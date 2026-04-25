import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { Box, useWindowSize } from "ink";
import { appendTranscriptEntry, createSystemEntry, createUserEntry, reduceTranscriptEntries } from "../agent/agent-transcript.js";
import { runAgentTurn } from "../agent/run-agent-turn.js";
import { buildPromptContextMessages, buildAgentPromptContext, mergeAgentTurnHistory } from "../memory/prompt-builder.js";
import { buildExecutionModeContextMessage, DEFAULT_EXECUTION_MODE, formatExecutionModeLabel } from "../modes/execution-mode.js";
import { buildResponseModeContextMessage, formatResponseModeLabel } from "../modes/response-mode.js";
import { isModelProvider } from "../models/model-client.js";
import { buildPlanConfirmationMessage, buildPlanExecutionPrompt, buildProjectPlanPrompt, formatPlanForTranscript, readPlanDocument, writePlanDocument } from "../plan/plan-workflow.js";
import { formatMcpReloadSummary, formatMcpServerList } from "../mcp/mcp-manager.js";
import { formatMarketplaceInfo, formatMarketplaceList, getMarketplaceEntry, listMarketplaceEntries } from "../mcp/mcp-marketplace.js";
import { createInitialSessionState, filterPersistedTranscript, getRecentSessionHistory } from "../storage/session-state.js";
import { createExecutionModeToolRegistry, filterToolsForExecutionMode } from "../tools/execution-mode-tool-registry.js";
import { formatHelpMessage, formatModelList, formatModeMessage, formatSessionList, formatTaskList, parseAppCommand } from "./commands.js";
import { FlowPanel } from "./components/flow-panel.js";
import { Header } from "./components/header.js";
import { InputBar } from "./components/input-bar.js";
import { advanceFlow, createFlow, formatFlowStepLabel, getActiveFlowStep, getFlowOptions, moveFlowSelection, primeFlow, resolveFlowDescription, resolveFlowPlaceholder, resolveFlowTitle, snapshotFlowState } from "./flow-engine.js";
import { OutputPanel } from "./components/output-panel.js";
import { Sidebar } from "./components/sidebar.js";
import { AppRuntimeStateProvider, toAppRuntimeState } from "./runtime-state.js";
import { calculateTuiLayout } from "./theme.js";
const DEFAULT_TOOL_SUMMARY = "No tool activity yet.";
const MAX_TOOL_ACTIVITY = 6;
const MAX_TOOL_SUMMARY_LENGTH = 72;
const DEFAULT_RESPONSE_MODE = "normal";
export function App({ initialSession, memoryStore, mcpManager, modelRuntime, sessionStore, taskRunner, toolRegistry, workspaceRoot }) {
    const windowSize = useWindowSize();
    const layout = calculateTuiLayout(windowSize.columns, windowSize.rows);
    const [tools, setTools] = useState(() => toolRegistry.listTools());
    const [composerValue, setComposerValue] = useState("");
    const [composerFlow, setComposerFlow] = useState({
        type: "idle"
    });
    const [activeFlow, setActiveFlow] = useState(null);
    const [currentSession, setCurrentSession] = useState(initialSession);
    const [appState, setAppState] = useState(() => toAppRuntimeState(modelRuntime.getSnapshot()));
    const [executionMode, setExecutionMode] = useState(DEFAULT_EXECUTION_MODE);
    const [mode, setMode] = useState(DEFAULT_RESPONSE_MODE);
    const [phase, setPhase] = useState("ready");
    const [step, setStep] = useState(0);
    const [tasks, setTasks] = useState(() => taskRunner.listTasks());
    const [now, setNow] = useState(() => Date.now());
    const [toolActivity, setToolActivity] = useState([]);
    const [lastToolSummary, setLastToolSummary] = useState(DEFAULT_TOOL_SUMMARY);
    const [transcript, setTranscript] = useState(() => initialSession.transcript);
    const [workflowState, setWorkflowState] = useState(createIdleWorkflowState());
    const executionScopedTools = filterToolsForExecutionMode(tools, executionMode);
    const deferredTools = useDeferredValue(executionScopedTools);
    const toolSignatureRef = useRef(createToolSignature(tools));
    const disposedRef = useRef(false);
    const composerFlowRef = useRef({
        type: "idle"
    });
    const activeFlowRef = useRef(null);
    const currentTurnIdRef = useRef(0);
    const currentSessionRef = useRef(initialSession);
    const appStateRef = useRef(toAppRuntimeState(modelRuntime.getSnapshot()));
    const executionModeRef = useRef(DEFAULT_EXECUTION_MODE);
    const modeRef = useRef(DEFAULT_RESPONSE_MODE);
    const historyRef = useRef(initialSession.history);
    const transcriptRef = useRef(initialSession.transcript);
    const phaseRef = useRef("ready");
    const stepRef = useRef(0);
    const toolActivityRef = useRef([]);
    const lastToolSummaryRef = useRef(DEFAULT_TOOL_SUMMARY);
    const workflowStateRef = useRef(createIdleWorkflowState());
    const taskCount = tasks.length;
    const runningTaskCount = tasks.filter((task) => task.isRunning).length;
    const autoTask = tasks.find((task) => task.kind === "auto");
    const activeToolCount = toolActivity.filter((tool) => tool.status === "running").length;
    const autoModeLabel = createAutoModeLabel(autoTask);
    const autoModeLastAction = autoTask?.autoState?.lastAction ??
        autoTask?.lastResultSummary ??
        (autoTask ? "Waiting for the first autonomous cycle." : "Auto mode is off.");
    const autoModeNextRunLabel = formatAutoModeNextRun(autoTask, now);
    const executionModeLabel = formatExecutionModeLabel(executionMode);
    const isBusy = phase !== "ready";
    const isStreaming = phase === "streaming";
    useEffect(() => {
        const syncTools = () => {
            const nextTools = toolRegistry.listTools();
            const nextSignature = createToolSignature(nextTools);
            if (nextSignature === toolSignatureRef.current) {
                return;
            }
            toolSignatureRef.current = nextSignature;
            startTransition(() => {
                setTools(nextTools);
            });
        };
        syncTools();
        const interval = setInterval(syncTools, 750);
        return () => {
            clearInterval(interval);
        };
    }, [toolRegistry]);
    useEffect(() => {
        return () => {
            disposedRef.current = true;
        };
    }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1_000);
        return () => {
            clearInterval(interval);
        };
    }, []);
    useEffect(() => {
        return taskRunner.subscribe((event) => {
            if (disposedRef.current) {
                return;
            }
            startTransition(() => {
                setTasks(taskRunner.listTasks());
                if (event.type === "task_updated" &&
                    event.session &&
                    event.session.id === currentSessionRef.current.id &&
                    phaseRef.current === "ready") {
                    replaceSessionState(event.session);
                }
            });
        });
    }, [taskRunner]);
    useEffect(() => {
        return modelRuntime.subscribe((snapshot) => {
            if (disposedRef.current) {
                return;
            }
            commitAppState(toAppRuntimeState(snapshot));
        });
    }, [modelRuntime]);
    useEffect(() => {
        emitAppDebugLog(`UI provider: ${appState.provider}`);
        emitAppDebugLog(`UI model: ${appState.model}`);
    }, [appState.model, appState.provider]);
    useEffect(() => {
        if (!activeFlow) {
            return;
        }
        const step = getActiveFlowStep(activeFlow.flow);
        if (step.inputType !== "text") {
            setComposerValue("");
            return;
        }
        const nextValue = activeFlow.flow.state[step.key];
        setComposerValue(typeof nextValue === "string" ? nextValue : "");
    }, [activeFlow?.flow.stepIndex, activeFlow?.id]);
    const commitCurrentSession = (nextSession) => {
        currentSessionRef.current = nextSession;
        setCurrentSession(nextSession);
    };
    const commitComposerFlow = (nextFlow) => {
        composerFlowRef.current = nextFlow;
        setComposerFlow(nextFlow);
    };
    const commitActiveFlow = (nextFlow) => {
        activeFlowRef.current = nextFlow;
        setActiveFlow(nextFlow);
    };
    const commitAppState = (nextAppState) => {
        const previousState = appStateRef.current;
        if (previousState.provider !== nextAppState.provider) {
            emitAppDebugLog(`Provider updated to ${nextAppState.provider}`);
        }
        if (previousState.model !== nextAppState.model) {
            emitAppDebugLog(`Model updated to ${nextAppState.model}`);
        }
        if (previousState.loginLabel !== nextAppState.loginLabel) {
            emitAppDebugLog(`Login status updated to ${nextAppState.loginLabel}`);
        }
        appStateRef.current = nextAppState;
        setAppState(nextAppState);
    };
    const commitExecutionMode = (nextMode) => {
        executionModeRef.current = nextMode;
        setExecutionMode(nextMode);
    };
    const commitMode = (nextMode) => {
        modeRef.current = nextMode;
        setMode(nextMode);
    };
    const commitHistory = (nextHistory) => {
        historyRef.current = nextHistory.map((message) => ({ ...message }));
    };
    const commitTranscript = (nextTranscript) => {
        transcriptRef.current = nextTranscript;
        setTranscript(nextTranscript);
    };
    const commitPhase = (nextPhase) => {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
    };
    const commitStep = (nextStep) => {
        stepRef.current = nextStep;
        setStep(nextStep);
    };
    const commitToolActivity = (nextToolActivity) => {
        toolActivityRef.current = nextToolActivity;
        setToolActivity(nextToolActivity);
    };
    const commitLastToolSummary = (nextSummary) => {
        lastToolSummaryRef.current = nextSummary;
        setLastToolSummary(nextSummary);
    };
    const commitWorkflowState = (nextWorkflowState) => {
        workflowStateRef.current = nextWorkflowState;
        setWorkflowState(nextWorkflowState);
    };
    const replaceSessionState = (session) => {
        currentTurnIdRef.current += 1;
        commitCurrentSession(session);
        commitHistory(session.history);
        commitTranscript(session.transcript);
        commitActiveFlow(null);
        commitComposerFlow({ type: "idle" });
        commitPhase("ready");
        commitStep(0);
        commitToolActivity([]);
        commitLastToolSummary(DEFAULT_TOOL_SUMMARY);
        commitWorkflowState(createIdleWorkflowState());
    };
    const appendSystemMessage = (content, persisted = false) => {
        const nextTranscript = appendTranscriptEntry(transcriptRef.current, createSystemEntry(content, persisted));
        commitTranscript(nextTranscript);
        return nextTranscript;
    };
    const persistSessionSnapshot = async () => {
        const savedSession = await sessionStore.saveSession({
            ...currentSessionRef.current,
            history: [...historyRef.current],
            transcript: filterPersistedTranscript(transcriptRef.current)
        });
        if (disposedRef.current) {
            return;
        }
        startTransition(() => {
            commitCurrentSession(savedSession);
        });
    };
    const beginLoginFlow = () => {
        const providers = modelRuntime.listProviders();
        const loginFlow = primeFlow(createFlow("Login", createLoginFlowSteps(providers)));
        commitActiveFlow({
            id: "login",
            flow: loginFlow
        });
        setComposerValue("");
    };
    const beginMcpAddFlow = () => {
        const draft = createDefaultMcpDraft();
        const flow = primeFlow(createFlow("MCP Add", createMcpDraftFlowSteps("add")));
        commitActiveFlow({
            draft,
            id: "mcp_add",
            flow
        });
        setComposerValue("");
    };
    const beginMcpEditFlow = (server) => {
        if (!server) {
            return;
        }
        const draft = createDraftFromManagedServer(server);
        const flow = primeFlow(createFlow("MCP Edit", createMcpDraftFlowSteps("edit"), {
            ...draft,
            args: draft.args.join(" "),
            env: formatStringRecord(draft.env),
            headers: formatStringRecord(draft.headers),
            tools: draft.tools.join(", ")
        }));
        commitActiveFlow({
            draft,
            flow,
            id: "mcp_edit",
            originalName: server.name
        });
        setComposerValue("");
    };
    const beginMarketplaceInstallFlow = (name, draft, prompts = []) => {
        const promptState = Object.fromEntries(prompts.map((prompt) => {
            const existingValue = prompt.target === "env"
                ? draft.env[prompt.key]
                : draft.headers[prompt.key];
            return [createMarketplacePromptStateKey(prompt), existingValue ?? ""];
        }));
        const flow = primeFlow(createFlow("MCP Install", createMarketplaceInstallFlowSteps(draft, prompts), {
            ...draft,
            args: draft.args.join(" "),
            env: formatStringRecord(draft.env),
            headers: formatStringRecord(draft.headers),
            tools: draft.tools.join(", "),
            url: draft.url ?? "",
            ...promptState
        }));
        commitActiveFlow({
            draft,
            flow,
            id: "mcp_install",
            installName: name,
            prompts
        });
        setComposerValue("");
    };
    const handleCommand = async (input) => {
        const command = parseAppCommand(input);
        if (!command) {
            return false;
        }
        try {
            switch (command.type) {
                case "help":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatHelpMessage());
                        });
                    }
                    return true;
                case "login":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            beginLoginFlow();
                        });
                    }
                    return true;
                case "models": {
                    emitAppDebugLog("/models handled");
                    const models = await modelRuntime.listModels();
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatModelList(models, modelRuntime.getSnapshot()));
                        });
                    }
                    return true;
                }
                case "model": {
                    emitAppDebugLog(`/model handled with requested model=${command.model}`);
                    const snapshot = await modelRuntime.setModel(command.model);
                    if (!disposedRef.current) {
                        commitAppState(toAppRuntimeState(snapshot));
                        startTransition(() => {
                            appendSystemMessage(`Active model set to ${snapshot.model} on ${snapshot.providerLabel}.`);
                        });
                    }
                    return true;
                }
                case "mcp_add":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            beginMcpAddFlow();
                        });
                    }
                    return true;
                case "mcp_list": {
                    const servers = await mcpManager.listServers();
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMcpServerList(servers));
                        });
                    }
                    return true;
                }
                case "mcp_marketplace":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMarketplaceList(listMarketplaceEntries()));
                        });
                    }
                    return true;
                case "mcp_info": {
                    const entry = getMarketplaceEntry(command.name);
                    if (!entry) {
                        if (!disposedRef.current) {
                            startTransition(() => {
                                appendSystemMessage(`Marketplace entry "${command.name}" was not found.`);
                            });
                        }
                        return true;
                    }
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMarketplaceInfo(entry));
                        });
                    }
                    return true;
                }
                case "mcp_install": {
                    const entry = getMarketplaceEntry(command.name);
                    if (!entry) {
                        if (!disposedRef.current) {
                            startTransition(() => {
                                appendSystemMessage(`Marketplace entry "${command.name}" was not found.`);
                            });
                        }
                        return true;
                    }
                    if (!disposedRef.current) {
                        startTransition(() => {
                            beginMarketplaceInstallFlow(entry.name, {
                                ...entry.draft,
                                enabled: true,
                                name: entry.name
                            }, entry.prompts ?? []);
                        });
                    }
                    return true;
                }
                case "mcp_enable": {
                    const result = await mcpManager.enableServer(command.name);
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMcpReloadSummary(`Enabled MCP server "${command.name}".`, result));
                        });
                    }
                    return true;
                }
                case "mcp_disable": {
                    const result = await mcpManager.disableServer(command.name);
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMcpReloadSummary(`Disabled MCP server "${command.name}".`, result));
                        });
                    }
                    return true;
                }
                case "mcp_remove": {
                    const result = await mcpManager.removeServer(command.name);
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatMcpReloadSummary(`Removed MCP server "${command.name}".`, result));
                        });
                    }
                    return true;
                }
                case "mcp_edit": {
                    const server = await mcpManager.getServer(command.name);
                    if (!server) {
                        if (!disposedRef.current) {
                            startTransition(() => {
                                appendSystemMessage(`MCP server "${command.name}" was not found.`);
                            });
                        }
                        return true;
                    }
                    if (!disposedRef.current) {
                        startTransition(() => {
                            beginMcpEditFlow(server);
                        });
                    }
                    return true;
                }
                case "plan":
                    emitAppDebugLog("/plan handled");
                    await generateProjectPlan();
                    return true;
                case "build": {
                    emitAppDebugLog("/build handled");
                    const plan = await readPlanDocument(workspaceRoot);
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitComposerFlow({
                                plan,
                                type: "build_confirm"
                            });
                            appendSystemMessage(buildPlanConfirmationMessage(plan));
                        });
                    }
                    return true;
                }
                case "new": {
                    const session = await sessionStore.createSession(createInitialSessionState());
                    if (!disposedRef.current) {
                        startTransition(() => {
                            replaceSessionState(session);
                        });
                    }
                    return true;
                }
                case "list": {
                    const sessions = await sessionStore.listSessions();
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatSessionList(sessions, currentSessionRef.current.id));
                        });
                    }
                    return true;
                }
                case "tasks":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(formatTaskList(taskRunner.listTasks(), currentSessionRef.current.id));
                        });
                    }
                    return true;
                case "auto": {
                    const autoMode = await taskRunner.enableAutoMode({
                        intervalMinutes: command.intervalMinutes,
                        sessionId: currentSessionRef.current.id
                    });
                    if (!disposedRef.current) {
                        startTransition(() => {
                            setTasks(taskRunner.listTasks());
                            appendSystemMessage(`Auto mode enabled every ${autoMode.intervalMinutes} minutes for session ${autoMode.sessionId}.`);
                        });
                    }
                    return true;
                }
                case "auto_stop": {
                    const stopped = await taskRunner.stopAutoMode();
                    if (!disposedRef.current) {
                        startTransition(() => {
                            setTasks(taskRunner.listTasks());
                            appendSystemMessage(stopped ? "Auto mode stopped." : "Auto mode is not running.");
                        });
                    }
                    return true;
                }
                case "mode":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitMode(command.mode);
                            appendSystemMessage(formatModeMessage(command.mode));
                        });
                    }
                    return true;
                case "open": {
                    const session = await sessionStore.loadSession(command.id);
                    if (!session) {
                        if (!disposedRef.current) {
                            startTransition(() => {
                                appendSystemMessage(`Session "${command.id}" was not found.`);
                            });
                        }
                        return true;
                    }
                    if (!disposedRef.current) {
                        startTransition(() => {
                            replaceSessionState(session);
                        });
                    }
                    return true;
                }
                case "schedule": {
                    const task = await taskRunner.scheduleTask({
                        intervalMinutes: command.intervalMinutes,
                        prompt: command.prompt,
                        sessionId: currentSessionRef.current.id
                    });
                    if (!disposedRef.current) {
                        startTransition(() => {
                            setTasks(taskRunner.listTasks());
                            appendSystemMessage(`Scheduled task ${task.id} every ${task.intervalMinutes} minutes for session ${task.sessionId}.`);
                        });
                    }
                    return true;
                }
                case "invalid":
                    if (!disposedRef.current) {
                        startTransition(() => {
                            appendSystemMessage(command.message);
                        });
                    }
                    return true;
                default:
                    return assertNever(command);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Session command failed.";
            if (!disposedRef.current) {
                startTransition(() => {
                    appendSystemMessage(`Session error: ${message}`);
                });
            }
            return true;
        }
    };
    const handleComposerFlowInput = async (input) => {
        const trimmedInput = input.trim();
        const flowContext = activeFlowRef.current;
        const flow = composerFlowRef.current;
        if (!flowContext && flow.type === "idle") {
            return false;
        }
        if (trimmedInput === "/cancel") {
            if (!disposedRef.current) {
                startTransition(() => {
                    commitActiveFlow(null);
                    commitComposerFlow({ type: "idle" });
                    appendSystemMessage(flow.type === "build_confirm"
                        ? "Build cancelled."
                        : flowContext
                            ? "Flow cancelled."
                            : "Login cancelled.");
                });
            }
            return true;
        }
        if (flowContext) {
            const currentStep = getActiveFlowStep(flowContext.flow);
            const submittedValue = currentStep.inputType === "text" ? input : flowContext.flow.value;
            const validationError = validateFlowSubmission(currentStep.key, submittedValue);
            if (validationError) {
                if (!disposedRef.current) {
                    startTransition(() => {
                        appendSystemMessage(validationError);
                    });
                }
                return true;
            }
            const nextFlow = advanceFlow(flowContext.flow, submittedValue);
            if (nextFlow) {
                if (!disposedRef.current) {
                    startTransition(() => {
                        commitActiveFlow({
                            ...flowContext,
                            flow: nextFlow
                        });
                        setComposerValue("");
                    });
                }
                return true;
            }
            await completeActiveFlow({
                ...flowContext,
                flow: {
                    ...flowContext.flow,
                    state: snapshotFlowState(flowContext.flow)
                }
            });
            return true;
        }
        if (flow.type === "build_confirm") {
            const normalizedInput = trimmedInput.toLowerCase();
            if (!isBuildConfirmationInput(normalizedInput)) {
                if (!disposedRef.current) {
                    startTransition(() => {
                        appendSystemMessage("Type yes to start BUILD mode, or /cancel to stop.");
                    });
                }
                return true;
            }
            if (!disposedRef.current) {
                startTransition(() => {
                    commitComposerFlow({ type: "idle" });
                });
            }
            await executeSavedPlan(flow.plan);
            return true;
        }
        return false;
    };
    const executeAgentPrompt = async (input) => {
        const turnId = currentTurnIdRef.current + 1;
        const transcriptPrompt = input.transcriptPrompt ?? input.prompt;
        let turnTranscript = transcriptPrompt.trim().length > 0
            ? appendTranscriptEntry(transcriptRef.current, createUserEntry(transcriptPrompt))
            : [...transcriptRef.current];
        currentTurnIdRef.current = turnId;
        startTransition(() => {
            commitPhase("thinking");
            commitStep(1);
            commitTranscript(turnTranscript);
        });
        const systemMessages = [
            buildExecutionModeContextMessage(executionModeRef.current),
            ...(input.useResponseModeContext === false
                ? []
                : [buildResponseModeContextMessage(modeRef.current)]),
            ...(input.systemMessages ?? [])
        ];
        const promptContext = await loadAgentPromptContext({
            history: historyRef.current,
            memoryStore,
            prompt: input.prompt,
            sessionSummary: currentSessionRef.current.summary,
            systemMessages
        }, (message) => {
            if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                return;
            }
            startTransition(() => {
                appendSystemMessage(`Memory warning: ${message}`);
            });
        });
        try {
            const result = await runAgentTurn({
                model: (() => {
                    const snapshot = modelRuntime.getSnapshot();
                    emitAppDebugLog(`Agent using provider=${snapshot.provider} model=${snapshot.model} executionMode=${executionModeRef.current}`);
                    return modelRuntime.getClient();
                })(),
                contextMessages: promptContext.contextMessages,
                history: promptContext.recentHistory,
                prompt: input.prompt,
                toolRegistry: input.toolRegistryOverride ??
                    createExecutionModeToolRegistry(toolRegistry, executionModeRef.current),
                onEvent: async (event) => {
                    if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                        return;
                    }
                    turnTranscript = reduceTranscriptEntries(turnTranscript, event, turnId);
                    startTransition(() => {
                        commitTranscript(turnTranscript);
                        commitToolActivity(reduceToolActivity(toolActivityRef.current, event, turnId));
                        commitLastToolSummary(reduceLastToolSummary(lastToolSummaryRef.current, event));
                        commitPhase(reducePhase(phaseRef.current, event));
                        commitStep(reduceStep(stepRef.current, event));
                    });
                }
            });
            if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                return {
                    content: result.content,
                    ok: true
                };
            }
            const nextHistory = mergeAgentTurnHistory(historyRef.current, promptContext.recentHistory, result.messages);
            commitHistory(nextHistory);
            const savedSession = await sessionStore.saveSession({
                ...currentSessionRef.current,
                history: nextHistory,
                transcript: filterPersistedTranscript(turnTranscript)
            });
            if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                return {
                    content: result.content,
                    ok: true
                };
            }
            startTransition(() => {
                commitCurrentSession(savedSession);
            });
            if (input.rememberUserPrompt) {
                await rememberPromptMemories(memoryStore, input.prompt, currentSessionRef.current.id, (message) => {
                    if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                        return;
                    }
                    startTransition(() => {
                        appendSystemMessage(`Memory warning: ${message}`);
                    });
                });
            }
            return {
                content: result.content,
                ok: true
            };
        }
        catch (error) {
            if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                return {
                    content: error instanceof Error ? error.message : "Unexpected agent failure.",
                    ok: false
                };
            }
            const message = error instanceof Error ? error.message : "Unexpected agent failure.";
            turnTranscript = appendTranscriptEntry(turnTranscript, createSystemEntry(`Agent error: ${message}`, true));
            startTransition(() => {
                commitPhase("ready");
                commitLastToolSummary(summarizeText(`Agent error: ${message}`));
                commitToolActivity(limitToolActivity(toolActivityRef.current.filter((tool) => tool.status !== "running")));
                commitTranscript(turnTranscript);
            });
            const savedSession = await sessionStore.saveSession({
                ...currentSessionRef.current,
                history: [...historyRef.current],
                transcript: filterPersistedTranscript(turnTranscript)
            });
            if (!disposedRef.current && currentTurnIdRef.current === turnId) {
                startTransition(() => {
                    commitCurrentSession(savedSession);
                });
            }
            return {
                content: message,
                ok: false
            };
        }
    };
    const runPrompt = async (prompt) => {
        await executeAgentPrompt({
            prompt,
            rememberUserPrompt: true
        });
    };
    const generateProjectPlan = async () => {
        const planningToolRegistry = createExecutionModeToolRegistry(toolRegistry, "plan");
        startTransition(() => {
            commitExecutionMode("plan");
            commitWorkflowState({
                currentStep: 0,
                currentStepLabel: "Analyzing project",
                progressLabel: "Generating plan.md",
                totalSteps: 0
            });
            appendSystemMessage("PLAN mode enabled. Inspecting the project in read-only mode and generating plan.md.", true);
        });
        const result = await executeAgentPrompt({
            prompt: buildProjectPlanPrompt(),
            rememberUserPrompt: false,
            systemMessages: [
                {
                    role: "system",
                    content: "Return only the markdown plan. Do not include commentary before or after the plan."
                }
            ],
            toolRegistryOverride: planningToolRegistry,
            transcriptPrompt: "Generate a read-only project plan.",
            useResponseModeContext: false
        });
        if (!result.ok || disposedRef.current) {
            startTransition(() => {
                commitWorkflowState({
                    currentStep: 0,
                    currentStepLabel: "Plan generation failed",
                    progressLabel: "plan.md not updated",
                    totalSteps: 0
                });
            });
            await persistSessionSnapshot();
            return;
        }
        try {
            const plan = await writePlanDocument(workspaceRoot, result.content);
            if (!disposedRef.current) {
                startTransition(() => {
                    commitWorkflowState({
                        currentStep: 0,
                        currentStepLabel: "Plan ready",
                        progressLabel: `0/${plan.steps.length} steps prepared`,
                        totalSteps: plan.steps.length
                    });
                    appendSystemMessage(formatPlanForTranscript(plan), true);
                });
            }
            await persistSessionSnapshot();
        }
        catch (error) {
            if (!disposedRef.current) {
                startTransition(() => {
                    commitWorkflowState({
                        currentStep: 0,
                        currentStepLabel: "Plan generation failed",
                        progressLabel: "plan.md not updated",
                        totalSteps: 0
                    });
                    appendSystemMessage(error instanceof Error
                        ? `Failed to save plan.md: ${error.message}`
                        : "Failed to save plan.md.", true);
                });
            }
            await persistSessionSnapshot();
        }
    };
    const executeSavedPlan = async (plan) => {
        const completedSteps = [];
        startTransition(() => {
            commitExecutionMode("build");
            commitWorkflowState({
                currentStep: 0,
                currentStepLabel: "Preparing build",
                progressLabel: `0/${plan.steps.length} steps complete`,
                totalSteps: plan.steps.length
            });
            appendSystemMessage(`BUILD mode enabled. Executing ${plan.steps.length} steps from plan.md.`, true);
        });
        for (const planStep of plan.steps) {
            if (disposedRef.current) {
                return;
            }
            startTransition(() => {
                commitWorkflowState({
                    currentStep: planStep.index,
                    currentStepLabel: planStep.title,
                    progressLabel: `${planStep.index - 1}/${plan.steps.length} steps complete`,
                    totalSteps: plan.steps.length
                });
                appendSystemMessage(`Executing Step ${planStep.index}: ${planStep.title}`, true);
            });
            const result = await executeAgentPrompt({
                prompt: buildPlanExecutionPrompt(plan, planStep, completedSteps),
                rememberUserPrompt: false,
                transcriptPrompt: `Execute Step ${planStep.index}: ${planStep.title}`,
                useResponseModeContext: false
            });
            if (!result.ok) {
                startTransition(() => {
                    commitWorkflowState({
                        currentStep: planStep.index,
                        currentStepLabel: planStep.title,
                        progressLabel: `Stopped at step ${planStep.index}/${plan.steps.length}`,
                        totalSteps: plan.steps.length
                    });
                    appendSystemMessage(`Build stopped at Step ${planStep.index}: ${result.content}`, true);
                });
                await persistSessionSnapshot();
                return;
            }
            completedSteps.push(planStep);
            startTransition(() => {
                commitWorkflowState({
                    currentStep: planStep.index,
                    currentStepLabel: planStep.title,
                    progressLabel: `${planStep.index}/${plan.steps.length} steps complete`,
                    totalSteps: plan.steps.length
                });
                appendSystemMessage(`Completed Step ${planStep.index}: ${summarizeText(result.content)}`, true);
            });
        }
        if (!disposedRef.current) {
            startTransition(() => {
                commitWorkflowState({
                    currentStep: plan.steps.length,
                    currentStepLabel: "Build complete",
                    progressLabel: `${plan.steps.length}/${plan.steps.length} steps complete`,
                    totalSteps: plan.steps.length
                });
                appendSystemMessage("BUILD mode completed every step in plan.md.", true);
            });
        }
        await persistSessionSnapshot();
    };
    const moveActiveFlowSelection = (direction) => {
        const current = activeFlowRef.current;
        if (!current) {
            return;
        }
        commitActiveFlow({
            ...current,
            flow: moveFlowSelection(current.flow, direction)
        });
    };
    const submitActiveFlowSelection = () => {
        const current = activeFlowRef.current;
        if (!current) {
            return;
        }
        const nextFlow = advanceFlow(current.flow, current.flow.value);
        if (nextFlow) {
            commitActiveFlow({
                ...current,
                flow: nextFlow
            });
            return;
        }
        void completeActiveFlow({
            ...current,
            flow: {
                ...current.flow,
                state: snapshotFlowState(current.flow)
            }
        });
    };
    const completeActiveFlow = async (context) => {
        try {
            if (readOptionalFlowString(context.flow, "confirm") === "cancel") {
                if (!disposedRef.current) {
                    startTransition(() => {
                        commitActiveFlow(null);
                    });
                }
                return;
            }
            switch (context.id) {
                case "login": {
                    const snapshot = await modelRuntime.login({
                        provider: readFlowProvider(context.flow),
                        apiKey: readOptionalFlowString(context.flow, "apiKey")
                    });
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitActiveFlow(null);
                            commitAppState(toAppRuntimeState(snapshot));
                            appendSystemMessage(`Provider set to ${snapshot.providerLabel}. Active model: ${snapshot.model}.`);
                        });
                    }
                    return;
                }
                case "mcp_add": {
                    const result = await mcpManager.addServer(buildDraftFromFlow(context.flow));
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitActiveFlow(null);
                            appendSystemMessage(formatMcpReloadSummary(`Added MCP server "${readRequiredFlowString(context.flow, "name")}".`, result));
                        });
                    }
                    return;
                }
                case "mcp_edit": {
                    const result = await mcpManager.editServer(context.originalName, buildDraftFromFlow(context.flow));
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitActiveFlow(null);
                            appendSystemMessage(formatMcpReloadSummary(`Updated MCP server "${readRequiredFlowString(context.flow, "name")}".`, result));
                        });
                    }
                    return;
                }
                case "mcp_install": {
                    const result = await mcpManager.addServer(applyMarketplacePromptValues(buildDraftFromFlow(context.flow), context.prompts, context.flow));
                    if (!disposedRef.current) {
                        startTransition(() => {
                            commitActiveFlow(null);
                            appendSystemMessage(formatMcpReloadSummary(`Installed MCP server "${context.installName}".`, result));
                        });
                    }
                    return;
                }
                default:
                    return assertNever(context);
            }
        }
        catch (error) {
            if (!disposedRef.current) {
                startTransition(() => {
                    appendSystemMessage(error instanceof Error ? error.message : "Flow completion failed.");
                });
            }
        }
    };
    const submitMessage = (rawValue) => {
        void (async () => {
            const input = rawValue.trim();
            if (phaseRef.current !== "ready") {
                return;
            }
            if (input.length === 0 &&
                composerFlowRef.current.type === "idle" &&
                activeFlowRef.current === null) {
                return;
            }
            setComposerValue("");
            if (activeFlowRef.current) {
                if (await handleComposerFlowInput(input)) {
                    return;
                }
            }
            if (composerFlowRef.current.type !== "idle" &&
                input.startsWith("/") &&
                input !== "/cancel") {
                if (await handleCommand(input)) {
                    return;
                }
            }
            if (await handleComposerFlowInput(input)) {
                return;
            }
            if (await handleCommand(input)) {
                return;
            }
            await runPrompt(input);
        })();
    };
    const composerInputState = activeFlow
        ? createActiveFlowInputState(activeFlow.flow)
        : createComposerInputState(composerFlow, isBusy, isStreaming);
    const activeFlowStep = activeFlow ? getActiveFlowStep(activeFlow.flow) : undefined;
    return (_jsx(AppRuntimeStateProvider, { value: appState, children: _jsxs(Box, { flexDirection: "column", height: windowSize.rows, paddingX: 1, children: [_jsx(Header, { activeToolCount: activeToolCount, autoModeLabel: autoModeLabel, executionModeLabel: executionModeLabel, statusLabel: createStatusLabel(phase, step), statusTone: phase === "ready" ? "ready" : "busy", taskCount: taskCount, toolCount: deferredTools.length, workflowProgressLabel: workflowState.progressLabel, width: layout.frameWidth }), _jsxs(Box, { flexDirection: layout.isWide ? "row" : "column", height: layout.bodyHeight, children: [activeFlow ? (_jsx(FlowPanel, { flow: activeFlow.flow, height: layout.mainHeight, width: layout.mainWidth, onCancel: () => {
                                commitActiveFlow(null);
                                setComposerValue("");
                            }, onMoveSelection: moveActiveFlowSelection, onSubmitSelection: submitActiveFlowSelection })) : (_jsx(OutputPanel, { entries: transcript, height: layout.mainHeight, isStreaming: isStreaming, width: layout.mainWidth })), _jsx(Box, { marginLeft: layout.isWide ? 1 : 0, marginTop: layout.isWide ? 0 : 1, children: _jsx(Sidebar, { activeTools: toolActivity, height: layout.sideHeight, lastToolSummary: lastToolSummary, currentWorkflowLabel: workflowState.currentStepLabel, executionModeLabel: executionModeLabel, autoModeLabel: autoModeLabel, autoModeLastAction: autoModeLastAction, autoModeNextRunLabel: autoModeNextRunLabel, phaseLabel: createPhaseLabel(phase), responseModeLabel: formatResponseModeLabel(mode), sessionLabel: createSessionLabel(currentSession), step: step, taskLabel: `${taskCount} tasks • ${runningTaskCount} running`, tools: deferredTools, workflowProgressLabel: workflowState.progressLabel, width: layout.sideWidth }) })] }), _jsx(InputBar, { footer: composerInputState.footer, focusInput: activeFlowStep?.inputType !== "select" && activeFlowStep?.inputType !== "confirm", isBusy: isBusy, isStreaming: isStreaming, mask: composerInputState.mask, placeholder: composerInputState.placeholder, subtitle: composerInputState.subtitle, title: composerInputState.title, value: composerValue, width: layout.frameWidth, onChange: setComposerValue, onSubmit: submitMessage })] }) }));
}
function reduceToolActivity(entries, event, turnId) {
    switch (event.type) {
        case "tool_started":
            return limitToolActivity([
                {
                    id: createToolEntryId(turnId, event.step, event.toolCall.id),
                    name: event.toolCall.name,
                    startedAt: Date.now(),
                    status: "running"
                },
                ...entries.filter((tool) => tool.id !== createToolEntryId(turnId, event.step, event.toolCall.id))
            ]);
        case "tool_finished":
            return limitToolActivity(upsertToolActivityEntry(entries, {
                id: createToolEntryId(turnId, event.step, event.toolCall.id),
                isError: event.result.isError,
                name: event.toolCall.name,
                startedAt: Date.now(),
                status: "complete",
                summary: summarizeText(`${event.toolCall.name}: ${event.result.isError ? "failed" : "completed"}`)
            }));
        case "assistant_stream_completed":
            return limitToolActivity(entries.filter((tool) => tool.status === "complete"));
        default:
            return entries;
    }
}
function reduceLastToolSummary(currentValue, event) {
    if (event.type !== "tool_finished") {
        return currentValue;
    }
    return summarizeText(`${event.toolCall.name}: ${event.result.isError ? "failed" : "completed"}`);
}
function reducePhase(currentValue, event) {
    return event.type === "status" ? event.phase : currentValue;
}
function reduceStep(currentValue, event) {
    return "step" in event ? event.step : currentValue;
}
function createComposerInputState(flow, isBusy, isStreaming) {
    if (flow.type === "build_confirm") {
        return {
            footer: "Type yes to execute the saved plan • /cancel stops build",
            placeholder: "Confirm build execution",
            subtitle: `${flow.plan.steps.length} steps queued from plan.md`,
            title: "Build Confirmation"
        };
    }
    return {
        placeholder: isBusy
            ? "Agent is working…"
            : isStreaming
                ? "Streaming response…"
                : "Type a message",
        subtitle: isStreaming ? "Agent streaming" : isBusy ? "Agent active" : "Ready",
        title: "Composer"
    };
}
function createActiveFlowInputState(flow) {
    const step = getActiveFlowStep(flow);
    return {
        footer: step.inputType === "text"
            ? "Complete the current step and press Enter • /cancel exits the flow"
            : "Use arrows to select • Enter confirms • /cancel exits the flow",
        mask: step.mask,
        placeholder: step.inputType === "text" ? resolveFlowPlaceholder(flow) : "Use arrows to choose",
        subtitle: formatFlowStepLabel(flow),
        title: resolveFlowTitle(flow)
    };
}
function createLoginProviderPrompt(providers) {
    const lines = ["Login setup", ""];
    for (const provider of providers) {
        lines.push(`${provider.name}  ${provider.requiresApiKey ? "API key required" : "No API key required"}`);
    }
    lines.push("");
    lines.push("Type a provider name to continue, or /cancel to stop.");
    return lines.join("\n");
}
function formatProviderChoices(providers) {
    if (providers.length === 0) {
        return "no providers";
    }
    const names = providers.map((provider) => provider.name);
    if (names.length === 1) {
        return names[0];
    }
    if (names.length === 2) {
        return `${names[0]} or ${names[1]}`;
    }
    return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}
