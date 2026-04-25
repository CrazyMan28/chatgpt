import { appendTranscriptEntry, createSystemEntry, createUserEntry, reduceTranscriptEntries } from "../agent/agent-transcript.js";
import { AgentControlError, runAgentTurn } from "../agent/run-agent-turn.js";
import { runWithRateLimitRecovery } from "../agent/rate-limit-recovery.js";
import { buildAgentPromptContext, mergeAgentTurnHistory } from "../memory/prompt-builder.js";
import { buildExecutionModeContextMessage } from "../modes/execution-mode.js";
import { buildResponseModeContextMessage, isResponseMode } from "../modes/response-mode.js";
import { createInitialSessionState, filterPersistedTranscript } from "../storage/session-state.js";
import { createExecutionModeToolRegistry } from "../tools/execution-mode-tool-registry.js";
const DEFAULT_MAX_AGENTS = 8;
const MAX_RECENT_OUTPUT = 8;
export function createFleetManager(dependencies) {
    return new FleetManagerImpl(dependencies);
}
export function detectFleetDelegationIntent(prompt) {
    return /\b(sub-?agent|delegate(?:\s+this)?|fleet)\b/i.test(prompt);
}
export function inferFleetRoleFromPrompt(prompt) {
    const normalized = prompt.toLowerCase();
    if (/\b(frontend|ui|ux|css|react)\b/.test(normalized)) {
        return "frontend";
    }
    if (/\b(backend|api|server|database|db)\b/.test(normalized)) {
        return "backend";
    }
    if (/\b(test|testing|qa|verify|validation)\b/.test(normalized)) {
        return "tester";
    }
    if (/\b(doc|docs|readme|documentation)\b/.test(normalized)) {
        return "docs";
    }
    return "general";
}
class FleetManagerImpl {
    dependencies;
    agents = new Map();
    listeners = new Set();
    locks = new Map();
    runtimes = new Map();
    enabled = false;
    constructor(dependencies) {
        this.dependencies = dependencies;
        for (const agent of dependencies.initialAgents ?? []) {
            const restoredAgent = normalizeRecoveredAgent(agent);
            this.agents.set(restoredAgent.id, restoredAgent);
            this.runtimes.set(restoredAgent.id, createRuntimeState(restoredAgent));
            for (const lockKey of restoredAgent.lockKeys) {
                this.locks.set(lockKey, {
                    createdAt: restoredAgent.createdAt,
                    id: `${restoredAgent.id}:${lockKey}`,
                    ownerId: restoredAgent.id,
                    resource: lockKey,
                    type: lockKey.includes("/") || lockKey.includes(".") ? "file" : "task"
                });
            }
            void this.persistAgent(restoredAgent);
        }
    }
    getAgent(id) {
        return this.agents.get(id);
    }
    isEnabled() {
        return this.enabled;
    }
    start() {
        this.enabled = true;
        this.emit();
        for (const agent of this.agents.values()) {
            if (agent.state === "queued" || agent.state === "waiting") {
                const runtime = this.ensureRuntime(agent.id, agent);
                void this.runAgent(agent, runtime.mode, runtime.style);
            }
        }
    }
    async stop() {
        this.enabled = false;
        for (const agent of this.agents.values()) {
            if (agent.state === "running") {
                this.updateAgent(agent.id, {
                    requestedAction: "stop",
                    summary: "Fleet stop requested."
                });
                continue;
            }
            if (agent.state === "queued" ||
                agent.state === "waiting" ||
                agent.state === "paused") {
                const nextAgent = {
                    ...agent,
                    blockers: agent.blockers ?? [],
                    requestedAction: undefined,
                    state: "cancelled",
                    summary: agent.summary ?? "Cancelled before execution.",
                    updatedAt: Date.now()
                };
                this.agents.set(agent.id, nextAgent);
                this.releaseLocks(agent.id);
                await this.persistAgent(nextAgent);
            }
        }
        this.emit();
    }
    listAgents() {
        return [...this.agents.values()].sort((left, right) => right.updatedAt - left.updatedAt);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    async assign(input) {
        if (!this.enabled) {
            throw new Error("Fleet mode is not running. Use /fleet start first.");
        }
        const activeAgents = this.listAgents().filter((agent) => agent.state === "queued" ||
            agent.state === "running" ||
            agent.state === "waiting");
        const maxConcurrentAgents = Math.max(1, this.dependencies.maxConcurrentAgents ?? DEFAULT_MAX_AGENTS);
        if (activeAgents.length >= maxConcurrentAgents) {
            throw new Error(`Fleet is limited to ${maxConcurrentAgents} concurrent sub-agents.`);
        }
        const lockKeys = detectLockKeys(input.task);
        for (const lockKey of lockKeys) {
            const existing = this.locks.get(lockKey);
            if (existing) {
                throw new Error(`Fleet task conflict: "${lockKey}" is already locked by ${existing.ownerId}.`);
            }
        }
        const workerSession = await this.dependencies.sessionStore.createSession(createInitialSessionState());
        const now = Date.now();
        const scopedToolRegistry = createExecutionModeToolRegistry(this.dependencies.toolRegistry, input.mode);
        const agent = {
            allowedToolNames: scopedToolRegistry
                .listTools()
                .map((tool) => tool.name)
                .sort(),
            blockers: [],
            changedFiles: [],
            contextSnapshot: {
                executionMode: input.mode,
                responseMode: input.style
            },
            createdAt: now,
            currentCwd: process.cwd(),
            currentScope: "workspace",
            id: createFleetAgentId(),
            lockKeys,
            parentSessionId: input.parentSessionId,
            recentOutput: [],
            role: input.role,
            state: "queued",
            task: input.task.trim(),
            updatedAt: now,
            workerSessionId: workerSession.id
        };
        this.agents.set(agent.id, agent);
        this.runtimes.set(agent.id, {
            isRunning: false,
            mode: input.mode,
            style: input.style
        });
        await this.persistAgent(agent);
        this.acquireLocks(agent);
        this.emit();
        void this.runAgent(agent, input.mode, input.style);
        return agent;
    }
    async pauseAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            return undefined;
        }
        const runtime = this.ensureRuntime(id, agent);
        if (runtime.isRunning) {
            return this.saveUpdatedAgent(id, {
                blockers: uniqStrings([...(agent.blockers ?? []), "Pause requested by user."]),
                requestedAction: "pause",
                summary: "Pause requested."
            });
        }
        return this.saveUpdatedAgent(id, {
            blockers: uniqStrings([...(agent.blockers ?? []), "Paused by user."]),
            requestedAction: undefined,
            state: "paused",
            summary: "Paused."
        });
    }
    async resumeAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            return undefined;
        }
        const runtime = this.ensureRuntime(id, agent);
        const nextState = this.enabled ? "queued" : "waiting";
        const updated = await this.saveUpdatedAgent(id, {
            blockers: [],
            error: undefined,
            requestedAction: undefined,
            state: nextState,
            summary: this.enabled ? "Queued to resume." : "Waiting for fleet start."
        });
        if (updated && this.enabled && !runtime.isRunning) {
            void this.runAgent(updated, runtime.mode, runtime.style);
        }
        return updated;
    }
    async stopAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            return undefined;
        }
        const runtime = this.ensureRuntime(id, agent);
        if (runtime.isRunning) {
            return this.saveUpdatedAgent(id, {
                blockers: uniqStrings([...(agent.blockers ?? []), "Stop requested by user."]),
                requestedAction: "stop",
                summary: "Stop requested."
            });
        }
        const updated = await this.saveUpdatedAgent(id, {
            blockers: uniqStrings([...(agent.blockers ?? []), "Stopped by user."]),
            requestedAction: undefined,
            state: "cancelled",
            summary: "Stopped."
        });
        this.releaseLocks(id);
        return updated;
    }
    async restartAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            return undefined;
        }
        const runtime = this.ensureRuntime(id, agent);
        if (runtime.isRunning) {
            return this.saveUpdatedAgent(id, {
                blockers: [],
                error: undefined,
                requestedAction: "restart",
                summary: "Restart requested."
            });
        }
        const nextState = this.enabled ? "queued" : "waiting";
        const updated = await this.saveUpdatedAgent(id, {
            blockers: [],
            changedFiles: [],
            error: undefined,
            recentOutput: [],
            requestedAction: undefined,
            state: nextState,
            summary: this.enabled ? "Queued to restart." : "Waiting for fleet start."
        });
        if (updated && this.enabled && !runtime.isRunning) {
            this.acquireLocks(updated);
            void this.runAgent(updated, runtime.mode, runtime.style);
        }
        return updated;
    }
    async runAgent(agent, mode, style) {
        const runtime = this.ensureRuntime(agent.id, agent, mode, style);
        if (runtime.isRunning) {
            return;
        }
        runtime.isRunning = true;
        this.acquireLocks(agent);
        const blockers = new Set();
        const changedFiles = new Set();
        this.updateAgent(agent.id, {
            blockers: [],
            currentCwd: process.cwd(),
            currentScope: "workspace",
            requestedAction: undefined,
            state: "running",
            summary: `Running ${agent.role} task`
        });
        let nextAgent = this.agents.get(agent.id) ?? agent;
        try {
            const session = (await this.dependencies.sessionStore.loadSession(agent.workerSessionId ?? agent.parentSessionId)) ??
                (await this.dependencies.sessionStore.createSession(createInitialSessionState()));
            const prompt = buildFleetPrompt(agent.role, agent.task);
            const promptContext = await buildAgentPromptContext({
                history: session.history,
                memoryStore: this.dependencies.memoryStore,
                prompt,
                sessionSummary: session.summary,
                systemMessages: [
                    buildExecutionModeContextMessage(mode),
                    buildResponseModeContextMessage(style)
                ]
            });
            let transcript = appendTranscriptEntry(session.transcript, createUserEntry(prompt));
            const result = await runWithRateLimitRecovery({
                run: async () => runAgentTurn({
                    contextMessages: promptContext.contextMessages,
                    history: promptContext.recentHistory,
                    maxSteps: mode === "plan" ? 10 : 18,
                    model: this.dependencies.modelRuntime.getClient(),
                    onEvent: async (event) => {
                        transcript = reduceTranscriptEntries(transcript, event, Date.now());
                        if (event.type === "tool_finished") {
                            for (const path of extractChangedFiles(event)) {
                                changedFiles.add(path);
                            }
                            if (event.result.isError) {
                                blockers.add(summarizeText(event.result.content));
                            }
                        }
                        this.updateAgent(agent.id, {
                            blockers: [...blockers].sort(),
                            changedFiles: [...changedFiles].sort(),
                            currentCwd: process.cwd(),
                            currentScope: "workspace",
                            recentOutput: appendRecentOutput(this.agents.get(agent.id)?.recentOutput, describeFleetEvent(event)),
                            summary: describeFleetSummary(event)
                        });
                    },
                    prompt,
                    shouldContinue: () => this.readControlDecision(agent.id),
                    toolRegistry: createExecutionModeToolRegistry(this.dependencies.toolRegistry, mode)
                })
            });
            const nextHistory = mergeAgentTurnHistory(session.history, promptContext.recentHistory, result.messages);
            await this.dependencies.sessionStore.saveSession({
                ...session,
                history: nextHistory,
                transcript: filterPersistedTranscript(transcript)
            });
            nextAgent =
                (await this.saveUpdatedAgent(agent.id, {
                    blockers: [...blockers].sort(),
                    changedFiles: [...changedFiles].sort(),
                    error: undefined,
                    requestedAction: undefined,
                    state: "complete",
                    summary: summarizeText(result.content)
                })) ?? nextAgent;
        }
        catch (error) {
            const current = this.agents.get(agent.id) ?? agent;
            const requestedAction = current.requestedAction;
            if (error instanceof AgentControlError) {
                const nextState = requestedAction === "pause"
                    ? "paused"
                    : requestedAction === "restart"
                        ? this.enabled
                            ? "queued"
                            : "waiting"
                        : "cancelled";
                const nextSummary = requestedAction === "pause"
                    ? "Paused."
                    : requestedAction === "restart"
                        ? this.enabled
                            ? "Restarting."
                            : "Waiting for fleet start."
                        : "Stopped.";
                nextAgent =
                    (await this.saveUpdatedAgent(agent.id, {
                        blockers: nextState === "paused"
                            ? uniqStrings([...(current.blockers ?? []), "Paused by user."])
                            : [],
                        changedFiles: [...changedFiles].sort(),
                        error: undefined,
                        requestedAction: undefined,
                        state: nextState,
                        summary: nextSummary
                    })) ?? nextAgent;
                if (requestedAction === "restart" && this.enabled) {
                    runtime.isRunning = false;
                    void this.runAgent(nextAgent, mode, style);
                    return;
                }
            }
            else {
                nextAgent =
                    (await this.saveUpdatedAgent(agent.id, {
                        blockers: [...blockers].sort(),
                        changedFiles: [...changedFiles].sort(),
                        error: error instanceof Error ? error.message : "Sub-agent failed.",
                        requestedAction: undefined,
                        state: "failed",
                        summary: "Sub-agent failed"
                    })) ?? nextAgent;
            }
        }
        finally {
            runtime.isRunning = false;
            if (nextAgent.state === "complete" ||
                nextAgent.state === "failed" ||
                nextAgent.state === "cancelled") {
                this.releaseLocks(agent.id);
            }
        }
    }
    readControlDecision(agentId) {
        const action = this.agents.get(agentId)?.requestedAction;
        if (action === "pause") {
            return {
                ok: false,
                reason: "Paused by user.",
                state: "paused"
            };
        }
        if (action === "stop" || action === "restart") {
            return {
                ok: false,
                reason: action === "restart" ? "Restart requested." : "Stopped by user.",
                state: "cancelled"
            };
        }
        return {
            ok: true
        };
    }
    ensureRuntime(agentId, agent, mode, style) {
        const existing = this.runtimes.get(agentId);
        if (existing) {
            if (mode) {
                existing.mode = mode;
            }
            if (style) {
                existing.style = style;
            }
            return existing;
        }
        const runtime = {
            isRunning: false,
            mode: mode ?? deriveAgentMode(agent),
            style: style ?? deriveResponseMode(agent)
        };
        this.runtimes.set(agentId, runtime);
        return runtime;
    }
    acquireLocks(agent) {
        for (const lockKey of agent.lockKeys) {
            this.locks.set(lockKey, {
                createdAt: agent.createdAt,
                id: `${agent.id}:${lockKey}`,
                ownerId: agent.id,
                resource: lockKey,
                type: lockKey.includes("/") || lockKey.includes(".") ? "file" : "task"
            });
        }
    }
    releaseLocks(agentId) {
        for (const [lockKey, lock] of this.locks.entries()) {
            if (lock.ownerId === agentId) {
                this.locks.delete(lockKey);
            }
        }
    }
    updateAgent(agentId, patch) {
        const current = this.agents.get(agentId);
        if (!current) {
            return;
        }
        const nextAgent = {
            ...current,
            ...patch,
            updatedAt: Date.now()
        };
        this.agents.set(agentId, nextAgent);
        void this.persistAgent(nextAgent);
        this.emit();
    }
    async saveUpdatedAgent(agentId, patch) {
        const current = this.agents.get(agentId);
        if (!current) {
            return undefined;
        }
        const nextAgent = {
            ...current,
            ...patch,
            updatedAt: Date.now()
        };
        this.agents.set(agentId, nextAgent);
        await this.persistAgent(nextAgent);
        this.emit();
        return nextAgent;
    }
    emit() {
        const agents = this.listAgents();
        for (const listener of this.listeners) {
            listener(agents);
        }
    }
    async persistAgent(agent) {
        if (!agent || !this.dependencies.fleetStore) {
            return;
        }
        await this.dependencies.fleetStore.saveAgent(agent);
    }
}
function createFleetAgentId() {
    return `agent-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}
function createRuntimeState(agent) {
    return {
        isRunning: false,
        mode: deriveAgentMode(agent),
        style: deriveResponseMode(agent)
    };
}
function normalizeRecoveredAgent(agent) {
    if (agent.state !== "queued" && agent.state !== "running") {
        return {
            ...agent,
            currentCwd: agent.currentCwd ?? process.cwd(),
            currentScope: agent.currentScope ?? "workspace",
            recentOutput: agent.recentOutput ?? []
        };
    }
    return {
        ...agent,
        currentCwd: agent.currentCwd ?? process.cwd(),
        currentScope: agent.currentScope ?? "workspace",
        recentOutput: agent.recentOutput ?? [],
        state: "waiting",
        summary: agent.summary ?? "Recovered from persisted fleet state.",
        updatedAt: Date.now()
    };
}
function buildFleetPrompt(role, task) {
    return [
        `You are a scoped ${role} sub-agent working on one bounded task.`,
        "Use only the tools and mode available in this run.",
        "Do not branch into unrelated work.",
        "Do not revert work from other agents. Adjust to changes already present in the repo.",
        "Return a concise summary of what you completed, what changed, and any blockers.",
        "",
        `Task: ${task}`
    ].join("\n");
}
function deriveAgentMode(agent) {
    const mode = agent?.contextSnapshot?.executionMode;
    return mode === "normal" || mode === "plan" || mode === "build"
        ? mode
        : "build";
}
function deriveResponseMode(agent) {
    const mode = agent?.contextSnapshot?.responseMode;
    return typeof mode === "string" && isResponseMode(mode) ? mode : "normal";
}
function detectLockKeys(task) {
    const keys = new Set();
    const normalizedTask = task.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalizedTask.length > 0) {
        keys.add(`task:${normalizedTask}`);
    }
    for (const match of task.matchAll(/\b(?:\.\/)?[\w./-]+\.[A-Za-z0-9]+\b/g)) {
        keys.add(`file:${match[0]}`);
    }
    return [...keys];
}
function extractChangedFiles(event) {
    const files = new Set();
    const combined = `${event.result.content}\n${event.toolCall.name}`;
    for (const match of combined.matchAll(/(?:Wrote .* to |Path: )([^\n.]+(?:\.[A-Za-z0-9_-]+)?)/g)) {
        const value = match[1]?.trim();
        if (value && value !== ".") {
            files.add(value);
        }
    }
    if (event.toolCall.name === "write_file") {
        const rawPath = event.toolCall.arguments.path;
        if (typeof rawPath === "string" && rawPath.trim().length > 0) {
            files.add(rawPath.trim());
        }
    }
    return [...files];
}
function describeFleetSummary(event) {
    switch (event.type) {
        case "status":
            return event.phase === "thinking"
                ? "Thinking"
                : event.phase === "running_tool"
                    ? "Running tool"
                    : event.phase === "streaming"
                        ? "Streaming response"
                        : "Ready";
        case "tool_started":
            return `Running ${event.toolCall.name}`;
        case "tool_finished":
            return `${event.toolCall.name} ${event.result.isError ? "failed" : "completed"}`;
        case "assistant_stream_started":
        case "assistant_stream_delta":
            return "Streaming response";
        case "assistant_stream_completed":
            return "Finalizing response";
        default:
            return "Running";
    }
}
function describeFleetEvent(event) {
    switch (event.type) {
        case "status":
            return `step ${event.step}: ${describeFleetSummary(event)}`;
        case "tool_started":
            return `tool ${event.toolCall.name} started`;
        case "tool_finished":
            return `tool ${event.toolCall.name} ${event.result.isError ? "failed" : "completed"}`;
        case "assistant_stream_started":
            return "assistant response started";
        case "assistant_stream_delta":
            return "assistant response streaming";
        case "assistant_stream_completed":
            return "assistant response completed";
        default:
            return "agent updated";
    }
}
function appendRecentOutput(existing, message) {
    const next = [...(existing ?? [])];
    if (message.trim().length === 0) {
        return next;
    }
    if (next[next.length - 1] === message) {
        return next;
    }
    next.push(message);
    while (next.length > MAX_RECENT_OUTPUT) {
        next.shift();
    }
    return next;
}
function summarizeText(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= 96) {
        return normalized || "Completed.";
    }
    return `${normalized.slice(0, 95)}…`;
}
function uniqStrings(values) {
    return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}
//# sourceMappingURL=fleet-manager.js.map