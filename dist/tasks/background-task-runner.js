import { appendTranscriptEntry, createSystemEntry, createUserEntry, reduceTranscriptEntries } from "../agent/agent-transcript.js";
import { runAgentTurn } from "../agent/run-agent-turn.js";
import { buildAgentPromptContext, buildPromptContextMessages, mergeAgentTurnHistory } from "../memory/prompt-builder.js";
import { filterPersistedTranscript, getRecentSessionHistory } from "../storage/session-state.js";
import { appendAutoModeLog, AUTO_MODE_MAX_AGENT_STEPS, AUTO_MODE_MAX_TOOL_ACTIONS, AUTO_MODE_PROMPT_PLACEHOLDER, buildAutoModeCyclePrompt, collectChangedFilesFromToolCall, createAutoModeToolRegistry, createEmptyAutoModeState, updateAutoModeState } from "./auto-mode.js";
const DEFAULT_TASK_PREVIEW_LENGTH = 72;
export async function createBackgroundTaskRunner({ memoryStore, modelRuntime, sessionStore, taskStore, toolRegistry, workspaceRoot }) {
    const runner = new BackgroundTaskRunnerImpl({
        memoryStore,
        modelRuntime,
        sessionStore,
        taskStore,
        toolRegistry,
        workspaceRoot
    });
    await runner.initialize();
    return runner;
}
class BackgroundTaskRunnerImpl {
    options;
    listeners = new Set();
    removedTaskIds = new Set();
    runtimesById = new Map();
    tasksById = new Map();
    constructor(options) {
        this.options = options;
    }
    async initialize() {
        const tasks = await this.options.taskStore.listTasks();
        for (const task of tasks) {
            this.tasksById.set(task.id, task);
            this.scheduleNextRun(task);
        }
    }
    listTasks() {
        return [...this.tasksById.values()]
            .sort((left, right) => left.nextRunAt - right.nextRunAt)
            .map((task) => this.toTaskView(task));
    }
    getAutoMode() {
        const autoTask = this.findAutoTask();
        if (!autoTask) {
            return undefined;
        }
        return this.toAutoModeView(autoTask);
    }
    async scheduleTask(input) {
        const task = await this.options.taskStore.createTask({
            intervalMinutes: input.intervalMinutes,
            kind: "scheduled",
            prompt: input.prompt,
            sessionId: input.sessionId
        });
        this.tasksById.set(task.id, task);
        this.removedTaskIds.delete(task.id);
        this.scheduleNextRun(task);
        this.emit({ task: this.toTaskView(task), type: "task_updated" });
        return this.toTaskView(task);
    }
    async enableAutoMode(input) {
        const existing = this.findAutoTask();
        const nextRunAt = Date.now() + minutesToMilliseconds(input.intervalMinutes);
        const task = existing
            ? await this.options.taskStore.saveTask({
                ...existing,
                autoState: existing.autoState ?? createEmptyAutoModeState(),
                intervalMinutes: input.intervalMinutes,
                kind: "auto",
                lastError: undefined,
                nextRunAt,
                prompt: AUTO_MODE_PROMPT_PLACEHOLDER,
                sessionId: input.sessionId
            })
            : await this.options.taskStore.createTask({
                autoState: createEmptyAutoModeState(),
                intervalMinutes: input.intervalMinutes,
                kind: "auto",
                prompt: AUTO_MODE_PROMPT_PLACEHOLDER,
                sessionId: input.sessionId
            });
        this.tasksById.set(task.id, task);
        this.removedTaskIds.delete(task.id);
        this.scheduleNextRun(task);
        this.emit({ task: this.toTaskView(task), type: "task_updated" });
        return this.toAutoModeView(task);
    }
    async stopAutoMode() {
        const autoTask = this.findAutoTask();
        if (!autoTask) {
            return false;
        }
        const runtime = this.runtimesById.get(autoTask.id);
        if (runtime?.timer) {
            clearTimeout(runtime.timer);
        }
        this.removedTaskIds.add(autoTask.id);
        this.runtimesById.delete(autoTask.id);
        this.tasksById.delete(autoTask.id);
        await this.options.taskStore.deleteTask(autoTask.id);
        this.emit({
            taskId: autoTask.id,
            type: "task_removed"
        });
        return true;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    async close() {
        for (const runtime of this.runtimesById.values()) {
            if (runtime.timer) {
                clearTimeout(runtime.timer);
            }
        }
        this.runtimesById.clear();
        this.listeners.clear();
    }
    scheduleNextRun(task) {
        const runtime = this.ensureRuntime(task.id);
        if (runtime.timer) {
            clearTimeout(runtime.timer);
        }
        const delayMs = Math.max(0, task.nextRunAt - Date.now());
        runtime.timer = setTimeout(() => {
            void this.runTask(task.id);
        }, delayMs);
    }
    async runTask(taskId) {
        const task = this.tasksById.get(taskId);
        if (!task) {
            return;
        }
        const runtime = this.ensureRuntime(taskId);
        if (runtime.isRunning) {
            return;
        }
        runtime.isRunning = true;
        this.emit({
            task: this.toTaskView(task),
            type: "task_updated"
        });
        const runStartedAt = Date.now();
        let updatedTask = task;
        let updatedSession;
        try {
            const session = await this.options.sessionStore.loadSession(task.sessionId);
            if (!session) {
                throw new Error(`Session "${task.sessionId}" was not found.`);
            }
            const execution = await this.runTaskCycle(task, session, runStartedAt);
            updatedTask = execution.task;
            updatedSession = execution.session;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Scheduled task failed.";
            updatedTask = await this.options.taskStore.saveTask({
                ...task,
                lastError: message,
                lastRunAt: Date.now(),
                nextRunAt: runStartedAt + minutesToMilliseconds(task.intervalMinutes),
                runCount: task.runCount + 1
            });
            const session = await this.options.sessionStore
                .loadSession(task.sessionId)
                .catch(() => undefined);
            if (session) {
                updatedSession = await this.options.sessionStore.saveSession({
                    ...session,
                    transcript: filterPersistedTranscript(appendTranscriptEntry(session.transcript, createSystemEntry(`${createTaskFailurePrefix(task)} ${message}`, true)))
                });
            }
            if (task.kind === "auto") {
                await appendAutoModeLog({
                    changedFiles: [],
                    cycleNumber: task.runCount + 1,
                    error: message,
                    intervalMinutes: task.intervalMinutes,
                    sessionId: task.sessionId,
                    summary: "Auto mode cycle failed.",
                    taskId: task.id,
                    timestamp: Date.now(),
                    workspaceRoot: this.options.workspaceRoot
                }).catch(() => undefined);
            }
        }
        finally {
            if (this.removedTaskIds.has(updatedTask.id)) {
                this.runtimesById.delete(updatedTask.id);
                return;
            }
            this.tasksById.set(updatedTask.id, updatedTask);
            runtime.isRunning = false;
            this.scheduleNextRun(updatedTask);
            this.emit({
                session: updatedSession,
                task: this.toTaskView(updatedTask),
                type: "task_updated"
            });
        }
    }
    async runTaskCycle(task, session, runStartedAt) {
        const cycleNumber = task.runCount + 1;
        const taskPrompt = task.kind === "auto"
            ? buildAutoModeCyclePrompt({
                session,
                task
            })
            : task.prompt;
        const displayPrompt = task.kind === "auto"
            ? `Auto mode cycle ${cycleNumber}: inspect the project and apply one meaningful improvement.`
            : task.prompt;
        const triggerMessage = task.kind === "auto"
            ? `Auto mode cycle ${cycleNumber} triggered.`
            : `Scheduled task ${task.id} triggered.`;
        const promptContext = await this.loadPromptContext(session, taskPrompt);
        const changedFiles = new Set();
        let transcript = appendTranscriptEntry(session.transcript, createSystemEntry(triggerMessage, true));
        transcript = appendTranscriptEntry(transcript, createUserEntry(displayPrompt));
        const result = await runAgentTurn({
            contextMessages: promptContext.contextMessages,
            history: promptContext.recentHistory,
            maxSteps: task.kind === "auto" ? AUTO_MODE_MAX_AGENT_STEPS : undefined,
            prompt: taskPrompt,
            model: this.options.modelRuntime.getClient(),
            toolRegistry: task.kind === "auto"
                ? createAutoModeToolRegistry(this.options.toolRegistry, {
                    maxActions: AUTO_MODE_MAX_TOOL_ACTIONS
                })
                : this.options.toolRegistry,
            onEvent: async (event) => {
                transcript = reduceTranscriptEntries(transcript, event, task.id);
                if (task.kind === "auto") {
                    recordAutoModeToolEffects(changedFiles, event);
                }
            }
        });
        const nextHistory = mergeAgentTurnHistory(session.history, promptContext.recentHistory, result.messages);
        const nextSession = await this.options.sessionStore.saveSession({
            ...session,
            history: nextHistory,
            transcript: filterPersistedTranscript(transcript)
        });
        if (task.kind === "scheduled") {
            await this.options.memoryStore.rememberFromUserMessage(task.prompt, {
                sessionId: task.sessionId
            });
            const nextTask = await this.options.taskStore.saveTask({
                ...task,
                lastError: undefined,
                lastResultSummary: summarizePreview(result.content),
                lastRunAt: Date.now(),
                nextRunAt: runStartedAt + minutesToMilliseconds(task.intervalMinutes),
                runCount: cycleNumber
            });
            return {
                session: nextSession,
                task: nextTask
            };
        }
        const nextAutoState = updateAutoModeState(task.autoState, {
            assistantContent: result.content,
            changedFiles: [...changedFiles],
            cycleNumber,
            timestamp: Date.now()
        });
        const nextTask = await this.options.taskStore.saveTask({
            ...task,
            autoState: nextAutoState,
            lastError: undefined,
            lastResultSummary: summarizePreview(result.content),
            lastRunAt: Date.now(),
            nextRunAt: runStartedAt + minutesToMilliseconds(task.intervalMinutes),
            runCount: cycleNumber
        });
        await appendAutoModeLog({
            changedFiles: [...changedFiles],
            cycleNumber,
            intervalMinutes: task.intervalMinutes,
            sessionId: task.sessionId,
            summary: nextAutoState.lastAction ?? summarizePreview(result.content),
            taskId: task.id,
            timestamp: Date.now(),
            workspaceRoot: this.options.workspaceRoot
        }).catch(() => undefined);
        return {
            session: nextSession,
            task: nextTask
        };
    }
    async loadPromptContext(session, prompt) {
        try {
            return await buildAgentPromptContext({
                history: session.history,
                memoryStore: this.options.memoryStore,
                prompt,
                sessionSummary: session.summary
            });
        }
        catch {
            return {
                contextMessages: buildPromptContextMessages({
                    memories: [],
                    sessionSummary: session.summary
                }),
                memories: [],
                recentHistory: getRecentSessionHistory(session.history)
            };
        }
    }
    findAutoTask() {
        return [...this.tasksById.values()].find((task) => task.kind === "auto");
    }
    ensureRuntime(taskId) {
        const existing = this.runtimesById.get(taskId);
        if (existing) {
            return existing;
        }
        const runtime = {
            isRunning: false
        };
        this.runtimesById.set(taskId, runtime);
        return runtime;
    }
    emit(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
    toTaskView(task) {
        return {
            ...task,
            isRunning: this.ensureRuntime(task.id).isRunning
        };
    }
    toAutoModeView(task) {
        return {
            intervalMinutes: task.intervalMinutes,
            isRunning: this.ensureRuntime(task.id).isRunning,
            lastAction: task.autoState?.lastAction ??
                task.lastResultSummary ??
                "Waiting for the first autonomous cycle.",
            lastError: task.lastError,
            lastRunAt: task.lastRunAt,
            nextRunAt: task.nextRunAt,
            runCount: task.runCount,
            sessionId: task.sessionId,
            taskId: task.id
        };
    }
}
function summarizePreview(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= DEFAULT_TASK_PREVIEW_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, DEFAULT_TASK_PREVIEW_LENGTH - 1)}…`;
}
function minutesToMilliseconds(minutes) {
    return minutes * 60_000;
}
function createTaskFailurePrefix(task) {
    return task.kind === "auto"
        ? `Auto mode cycle ${task.runCount + 1} failed:`
        : `Background task ${task.id} failed:`;
}
function recordAutoModeToolEffects(changedFiles, event) {
    if (event.type !== "tool_started" && event.type !== "tool_finished") {
        return;
    }
    for (const filePath of collectChangedFilesFromToolCall(event.toolCall)) {
        changedFiles.add(filePath);
    }
}