function matchProvider(input, providers) {
    const normalizedInput = input.trim().toLowerCase();
    return providers.find((provider) => {
        return (provider.name.toLowerCase() === normalizedInput ||
            provider.label.toLowerCase() === normalizedInput);
    });
}
function emitAppDebugLog(message) {
    if (process.env.CHATGPT_CODE_DEBUG !== "1") {
        return;
    }
    process.stderr.write(`[app] ${message}\n`);
}
async function loadAgentPromptContext(input, onError) {
    try {
        return await buildAgentPromptContext(input);
    }
    catch (error) {
        onError(error instanceof Error
            ? error.message
            : "Unable to prepare prompt memory.");
        return {
            contextMessages: buildPromptContextMessages({
                memories: [],
                sessionSummary: input.sessionSummary,
                systemMessages: input.systemMessages
            }),
            recentHistory: getRecentSessionHistory(input.history)
        };
    }
}
async function rememberPromptMemories(memoryStore, prompt, sessionId, onError) {
    try {
        await memoryStore.rememberFromUserMessage(prompt, { sessionId });
    }
    catch (error) {
        onError(error instanceof Error ? error.message : "Unable to persist user memory.");
    }
}
function limitToolActivity(entries) {
    return [...entries].slice(0, MAX_TOOL_ACTIVITY);
}
function upsertToolActivityEntry(entries, nextEntry) {
    const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
    if (existingIndex === -1) {
        return [nextEntry, ...entries];
    }
    return entries.map((entry, index) => index === existingIndex
        ? {
            ...entry,
            ...nextEntry,
            startedAt: entry.startedAt
        }
        : entry);
}
function createPhaseLabel(phase) {
    switch (phase) {
        case "thinking":
            return "Thinking";
        case "running_tool":
            return "Running tool";
        case "streaming":
            return "Streaming";
        case "ready":
            return "Ready";
        default:
            return phase;
    }
}
function createStatusLabel(phase, step) {
    const phaseLabel = createPhaseLabel(phase);
    if (phase === "ready" || step <= 0) {
        return phaseLabel;
    }
    return `${phaseLabel} · step ${step}`;
}
function createSessionLabel(session) {
    return `${session.id} • ${session.title}`;
}
function createAutoModeLabel(task) {
    if (!task) {
        return "Auto off";
    }
    return task.isRunning ? "AUTO MODE RUNNING" : "Auto scheduled";
}
function formatAutoModeNextRun(task, now) {
    if (!task) {
        return "Off";
    }
    if (task.isRunning) {
        return "Running now";
    }
    const deltaMs = task.nextRunAt - now;
    if (deltaMs <= 0) {
        return "Due now";
    }
    const totalSeconds = Math.floor(deltaMs / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) {
        return `${seconds}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
function summarizeText(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= MAX_TOOL_SUMMARY_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_TOOL_SUMMARY_LENGTH - 1)}…`;
}
function createToolSignature(tools) {
    return tools.map((tool) => `${tool.id}:${tool.name}`).join("|");
}
function createToolEntryId(turnId, step, toolCallId) {
    return `tool-${turnId}-${step}-${toolCallId}`;
}
function createIdleWorkflowState() {
    return {
        currentStep: 0,
        currentStepLabel: "No active plan",
        progressLabel: "Idle",
        totalSteps: 0
    };
}
function isBuildConfirmationInput(value) {
    return value === "yes" || value === "y" || value === "build" || value === "confirm";
}
function createLoginFlowSteps(providers) {
    return [
        {
            key: "provider",
            title: "Choose Provider",
            description: "Select the model provider for this session.",
            inputType: "select",
            options: providers.map((provider) => ({
                description: provider.requiresApiKey ? "API key required" : "No key required",
                label: provider.label,
                value: provider.name
            }))
        },
        {
            key: "apiKey",
            title: "Enter API Key",
            description: "Provide the provider API key. Leave blank for local mode or to reuse a saved key.",
            inputType: "text",
            mask: "*",
            placeholder: "API key",
            condition: (state) => typeof state.provider === "string" && state.provider !== "local"
        },
        {
            key: "confirm",
            title: "Confirm Login",
            description: (state) => `Save provider ${String(state.provider ?? "local")} and update the active runtime immediately.`,
            inputType: "confirm",
            options: [
                {
                    label: "Confirm login",
                    value: "confirm"
                },
                {
                    label: "Cancel",
                    value: "cancel"
                }
            ]
        }
    ];
}
function createMcpDraftFlowSteps(mode) {
    return [
        {
            key: "name",
            title: "Server Name",
            description: "Choose the unique name used for this MCP server in config and commands.",
            inputType: "text",
            placeholder: "filesystem"
        },
        {
            key: "type",
            title: "Transport Type",
            description: "Choose how this MCP server communicates. STDIO covers local and command processes.",
            inputType: "select",
            options: [
                {
                    label: "local / stdio",
                    value: "local"
                },
                {
                    label: "command / stdio",
                    value: "command"
                },
                {
                    label: "http",
                    value: "http"
                },
                {
                    label: "sse",
                    value: "sse"
                }
            ]
        },
        {
            key: "command",
            title: "Command",
            description: "Enter the executable used to start the local MCP server process.",
            inputType: "text",
            placeholder: "npx",
            condition: (state) => state.type === "local" || state.type === "command"
        },
        {
            key: "args",
            title: "Arguments",
            description: "Provide command arguments as a space-separated list.",
            inputType: "text",
            placeholder: "-y @playwright/mcp@latest",
            condition: (state) => state.type === "local" || state.type === "command"
        },
        {
            key: "cwd",
            title: "Working Directory",
            description: "Optional cwd relative to the project root.",
            inputType: "text",
            placeholder: ".",
            condition: (state) => state.type === "local" || state.type === "command"
        },
        {
            key: "env",
            title: "Environment Variables",
            description: "Optional KEY=value pairs separated by commas.",
            inputType: "text",
            placeholder: "API_KEY=replace-me",
            condition: (state) => state.type === "local" || state.type === "command"
        },
        {
            key: "url",
            title: "Remote URL",
            description: "Provide the MCP endpoint URL.",
            inputType: "text",
            placeholder: "https://example.com/mcp",
            condition: (state) => state.type === "http" || state.type === "sse"
        },
        {
            key: "headers",
            title: "HTTP Headers",
            description: "Optional KEY=value pairs separated by commas.",
            inputType: "text",
            placeholder: "Authorization=Bearer token",
            condition: (state) => state.type === "http" || state.type === "sse"
        },
        {
            key: "tools",
            title: "Tool Filter",
            description: "Use * for all tools or a comma-separated allowlist.",
            inputType: "text",
            placeholder: "*"
        },
        {
            key: "confirm",
            title: mode === "edit" ? "Confirm Changes" : "Confirm Install",
            description: (state) => `Review ${String(state.name ?? "this MCP server")} and save it to config with hot reload.`,
            inputType: "confirm",
            options: [
                {
                    label: mode === "edit" ? "Save changes" : "Save and enable",
                    value: "confirm"
                },
                {
                    label: "Cancel",
                    value: "cancel"
                }
            ]
        }
    ];
}
function createMarketplaceInstallFlowSteps(draft, prompts = []) {
    const installSteps = createMcpDraftFlowSteps("install").filter((step) => {
        if (step.key === "name") {
            return true;
        }
        if (draft.type === "http" || draft.type === "sse") {
            return step.key !== "command" && step.key !== "args" && step.key !== "cwd" && step.key !== "env";
        }
        return step.key !== "url" && step.key !== "headers";
    });
    const confirmStep = installSteps.at(-1);
    const setupSteps = confirmStep ? installSteps.slice(0, -1) : installSteps;
    const promptSteps = prompts.map((prompt) => ({
        key: createMarketplacePromptStateKey(prompt),
        title: prompt.label,
        description: prompt.description,
        inputType: "text",
        mask: prompt.mask,
        placeholder: prompt.key
    }));
    return confirmStep
        ? [...setupSteps, ...promptSteps, confirmStep]
        : [...setupSteps, ...promptSteps];
}
function createDefaultMcpDraft() {
    return {
        args: [],
        command: "",
        cwd: ".",
        enabled: true,
        env: {},
        headers: {},
        name: "",
        tools: ["*"],
        transport: "stdio",
        type: "local",
        url: undefined
    };
}
function createDraftFromManagedServer(server) {
    return {
        args: [...server.definition.args],
        command: server.definition.command,
        cwd: server.definition.cwd,
        enabled: server.definition.enabled,
        env: { ...server.definition.env },
        headers: { ...(server.definition.headers ?? {}) },
        name: server.name,
        tools: [...(server.definition.tools ?? ["*"])],
        transport: server.definition.transport === "http" ||
            server.definition.transport === "sse"
            ? server.definition.transport
            : "stdio",
        type: server.definition.type === "local" ||
            server.definition.type === "command" ||
            server.definition.type === "http" ||
            server.definition.type === "sse"
            ? server.definition.type
            : "command",
        url: server.definition.url
    };
}
function buildDraftFromFlow(flow) {
    const type = readFlowServerType(flow);
    return {
        args: parseListValue(readOptionalFlowString(flow, "args")),
        command: readOptionalFlowString(flow, "command") ?? "",
        cwd: readOptionalFlowString(flow, "cwd") ?? ".",
        enabled: true,
        env: parseRecordValue(readOptionalFlowString(flow, "env")),
        headers: parseRecordValue(readOptionalFlowString(flow, "headers")),
        name: readRequiredFlowString(flow, "name"),
        tools: parseToolFilter(readOptionalFlowString(flow, "tools")),
        transport: type === "http" ? "http" : type === "sse" ? "sse" : "stdio",
        type,
        url: readOptionalFlowString(flow, "url")
    };
}
function readFlowProvider(flow) {
    const provider = readRequiredFlowString(flow, "provider");
    if (!isModelProvider(provider)) {
        throw new Error(`Unsupported provider "${provider}".`);
    }
    return provider;
}
function readFlowServerType(flow) {
    const type = readRequiredFlowString(flow, "type");
    if (type === "local" || type === "command" || type === "http" || type === "sse") {
        return type;
    }
    throw new Error(`Unsupported MCP server type "${type}".`);
}
function readRequiredFlowString(flow, key) {
    const value = flow.state[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Flow value "${key}" is required.`);
    }
    return value.trim();
}
function readOptionalFlowString(flow, key) {
    const value = flow.state[key];
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function parseListValue(value) {
    if (!value) {
        return [];
    }
    return value
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function parseToolFilter(value) {
    if (!value || value.trim() === "*" || value.trim().length === 0) {
        return ["*"];
    }
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function parseRecordValue(value) {
    if (!value) {
        return {};
    }
    if (value.trim().startsWith("{")) {
        const parsed = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Expected a JSON object.");
        }
        return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, String(entry)]));
    }
    const pairs = value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    const record = {};
    for (const pair of pairs) {
        const separatorIndex = pair.indexOf("=");
        if (separatorIndex <= 0) {
            throw new Error(`Invalid key=value pair "${pair}".`);
        }
        record[pair.slice(0, separatorIndex).trim()] = pair
            .slice(separatorIndex + 1)
            .trim();
    }
    return record;
}
function applyMarketplacePromptValues(draft, prompts, flow) {
    if (prompts.length === 0) {
        return draft;
    }
    const nextDraft = {
        ...draft,
        env: { ...draft.env },
        headers: { ...draft.headers }
    };
    for (const prompt of prompts) {
        const value = readOptionalFlowString(flow, createMarketplacePromptStateKey(prompt));
        if (!value) {
            continue;
        }
        if (prompt.target === "env") {
            nextDraft.env[prompt.key] = value;
            continue;
        }
        nextDraft.headers[prompt.key] = value;
    }
    return nextDraft;
}
function createMarketplacePromptStateKey(prompt) {
    return `marketplace:${prompt.target}:${prompt.key}`;
}
function formatStringRecord(record) {
    return Object.entries(record)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
}
function validateFlowSubmission(key, value) {
    const trimmed = value.trim();
    if (key === "name" && trimmed.length === 0) {
        return "A name is required for this step.";
    }
    if (key === "command" && trimmed.length === 0) {
        return "A command is required for stdio MCP servers.";
    }
    if (key === "url" && trimmed.length === 0) {
        return "A URL is required for remote MCP servers.";
    }
    if ((key === "url" || key.endsWith(":url")) && trimmed.length > 0) {
        try {
            new URL(trimmed);
        }
        catch {
            return "Enter a valid URL for this step.";
        }
    }
    if ((key === "env" || key === "headers") && trimmed.length > 0) {
        try {
            parseRecordValue(trimmed);
        }
        catch (error) {
            return error instanceof Error ? error.message : "Enter valid KEY=value pairs.";
        }
    }
    return undefined;
}
function assertNever(value) {
    throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
