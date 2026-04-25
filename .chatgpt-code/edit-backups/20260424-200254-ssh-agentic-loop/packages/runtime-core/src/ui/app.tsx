import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";

import { Box, useWindowSize } from "ink";

import {
  appendTranscriptEntry,
  createSystemEntry,
  createUserEntry,
  reduceTranscriptEntries
} from "../agent/agent-transcript.js";
import {
  AgentControlError,
  runAgentTurn,
  type AgentTurnEvent,
  type AgentTurnPhase
} from "../agent/run-agent-turn.js";
import {
  formatRetryDelay,
  isRateLimitError,
  readErrorMessage,
  runWithRateLimitRecovery
} from "../agent/rate-limit-recovery.js";
import {
  buildPromptContextMessages,
  buildAgentPromptContext,
  mergeAgentTurnHistory
} from "../memory/prompt-builder.js";
import {
  detectFleetDelegationIntent,
  inferFleetRoleFromPrompt,
  type FleetManager
} from "../fleet/fleet-manager.js";
import type { GoalStore } from "../goals/goal-store.js";
import {
  buildExecutionModeContextMessage,
  DEFAULT_EXECUTION_MODE,
  formatExecutionModeLabel,
  type ExecutionMode
} from "../modes/execution-mode.js";
import {
  buildResponseModeContextMessage,
  formatResponseModeLabel,
  type ResponseMode
} from "../modes/response-mode.js";
import {
  isModelProvider,
  type ModelMessage,
  type ModelProvider
} from "../models/model-client.js";
import {
  buildPlanConfirmationMessage,
  buildPlanExecutionPrompt,
  buildPlanRevisionPrompt,
  buildProjectPlanPrompt,
  buildTaskPlanPrompt,
  detectPlanClarificationState,
  formatPlanForTranscript,
  mergeClarificationIntoPlanPrompt,
  readPlanDocument,
  writePlanDocument,
  type PlanClarificationState,
  type PlanDocument,
  type PlanStep
} from "../plan/plan-workflow.js";
import {
  type McpServerDraft,
  formatMcpReloadSummary,
  formatMcpServerList,
  type McpManager
} from "../mcp/mcp-manager.js";
import type {
  ApprovalManager,
  ApprovalManagerStatus
} from "../platform/approval-manager.js";
import type { ExecutionContextController } from "../platform/execution-context.js";
import {
  type MarketplacePromptField,
  formatMarketplaceInfo,
  formatMarketplaceList,
  getMarketplaceEntry,
  listMarketplaceEntries
} from "../mcp/mcp-marketplace.js";
import type { ModelRuntimeManager } from "../providers/model-runtime.js";
import type {
  ModelRuntimeSnapshot,
  ProviderSummary
} from "../providers/provider-types.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRecord, SessionStore } from "../storage/session-store.js";
import type { ProjectRegistryStore } from "../storage/project-registry-store.js";
import type { SessionRegistryStore } from "../storage/session-registry-store.js";
import type { BackgroundTaskRecord } from "../storage/task-store.js";
import {
  createInitialSessionState,
  filterPersistedTranscript,
  getRecentSessionHistory
} from "../storage/session-state.js";
import type { BackgroundTaskRunner, BackgroundTaskView } from "../tasks/background-task-runner.js";
import type { LoadedToolRegistry } from "../tools/load-tool-registry.js";
import type { RegisteredTool, ToolRegistration, ToolRegistry } from "../tools/tool-registry.js";
import { createExecutionModeToolRegistry, filterToolsForExecutionMode } from "../tools/execution-mode-tool-registry.js";
import type { TimelineStore } from "../storage/timeline-store.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import {
  PathAccessError,
  formatPathForDisplay,
  isPathOutsideProject,
  readScopeLabel,
  resolvePathFromContext,
  ensureLocalPathAllowed
} from "../tools/workspace-safety.js";
import {
  formatAgentDetail,
  formatAgentList,
  formatHelpMessage,
  formatTaskDetail,
  formatModelList,
  formatModeMessage,
  formatSessionList,
  formatStyleMessage,
  formatTaskList,
  formatWatcherDetail,
  formatWatcherList,
  parseAppCommand
} from "./commands.js";
import { FlowPanel } from "./components/flow-panel.js";
import { Header } from "./components/header.js";
import { InputBar } from "./components/input-bar.js";
import {
  advanceFlow,
  createFlow,
  formatFlowStepLabel,
  getActiveFlowStep,
  getFlowOptions,
  moveFlowSelection,
  primeFlow,
  resolveFlowDescription,
  resolveFlowPlaceholder,
  resolveFlowTitle,
  snapshotFlowState,
  type FlowState,
  type FlowStep
} from "./flow-engine.js";
import { OutputPanel } from "./components/output-panel.js";
import { Sidebar } from "./components/sidebar.js";
import {
  AppRuntimeStateProvider,
  toAppRuntimeState,
  type AppRuntimeState
} from "./runtime-state.js";
import { calculateTuiLayout } from "./theme.js";
import type { ActiveToolEntry, TranscriptEntry } from "./types.js";
import type { TimelineEvent } from "../platform/types.js";
import type {
  ApprovalPolicyPreset,
  ApprovalRequest,
  ExecutionContext,
  FleetAgentRecord,
  FilesystemGrant,
  GoalRecord,
  ProjectRecord,
  SessionRegistryEntry,
  WatcherRecord,
  WorkerSpec
} from "../platform/types.js";

const DEFAULT_TOOL_SUMMARY = "No tool activity yet.";
const MAX_TOOL_ACTIVITY = 6;
const MAX_TOOL_SUMMARY_LENGTH = 72;
const DEFAULT_RESPONSE_MODE: ResponseMode = "normal";
const RATE_LIMIT_RETRY_DELAYS_MS = [60_000, 120_000, 300_000] as const;

type ComposerFlow =
  | { type: "idle" }
  | { plan: PlanDocument; type: "build_confirm" };

type ActiveFlowContext =
  | {
      id: "login";
      flow: FlowState;
    }
  | {
      draft: SshWorkerDraft;
      id: "ssh_add";
      flow: FlowState;
    }
  | {
      draft: McpServerDraft;
      id: "mcp_add";
      flow: FlowState;
    }
    | {
      installName: string;
      draft: McpServerDraft;
      id: "mcp_install";
      flow: FlowState;
      prompts: readonly MarketplacePromptField[];
    }
  | {
      originalName: string;
      draft: McpServerDraft;
      id: "mcp_edit";
      flow: FlowState;
    };

interface SshWorkerDraft {
  host: string;
  name: string;
  password?: string;
  port?: number;
  username?: string;
  workingDirectory?: string;
}

interface RemoteWorkerView {
  currentTask?: string;
  host: string;
  id: string;
  name: string;
  role: string;
  status: string;
}

interface WorkflowState {
  currentStep: number;
  currentStepLabel: string;
  progressLabel: string;
  totalSteps: number;
}

interface ExtendedMemoryStore {
  clear?(scope?: "global" | "workspace"): Promise<void>;
  compact?(): Promise<{
    decisions: string[];
    constraints: string[];
    currentTask: Record<string, unknown>;
    goals: string[];
    historySummary: string;
  }>;
  forgetGlobal(key: string): Promise<boolean>;
  listMemories(): Promise<ModelMemoryRecord[]>;
  rememberGlobal(text: string): Promise<ModelMemoryRecord>;
  search(keyword: string): Promise<ModelMemoryRecord[]>;
}

interface ResumableBuildState {
  canResume: boolean;
  completedSteps: readonly PlanStep[];
  message: string;
  startStepIndex: number;
}

interface PersistedBuildProgress {
  completedStepIndexes: number[];
  lastAttemptedStepIndex?: number;
  lastCompletedStepIndex?: number;
  status: "idle" | "running" | "blocked" | "complete";
  updatedAt: number;
}

interface PlanReviewState {
  originalPrompt: string;
  plan: PlanDocument;
}

interface SessionAppMetadata {
  approvalStatus: ApprovalManagerStatus;
  autopilot?: {
    enabled?: boolean;
    policy?: ApprovalPolicyPreset;
  };
  executionMode?: ExecutionMode;
  responseMode?: ResponseMode;
}

interface AgentPromptInput {
  prompt: string;
  rememberUserPrompt?: boolean;
  systemMessages?: readonly Extract<ModelMessage, { role: "system" }>[];
  toolRegistryOverride?: ToolRegistry;
  transcriptPrompt?: string;
  useResponseModeContext?: boolean;
}

type ModelMemoryRecord = Awaited<ReturnType<MemoryStore["listMemories"]>>[number];

export interface AppProps {
  approvalManager: ApprovalManager;
  executionContextController: ExecutionContextController;
  fleetManager?: FleetManager;
  goalStore?: GoalStore;
  initialSession: SessionRecord;
  memoryStore: MemoryStore;
  mcpManager: McpManager;
  modelRuntime: ModelRuntimeManager;
  projectRecord: ProjectRecord;
  projectRegistryStore: ProjectRegistryStore;
  remoteManager?: {
    add(agent: {
      capabilities: string[];
      connectionType: "ssh" | "local" | "container" | "subprocess";
      host: string;
      id: string;
      name: string;
      password?: string;
      port?: number;
      role: WorkerSpec["role"];
      status: "idle" | "running" | "waiting" | "degraded" | "offline";
      username?: string;
      workingDirectory?: string;
    }): Promise<unknown>;
    connect(id: string): Promise<{ status: string }>;
    disconnect(id: string): Promise<{ status: string }>;
    get(id: string): Promise<unknown>;
    list(): Promise<readonly RemoteWorkerView[]>;
    remove(id: string): Promise<boolean>;
    runCommand(
      id: string,
      command: string,
      args?: string[]
    ): Promise<{
      code: number | null;
      stderr: string;
      stdout: string;
    }>;
    testConnection(id: string): Promise<{ ok: boolean; output: string }>;
  };
  sessionRegistryStore: SessionRegistryStore;
  sessionStore: SessionStore;
  taskRunner: BackgroundTaskRunner;
  toolRegistry: LoadedToolRegistry;
  timelineStore?: TimelineStore;
  watcherStore?: WatcherStore;
  workspaceRoot: string;
}

export function App({
  approvalManager,
  executionContextController,
  fleetManager,
  goalStore,
  initialSession,
  memoryStore,
  mcpManager,
  modelRuntime,
  projectRecord,
  projectRegistryStore,
  remoteManager,
  sessionRegistryStore,
  sessionStore,
  taskRunner,
  toolRegistry,
  timelineStore,
  watcherStore,
  workspaceRoot
}: AppProps): React.JSX.Element {
  const windowSize = useWindowSize();
  const layout = calculateTuiLayout(windowSize.columns, windowSize.rows);
  const [executionContext, setExecutionContext] = useState<ExecutionContext>(() =>
    executionContextController.get()
  );
  const [tools, setTools] = useState<readonly RegisteredTool[]>(() =>
    toolRegistry.listTools()
  );
  const [composerValue, setComposerValue] = useState("");
  const [composerFlow, setComposerFlow] = useState<ComposerFlow>({
    type: "idle"
  });
  const [activeFlow, setActiveFlow] = useState<ActiveFlowContext | null>(null);
  const [currentSession, setCurrentSession] = useState(initialSession);
  const [appState, setAppState] = useState<AppRuntimeState>(() =>
    toAppRuntimeState(
      modelRuntime.getSnapshot(),
      createRuntimeStateOptions(executionContextController.get(), projectRecord)
    )
  );
  const [approvals, setApprovals] = useState<readonly ApprovalRequest[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalManagerStatus>(() =>
    approvalManager.getStatus()
  );
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(
    DEFAULT_EXECUTION_MODE
  );
  const [mode, setMode] = useState<ResponseMode>(DEFAULT_RESPONSE_MODE);
  const [phase, setPhase] = useState<AgentTurnPhase>("ready");
  const [step, setStep] = useState(0);
  const [tasks, setTasks] = useState<readonly BackgroundTaskView[]>(() =>
    taskRunner.listTasks()
  );
  const [goals, setGoals] = useState<readonly GoalRecord[]>([]);
  const [fleetAgents, setFleetAgents] = useState<readonly FleetAgentRecord[]>(() =>
    fleetManager?.listAgents() ?? []
  );
  const [remoteAgents, setRemoteAgents] = useState<readonly RemoteWorkerView[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [toolActivity, setToolActivity] = useState<ActiveToolEntry[]>([]);
  const [watchers, setWatchers] = useState<readonly WatcherRecord[]>([]);
  const [lastToolSummary, setLastToolSummary] = useState(DEFAULT_TOOL_SUMMARY);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() =>
    initialSession.transcript
  );
  const [workflowState, setWorkflowState] = useState<WorkflowState>(
    createIdleWorkflowState()
  );
  const [pendingPlanPrompt, setPendingPlanPrompt] = useState(false);
  const [planClarificationState, setPlanClarificationState] =
    useState<PlanClarificationState | null>(null);
  const [planReviewState, setPlanReviewState] =
    useState<PlanReviewState | null>(null);
  const executionScopedTools = filterToolsForExecutionMode(tools, executionMode);
  const deferredTools = useDeferredValue(executionScopedTools);
  const toolSignatureRef = useRef(createToolSignature(tools));
  const disposedRef = useRef(false);
  const composerFlowRef = useRef<ComposerFlow>({
    type: "idle"
  });
  const activeFlowRef = useRef<ActiveFlowContext | null>(null);
  const currentTurnIdRef = useRef(0);
  const currentTaskIdRef = useRef<string | undefined>(undefined);
  const currentSessionRef = useRef(initialSession);
  const executionContextRef = useRef<ExecutionContext>(
    executionContextController.get()
  );
  const appStateRef = useRef<AppRuntimeState>(
    toAppRuntimeState(
      modelRuntime.getSnapshot(),
      createRuntimeStateOptions(executionContextController.get(), projectRecord)
    )
  );
  const executionModeRef = useRef<ExecutionMode>(DEFAULT_EXECUTION_MODE);
  const modeRef = useRef<ResponseMode>(DEFAULT_RESPONSE_MODE);
  const historyRef = useRef<readonly ModelMessage[]>(initialSession.history);
  const transcriptRef = useRef<TranscriptEntry[]>(initialSession.transcript);
  const phaseRef = useRef<AgentTurnPhase>("ready");
  const stepRef = useRef(0);
  const toolActivityRef = useRef<ActiveToolEntry[]>([]);
  const lastToolSummaryRef = useRef(DEFAULT_TOOL_SUMMARY);
  const workflowStateRef = useRef<WorkflowState>(createIdleWorkflowState());
  const pendingPlanPromptRef = useRef(false);
  const planClarificationStateRef = useRef<PlanClarificationState | null>(null);
  const planReviewStateRef = useRef<PlanReviewState | null>(null);
  const buildProgressRef = useRef<PersistedBuildProgress | null>(null);
  const clientIdRef = useRef(`tui-${process.pid}-${Date.now().toString(36)}`);
  const lastAgentPromptInputRef = useRef<AgentPromptInput | undefined>(undefined);
  const lastUserPromptRef = useRef<string>("");
  const autopilotEnabledRef = useRef(false);
  const lastModeApprovalPresetRef = useRef<ApprovalPolicyPreset>("auto-safe");
  const sshToolOwnersRef = useRef<Set<string>>(new Set());
  const taskCount = tasks.length;
  const runningTaskCount = tasks.filter((task) => task.isRunning).length;
  const runningFleetCount = fleetAgents.filter((agent) => agent.state === "running").length;
  const autoTask = tasks.find((task) => task.kind === "auto");
  const activeToolCount = toolActivity.filter(
    (tool) => tool.status === "running"
  ).length;
  const autoModeLabel = createAutoModeLabel(autoTask);
  const autoModeLastAction =
    autoTask?.autoState?.lastAction ??
    autoTask?.lastResultSummary ??
    (autoTask ? "Waiting for the first autonomous cycle." : "Auto mode is off.");
  const autoModeNextRunLabel = formatAutoModeNextRun(autoTask, now);
  const executionModeLabel = formatExecutionModeLabel(executionMode);
  const isBusy = phase !== "ready";
  const isStreaming = phase === "streaming";
  const pendingApprovalCount = approvals.filter(
    (approval) => approval.state === "pending"
  ).length;
  const agentModeLabel =
    isBusy || runningFleetCount > 0 || runningTaskCount > 0
      ? "AGENT MODE"
      : "Agent idle";
  const syncSshWorkerTools = (agents: readonly RemoteWorkerView[]): void => {
    if (!remoteManager) {
      return;
    }

    const sshAgents = agents.filter((agent) => agent.host.trim().length > 0);
    const nextOwners = new Set(sshAgents.map((agent) => createSshToolOwner(agent.id)));

    for (const owner of sshToolOwnersRef.current) {
      if (!nextOwners.has(owner)) {
        toolRegistry.clearOwner(owner);
      }
    }

    for (const agent of sshAgents) {
      const owner = createSshToolOwner(agent.id);
      toolRegistry.replaceOwnerTools(
        owner,
        createSshWorkerToolRegistrations(agent, owner, remoteManager)
      );
    }

    sshToolOwnersRef.current = nextOwners;
  };

  useEffect(() => {
    const syncTools = (): void => {
      const nextTools = toolRegistry.listTools();
      const nextSignature = createToolSignature(nextTools);

      if (nextSignature === toolSignatureRef.current) {
        return;
      }

      toolSignatureRef.current = nextSignature;
      emitAppDebugLog(
        `loaded tools updated: ${nextTools.map((tool) => tool.name).join(", ")}`
      );
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

        if (
          event.type === "task_updated" &&
          event.session &&
          event.session.id === currentSessionRef.current.id &&
          phaseRef.current === "ready"
        ) {
          replaceSessionState(event.session);
        }
      });
    });
  }, [taskRunner]);

  useEffect(() => {
    if (!goalStore) {
      return;
    }

    void goalStore.listGoals().then((nextGoals) => {
      if (!disposedRef.current) {
        startTransition(() => {
          setGoals(nextGoals);
        });
      }
    });
  }, [goalStore]);

  useEffect(() => {
    if (!fleetManager) {
      return;
    }

    startTransition(() => {
      setFleetAgents(fleetManager.listAgents());
    });

    return fleetManager.subscribe((agents) => {
      if (!disposedRef.current) {
        startTransition(() => {
          setFleetAgents(agents);
        });
      }
    });
  }, [fleetManager]);

  useEffect(() => {
    if (!remoteManager) {
      return;
    }

    void remoteManager.list().then((agents) => {
      if (!disposedRef.current) {
        syncSshWorkerTools(agents);
        startTransition(() => {
          setRemoteAgents(agents);
        });
      }
    });
  }, [remoteManager]);

  useEffect(() => {
    let cancelled = false;

    const syncApprovals = async (): Promise<void> => {
      const [nextApprovals, nextApprovalStatus] = await Promise.all([
        approvalManager.list(),
        Promise.resolve(approvalManager.getStatus())
      ]);

      if (cancelled || disposedRef.current) {
        return;
      }

      startTransition(() => {
        setApprovals(nextApprovals);
        commitApprovalStatus(nextApprovalStatus);
      });
    };

    void syncApprovals();
    const interval = setInterval(() => {
      void syncApprovals();
    }, 1_500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [approvalManager]);

  useEffect(() => {
    approvalManager.setActiveSession(currentSession.id);
    approvalManager.setMode(executionMode);
    commitApprovalStatus(approvalManager.getStatus());
  }, [approvalManager, currentSession.id, executionMode]);

  useEffect(() => {
    if (!watcherStore) {
      return;
    }

    let cancelled = false;

    const syncWatchers = async (): Promise<void> => {
      const nextWatchers = await watcherStore.list();

      if (cancelled || disposedRef.current) {
        return;
      }

      startTransition(() => {
        setWatchers(nextWatchers);
      });
    };

    void syncWatchers();
    const interval = setInterval(() => {
      void syncWatchers();
    }, 2_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [watcherStore]);

  useEffect(() => {
    const attachmentId = `attachment-${currentSession.id}-${Date.now().toString(36)}`;
    const attachment = {
      attachedAt: Date.now(),
      clientId: clientIdRef.current,
      clientType: "tui" as const,
      id: attachmentId,
      isActive: true,
      metadata: {
        projectId: projectRecord.id
      },
      sessionId: currentSession.id
    };

    void sessionRegistryStore.attachClient(attachment);

    return () => {
      void sessionRegistryStore.detachClient(attachmentId);
    };
  }, [currentSession.id, projectRecord.id, sessionRegistryStore]);

  useEffect(() => {
    void sessionRegistryStore.save({
      activeRemoteHostId: executionContext.activeRemoteHostId,
      allowedRoots: [...executionContext.allowedRoots],
      backgroundState: "idle",
      createdAt: currentSession.createdAt,
      cwd: executionContext.cwd,
      lastActivityAt: Date.now(),
      mode: executionMode,
      model: appState.model,
      ownerId: "local-owner",
      projectId: projectRecord.id,
      provider: appState.provider,
      resumablePlanState: {
        activeTaskId: currentTaskIdRef.current,
        buildProgress: buildProgressRef.current,
        pendingPlanPrompt,
        planClarificationState,
        planReviewState,
        workflowState
      },
      scope: executionContext.scope,
      sessionId: currentSession.id,
      style: mode,
      metadata: {
        approvalStatus: approvalManager.getStatus(),
        autopilot: {
          enabled: autopilotEnabledRef.current,
          policy: approvalManager.getStatus().policy.preset
        },
        executionMode,
        responseMode: mode
      },
      title: currentSession.title,
      updatedAt: Date.now()
    });
  }, [
    approvalManager,
    appState.model,
    appState.provider,
    currentSession.createdAt,
    currentSession.id,
    currentSession.title,
    executionContext.activeRemoteHostId,
    executionContext.allowedRoots,
    executionContext.cwd,
    executionContext.scope,
    executionMode,
    mode,
    autopilotEnabled,
    pendingPlanPrompt,
    planClarificationState,
    planReviewState,
    projectRecord.id,
    sessionRegistryStore,
    workflowState
  ]);

  useEffect(() => {
    void projectRegistryStore.save({
      ...projectRecord,
      lastCwd: executionContext.cwd,
      lastScope: executionContext.scope,
      remoteHostId: executionContext.activeRemoteHostId,
      updatedAt: Date.now()
    });
  }, [
    executionContext.activeRemoteHostId,
    executionContext.cwd,
    executionContext.scope,
    projectRecord,
    projectRegistryStore
  ]);

  useEffect(() => {
    return modelRuntime.subscribe((snapshot) => {
      if (disposedRef.current) {
        return;
      }

      commitAppState(
        toAppRuntimeState(
          snapshot,
          createRuntimeStateOptions(executionContextRef.current, projectRecord)
        )
      );
    });
  }, [modelRuntime, projectRecord]);

  useEffect(() => {
    commitAppState(
      toAppRuntimeState(
        modelRuntime.getSnapshot(),
        createRuntimeStateOptions(executionContext, projectRecord)
      )
    );
  }, [executionContext, modelRuntime, projectRecord]);

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

  const commitCurrentSession = (nextSession: SessionRecord): void => {
    approvalManager.setActiveSession(nextSession.id);
    currentSessionRef.current = nextSession;
    commitApprovalStatus(approvalManager.getStatus());
    setCurrentSession(nextSession);
  };

  const commitComposerFlow = (nextFlow: ComposerFlow): void => {
    composerFlowRef.current = nextFlow;
    setComposerFlow(nextFlow);
  };

  const commitActiveFlow = (nextFlow: ActiveFlowContext | null): void => {
    activeFlowRef.current = nextFlow;
    setActiveFlow(nextFlow);
  };

  const commitAppState = (nextAppState: AppRuntimeState): void => {
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

  const commitApprovalStatus = (nextStatus: ApprovalManagerStatus): void => {
    setApprovalStatus({
      ...nextStatus,
      blanketGrant: nextStatus.blanketGrant
        ? { ...nextStatus.blanketGrant }
        : undefined,
      policy: {
        ...nextStatus.policy,
        blanketGrant: nextStatus.policy.blanketGrant
          ? { ...nextStatus.policy.blanketGrant }
          : undefined
      }
    });
  };

  const commitAutopilotEnabled = (enabled: boolean): void => {
    autopilotEnabledRef.current = enabled;
    setAutopilotEnabled(enabled);
  };

  const commitExecutionContext = (nextContext: ExecutionContext): void => {
    executionContextRef.current = nextContext;
    setExecutionContext(nextContext);
    commitAppState(
      toAppRuntimeState(
        modelRuntime.getSnapshot(),
        createRuntimeStateOptions(nextContext, projectRecord)
      )
    );
  };

  const syncApprovalPolicy = (nextPolicy: ExecutionContext["approvalPolicy"]): void => {
    approvalManager.setPolicy(nextPolicy);
    commitExecutionContext(
      executionContextController.update({
        approvalPolicy: nextPolicy
      })
    );
    commitApprovalStatus(approvalManager.getStatus());
  };

  const commitExecutionMode = (nextMode: ExecutionMode): void => {
    approvalManager.setMode(nextMode);
    executionModeRef.current = nextMode;
    emitAppDebugLog(
      `execution mode ${nextMode} tools: ${filterToolsForExecutionMode(tools, nextMode)
        .map((tool) => tool.name)
        .join(", ")}`
    );
    commitApprovalStatus(approvalManager.getStatus());
    setExecutionMode(nextMode);
  };

  const commitTaskContext = (nextTaskId?: string): void => {
    currentTaskIdRef.current = nextTaskId;
    approvalManager.setActiveTask(nextTaskId);
    commitApprovalStatus(approvalManager.getStatus());
  };

  const resolveModeApprovalPreset = (
    nextMode: ExecutionMode,
    options?: {
      autopilotEnabled?: boolean;
    }
  ): ApprovalPolicyPreset => {
    if (nextMode === "plan") {
      return "strict";
    }

    if (options?.autopilotEnabled ?? autopilotEnabledRef.current) {
      return approvalManager.getStatus().policy.preset ?? "auto-safe";
    }

    if (nextMode === "build") {
      return "auto-safe-medium";
    }

    return "auto-safe";
  };

  const applyDefaultApprovalPolicyForMode = (
    nextMode: ExecutionMode,
    options?: {
      autopilotEnabled?: boolean;
    }
  ): ApprovalPolicyPreset => {
    const currentPreset = approvalManager.getStatus().policy.preset ?? "strict";
    const preset = resolveModeApprovalPreset(nextMode, options);

    if (nextMode !== "plan" && (options?.autopilotEnabled ?? autopilotEnabledRef.current)) {
      return currentPreset;
    }

    if (nextMode !== "plan" && currentPreset !== lastModeApprovalPresetRef.current) {
      return currentPreset;
    }

    applyApprovalPreset(preset);
    lastModeApprovalPresetRef.current = preset;
    return preset;
  };

  const setAutopilotState = (
    enabled: boolean,
    policy?: ApprovalPolicyPreset
  ): ApprovalPolicyPreset => {
    commitAutopilotEnabled(enabled);

    if (enabled) {
      if (policy) {
        lastModeApprovalPresetRef.current = policy;
        return applyApprovalPreset(policy).preset ?? policy;
      }

      syncApprovalPolicy(approvalManager.getPolicy());
      return approvalManager.getStatus().policy.preset ?? "auto-safe";
    }

    return applyDefaultApprovalPolicyForMode(executionModeRef.current, {
      autopilotEnabled: false
    });
  };

  const commitPendingPlanPrompt = (nextValue: boolean): void => {
    pendingPlanPromptRef.current = nextValue;
    setPendingPlanPrompt(nextValue);
  };

  const commitPlanClarificationState = (
    nextValue: PlanClarificationState | null
  ): void => {
    planClarificationStateRef.current = nextValue;
    setPlanClarificationState(nextValue);
  };

  const commitPlanReviewState = (
    nextValue: PlanReviewState | null
  ): void => {
    planReviewStateRef.current = nextValue;
    setPlanReviewState(nextValue);
  };

  const commitMode = (nextMode: ResponseMode): void => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  const commitHistory = (nextHistory: readonly ModelMessage[]): void => {
    historyRef.current = nextHistory.map((message) => ({ ...message }));
  };

  const commitTranscript = (nextTranscript: TranscriptEntry[]): void => {
    transcriptRef.current = nextTranscript;
    setTranscript(nextTranscript);
  };

  const commitPhase = (nextPhase: AgentTurnPhase): void => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const commitStep = (nextStep: number): void => {
    stepRef.current = nextStep;
    setStep(nextStep);
  };

  const commitToolActivity = (nextToolActivity: ActiveToolEntry[]): void => {
    toolActivityRef.current = nextToolActivity;
    setToolActivity(nextToolActivity);
  };

  const commitLastToolSummary = (nextSummary: string): void => {
    lastToolSummaryRef.current = nextSummary;
    setLastToolSummary(nextSummary);
  };

  const commitWorkflowState = (nextWorkflowState: WorkflowState): void => {
    workflowStateRef.current = nextWorkflowState;
    setWorkflowState(nextWorkflowState);
  };

  const commitBuildProgress = (
    nextBuildProgress: PersistedBuildProgress | null
  ): void => {
    buildProgressRef.current = nextBuildProgress
      ? {
          ...nextBuildProgress,
          completedStepIndexes: [...nextBuildProgress.completedStepIndexes]
        }
      : null;
  };

  const replaceSessionState = (session: SessionRecord): void => {
    currentTurnIdRef.current += 1;
    commitCurrentSession(session);
    commitHistory(session.history);
    commitTranscript(session.transcript);
    commitActiveFlow(null);
    commitComposerFlow({ type: "idle" });
    commitPendingPlanPrompt(false);
    commitPlanClarificationState(null);
    commitPlanReviewState(null);
    commitBuildProgress(null);
    commitTaskContext(undefined);
    commitPhase("ready");
    commitStep(0);
    commitToolActivity([]);
    commitLastToolSummary(DEFAULT_TOOL_SUMMARY);
    commitWorkflowState(createIdleWorkflowState());
    lastModeApprovalPresetRef.current =
      approvalManager.getStatus().policy.preset ?? "auto-safe";
    lastAgentPromptInputRef.current = undefined;
    lastUserPromptRef.current = "";
  };

  const restoreSessionWorkflowState = (
    entry: SessionRegistryEntry
  ): void => {
    const savedState = entry.resumablePlanState;

    if (!savedState || typeof savedState !== "object") {
      commitTaskContext(undefined);
      return;
    }

    if (typeof savedState.activeTaskId === "string") {
      commitTaskContext(savedState.activeTaskId);
    } else {
      commitTaskContext(undefined);
    }

    if (typeof savedState.pendingPlanPrompt === "boolean") {
      commitPendingPlanPrompt(savedState.pendingPlanPrompt);
    }

    if (
      savedState.workflowState &&
      typeof savedState.workflowState === "object" &&
      typeof (savedState.workflowState as WorkflowState).currentStep === "number"
    ) {
      commitWorkflowState(savedState.workflowState as WorkflowState);
    }

    if (savedState.planClarificationState && typeof savedState.planClarificationState === "object") {
      commitPlanClarificationState(
        savedState.planClarificationState as PlanClarificationState
      );
    }

    if (
      savedState.planReviewState &&
      typeof savedState.planReviewState === "object"
    ) {
      commitPlanReviewState(savedState.planReviewState as PlanReviewState);
    }

    if (isPersistedBuildProgress(savedState.buildProgress)) {
      commitBuildProgress(savedState.buildProgress);
    } else {
      commitBuildProgress(null);
    }
  };

  const appendSystemMessage = (
    content: string,
    persisted = false
  ): TranscriptEntry[] => {
    const nextTranscript = appendTranscriptEntry(
      transcriptRef.current,
      createSystemEntry(content, persisted)
    );

    commitTranscript(nextTranscript);
    return nextTranscript;
  };

  const persistSessionSnapshot = async (): Promise<void> => {
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

  const beginLoginFlow = (): void => {
    const providers = modelRuntime.listProviders();
    const loginFlow = primeFlow(
      createFlow("Login", createLoginFlowSteps(providers))
    );

    commitActiveFlow({
      id: "login",
      flow: loginFlow
    });
    setComposerValue("");
  };

  const beginMcpAddFlow = (): void => {
    const draft = createDefaultMcpDraft();
    const flow = primeFlow(createFlow("MCP Add", createMcpDraftFlowSteps("add")));

    commitActiveFlow({
      draft,
      id: "mcp_add",
      flow
    });
    setComposerValue("");
  };

  const beginSshAddFlow = (): void => {
    const draft = createDefaultSshWorkerDraft();
    const flow = primeFlow(createFlow("SSH Worker Add", createSshWorkerFlowSteps()));

    commitActiveFlow({
      draft,
      flow,
      id: "ssh_add"
    });
    setComposerValue("");
  };

  const beginMcpEditFlow = (server: Awaited<ReturnType<McpManager["getServer"]>>): void => {
    if (!server) {
      return;
    }

    const draft = createDraftFromManagedServer(server);
    const flow = primeFlow(
      createFlow(
        "MCP Edit",
        createMcpDraftFlowSteps("edit"),
        {
          ...draft,
          args: draft.args.join(" "),
          env: formatStringRecord(draft.env),
          headers: formatStringRecord(draft.headers),
          tools: draft.tools.join(", ")
        }
      )
    );

    commitActiveFlow({
      draft,
      flow,
      id: "mcp_edit",
      originalName: server.name
    });
    setComposerValue("");
  };

  const beginMarketplaceInstallFlow = (
    name: string,
    draft: McpServerDraft,
    prompts: readonly MarketplacePromptField[] = []
  ): void => {
    const promptState = Object.fromEntries(
      prompts.map((prompt) => {
        const existingValue =
          prompt.target === "env"
            ? draft.env[prompt.key]
            : draft.headers[prompt.key];

        return [createMarketplacePromptStateKey(prompt), existingValue ?? ""];
      })
    );
    const flow = primeFlow(
      createFlow(
        "MCP Install",
        createMarketplaceInstallFlowSteps(draft, prompts),
        {
          ...draft,
          args: draft.args.join(" "),
          env: formatStringRecord(draft.env),
          headers: formatStringRecord(draft.headers),
          tools: draft.tools.join(", "),
          url: draft.url ?? "",
          ...promptState
        }
      )
    );

    commitActiveFlow({
      draft,
      flow,
      id: "mcp_install",
      installName: name,
      prompts
    });
    setComposerValue("");
  };

  const refreshGoals = async (): Promise<readonly GoalRecord[]> => {
    if (!goalStore) {
      return [];
    }

    const nextGoals = await goalStore.listGoals();

    if (!disposedRef.current) {
      startTransition(() => {
        setGoals(nextGoals);
      });
    }

    return nextGoals;
  };

  const captureGoal = async (input: {
    description: string;
    source: GoalRecord["source"];
    title: string;
  }): Promise<GoalRecord | undefined> => {
    if (!goalStore) {
      return undefined;
    }

    const existing = (await goalStore.listGoals()).find((goal) => {
      return (
        goal.state !== "cancelled" &&
        goal.state !== "complete" &&
        goal.title.trim().toLowerCase() === input.title.trim().toLowerCase()
      );
    });

    if (existing) {
      return existing;
    }

    const goal = await goalStore.createGoal({
      description: input.description,
      nextBestAction: "Review the task, then run /plan or execute directly if already approved.",
      source: input.source,
      title: input.title,
      whyItMatters: "This was requested or scheduled in the active workspace."
    });
    await refreshGoals();
    return goal;
  };

  const refreshRemoteAgents = async (): Promise<readonly RemoteWorkerView[]> => {
    if (!remoteManager) {
      return [];
    }

    const nextAgents = await remoteManager.list();
    syncSshWorkerTools(nextAgents);

    if (!disposedRef.current) {
      startTransition(() => {
        setRemoteAgents(nextAgents);
      });
    }

    return nextAgents;
  };

  const refreshApprovals = async (): Promise<readonly ApprovalRequest[]> => {
    const nextApprovals = await approvalManager.list();
    const nextStatus = approvalManager.getStatus();

    if (!disposedRef.current) {
      startTransition(() => {
        setApprovals(nextApprovals);
        commitApprovalStatus(nextStatus);
      });
    }

    return nextApprovals;
  };

  const approvePendingForPreset = async (
    preset: ApprovalPolicyPreset
  ): Promise<number> => {
    const pendingApprovals = await approvalManager.listPending();
    const eligibleApprovals = pendingApprovals.filter((approval) => {
      if (approval.metadata.sessionId !== currentSessionRef.current.id) {
        return false;
      }

      if (preset === "full") {
        return true;
      }

      if (preset === "approve-all") {
        return approval.safetyLevel !== "dangerous";
      }

      if (preset === "auto-safe-medium") {
        return approval.safetyLevel !== "dangerous";
      }

      if (preset === "auto-safe") {
        return approval.safetyLevel === "safe";
      }

      return false;
    });

    for (const approval of eligibleApprovals) {
      await approvalManager.approve(approval.id);
    }

    if (eligibleApprovals.length > 0) {
      await refreshApprovals();
    }

    return eligibleApprovals.length;
  };

  const applyApprovalPreset = (
    preset: ApprovalPolicyPreset
  ): ExecutionContext["approvalPolicy"] => {
    const nextPolicy = approvalManager.setPolicyPreset(preset);
    syncApprovalPolicy(nextPolicy);
    return nextPolicy;
  };

  const grantApprovalScope = async (
    scope: "once" | "task" | "session" | "all"
  ): Promise<void> => {
    const effectiveScope = scope === "all" ? "session" : scope;
    const granted = await approvalManager.grant(effectiveScope, {
      approvePending: true,
      maxSafety: "medium"
    });

    if (!granted) {
      throw new Error(
        effectiveScope === "task"
          ? "No active task is running yet, so task-wide approval cannot be applied."
          : effectiveScope === "session"
            ? "No active session is available for session-wide approval."
            : "No active session is available for blanket approval."
      );
    }

    syncApprovalPolicy(approvalManager.getPolicy());
    await refreshApprovals();
  };

  const resumeBlockedTask = async (
    transcriptPrompt = "Continue with the approved task."
  ): Promise<void> => {
    if (!lastAgentPromptInputRef.current) {
      return;
    }

    await executeAgentPrompt({
      ...lastAgentPromptInputRef.current,
      rememberUserPrompt: false,
      transcriptPrompt
    });
  };

  const tryHandleNaturalApprovalInput = async (
    input: string
  ): Promise<boolean> => {
    const pendingApprovals = await approvalManager.listPending();
    const intent = parseApprovalShortcutIntent(input, {
      activeSessionId: currentSessionRef.current.id,
      activeTaskId: currentTaskIdRef.current,
      pendingApprovalCount: pendingApprovals.length
    });

    if (!intent) {
      return false;
    }

    if (intent.enableAutopilot !== undefined) {
      const nextPolicy = setAutopilotState(intent.enableAutopilot, intent.policy);
      if (intent.enableAutopilot) {
        await approvePendingForPreset(intent.policy ?? nextPolicy);
      }
      await refreshApprovals();
    } else if (intent.policy) {
      applyApprovalPreset(intent.policy);
      await approvePendingForPreset(intent.policy);
      await refreshApprovals();
    }

    if (intent.scope) {
      await grantApprovalScope(intent.scope);
    }

    if (intent.approveLatestPending) {
      await approvalManager.approveLatestPending();
      await refreshApprovals();
    }

    if (!disposedRef.current) {
      startTransition(() => {
        appendSystemMessage(intent.summary, true);
      });
    }

    if (intent.rerunBlockedTask && lastAgentPromptInputRef.current) {
      await resumeBlockedTask();
    }

    return true;
  };

  const tryHandleNaturalSshInput = async (input: string): Promise<boolean> => {
    if (!remoteManager) {
      return false;
    }

    const agents = await refreshRemoteAgents();
    const intent = parseNaturalSshCommand(input, agents);

    if (!intent) {
      return false;
    }

    const result = await remoteManager.runCommand(intent.agent.id, "sh", [
      "-lc",
      intent.command
    ]);
    await refreshRemoteAgents();

    if (!disposedRef.current) {
      startTransition(() => {
        appendSystemMessage(
          formatSshRunResult(intent.agent.id, intent.command, result),
          true
        );
      });
    }

    return true;
  };

  const refreshWatchers = async (): Promise<readonly WatcherRecord[]> => {
    if (!watcherStore) {
      return [];
    }

    const nextWatchers = await watcherStore.list();

    if (!disposedRef.current) {
      startTransition(() => {
        setWatchers(nextWatchers);
      });
    }

    return nextWatchers;
  };

  const cancelWatchers = async (
    watcherIds: readonly string[],
    detail: string
  ): Promise<number> => {
    if (!watcherStore || watcherIds.length === 0) {
      return 0;
    }

    let cancelledCount = 0;

    for (const watcherId of watcherIds) {
      const watcher = await watcherStore.get(watcherId);

      if (!watcher || watcher.status === "completed" || watcher.status === "cancelled") {
        continue;
      }

      await watcherStore.update({
        ...watcher,
        activityAt: Date.now(),
        detail,
        metadata: {
          ...(watcher.metadata ?? {}),
          cancelledBy: "user"
        },
        status: "cancelled",
        updatedAt: Date.now()
      });
      cancelledCount += 1;
    }

    await refreshWatchers();
    return cancelledCount;
  };

  const stopAllTasks = async (
    action: "cancel" | "stop"
  ): Promise<number> => {
    let changedCount = 0;

    for (const task of taskRunner.listTasks()) {
      if (
        task.state === "cancelled" ||
        (task.kind === "interactive" && task.state === "complete")
      ) {
        continue;
      }

      const nextTask =
        action === "cancel"
          ? await taskRunner.cancelTask(task.id)
          : await taskRunner.stopTask(task.id);

      if (!nextTask) {
        continue;
      }

      changedCount += 1;

      if (nextTask.watcherIds.length > 0) {
        await cancelWatchers(
          nextTask.watcherIds,
          `Task ${nextTask.id} was ${action === "cancel" ? "cancelled" : "stopped"} by the user.`
        );
      }
    }

    return changedCount;
  };

  const changeDirectory = async (nextPath: string): Promise<ExecutionContext> => {
    const context = executionContextRef.current;

    if (context.scope === "remote-host") {
      if (!remoteManager || !context.activeRemoteHostId) {
        throw new Error("Remote-host scope is active, but no remote host is attached.");
      }

      const targetPath = resolvePathFromContext(context, nextPath);
      const result = await remoteManager.runCommand(context.activeRemoteHostId, "sh", [
        "-lc",
        `cd -- ${shellQuote(targetPath)} && pwd`
      ]);

      if (result.code !== 0) {
        throw new Error(formatRemoteDirectoryError(targetPath, result.stderr));
      }

      const nextContext = executionContextController.update({
        cwd: result.stdout.trim() || targetPath
      });
      commitExecutionContext(nextContext);
      return nextContext;
    }

    const targetPath = resolvePathFromContext(context, nextPath);
    ensureLocalPathAllowed(context, targetPath);

    let nextStats;

    try {
      nextStats = await stat(targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Path "${targetPath}" does not exist.`);
      }

      throw error;
    }

    if (!nextStats.isDirectory()) {
      throw new Error(`Path "${targetPath}" is not a directory.`);
    }

    const nextContext = executionContextController.update({
      cwd: targetPath
    });
    commitExecutionContext(nextContext);
    return nextContext;
  };

  const grantScopeAccess = async (
    grant: {
      hostId?: string;
      scope: FilesystemGrant["scope"];
    }
  ): Promise<ExecutionContext> => {
    const grantRecord: FilesystemGrant = {
      createdAt: Date.now(),
      hostId: grant.hostId,
      id: `grant-${grant.scope}-${Date.now().toString(36)}`,
      scope: grant.scope,
      source: "user"
    };
    const current = executionContextRef.current;

    if (grant.scope === "remote-host") {
      if (!grant.hostId) {
        throw new Error("Usage: /scope grant remote-host <host-id>");
      }

      if (!remoteManager) {
        throw new Error("Remote-host scope is unavailable for this runtime.");
      }

      const agents = await remoteManager.list();
      const agent = agents.find((entry) => entry.id === grant.hostId);

      if (!agent) {
        throw new Error(`Remote worker "${grant.hostId}" was not found.`);
      }

      executionContextController.addGrant(grantRecord);
      const nextContext = executionContextController.update({
        activeRemoteHostId: agent.id,
        cwd: "/",
        scope: "remote-host"
      });
      commitExecutionContext(nextContext);
      return nextContext;
    }

    executionContextController.addGrant(grantRecord);
    const nextContext = executionContextController.update({
      activeRemoteHostId: undefined,
      cwd:
        grant.scope === "workspace"
          ? projectRecord.path
          : grant.scope === "home"
            ? homedir()
            : current.cwd,
      scope: grant.scope
    });
    commitExecutionContext(nextContext);
    return nextContext;
  };

  const revokeScopeAccess = async (
    grantIdOrScope: string
  ): Promise<ExecutionContext> => {
    const current = executionContextController.revokeGrant(grantIdOrScope);

    if (
      current.scope === "remote-host" &&
      current.activeRemoteHostId &&
      (grantIdOrScope === current.activeRemoteHostId ||
        grantIdOrScope.toLowerCase() === "remote-host")
    ) {
      const nextContext = executionContextController.update({
        activeRemoteHostId: undefined,
        cwd: projectRecord.path,
        scope: "workspace"
      });
      commitExecutionContext(nextContext);
      return nextContext;
    }

    if (
      (grantIdOrScope.toLowerCase() === current.scope ||
        grantIdOrScope.toLowerCase() === "full-machine" ||
        grantIdOrScope.toLowerCase() === "home") &&
      current.scope !== "workspace"
    ) {
      const nextContext = executionContextController.update({
        activeRemoteHostId: undefined,
        cwd: projectRecord.path,
        scope: "workspace"
      });
      commitExecutionContext(nextContext);
      return nextContext;
    }

    commitExecutionContext(current);
    return current;
  };

  const assignFleetTask = async (
    role: WorkerSpec["role"],
    task: string
  ): Promise<FleetAgentRecord> => {
    if (!fleetManager) {
      throw new Error("Fleet support is unavailable in this runtime.");
    }

    const agent = await fleetManager.assign({
      mode: executionModeRef.current === "plan" ? "plan" : "build",
      parentSessionId: currentSessionRef.current.id,
      role,
      style: modeRef.current,
      task
    });

    await timelineStore?.record({
      detail: task,
      sessionId: currentSessionRef.current.id,
      summary: `Fleet agent ${agent.id} assigned (${role})`,
      type: "worker"
    });

    return agent;
  };

  const buildInteractiveTaskRecord = (
    input: AgentPromptInput,
    taskId: string,
    transcriptPrompt: string
  ): BackgroundTaskRecord => {
    const existing = taskRunner.getTask(taskId);
    const now = Date.now();

    return {
      approvalRequestIds: existing?.approvalRequestIds ?? [],
      assignedAgentId: existing?.assignedAgentId,
      autoState: existing?.autoState,
      blockedReason: undefined,
      createdAt: existing?.createdAt ?? now,
      currentStep: "Preparing prompt context.",
      goalId: existing?.goalId,
      id: taskId,
      intervalMinutes: existing?.intervalMinutes ?? 0,
      kind: "interactive",
      lastError: undefined,
      lastEventAt: now,
      lastResultSummary: existing?.lastResultSummary,
      lastRunAt: existing?.lastRunAt,
      metadata: existing?.metadata,
      nextRunAt: now,
      prompt: input.prompt,
      requestedAction: undefined,
      resumePrompt: input.prompt,
      retries: existing?.retries ?? 0,
      runCount: existing?.runCount ?? 0,
      sessionId: currentSessionRef.current.id,
      state: "planning",
      title: existing?.title ?? summarizeText(transcriptPrompt || input.prompt),
      transcriptPrompt,
      updatedAt: now,
      validationStatus: "idle",
      watcherIds: existing?.watcherIds ?? []
    };
  };

  const readInteractiveTaskControlDecision = (
    taskId: string
  ):
    | { ok: true }
    | { ok: false; reason?: string; state: "cancelled" | "paused" } => {
    const action = taskRunner.getTask(taskId)?.requestedAction;

    if (action === "pause") {
      return {
        ok: false,
        reason: "Paused by user.",
        state: "paused"
      };
    }

    if (action === "stop" || action === "cancel") {
      return {
        ok: false,
        reason: "Stopped by user.",
        state: "cancelled"
      };
    }

    return {
      ok: true
    };
  };

  const executeTrackedTask = async (
    task: BackgroundTaskView,
    options?: {
      retry?: boolean;
      transcriptPrompt?: string;
    }
  ): Promise<void> => {
    const nextTask =
      options?.retry
        ? await taskRunner.retryTask(task.id)
        : await taskRunner.resumeTask(task.id);

    if (!nextTask) {
      throw new Error(`Task "${task.id}" was not found.`);
    }

    if (nextTask.kind !== "interactive") {
      await taskRunner.runTaskNow(nextTask.id);
      return;
    }

    await executeAgentPrompt({
      prompt: nextTask.resumePrompt ?? nextTask.prompt,
      rememberUserPrompt: false,
      transcriptPrompt:
        options?.transcriptPrompt ??
        nextTask.transcriptPrompt ??
        nextTask.title
    });
  };

  const handleCommand = async (
    input: string
  ): Promise<boolean> => {
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
        case "cwd":
          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatExecutionContextStatus(
                  executionContextRef.current,
                  projectRecord,
                  executionContextController.getGrants()
                )
              );
            });
          }

          return true;
        case "cd": {
          const nextContext = await changeDirectory(command.path);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Current directory set to ${formatPathForDisplay(nextContext, nextContext.cwd)}.`
              );
            });
          }

          return true;
        }
        case "scope":
        {
          const nextApprovals = await refreshApprovals();
          const nextWatchers = await refreshWatchers();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatScopeStatus({
                  approvals: nextApprovals,
                  context: executionContextRef.current,
                  grants: executionContextController.getGrants(),
                  project: projectRecord,
                  watchers: nextWatchers
                })
              );
            });
          }

          return true;
        }
        case "scope_grant": {
          const nextContext = await grantScopeAccess({
            hostId: command.hostId,
            scope: command.grantScope
          });

          await timelineStore?.record({
            detail: command.hostId ?? nextContext.cwd,
            sessionId: currentSessionRef.current.id,
            summary: `Scope granted: ${readScopeLabel(command.grantScope)}`,
            type: "approval"
          });

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Scope set to ${readScopeLabel(nextContext.scope)}${nextContext.activeRemoteHostId ? ` (${nextContext.activeRemoteHostId})` : ""}.`
              );
            });
          }

          return true;
        }
        case "scope_revoke": {
          const nextContext = await revokeScopeAccess(command.grantIdOrScope);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Revoked "${command.grantIdOrScope}". Active scope is ${readScopeLabel(nextContext.scope)}.`
              );
            });
          }

          return true;
        }
        case "approvals": {
          const nextApprovals = await refreshApprovals();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatApprovalList(nextApprovals, approvalManager.getStatus())
              );
            });
          }

          return true;
        }
        case "approve_scope": {
          const hadPendingApprovals =
            (await approvalManager.listPending()).length > 0;
          await grantApprovalScope(command.scope);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                command.scope === "once"
                  ? "Approved the next safe/medium action once."
                  : command.scope === "task"
                    ? "Approved all safe/medium actions for the current task."
                    : command.scope === "session" || command.scope === "all"
                      ? "Approved all safe/medium actions for the current session."
                      : "Approved all safe/medium actions until the blanket grant is changed."
              );
            });
          }

          if (
            hadPendingApprovals &&
            (await approvalManager.listPending()).length === 0
          ) {
            await resumeBlockedTask();
          }

          return true;
        }
        case "approve_policy": {
          const hadPendingApprovals =
            (await approvalManager.listPending()).length > 0;
          const nextPolicy = applyApprovalPreset(command.policy);
          await approvePendingForPreset(command.policy);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Approval policy set to ${nextPolicy.preset ?? command.policy}.`
              );
            });
          }

          if (
            hadPendingApprovals &&
            (await approvalManager.listPending()).length === 0
          ) {
            await resumeBlockedTask();
          }

          return true;
        }
        case "autopilot_on": {
          const hadPendingApprovals =
            (await approvalManager.listPending()).length > 0;
          const nextPolicy = setAutopilotState(true, command.policy);
          await approvePendingForPreset(nextPolicy);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Autopilot enabled with ${nextPolicy} approval policy for this session.`
              );
            });
          }

          if (
            hadPendingApprovals &&
            (await approvalManager.listPending()).length === 0
          ) {
            await resumeBlockedTask("Continue in autopilot mode.");
          }

          return true;
        }
        case "autopilot_off": {
          const nextPolicy = setAutopilotState(false);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Autopilot disabled. Active approval policy is ${nextPolicy}.`
              );
            });
          }

          return true;
        }
        case "autopilot_status": {
          const nextApprovals = await refreshApprovals();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatAutopilotStatus({
                  approvalStatus: approvalManager.getStatus(),
                  autopilotEnabled: autopilotEnabledRef.current,
                  context: executionContextRef.current,
                  executionMode: executionModeRef.current,
                  isBusy,
                  pendingApprovalCount: nextApprovals.filter(
                    (approval) => approval.state === "pending"
                  ).length
                })
              );
            });
          }

          return true;
        }
        case "watchers": {
          const nextWatchers = await refreshWatchers();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatWatcherList(nextWatchers));
            });
          }

          return true;
        }
        case "watcher_show": {
          const watcher = watcherStore
            ? await watcherStore.get(command.id)
            : undefined;

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                watcher
                  ? formatWatcherDetail(watcher)
                  : `Watcher "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "watcher_cancel": {
          if (isAllTarget(command.id)) {
            const nextWatchers = await refreshWatchers();

            for (const watcher of nextWatchers) {
              if (watcher.taskId) {
                await taskRunner.stopTask(watcher.taskId).catch(() => undefined);
              }
            }

            const cancelledCount = await cancelWatchers(
              nextWatchers.map((watcher) => watcher.id),
              "Cancelled from /watcher cancel all."
            );

            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Cancelled ${cancelledCount} watcher${cancelledCount === 1 ? "" : "s"}.`);
              });
            }

            return true;
          }

          const watcher = watcherStore
            ? await watcherStore.get(command.id)
            : undefined;

          if (!watcher) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Watcher "${command.id}" was not found.`);
              });
            }

            return true;
          }

          if (watcher.taskId) {
            await taskRunner.stopTask(watcher.taskId).catch(() => undefined);
          }

          await cancelWatchers([watcher.id], "Cancelled from /watcher cancel.");

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Watcher ${watcher.id} cancelled.`);
            });
          }

          return true;
        }
        case "approve": {
          const approved = await approvalManager.approve(command.id);
          const nextApprovals = await refreshApprovals();

          if (approved) {
            await timelineStore?.record({
              detail: approved.detail,
              sessionId: currentSessionRef.current.id,
              summary: `Approval granted: ${approved.summary}`,
              type: "approval"
            });
          }

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                approved
                  ? `Approved ${approved.id}: ${approved.summary}\n\n${formatApprovalList(nextApprovals, approvalManager.getStatus())}`
                  : `Approval "${command.id}" was not found.`
              );
            });
          }

          if (approved && nextApprovals.every((request) => request.state !== "pending")) {
            await resumeBlockedTask();
          }

          return true;
        }
        case "reject": {
          const rejected = await approvalManager.reject(command.id);
          const nextApprovals = await refreshApprovals();

          if (rejected) {
            await timelineStore?.record({
              detail: rejected.detail,
              sessionId: currentSessionRef.current.id,
              summary: `Approval rejected: ${rejected.summary}`,
              type: "approval"
            });
          }

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                rejected
                  ? `Rejected ${rejected.id}: ${rejected.summary}\n\n${formatApprovalList(nextApprovals, approvalManager.getStatus())}`
                  : `Approval "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
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
              appendSystemMessage(
                `Active model set to ${snapshot.model} on ${snapshot.providerLabel}.`
              );
            });
          }

          return true;
        }
        case "goals": {
          const nextGoals = await refreshGoals();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatGoalList(nextGoals));
            });
          }

          return true;
        }
        case "goal_show": {
          if (!goalStore) {
            throw new Error("Goal management is unavailable for this runtime.");
          }

          const goal = await goalStore.loadGoal(command.goalId);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                goal
                  ? formatGoalDetail(goal)
                  : `Goal "${command.goalId}" was not found.`
              );
            });
          }

          return true;
        }
        case "goal_adopt": {
          if (!goalStore) {
            throw new Error("Goal management is unavailable for this runtime.");
          }

          const goal = await goalStore.loadGoal(command.goalId);

          if (!goal) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Goal "${command.goalId}" was not found.`);
              });
            }

            return true;
          }

          await goalStore.saveGoal({
            ...goal,
            nextBestAction:
              goal.nextBestAction ?? "Run /plan and describe the work for this goal.",
            state: "planning"
          });
          const nextGoals = await refreshGoals();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Goal "${goal.title}" adopted. Next action: ${goal.nextBestAction ?? "Run /plan for this goal."}`
              );
            });
          }

          void nextGoals;
          return true;
        }
        case "goal_dismiss": {
          if (!goalStore) {
            throw new Error("Goal management is unavailable for this runtime.");
          }

          const goal = await goalStore.loadGoal(command.goalId);

          if (!goal) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Goal "${command.goalId}" was not found.`);
              });
            }

            return true;
          }

          await goalStore.saveGoal({
            ...goal,
            state: "cancelled"
          });
          await refreshGoals();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Goal "${goal.title}" dismissed.`);
            });
          }

          return true;
        }
        case "fleet_start":
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          fleetManager.start();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage("Fleet mode started. Use /fleet assign <role> <task> to delegate work.");
            });
          }

          return true;
        case "fleet_stop":
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          await fleetManager.stop();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage("Fleet mode stopped.");
            });
          }

          return true;
        case "fleet_status":
          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatAgentList(fleetAgents, fleetManager?.isEnabled() ?? false));
            });
          }

          return true;
        case "agents":
          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatAgentList(fleetAgents, fleetManager?.isEnabled() ?? false));
            });
          }

          return true;
        case "fleet_assign": {
          const agent = await assignFleetTask(command.role, command.task);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Assigned sub-agent ${agent.id} (${agent.role}) to: ${agent.task}`
              );
            });
          }

          return true;
        }
        case "agent_show": {
          const agent = fleetManager?.getAgent(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent
                  ? formatAgentDetail(agent)
                  : `Agent "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "agent_pause": {
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          const agent = await fleetManager.pauseAgent(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent
                  ? `Agent ${agent.id} is ${agent.state}.`
                  : `Agent "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "agent_resume": {
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          const agent = await fleetManager.resumeAgent(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent
                  ? `Agent ${agent.id} is ${agent.state}.`
                  : `Agent "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "agent_stop": {
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          const agent = await fleetManager.stopAgent(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent
                  ? `Agent ${agent.id} is ${agent.state}.`
                  : `Agent "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "agent_restart": {
          if (!fleetManager) {
            throw new Error("Fleet support is unavailable for this runtime.");
          }

          const agent = await fleetManager.restartAgent(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent
                  ? `Agent ${agent.id} is ${agent.state}.`
                  : `Agent "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "orchestrator_status":
        case "orchestrator_queue":
        case "orchestrator_health": {
          const nextApprovals = await refreshApprovals();
          const nextWatchers = await refreshWatchers();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatOrchestratorStatus({
                  approvals: nextApprovals,
                  context: executionContextRef.current,
                  executionMode,
                  fleetAgents,
                  goals,
                  remoteAgents,
                  tasks,
                  watchers: nextWatchers
                })
              );
            });
          }

          return true;
        }
        case "remote_list": {
          const agents = await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatRemoteList(agents));
            });
          }

          return true;
        }
        case "remote_status": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const agents = await remoteManager.list();
          const agent = agents.find((entry) => entry.id === command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                agent ? formatRemoteDetail(agent) : `Remote worker "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "remote_connect": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const agent = await remoteManager.connect(command.id);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Remote worker "${command.id}" is ${agent.status}.`);
            });
          }

          return true;
        }
        case "remote_disconnect": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const agent = await remoteManager.disconnect(command.id);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Remote worker "${command.id}" is ${agent.status}.`);
            });
          }

          return true;
        }
        case "remote_remove": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const removed = await remoteManager.remove(command.id);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                removed
                  ? `Removed remote worker "${command.id}".`
                  : `Remote worker "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "remote_add": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          await remoteManager.add({
            capabilities: ["run_command", "read_file", "write_file"],
            connectionType: "ssh",
            host: command.host,
            id: command.id,
            name: command.id,
            port: command.port,
            role: "general",
            status: "offline",
            username: command.username
          });
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Added remote worker "${command.id}" (${command.host}).`);
            });
          }

          return true;
        }
        case "ssh_list": {
          const agents = (await refreshRemoteAgents()).filter((agent) => agent.host.length > 0);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatRemoteList(agents));
            });
          }

          return true;
        }
        case "ssh_test": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const result = await remoteManager.testConnection(command.name);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                result.ok
                  ? `SSH worker "${command.name}" connected successfully.\n${result.output}`
                  : `SSH worker "${command.name}" failed to connect.\n${result.output}`
              );
            });
          }

          return true;
        }
        case "ssh_run": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const result = await remoteManager.runCommand(command.name, "sh", [
            "-lc",
            command.command
          ]);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatSshRunResult(command.name, command.command, result));
            });
          }

          return true;
        }
        case "ssh_remove":
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          await remoteManager.remove(command.name);
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Removed SSH worker "${command.name}".`);
            });
          }

          return true;
        case "ssh_add":
          if (!disposedRef.current) {
            startTransition(() => {
              beginSshAddFlow();
            });
          }

          return true;
        case "ssh_add_inline":
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          await remoteManager.add({
            capabilities: ["run_command", "read_file", "write_file"],
            connectionType: "ssh",
            host: command.host,
            id: command.name,
            name: command.name,
            port: command.port,
            role: "devops",
            status: "offline",
            username: command.username
          });
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatSshAddedMessage(command.name, command.host));
            });
          }

          return true;
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
        case "mcp_refresh": {
          const result = await mcpManager.refresh();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatMcpReloadSummary("Reloaded MCP registry.", result)
              );
            });
          }

          await timelineStore?.record({
            sessionId: currentSessionRef.current.id,
            summary: "MCP registry refreshed",
            type: "mcp_change"
          });
          return true;
        }
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
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Enabled MCP server "${command.name}".`,
                  result
                )
              );
            });
          }

          return true;
        }
        case "mcp_disable": {
          const result = await mcpManager.disableServer(command.name);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Disabled MCP server "${command.name}".`,
                  result
                )
              );
            });
          }

          return true;
        }
        case "mcp_remove": {
          const result = await mcpManager.removeServer(command.name);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Removed MCP server "${command.name}".`,
                  result
                )
              );
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
          if (command.prompt) {
            await captureGoal({
              description: command.prompt,
              source: "user",
              title: summarizeText(command.prompt)
            });
            await startPlanWorkflow(command.prompt);
            return true;
          }

          if (!disposedRef.current) {
            startTransition(() => {
              commitExecutionMode("plan");
              applyDefaultApprovalPolicyForMode("plan");
              commitBuildProgress(null);
              commitPendingPlanPrompt(true);
              commitPlanClarificationState(null);
              commitPlanReviewState(null);
              commitWorkflowState({
                currentStep: 0,
                currentStepLabel: "Waiting for task",
                progressLabel: "Describe what you want planned",
                totalSteps: 0
              });
              appendSystemMessage(
                "PLAN mode enabled. Describe the task you want planned. I will inspect the codebase in read-only mode, ask clarifying questions if needed, then generate TODO + plan.md.",
                true
              );
            });
          }
          return true;
        case "build": {
          emitAppDebugLog("/build handled");
          const plan = await readPlanDocument(workspaceRoot);
          applyDefaultApprovalPolicyForMode("build");
          await executeSavedPlan(plan);
          return true;
        }
        case "resume": {
          emitAppDebugLog("/resume handled");
          const plan = await readPlanDocument(workspaceRoot);
          const buildState =
            deriveResumableBuildStateFromProgress(buildProgressRef.current, plan) ??
            deriveResumableBuildState(currentSessionRef.current.transcript, plan);

          if (!buildState.canResume) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(buildState.message);
              });
            }

            return true;
          }

          applyDefaultApprovalPolicyForMode("build");

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(buildState.message, true);
            });
          }

          await executeSavedPlan(plan, {
            completedSteps: buildState.completedSteps,
            startStepIndex: buildState.startStepIndex
          });
          return true;
        }
        case "new": {
          const session = await sessionStore.createSession(
            createInitialSessionState()
          );

          if (!disposedRef.current) {
            startTransition(() => {
              commitAutopilotEnabled(false);
              applyDefaultApprovalPolicyForMode("normal");
              commitPendingPlanPrompt(false);
              replaceSessionState(session);
            });
          }

          return true;
        }
        case "list": {
          const sessions = await sessionStore.listSessions();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatSessionList(sessions, currentSessionRef.current.id)
              );
            });
          }

          return true;
        }
        case "memory_global_show": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore) {
            throw new Error("Global memory commands are unavailable for this runtime.");
          }

          const memories = (await extendedMemoryStore.listMemories()).filter(
            (memory) => memory.scope === "global"
          );

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatMemoryEntries(memories, "Global memory"));
            });
          }

          return true;
        }
        case "memory_show": {
          const memories = await memoryStore.listMemories();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatMemoryEntries(memories, "Memory"));
            });
          }

          return true;
        }
        case "memory_clear": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore?.clear) {
            throw new Error("Memory clearing is unavailable for this runtime.");
          }

          await extendedMemoryStore.clear("workspace");

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage("Cleared workspace memory. Global memory is unchanged.");
            });
          }

          return true;
        }
        case "memory_compact": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore?.compact) {
            throw new Error("Memory compaction is unavailable for this runtime.");
          }

          const compacted = await extendedMemoryStore.compact();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatCompactedMemory(compacted));
            });
          }

          return true;
        }
        case "memory_global_remember": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore) {
            throw new Error("Global memory commands are unavailable for this runtime.");
          }

          const memory = await extendedMemoryStore.rememberGlobal(command.text);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                `Saved global memory ${memory.id}: ${memory.text}`
              );
            });
          }

          return true;
        }
        case "memory_global_forget": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore) {
            throw new Error("Global memory commands are unavailable for this runtime.");
          }

          const removed = await extendedMemoryStore.forgetGlobal(command.key);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                removed
                  ? `Removed global memory matching "${command.key}".`
                  : `No global memory matched "${command.key}".`
              );
            });
          }

          return true;
        }
        case "memory_search": {
          const extendedMemoryStore = getExtendedMemoryStore(memoryStore);

          if (!extendedMemoryStore) {
            throw new Error("Memory search is unavailable for this runtime.");
          }

          const memories = await extendedMemoryStore.search(command.keyword);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatMemoryEntries(memories, `Memory search: ${command.keyword}`)
              );
            });
          }

          return true;
        }
        case "timeline":
        case "timeline_recent": {
          if (!timelineStore) {
            throw new Error("Timeline commands are unavailable for this runtime.");
          }

          const events = await timelineStore.listRecent();

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(formatTimelineEntries(events, "Recent timeline"));
            });
          }

          return true;
        }
        case "timeline_filter": {
          if (!timelineStore) {
            throw new Error("Timeline commands are unavailable for this runtime.");
          }

          const events = await timelineStore.filterByType(
            command.filterType as TimelineEvent["type"]
          );

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatTimelineEntries(events, `Timeline: ${command.filterType}`)
              );
            });
          }

          return true;
        }
        case "tasks":
          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                formatTaskList(taskRunner.listTasks(), currentSessionRef.current.id)
              );
            });
          }

          return true;
        case "task_show": {
          const task = taskRunner.getTask(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                task
                  ? formatTaskDetail(task)
                  : `Task "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "task_pause": {
          const task = await taskRunner.pauseTask(command.id);

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                task
                  ? `Task ${task.id} is ${task.state}${task.requestedAction ? ` with ${task.requestedAction} requested` : ""}.`
                  : `Task "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "task_resume": {
          const task = taskRunner.getTask(command.id);

          if (!task) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Task "${command.id}" was not found.`);
              });
            }

            return true;
          }

          await executeTrackedTask(task, {
            transcriptPrompt: `Resume task ${task.id}: ${task.title}`
          });

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Task ${task.id} resumed.`);
            });
          }

          return true;
        }
        case "task_stop": {
          if (isAllTarget(command.id)) {
            const stoppedCount = await stopAllTasks("stop");

            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Stopped ${stoppedCount} task${stoppedCount === 1 ? "" : "s"}.`);
              });
            }

            return true;
          }

          const task = await taskRunner.stopTask(command.id);

          if (task?.watcherIds.length) {
            await cancelWatchers(task.watcherIds, `Task ${task.id} was stopped by the user.`);
          }

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                task
                  ? `Task ${task.id} is ${task.state}${task.requestedAction ? ` with ${task.requestedAction} requested` : ""}.`
                  : `Task "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "task_cancel": {
          if (isAllTarget(command.id)) {
            const cancelledCount = await stopAllTasks("cancel");

            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Cancelled ${cancelledCount} task${cancelledCount === 1 ? "" : "s"}.`);
              });
            }

            return true;
          }

          const task = await taskRunner.cancelTask(command.id);

          if (task?.watcherIds.length) {
            await cancelWatchers(task.watcherIds, `Task ${task.id} was cancelled by the user.`);
          }

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(
                task
                  ? `Task ${task.id} is ${task.state}${task.requestedAction ? ` with ${task.requestedAction} requested` : ""}.`
                  : `Task "${command.id}" was not found.`
              );
            });
          }

          return true;
        }
        case "task_retry": {
          const task = taskRunner.getTask(command.id);

          if (!task) {
            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Task "${command.id}" was not found.`);
              });
            }

            return true;
          }

          await executeTrackedTask(task, {
            retry: true,
            transcriptPrompt: `Retry task ${task.id}: ${task.title}`
          });

          if (!disposedRef.current) {
            startTransition(() => {
              appendSystemMessage(`Task ${task.id} retried.`);
            });
          }

          return true;
        }
        case "task_start": {
          const existingTask = taskRunner.getTask(command.target);

          if (existingTask) {
            await executeTrackedTask(existingTask, {
              transcriptPrompt: `Start task ${existingTask.id}: ${existingTask.title}`
            });

            if (!disposedRef.current) {
              startTransition(() => {
                appendSystemMessage(`Task ${existingTask.id} started.`);
              });
            }

            return true;
          }

          await executeAgentPrompt({
            prompt: command.target,
            rememberUserPrompt: true,
            transcriptPrompt: command.target
          });

          return true;
        }
        case "auto": {
          await captureGoal({
            description: "Autonomous repository improvement loop",
            source: "proactive",
            title: "Autonomous repository improvement"
          });
          const autoMode = await taskRunner.enableAutoMode({
            intervalMinutes: command.intervalMinutes,
            sessionId: currentSessionRef.current.id
          });

          if (!disposedRef.current) {
            startTransition(() => {
              setTasks(taskRunner.listTasks());
              appendSystemMessage(
                `Auto mode enabled every ${autoMode.intervalMinutes} minutes for session ${autoMode.sessionId}.`
              );
            });
          }

          return true;
        }
        case "auto_stop": {
          const stopped = await taskRunner.stopAutoMode();

          if (!disposedRef.current) {
            startTransition(() => {
              setTasks(taskRunner.listTasks());
              appendSystemMessage(
                stopped ? "Auto mode stopped." : "Auto mode is not running."
              );
            });
          }

          return true;
        }
        case "mode":
          if (!disposedRef.current) {
            startTransition(() => {
              commitExecutionMode(command.mode);
              applyDefaultApprovalPolicyForMode(command.mode);
              if (command.mode === "plan") {
                commitBuildProgress(null);
              } else {
                commitPendingPlanPrompt(false);
                commitPlanClarificationState(null);
                commitPlanReviewState(null);
              }
              appendSystemMessage(formatModeMessage(command.mode));
            });
          }

          await timelineStore?.record({
            sessionId: currentSessionRef.current.id,
            summary: `Mode switched to ${command.mode.toUpperCase()}`,
            type: "mode_switch"
          });
          return true;
        case "style":
          if (!disposedRef.current) {
            startTransition(() => {
              commitMode(command.style);
              appendSystemMessage(formatStyleMessage(command.style));
            });
          }

          return true;
        case "open": {
          const session = await sessionStore.loadSession(command.id);
          const sessionRegistryEntry = await sessionRegistryStore.get(command.id);

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

              if (sessionRegistryEntry) {
                const sessionMetadata = isApprovalManagerMetadata(
                  sessionRegistryEntry.metadata
                )
                  ? sessionRegistryEntry.metadata
                  : undefined;
                approvalManager.restore({
                  activeSessionId: session.id,
                  activeTaskId:
                    typeof sessionRegistryEntry.resumablePlanState?.activeTaskId === "string"
                      ? sessionRegistryEntry.resumablePlanState.activeTaskId
                      : undefined,
                  mode: sessionRegistryEntry.mode,
                  policy:
                    sessionMetadata
                      ? sessionMetadata.approvalStatus.policy
                      : executionContextRef.current.approvalPolicy
                });
                commitAutopilotEnabled(sessionMetadata?.autopilot?.enabled === true);
                lastModeApprovalPresetRef.current = resolveModeApprovalPreset(
                  sessionRegistryEntry.mode,
                  {
                    autopilotEnabled: false
                  }
                );
                commitExecutionContext(
                  executionContextController.update({
                    activeRemoteHostId: sessionRegistryEntry.activeRemoteHostId,
                    allowedRoots: sessionRegistryEntry.allowedRoots,
                    approvalPolicy:
                      approvalManager.getStatus().policy,
                    cwd: sessionRegistryEntry.cwd,
                    scope: sessionRegistryEntry.scope
                  })
                );
                commitExecutionMode(sessionRegistryEntry.mode);
                commitMode(sessionRegistryEntry.style);
                restoreSessionWorkflowState(sessionRegistryEntry);
              }
            });
          }

          return true;
        }
        case "schedule": {
          await captureGoal({
            description: command.prompt,
            source: "user",
            title: summarizeText(command.prompt)
          });
          const task = await taskRunner.scheduleTask({
            intervalMinutes: command.intervalMinutes,
            prompt: command.prompt,
            sessionId: currentSessionRef.current.id
          });

          if (!disposedRef.current) {
            startTransition(() => {
              setTasks(taskRunner.listTasks());
              appendSystemMessage(
                `Scheduled task ${task.id} every ${task.intervalMinutes} minutes for session ${task.sessionId}.`
              );
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
    } catch (error) {
      const message =
        error instanceof PathAccessError
          ? formatPathAccessError(error, executionContextRef.current)
          : error instanceof Error
            ? error.message
            : "Session command failed.";

      if (!disposedRef.current) {
        startTransition(() => {
          appendSystemMessage(`Session error: ${message}`);
        });
      }

      return true;
    }
  };

  const handleComposerFlowInput = async (input: string): Promise<boolean> => {
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
          appendSystemMessage(
            flow.type === "build_confirm"
              ? "Build cancelled."
              : flowContext
                ? "Flow cancelled."
                : "Login cancelled."
          );
        });
      }

      return true;
    }

    if (flowContext) {
      const currentStep = getActiveFlowStep(flowContext.flow);
      const submittedValue =
        currentStep.inputType === "text" ? input : flowContext.flow.value;
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

  const executeAgentPrompt = async (
    input: AgentPromptInput
  ): Promise<{
    content: string;
    ok: boolean;
  }> => {
    const turnId = currentTurnIdRef.current + 1;
    const transcriptPrompt = input.transcriptPrompt ?? input.prompt;
    const taskId = createTaskId(
      currentSessionRef.current.id,
      input.prompt,
      transcriptPrompt
    );
    const baseTranscript = [...transcriptRef.current];
    const userEntry =
      transcriptPrompt.trim().length > 0
        ? createUserEntry(transcriptPrompt)
        : undefined;
    let turnTranscript = userEntry
      ? appendTranscriptEntry(baseTranscript, userEntry)
      : [...baseTranscript];
    const blockedApprovalIds = new Set<string>();
    let trackedTask = await taskRunner.saveTask(
      buildInteractiveTaskRecord(input, taskId, transcriptPrompt)
    );

    currentTurnIdRef.current = turnId;
    lastUserPromptRef.current = input.prompt;
    lastAgentPromptInputRef.current = {
      ...input,
      systemMessages: input.systemMessages
        ? [...input.systemMessages]
        : undefined
    };
    commitTaskContext(taskId);

    startTransition(() => {
      commitPhase("thinking");
      commitStep(1);
      commitTranscript(turnTranscript);
    });

    const remoteWorkerContextMessage = buildRemoteWorkerContextMessage(remoteAgents);
    const systemMessages: Extract<ModelMessage, { role: "system" }>[] = [
      buildExecutionModeContextMessage(executionModeRef.current),
      ...(input.useResponseModeContext === false
        ? []
        : [buildResponseModeContextMessage(modeRef.current)]),
      ...(remoteWorkerContextMessage ? [remoteWorkerContextMessage] : []),
      ...(input.systemMessages ?? [])
    ];

    if (input.rememberUserPrompt) {
      await rememberPromptMemories(
        memoryStore,
        input.prompt,
        currentSessionRef.current.id,
        (message) => {
          if (disposedRef.current || currentTurnIdRef.current !== turnId) {
            return;
          }

          startTransition(() => {
            appendSystemMessage(`Memory warning: ${message}`);
          });
        }
      );
    }

    const promptContext = await loadAgentPromptContext(
      {
        history: historyRef.current,
        memoryStore,
        prompt: input.prompt,
        sessionSummary: currentSessionRef.current.summary,
        systemMessages
      },
      (message) => {
        if (disposedRef.current || currentTurnIdRef.current !== turnId) {
          return;
        }

        startTransition(() => {
          appendSystemMessage(`Memory warning: ${message}`);
        });
      }
    );

    try {
      const result = await runAgentTurnWithRateLimitRecovery({
        run: async () =>
          runAgentTurn({
            autopilot: autopilotEnabledRef.current,
            model: (() => {
              const snapshot = modelRuntime.getSnapshot();

              emitAppDebugLog(
                `Agent using provider=${snapshot.provider} model=${snapshot.model} executionMode=${executionModeRef.current}`
              );

              return modelRuntime.getClient();
            })(),
            contextMessages: promptContext.contextMessages,
            executionMode: executionModeRef.current,
            history: promptContext.recentHistory,
            prompt: input.prompt,
            shouldContinue: () => readInteractiveTaskControlDecision(taskId),
            toolRegistry:
              input.toolRegistryOverride ??
              createExecutionModeToolRegistry(toolRegistry, executionModeRef.current),
            onEvent: async (event) => {
              if (disposedRef.current || currentTurnIdRef.current !== turnId) {
                return;
              }

              turnTranscript = reduceTranscriptEntries(turnTranscript, event, turnId);

              startTransition(() => {
                commitTranscript(turnTranscript);
                commitToolActivity(
                  reduceToolActivity(toolActivityRef.current, event, turnId)
                );
                commitLastToolSummary(
                  reduceLastToolSummary(lastToolSummaryRef.current, event)
                );
                commitPhase(reducePhase(phaseRef.current, event));
                commitStep(reduceStep(stepRef.current, event));
              });

              if (!timelineStore) {
                trackedTask = await taskRunner.saveTask({
                  ...trackedTask,
                  approvalRequestIds: [...blockedApprovalIds],
                  currentStep: describeTaskStep(event),
                  lastEventAt: Date.now(),
                  requestedAction: undefined,
                  state: "running",
                  transcriptPrompt,
                  validationStatus: "running"
                });
                return;
              }

              if (event.type === "tool_finished") {
                for (const approvalId of extractApprovalRequestIds(
                  event.result.content
                )) {
                  blockedApprovalIds.add(approvalId);
                }

                await timelineStore.record({
                  detail: event.result.content,
                  sessionId: currentSessionRef.current.id,
                  summary: `${event.toolCall.name} ${event.result.isError ? "failed" : "completed"}`,
                  type: "tool_call"
                });
              }

              if (event.type === "status" && event.phase === "running_tool") {
                await timelineStore.record({
                  sessionId: currentSessionRef.current.id,
                  summary: `Agent entered tool phase at step ${event.step}`,
                  type: "system"
                });
              }

              trackedTask = await taskRunner.saveTask({
                ...trackedTask,
                approvalRequestIds: [...blockedApprovalIds],
                currentStep: describeTaskStep(event),
                lastEventAt: Date.now(),
                requestedAction: undefined,
                state: "running",
                transcriptPrompt,
                validationStatus: "running"
              });
            }
          }),
        onRetry: async ({ attempt, delayMs, error }) => {
          if (disposedRef.current || currentTurnIdRef.current !== turnId) {
            return;
          }

          turnTranscript = userEntry
            ? appendTranscriptEntry(baseTranscript, userEntry)
            : [...baseTranscript];
          turnTranscript = appendTranscriptEntry(
            turnTranscript,
            createSystemEntry(
              `Provider rate limited this turn. Retrying in ${formatRetryDelay(
                delayMs
              )} (attempt ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length}).`,
              true
            )
          );

          emitAppDebugLog(
            `retrying after rate limit in ${delayMs}ms: ${
              error instanceof Error ? error.message : String(error)
            }`
          );

          await timelineStore?.record({
            detail: readErrorMessage(error),
            sessionId: currentSessionRef.current.id,
            summary: `Provider rate limit retry ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length}`,
            type: "rate_limit"
          });

          trackedTask = await taskRunner.saveTask({
            ...trackedTask,
            currentStep: `Rate limited, retry ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length} in ${formatRetryDelay(delayMs)}.`,
            lastEventAt: Date.now(),
            requestedAction: undefined,
            state: "rate_limited"
          });

          startTransition(() => {
            commitTranscript(turnTranscript);
            commitToolActivity([]);
            commitLastToolSummary(DEFAULT_TOOL_SUMMARY);
            commitPhase("thinking");
            commitStep(1);
          });
        }
      });

      if (disposedRef.current || currentTurnIdRef.current !== turnId) {
        return {
          content: result.content,
          ok: true
        };
      }

      const nextHistory = mergeAgentTurnHistory(
        historyRef.current,
        promptContext.recentHistory,
        result.messages
      );
      emitAppDebugLog("committing successful turn history");

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

      const relevantPendingApprovals =
        blockedApprovalIds.size > 0
          ? (await approvalManager.listPending()).filter((request) => {
              return (
                blockedApprovalIds.has(request.id) ||
                request.metadata.taskId === taskId
              );
            })
          : [];

      startTransition(() => {
        commitCurrentSession(savedSession);
        commitPhase("ready");
        commitStep(0);
        commitToolActivity([]);
      });

      if (relevantPendingApprovals.length > 0) {
        trackedTask = await taskRunner.saveTask({
          ...trackedTask,
          approvalRequestIds: relevantPendingApprovals.map((approval) => approval.id),
          blockedReason: "Waiting for approval.",
          currentStep: "Awaiting approval.",
          lastEventAt: Date.now(),
          lastResultSummary: summarizeText(result.content),
          lastRunAt: Date.now(),
          requestedAction: undefined,
          runCount: trackedTask.runCount + 1,
          state: "waiting_approval",
          transcriptPrompt,
          validationStatus: "passed"
        });
        await refreshApprovals();
        return {
          content: formatPendingApprovalMessage(relevantPendingApprovals),
          ok: false
        };
      }

      trackedTask = await taskRunner.saveTask({
        ...trackedTask,
        approvalRequestIds: [],
        blockedReason: undefined,
        currentStep: "Complete.",
        lastEventAt: Date.now(),
        lastResultSummary: summarizeText(result.content),
        lastRunAt: Date.now(),
        requestedAction: undefined,
        runCount: trackedTask.runCount + 1,
        state: "complete",
        transcriptPrompt,
        validationStatus: "passed"
      });

      return {
        content: result.content,
        ok: true
      };
    } catch (error) {
      if (disposedRef.current || currentTurnIdRef.current !== turnId) {
        return {
          content:
            error instanceof Error ? error.message : "Unexpected agent failure.",
          ok: false
        };
      }

      const message =
        error instanceof Error ? error.message : "Unexpected agent failure.";

      trackedTask = await taskRunner.saveTask({
        ...trackedTask,
        approvalRequestIds: [...blockedApprovalIds],
        blockedReason:
          error instanceof AgentControlError ? message : undefined,
        currentStep: undefined,
        lastError:
          error instanceof AgentControlError ? undefined : message,
        lastEventAt: Date.now(),
        lastRunAt: Date.now(),
        requestedAction: undefined,
        runCount: trackedTask.runCount + 1,
        state:
          error instanceof AgentControlError
            ? error.state === "paused"
              ? "paused"
              : "cancelled"
            : "failed",
        transcriptPrompt,
        validationStatus:
          error instanceof AgentControlError ? trackedTask.validationStatus : "failed"
      });

      turnTranscript = userEntry
        ? appendTranscriptEntry(baseTranscript, userEntry)
        : [...baseTranscript];
      turnTranscript = appendTranscriptEntry(
        turnTranscript,
        createSystemEntry(`Agent error: ${message}`, true)
      );
      emitAppDebugLog("discarding failed turn history");
      await timelineStore?.record({
        detail: message,
        sessionId: currentSessionRef.current.id,
        summary: "Provider or agent turn failed",
        type: isRateLimitError(error) ? "rate_limit" : "system"
      });

      startTransition(() => {
        commitPhase("ready");
        commitLastToolSummary(summarizeText(`Agent error: ${message}`));
        commitToolActivity([]);
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

  const runPrompt = async (prompt: string): Promise<void> => {
    await executeAgentPrompt({
      prompt,
      rememberUserPrompt: true
    });
  };

  const startPlanWorkflow = async (taskPrompt: string): Promise<void> => {
    const clarificationState = detectPlanClarificationState(taskPrompt);

    if (clarificationState) {
      if (!disposedRef.current) {
        startTransition(() => {
          commitExecutionMode("plan");
          commitPendingPlanPrompt(false);
          commitPlanReviewState(null);
          commitPlanClarificationState(clarificationState);
          commitWorkflowState({
            currentStep: 0,
            currentStepLabel: "Clarification needed",
            progressLabel: `${clarificationState.questions.length} questions pending`,
            totalSteps: 0
          });
          appendSystemMessage(
            buildPlanClarificationMessage(clarificationState),
            true
          );
        });
      }

      return;
    }

    await generateProjectPlan(taskPrompt);
  };

  const reviseExistingPlan = async (
    reviewState: PlanReviewState,
    feedback: string
  ): Promise<void> => {
    const planningToolRegistry = createExecutionModeToolRegistry(toolRegistry, "plan");

        startTransition(() => {
          commitExecutionMode("plan");
          commitBuildProgress(null);
          commitPendingPlanPrompt(false);
          commitPlanClarificationState(null);
          commitWorkflowState({
        currentStep: 0,
        currentStepLabel: "Revising plan",
        progressLabel: "Updating TODO and plan.md",
        totalSteps: reviewState.plan.steps.length
      });
      appendSystemMessage(
        `Revising the current plan using your feedback: ${feedback}`,
        true
      );
    });

    const result = await executeAgentPrompt({
      prompt: buildPlanRevisionPrompt(
        reviewState.plan,
        feedback,
        reviewState.originalPrompt
      ),
      rememberUserPrompt: false,
      systemMessages: [
        {
          role: "system",
          content:
            "Return only the updated markdown plan. Do not include commentary before or after the plan."
        }
      ],
      toolRegistryOverride: planningToolRegistry,
      transcriptPrompt: `Revise the saved plan: ${feedback}`,
      useResponseModeContext: false
    });

    if (!result.ok || disposedRef.current) {
      startTransition(() => {
        commitWorkflowState({
          currentStep: 0,
          currentStepLabel: "Plan revision failed",
          progressLabel: "plan.md not updated",
          totalSteps: reviewState.plan.steps.length
        });
      });

      await persistSessionSnapshot();
      return;
    }

    try {
      const updatedPlan = await writePlanDocument(workspaceRoot, result.content);

      if (!disposedRef.current) {
        startTransition(() => {
          commitBuildProgress(null);
          commitPlanReviewState({
            originalPrompt: reviewState.originalPrompt,
            plan: updatedPlan
          });
          commitWorkflowState({
            currentStep: 0,
            currentStepLabel: "Plan revised",
            progressLabel: `0/${updatedPlan.steps.length} steps prepared`,
            totalSteps: updatedPlan.steps.length
          });
          appendSystemMessage(
            `${formatPlanForTranscript(updatedPlan)}\n\nReply with “implement it” or /build to execute, or send more plan edits to revise it again.`,
            true
          );
        });
      }

      await persistSessionSnapshot();
    } catch (error) {
      if (!disposedRef.current) {
        startTransition(() => {
          appendSystemMessage(
            error instanceof Error
              ? `Failed to save revised plan.md: ${error.message}`
              : "Failed to save revised plan.md.",
            true
          );
        });
      }
    }
  };

  const generateProjectPlan = async (taskPrompt?: string): Promise<void> => {
    const planningToolRegistry = createExecutionModeToolRegistry(toolRegistry, "plan");

    startTransition(() => {
      commitExecutionMode("plan");
      commitPendingPlanPrompt(false);
      commitPlanClarificationState(null);
      commitWorkflowState({
        currentStep: 0,
        currentStepLabel: "Analyzing project",
        progressLabel: "Generating TODO and plan.md",
        totalSteps: 0
      });
      appendSystemMessage(
        taskPrompt
          ? `PLAN mode enabled. Analyzing: ${taskPrompt}`
          : "PLAN mode enabled. Inspecting the project in read-only mode and generating plan.md.",
        true
      );
    });

    const result = await executeAgentPrompt({
      prompt: taskPrompt ? buildTaskPlanPrompt(taskPrompt) : buildProjectPlanPrompt(),
      rememberUserPrompt: false,
      systemMessages: [
        {
          role: "system",
          content:
            "Return only the markdown plan. Do not include commentary before or after the plan."
        }
      ],
      toolRegistryOverride: planningToolRegistry,
      transcriptPrompt: taskPrompt ?? "Generate a read-only project plan.",
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
          commitBuildProgress(null);
          if (taskPrompt) {
            commitPlanReviewState({
              originalPrompt: taskPrompt,
              plan
            });
          }
          commitWorkflowState({
            currentStep: 0,
            currentStepLabel: "Plan ready",
            progressLabel: `0/${plan.steps.length} steps prepared`,
            totalSteps: plan.steps.length
          });
          appendSystemMessage(
            [
              taskPrompt
                ? buildPlanUnderstandingMessage(taskPrompt)
                : "Here is the generated plan.",
              "",
              formatPlanForTranscript(plan),
              "",
              "Reply with “implement it” or /build to execute, or send plan changes to revise it."
            ].join("\n"),
            true
          );
        });
      }

      await persistSessionSnapshot();
    } catch (error) {
      if (!disposedRef.current) {
        startTransition(() => {
          commitWorkflowState({
            currentStep: 0,
            currentStepLabel: "Plan generation failed",
            progressLabel: "plan.md not updated",
            totalSteps: 0
          });
          appendSystemMessage(
            error instanceof Error
              ? `Failed to save plan.md: ${error.message}`
              : "Failed to save plan.md.",
            true
          );
        });
      }

      await persistSessionSnapshot();
    }
  };

  const executeSavedPlan = async (
    plan: PlanDocument,
    options?: {
      completedSteps?: readonly PlanStep[];
      startStepIndex?: number;
    }
  ): Promise<void> => {
    const completedSteps: PlanStep[] = [...(options?.completedSteps ?? [])];
    const startStepIndex = Math.max(1, options?.startStepIndex ?? 1);
    const completedStepIndexes = completedSteps.map((step) => step.index);

    startTransition(() => {
      commitExecutionMode("build");
      commitPendingPlanPrompt(false);
      commitPlanClarificationState(null);
      commitPlanReviewState(null);
      commitBuildProgress({
        completedStepIndexes,
        lastCompletedStepIndex:
          completedStepIndexes.length > 0 ? completedStepIndexes.at(-1) : undefined,
        status: "running",
        updatedAt: Date.now()
      });
      commitWorkflowState({
        currentStep: Math.max(0, startStepIndex - 1),
        currentStepLabel: "Preparing build",
        progressLabel: `${completedSteps.length}/${plan.steps.length} steps complete`,
        totalSteps: plan.steps.length
      });
      appendSystemMessage(
        `BUILD mode enabled. Executing ${plan.steps.length} steps from plan.md.`,
        true
      );
    });

    for (const planStep of plan.steps.filter((step) => step.index >= startStepIndex)) {
      if (disposedRef.current) {
        return;
      }

      commitBuildProgress({
        completedStepIndexes,
        lastAttemptedStepIndex: planStep.index,
        lastCompletedStepIndex:
          completedStepIndexes.length > 0 ? completedStepIndexes.at(-1) : undefined,
        status: "running",
        updatedAt: Date.now()
      });

      startTransition(() => {
        commitWorkflowState({
          currentStep: planStep.index,
          currentStepLabel: planStep.title,
          progressLabel: `${planStep.index - 1}/${plan.steps.length} steps complete`,
          totalSteps: plan.steps.length
        });
        appendSystemMessage(
          `Executing Step ${planStep.index}: ${planStep.title}`,
          true
        );
      });

      const result = await executeAgentPrompt({
        prompt: buildPlanExecutionPrompt(plan, planStep, completedSteps),
        rememberUserPrompt: false,
        transcriptPrompt: `Execute Step ${planStep.index}: ${planStep.title}`,
        useResponseModeContext: false
      });

      if (!result.ok) {
        commitBuildProgress({
          completedStepIndexes,
          lastAttemptedStepIndex: planStep.index,
          lastCompletedStepIndex:
            completedStepIndexes.length > 0 ? completedStepIndexes.at(-1) : undefined,
          status: "blocked",
          updatedAt: Date.now()
        });
        startTransition(() => {
          commitWorkflowState({
            currentStep: planStep.index,
            currentStepLabel: planStep.title,
            progressLabel: `Stopped at step ${planStep.index}/${plan.steps.length}`,
            totalSteps: plan.steps.length
          });
          appendSystemMessage(
            `Build stopped at Step ${planStep.index}: ${result.content}`,
            true
          );
        });

        await persistSessionSnapshot();
        return;
      }

      completedSteps.push(planStep);
      completedStepIndexes.push(planStep.index);
      commitBuildProgress({
        completedStepIndexes,
        lastAttemptedStepIndex: planStep.index,
        lastCompletedStepIndex: planStep.index,
        status: "running",
        updatedAt: Date.now()
      });

      startTransition(() => {
        commitWorkflowState({
          currentStep: planStep.index,
          currentStepLabel: planStep.title,
          progressLabel: `${planStep.index}/${plan.steps.length} steps complete`,
          totalSteps: plan.steps.length
        });
        appendSystemMessage(
          `Completed Step ${planStep.index}: ${summarizeText(result.content)}`,
          true
        );
      });
    }

    if (!disposedRef.current) {
      commitBuildProgress({
        completedStepIndexes,
        lastAttemptedStepIndex: plan.steps.length,
        lastCompletedStepIndex:
          completedStepIndexes.length > 0 ? completedStepIndexes.at(-1) : undefined,
        status: "complete",
        updatedAt: Date.now()
      });
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

  const moveActiveFlowSelection = (direction: "next" | "previous"): void => {
    const current = activeFlowRef.current;

    if (!current) {
      return;
    }

    commitActiveFlow({
      ...current,
      flow: moveFlowSelection(current.flow, direction)
    });
  };

  const submitActiveFlowSelection = (): void => {
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

  const completeActiveFlow = async (context: ActiveFlowContext): Promise<void> => {
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
              appendSystemMessage(
                `Provider set to ${snapshot.providerLabel}. Active model: ${snapshot.model}.`
              );
            });
          }

          return;
        }
        case "ssh_add": {
          if (!remoteManager) {
            throw new Error("Remote workers are unavailable for this runtime.");
          }

          const worker = buildSshWorkerFromFlow(context.flow);
          await remoteManager.add({
            capabilities: ["run_command", "read_file", "write_file"],
            connectionType: "ssh",
            host: worker.host,
            id: worker.name,
            name: worker.name,
            password: worker.password,
            port: worker.port,
            role: "devops",
            status: "offline",
            username: worker.username,
            workingDirectory: worker.workingDirectory
          });
          await refreshRemoteAgents();

          if (!disposedRef.current) {
            startTransition(() => {
              commitActiveFlow(null);
              appendSystemMessage(formatSshAddedMessage(worker.name, worker.host));
            });
          }

          return;
        }
        case "mcp_add": {
          const result = await mcpManager.addServer(buildDraftFromFlow(context.flow));

          if (!disposedRef.current) {
            startTransition(() => {
              commitActiveFlow(null);
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Added MCP server "${readRequiredFlowString(context.flow, "name")}".`,
                  result
                )
              );
            });
          }

          return;
        }
        case "mcp_edit": {
          const result = await mcpManager.editServer(
            context.originalName,
            buildDraftFromFlow(context.flow)
          );

          if (!disposedRef.current) {
            startTransition(() => {
              commitActiveFlow(null);
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Updated MCP server "${readRequiredFlowString(context.flow, "name")}".`,
                  result
                )
              );
            });
          }

          return;
        }
        case "mcp_install": {
          const result = await mcpManager.addServer(
            applyMarketplacePromptValues(
              buildDraftFromFlow(context.flow),
              context.prompts,
              context.flow
            )
          );

          if (!disposedRef.current) {
            startTransition(() => {
              commitActiveFlow(null);
              appendSystemMessage(
                formatMcpReloadSummary(
                  `Installed MCP server "${context.installName}".`,
                  result
                )
              );
            });
          }

          return;
        }
        default:
          return assertNever(context);
      }
    } catch (error) {
      if (!disposedRef.current) {
        startTransition(() => {
          appendSystemMessage(
            error instanceof Error ? error.message : "Flow completion failed."
          );
        });
      }
    }
  };

  const submitMessage = (rawValue: string): void => {
    void (async () => {
      const input = rawValue.trim();

      if (phaseRef.current !== "ready") {
        return;
      }

      if (
        input.length === 0 &&
        composerFlowRef.current.type === "idle" &&
        activeFlowRef.current === null
      ) {
        return;
      }

      setComposerValue("");

      if (
        input === "/cancel" &&
        (
          pendingPlanPromptRef.current ||
          planClarificationStateRef.current !== null ||
          planReviewStateRef.current !== null
        )
      ) {
        startTransition(() => {
          commitPendingPlanPrompt(false);
          commitPlanClarificationState(null);
          commitPlanReviewState(null);
          appendSystemMessage("Plan workflow cancelled.", true);
        });
        return;
      }

      if (activeFlowRef.current) {
        if (await handleComposerFlowInput(input)) {
          return;
        }
      }

      if (
        composerFlowRef.current.type !== "idle" &&
        input.startsWith("/") &&
        input !== "/cancel"
      ) {
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

      if (await tryHandleNaturalApprovalInput(input)) {
        return;
      }

      if (await tryHandleNaturalSshInput(input)) {
        return;
      }

      if (
        planClarificationStateRef.current &&
        input.length > 0
      ) {
        const combinedPrompt = mergeClarificationIntoPlanPrompt(
          planClarificationStateRef.current,
          input
        );
        await generateProjectPlan(combinedPrompt);
        return;
      }

      if (pendingPlanPromptRef.current) {
        await startPlanWorkflow(input);
        return;
      }

      if (planReviewStateRef.current) {
        if (isPlanImplementationInput(input)) {
          await executeSavedPlan(planReviewStateRef.current.plan);
          return;
        }

        if (input.length > 0) {
          await reviseExistingPlan(planReviewStateRef.current, input);
          return;
        }

        return;
      }

      if (detectFleetDelegationIntent(input) && fleetManager) {
        if (!fleetManager.isEnabled()) {
          fleetManager.start();
        }

        const role = inferFleetRoleFromPrompt(input);
        const agent = await assignFleetTask(role, input);

        if (!disposedRef.current) {
          startTransition(() => {
            appendSystemMessage(
              `Delegated to sub-agent ${agent.id} (${agent.role}). Use /fleet status to track progress.`,
              true
            );
          });
        }

        return;
      }

      await runPrompt(input);
    })();
  };

  const composerInputState = activeFlow
    ? createActiveFlowInputState(activeFlow.flow)
    : createComposerInputState(composerFlow, isBusy, isStreaming);
  const activeFlowStep = activeFlow ? getActiveFlowStep(activeFlow.flow) : undefined;

  return (
    <AppRuntimeStateProvider value={appState}>
      <Box flexDirection="column" height={windowSize.rows} paddingX={1}>
        <Header
          activeToolCount={activeToolCount + runningFleetCount}
          agentModeLabel={agentModeLabel}
          approvalLabel={createApprovalHeaderLabel(
            approvalStatus,
            pendingApprovalCount
          )}
          autoModeLabel={autoModeLabel}
          autopilotLabel={createAutopilotHeaderLabel(autopilotEnabled, isBusy)}
          cwdLabel={createCwdHeaderLabel(executionContext)}
          executionModeLabel={executionModeLabel}
          projectLabel={createProjectHeaderLabel(projectRecord, executionContext)}
          scopeLabel={createScopeHeaderLabel(executionContext)}
          statusLabel={createStatusLabel(phase, step)}
          statusTone={phase === "ready" ? "ready" : "busy"}
          taskCount={taskCount + fleetAgents.length}
          toolCount={deferredTools.length}
          workflowProgressLabel={workflowState.progressLabel}
          width={layout.frameWidth}
        />
        <Box
          flexDirection={layout.isWide ? "row" : "column"}
          height={layout.bodyHeight}
        >
          {activeFlow ? (
            <FlowPanel
              flow={activeFlow.flow}
              height={layout.mainHeight}
              width={layout.mainWidth}
              onCancel={() => {
                commitActiveFlow(null);
                setComposerValue("");
              }}
              onMoveSelection={moveActiveFlowSelection}
              onSubmitSelection={submitActiveFlowSelection}
            />
          ) : (
            <OutputPanel
              entries={transcript}
              height={layout.mainHeight}
              isStreaming={isStreaming}
              width={layout.mainWidth}
            />
          )}
          <Box
            marginLeft={layout.isWide ? 1 : 0}
            marginTop={layout.isWide ? 0 : 1}
          >
            <Sidebar
              activeTools={toolActivity}
              agentModeLabel={agentModeLabel}
              height={layout.sideHeight}
              lastToolSummary={lastToolSummary}
              currentWorkflowLabel={workflowState.currentStepLabel}
              executionModeLabel={executionModeLabel}
              autoModeLabel={autoModeLabel}
              autoModeLastAction={autoModeLastAction}
              autoModeNextRunLabel={autoModeNextRunLabel}
              phaseLabel={createPhaseLabel(phase)}
              responseModeLabel={formatResponseModeLabel(mode)}
              sessionLabel={createSessionLabel(currentSession)}
              step={step}
              taskLabel={`${taskCount} tasks • ${runningTaskCount} running • ${fleetAgents.length} agents`}
              tools={deferredTools}
              workflowProgressLabel={workflowState.progressLabel}
              width={layout.sideWidth}
            />
          </Box>
        </Box>
        <InputBar
          footer={composerInputState.footer}
          focusInput={activeFlowStep?.inputType !== "select" && activeFlowStep?.inputType !== "confirm"}
          isBusy={isBusy}
          isStreaming={isStreaming}
          mask={composerInputState.mask}
          placeholder={composerInputState.placeholder}
          subtitle={composerInputState.subtitle}
          title={composerInputState.title}
          value={composerValue}
          width={layout.frameWidth}
          onChange={setComposerValue}
          onSubmit={submitMessage}
        />
      </Box>
    </AppRuntimeStateProvider>
  );
}

function reduceToolActivity(
  entries: readonly ActiveToolEntry[],
  event: AgentTurnEvent,
  turnId: number
): ActiveToolEntry[] {
  switch (event.type) {
    case "tool_started":
      return limitToolActivity([
        {
          id: createToolEntryId(turnId, event.step, event.toolCall.id),
          name: event.toolCall.name,
          startedAt: Date.now(),
          status: "running"
        },
        ...entries.filter(
          (tool) =>
            tool.id !== createToolEntryId(turnId, event.step, event.toolCall.id)
        )
      ]);
    case "tool_finished":
      return limitToolActivity(
        upsertToolActivityEntry(entries, {
          id: createToolEntryId(turnId, event.step, event.toolCall.id),
          isError: event.result.isError,
          name: event.toolCall.name,
          startedAt: Date.now(),
          status: "complete",
          summary: summarizeText(
            `${event.toolCall.name}: ${event.result.isError ? "failed" : "completed"}`
          )
        })
      );
    case "assistant_stream_completed":
      return limitToolActivity(
        entries.filter((tool) => tool.status === "complete")
      );
    default:
      return entries as ActiveToolEntry[];
  }
}

function reduceLastToolSummary(
  currentValue: string,
  event: AgentTurnEvent
): string {
  if (event.type !== "tool_finished") {
    return currentValue;
  }

  return summarizeText(
    `${event.toolCall.name}: ${event.result.isError ? "failed" : "completed"}`
  );
}

function reducePhase(
  currentValue: AgentTurnPhase,
  event: AgentTurnEvent
): AgentTurnPhase {
  return event.type === "status" ? event.phase : currentValue;
}

function reduceStep(currentValue: number, event: AgentTurnEvent): number {
  return "step" in event ? event.step : currentValue;
}

function createComposerInputState(
  flow: ComposerFlow,
  isBusy: boolean,
  isStreaming: boolean
): {
  footer?: string;
  mask?: string;
  placeholder?: string;
  subtitle?: string;
  title?: string;
} {
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

function createActiveFlowInputState(flow: FlowState): {
  footer?: string;
  mask?: string;
  placeholder?: string;
  subtitle?: string;
  title?: string;
} {
  const step = getActiveFlowStep(flow);

  return {
    footer:
      step.inputType === "text"
        ? "Complete the current step and press Enter • /cancel exits the flow"
        : "Use arrows to select • Enter confirms • /cancel exits the flow",
    mask: step.mask,
    placeholder:
      step.inputType === "text" ? resolveFlowPlaceholder(flow) : "Use arrows to choose",
    subtitle: formatFlowStepLabel(flow),
    title: resolveFlowTitle(flow)
  };
}

function createLoginProviderPrompt(
  providers: readonly ProviderSummary[]
): string {
  const lines = ["Login setup", ""];

  for (const provider of providers) {
    lines.push(
      `${provider.name}  ${provider.requiresApiKey ? "API key required" : "No API key required"}`
    );
  }

  lines.push("");
  lines.push("Type a provider name to continue, or /cancel to stop.");

  return lines.join("\n");
}

function formatProviderChoices(providers: readonly ProviderSummary[]): string {
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

function matchProvider(
  input: string,
  providers: readonly ProviderSummary[]
): ProviderSummary | undefined {
  const normalizedInput = input.trim().toLowerCase();

  return providers.find((provider) => {
    return (
      provider.name.toLowerCase() === normalizedInput ||
      provider.label.toLowerCase() === normalizedInput
    );
  });
}

function emitAppDebugLog(message: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[app] ${message}\n`);
}

async function loadAgentPromptContext(
  input: {
    history: readonly ModelMessage[];
    memoryStore: MemoryStore;
    prompt: string;
    sessionSummary: SessionRecord["summary"];
    systemMessages?: readonly Extract<ModelMessage, { role: "system" }>[];
  },
  onError: (message: string) => void
): Promise<{
  contextMessages: Extract<ModelMessage, { role: "system" }>[];
  recentHistory: ModelMessage[];
}> {
  try {
    return await buildAgentPromptContext(input);
  } catch (error) {
    onError(
      error instanceof Error
        ? error.message
        : "Unable to prepare prompt memory."
    );
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

async function rememberPromptMemories(
  memoryStore: MemoryStore,
  prompt: string,
  sessionId: string,
  onError: (message: string) => void
): Promise<void> {
  try {
    await memoryStore.rememberFromUserMessage(prompt, { sessionId });
  } catch (error) {
    onError(
      error instanceof Error ? error.message : "Unable to persist user memory."
    );
  }
}

export async function runAgentTurnWithRateLimitRecovery<T>(input: {
  onRetry?: (input: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void | Promise<void>;
  run: () => Promise<T>;
}): Promise<T> {
  return runWithRateLimitRecovery({
    onRetry: async ({ attempt, delayMs, error }) => {
      emitAppDebugLog(
        `rate limit detected; retry ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length} in ${delayMs}ms`
      );
      await input.onRetry?.({
        attempt,
        delayMs,
        error
      });
    },
    run: input.run
  });
}

function getExtendedMemoryStore(
  memoryStore: MemoryStore
): ExtendedMemoryStore | undefined {
  const candidate = memoryStore as Partial<ExtendedMemoryStore>;

  if (
    typeof candidate.rememberGlobal === "function" &&
    typeof candidate.forgetGlobal === "function" &&
    typeof candidate.search === "function"
  ) {
    return candidate as ExtendedMemoryStore;
  }

  return undefined;
}

function formatMemoryEntries(
  memories: readonly ModelMemoryRecord[],
  title: string
): string {
  if (memories.length === 0) {
    return `${title}\n\nNo matching memory entries.`;
  }

  const lines = [title];

  for (const memory of memories) {
    lines.push(
      `${memory.id}  [${memory.scope}/${memory.type}]  ${memory.text}`
    );
  }

  return lines.join("\n");
}

function formatCompactedMemory(summary: {
  decisions: string[];
  constraints: string[];
  currentTask: Record<string, unknown>;
  goals: string[];
  historySummary: string;
}): string {
  const lines = ["Compacted memory"];
  const pushSection = (label: string, values: readonly string[]): void => {
    lines.push("");
    lines.push(`${label}:`);

    if (values.length === 0) {
      lines.push("- none");
      return;
    }

    for (const value of values) {
      lines.push(`- ${value}`);
    }
  };

  pushSection("Goals", summary.goals);
  pushSection("Decisions", summary.decisions);
  pushSection("Constraints", summary.constraints);
  lines.push("");
  lines.push(
    `Current task: ${
      Object.keys(summary.currentTask).length > 0
        ? JSON.stringify(summary.currentTask)
        : "none"
    }`
  );
  lines.push("");
  lines.push(`History summary: ${summary.historySummary || "none"}`);

  return lines.join("\n");
}

function formatTimelineEntries(
  events: readonly TimelineEvent[],
  title: string
): string {
  if (events.length === 0) {
    return `${title}\n\nNo timeline events recorded yet.`;
  }

  const lines = [title];

  for (const event of events) {
    lines.push(
      `${new Date(event.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })}  [${event.type}]  ${event.summary}`
    );

    if (event.detail) {
      lines.push(`  ${event.detail}`);
    }
  }

  return lines.join("\n");
}

function formatGoalList(goals: readonly GoalRecord[]): string {
  if (goals.length === 0) {
    return "Goals\n\nNo goals tracked yet.";
  }

  const lines = ["Goals"];

  for (const goal of goals) {
    lines.push(
      `${goal.id}  [${goal.state}]  ${goal.title}  ${goal.estimatedEffort}`
    );
  }

  lines.push("");
  lines.push("Use /goal show <id> to inspect a goal.");

  return lines.join("\n");
}

function formatGoalDetail(goal: GoalRecord): string {
  const lines = [
    `Goal ${goal.id}`,
    `Title: ${goal.title}`,
    `State: ${goal.state}`,
    `Effort: ${goal.estimatedEffort}`,
    `Source: ${goal.source}`,
    `Description: ${goal.description}`
  ];

  if (goal.linkedProject) {
    lines.push(`Project: ${goal.linkedProject}`);
  }

  if (goal.whyItMatters) {
    lines.push(`Why it matters: ${goal.whyItMatters}`);
  }

  if (goal.nextBestAction) {
    lines.push(`Next action: ${goal.nextBestAction}`);
  }

  if (goal.blockers.length > 0) {
    lines.push(`Blockers: ${goal.blockers.join(", ")}`);
  }

  if (goal.suggestedMcps.length > 0) {
    lines.push(`Suggested MCPs: ${goal.suggestedMcps.join(", ")}`);
  }

  return lines.join("\n");
}

function formatFleetStatus(
  agents: readonly FleetAgentRecord[],
  enabled: boolean
): string {
  const lines = [
    `Fleet ${enabled ? "running" : "stopped"}`
  ];

  if (agents.length === 0) {
    lines.push("");
    lines.push("No sub-agents created yet.");
    return lines.join("\n");
  }

  lines.push("");

  for (const agent of agents) {
    lines.push(
      `${agent.id}  [${agent.state}]  ${agent.role}  ${agent.task}`
    );

    if (agent.summary) {
      lines.push(`  ${agent.summary}`);
    }

    if (agent.changedFiles.length > 0) {
      lines.push(`  changed: ${agent.changedFiles.join(", ")}`);
    }

    if (agent.error) {
      lines.push(`  error: ${agent.error}`);
    }
  }

  return lines.join("\n");
}

function formatRemoteList(
  agents: readonly RemoteWorkerView[]
): string {
  if (agents.length === 0) {
    return "Remote workers\n\nNo remote workers configured yet.";
  }

  const lines = ["Remote workers"];

  for (const agent of agents) {
    lines.push(
      `${agent.id.padEnd(14, " ")} ${agent.role.padEnd(8, " ")} ${agent.status.padEnd(9, " ")} ${agent.host}`
    );
    lines.push(`  tool=${createSshRunToolName(agent.id)}`);
  }

  return lines.join("\n");
}

function formatRemoteDetail(agent: RemoteWorkerView): string {
  return [
    `Remote worker ${agent.id}`,
    `Name: ${agent.name}`,
    `Host: ${agent.host}`,
    `Role: ${agent.role}`,
    `Status: ${agent.status}`,
    `Current task: ${agent.currentTask ?? "idle"}`,
    `Tool: ${createSshRunToolName(agent.id)}`
  ].join("\n");
}

function formatSshAddedMessage(name: string, host: string): string {
  return [
    `Added SSH worker "${name}" (${host}).`,
    `Exposed tool: ${createSshRunToolName(name)}`,
    `Use /ssh test ${name} to verify the connection.`,
    `Use /ssh run ${name} <command> for a direct command, or /scope grant remote-host ${name} before asking the agent to work on that VM.`
  ].join("\n");
}

function formatSshRunResult(
  name: string,
  command: string,
  result: {
    code: number | null;
    stderr: string;
    stdout: string;
  }
): string {
  const lines = [
    `SSH ${name}: ${command}`,
    `Exit code: ${result.code ?? "unknown"}`
  ];

  if (result.stdout.trim().length > 0) {
    lines.push("stdout:");
    lines.push(result.stdout.trimEnd());
  }

  if (result.stderr.trim().length > 0) {
    lines.push("stderr:");
    lines.push(result.stderr.trimEnd());
  }

  return lines.join("\n");
}

function buildRemoteWorkerContextMessage(
  agents: readonly RemoteWorkerView[]
): Extract<ModelMessage, { role: "system" }> | undefined {
  const sshAgents = agents.filter((agent) => agent.host.trim().length > 0);

  if (sshAgents.length === 0) {
    return undefined;
  }

  return {
    role: "system",
    content: [
      "Available SSH workers:",
      ...sshAgents.map(
        (agent) =>
          `- ${agent.id}: host=${agent.host}, status=${agent.status}, tool=${createSshRunToolName(agent.id)}`
      ),
      "When the user says to run a command on one of these worker names, use that worker's SSH tool instead of the local run_command tool."
    ].join("\n")
  };
}

function createSshWorkerToolRegistrations(
  agent: RemoteWorkerView,
  owner: string,
  remoteManager: NonNullable<AppProps["remoteManager"]>
): ToolRegistration[] {
  const toolName = createSshRunToolName(agent.id);

  return [
    {
      tool: {
        id: `${owner}::run_command`,
        name: toolName,
        owner,
        source: "mcp",
        originalName: "run_command",
        description: [
          `Run a shell command on SSH worker "${agent.id}" (${agent.host}).`,
          `Use this when the user asks to run a command on "${agent.id}" or "${agent.name}".`
        ].join(" "),
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            command: {
              type: "string",
              description: "Shell command to run on the SSH worker."
            }
          },
          required: ["command"]
        }
      },
      execute: async (input) => {
        const command = readToolString(input, "command");

        if (!command) {
          return {
            content: `Tool "${toolName}" requires a command string.`,
            isError: true
          };
        }

        const result = await remoteManager.runCommand(agent.id, "sh", [
          "-lc",
          command
        ]);

        return {
          content: formatSshRunResult(agent.id, command, result),
          isError: result.code !== 0
        };
      }
    }
  ];
}

function createSshToolOwner(agentId: string): string {
  return `ssh:${agentId}`;
}

function createSshRunToolName(agentId: string): string {
  const baseName = `ssh__${sanitizeToolNamePart(agentId)}__run_command`;

  if (baseName.length <= 64) {
    return baseName;
  }

  const hash = createHash("sha1").update(agentId).digest("hex").slice(0, 8);
  return `${baseName.slice(0, 55)}_${hash}`;
}

function readToolString(
  input: Record<string, unknown>,
  key: string
): string | undefined {
  const value = input[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseNaturalSshCommand(
  input: string,
  agents: readonly RemoteWorkerView[]
): { agent: RemoteWorkerView; command: string } | undefined {
  const trimmed = input.trim();
  const sshAgents = [...agents]
    .filter((agent) => agent.host.trim().length > 0)
    .sort((left, right) => right.id.length - left.id.length);

  for (const agent of sshAgents) {
    const names = dedupeStrings([agent.id, agent.name]);

    for (const name of names) {
      const escapedName = escapeRegExp(name);
      const commandOnHost = trimmed.match(
        new RegExp(
          `^(?:please\\s+)?(?:do|run|execute)\\s+(?:command\\s+|comand\\s+|cmd\\s+)?(.+?)\\s+(?:on|in|at)\\s+(?:ssh\\s+)?${escapedName}\\s*$`,
          "i"
        )
      );
      const hostThenCommand = trimmed.match(
        new RegExp(
          `^(?:please\\s+)?(?:on|in|at)\\s+(?:ssh\\s+)?${escapedName}\\s+(?:do|run|execute)\\s+(?:command\\s+|comand\\s+|cmd\\s+)?(.+?)\\s*$`,
          "i"
        )
      );
      const command = cleanNaturalShellCommand(
        commandOnHost?.[1] ?? hostThenCommand?.[1]
      );

      if (command) {
        return {
          agent,
          command
        };
      }
    }
  }

  return undefined;
}

function cleanNaturalShellCommand(value: string | undefined): string | undefined {
  const command = value
    ?.trim()
    .replace(/^`+|`+$/g, "")
    .trim();

  return command && command.length > 0 ? command : undefined;
}

function isAllTarget(value: string): boolean {
  return value.trim().toLowerCase() === "all";
}

function sanitizeToolNamePart(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "worker";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (normalized.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(normalized);
  }

  return results;
}

function formatOrchestratorStatus(input: {
  approvals: readonly ApprovalRequest[];
  context: ExecutionContext;
  executionMode: ExecutionMode;
  fleetAgents: readonly FleetAgentRecord[];
  goals: readonly GoalRecord[];
  remoteAgents: readonly RemoteWorkerView[];
  tasks: readonly BackgroundTaskView[];
  watchers: readonly WatcherRecord[];
}): string {
  const runningFleet = input.fleetAgents.filter((agent) => agent.state === "running").length;
  const activeRemotes = input.remoteAgents.filter((agent) => agent.status !== "offline").length;
  const runningTasks = input.tasks.filter((task) => task.isRunning).length;
  const pendingApprovals = input.approvals.filter(
    (approval) => approval.state === "pending"
  ).length;
  const activeWatchers = input.watchers.filter(
    (watcher) =>
      watcher.status === "active" ||
      watcher.status === "healthy" ||
      watcher.status === "stalled"
  ).length;

  return [
    "Orchestrator status",
    `Mode: ${input.executionMode}`,
    `Scope: ${readScopeLabel(input.context.scope)}`,
    `CWD: ${formatPathForDisplay(input.context, input.context.cwd)}`,
    `Tasks: ${input.tasks.length} total / ${runningTasks} running`,
    `Goals: ${input.goals.length}`,
    `Fleet: ${input.fleetAgents.length} agents / ${runningFleet} running`,
    `Watchers: ${input.watchers.length} total / ${activeWatchers} active`,
    `Approvals: ${input.approvals.length} total / ${pendingApprovals} pending`,
    `Remote: ${input.remoteAgents.length} workers / ${activeRemotes} connected`
  ].join("\n");
}

function formatExecutionContextStatus(
  context: ExecutionContext,
  project: ProjectRecord,
  grants: readonly FilesystemGrant[]
): string {
  const lines = [
    `Project: ${project.displayName}`,
    `Scope: ${readScopeLabel(context.scope)}${context.activeRemoteHostId ? ` (${context.activeRemoteHostId})` : ""}`,
    `CWD: ${formatPathForDisplay(context, context.cwd)}`,
    `Workspace root: ${project.path}`
  ];

  if (isPathOutsideProject(context, context.cwd)) {
    lines.push("Status: current working directory is outside the workspace root.");
  }

  if (grants.length > 0) {
    lines.push("");
    lines.push("Granted scopes:");

    for (const grant of grants) {
      lines.push(
        `${grant.id}  ${readScopeLabel(grant.scope)}${grant.hostId ? ` (${grant.hostId})` : ""}${grant.root ? ` -> ${grant.root}` : ""}`
      );
    }
  }

  return lines.join("\n");
}

function formatScopeStatus(input: {
  approvals: readonly ApprovalRequest[];
  context: ExecutionContext;
  grants: readonly FilesystemGrant[];
  project: ProjectRecord;
  watchers: readonly WatcherRecord[];
}): string {
  const pendingApprovals = input.approvals.filter(
    (approval) => approval.state === "pending"
  ).length;
  const activeWatchers = input.watchers.filter(
    (watcher) =>
      watcher.status === "active" ||
      watcher.status === "healthy" ||
      watcher.status === "stalled"
  ).length;

  return [
    formatExecutionContextStatus(input.context, input.project, input.grants),
    "",
    `Pending approvals: ${pendingApprovals}`,
    `Active watchers: ${activeWatchers}`
  ].join("\n");
}

function formatApprovalList(
  approvals: readonly ApprovalRequest[],
  status?: ApprovalManagerStatus
): string {
  const lines = [
    "Approvals",
    "",
    `Policy: ${formatApprovalPolicyPreset(status?.policy.preset)}`,
    `Blanket approval: ${formatApprovalGrantStatus(status)}`
  ];

  if (approvals.length === 0) {
    lines.push("");
    lines.push("No approval requests yet.");
    return lines.join("\n");
  }

  for (const approval of approvals) {
    lines.push("");
    lines.push(
      `${approval.id}  [${approval.state}]  ${approval.kind}  ${approval.summary}`
    );
    lines.push(
      `scope=${approval.scope ?? "unknown"}  safety=${approval.safetyLevel ?? "unknown"}${approval.resource ? `  resource=${approval.resource}` : ""}`
    );
    lines.push(approval.detail);
  }

  return lines.join("\n");
}

function formatPathAccessError(
  error: PathAccessError,
  context: ExecutionContext
): string {
  const diagnostics = [
    error.path ? `Resolved path: ${error.path}` : undefined,
    `Resolved scope: ${readScopeLabel(context.scope)}`
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  switch (error.code) {
    case "outside_scope":
      return `${error.message}\n${diagnostics}\nUse /scope grant <workspace|home|full-machine|remote-host> to widen access.`;
    case "blocked_policy":
      return `${error.message}\n${diagnostics}\nAccess is blocked by policy.`;
    case "remote_host_unavailable":
      return `${error.message}\n${diagnostics}\nAttach a remote host first with /scope grant remote-host <host-id>.`;
    case "invalid_path":
      return diagnostics.length > 0 ? `${error.message}\n${diagnostics}` : error.message;
    default:
      return diagnostics.length > 0 ? `${error.message}\n${diagnostics}` : error.message;
  }
}

function createRuntimeStateOptions(
  context: ExecutionContext,
  project: ProjectRecord
): {
  cwd: string;
  projectLabel: string;
  scope: ExecutionContext["scope"];
} {
  return {
    cwd: context.cwd,
    projectLabel: project.displayName,
    scope: context.scope
  };
}

function buildPlanClarificationMessage(
  clarificationState: PlanClarificationState
): string {
  const lines = [
    "I need a bit more detail before I generate the plan.",
    "",
    "Questions:"
  ];

  for (const question of clarificationState.questions) {
    lines.push(`- ${question}`);
  }

  lines.push("");
  lines.push("Reply with the clarifications and I will inspect the codebase and generate TODO + plan.md.");

  return lines.join("\n");
}

function buildPlanUnderstandingMessage(taskPrompt: string): string {
  const normalized = taskPrompt
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");

  return [
    "Here is what I think you want:",
    `- ${normalized}`,
    "- I should inspect the codebase in read-only mode first.",
    "- I should generate TODO items and a step-by-step implementation plan.",
    "- The plan should stay editable until you approve it."
  ].join("\n");
}

function isPlanImplementationInput(input: string): boolean {
  const normalized = input.trim().toLowerCase();

  return (
    normalized === "implement it" ||
    normalized === "implement" ||
    normalized === "build it" ||
    normalized === "do it" ||
    normalized === "go" ||
    normalized === "go ahead" ||
    normalized === "yes" ||
    normalized === "ship it"
  );
}

export function deriveResumableBuildState(
  transcript: readonly TranscriptEntry[],
  plan: PlanDocument
): ResumableBuildState {
  const relevantEntries = getEntriesSinceLastBuildStart(transcript);

  if (relevantEntries.length === 0) {
    return {
      canResume: false,
      completedSteps: [],
      message: "No prior BUILD run was found for the current session.",
      startStepIndex: 1
    };
  }

  if (
    relevantEntries.some((entry) =>
      entry.content.includes("BUILD mode completed every step in plan.md.")
    )
  ) {
    return {
      canResume: false,
      completedSteps: plan.steps,
      message: "The current plan is already complete.",
      startStepIndex: plan.steps.length + 1
    };
  }

  const completedStepIndexes = new Set<number>();
  let failedStepIndex: number | undefined;

  for (const entry of relevantEntries) {
    const completedMatch = entry.content.match(/^Completed Step (\d+):/m);

    if (completedMatch) {
      completedStepIndexes.add(Number(completedMatch[1]));
    }

    const failedMatch = entry.content.match(/^Build stopped at Step (\d+):/m);

    if (failedMatch) {
      failedStepIndex = Number(failedMatch[1]);
    }
  }

  const completedSteps = plan.steps.filter((step) =>
    completedStepIndexes.has(step.index)
  );
  const startStepIndex =
    failedStepIndex ??
    plan.steps.find((step) => !completedStepIndexes.has(step.index))?.index ??
    plan.steps.length + 1;

  if (startStepIndex > plan.steps.length) {
    return {
      canResume: false,
      completedSteps,
      message: "No incomplete BUILD step remains in plan.md.",
      startStepIndex
    };
  }

  return {
    canResume: true,
    completedSteps,
    message: `Resuming BUILD mode from Step ${startStepIndex}.`,
    startStepIndex
  };
}

function deriveResumableBuildStateFromProgress(
  progress: PersistedBuildProgress | null,
  plan: PlanDocument
): ResumableBuildState | undefined {
  if (!progress || progress.status === "idle") {
    return undefined;
  }

  const completedStepIndexes = new Set(
    progress.completedStepIndexes.filter((index) =>
      plan.steps.some((step) => step.index === index)
    )
  );
  const completedSteps = plan.steps.filter((step) =>
    completedStepIndexes.has(step.index)
  );

  if (progress.status === "complete") {
    return {
      canResume: false,
      completedSteps: plan.steps,
      message: "The current plan is already complete.",
      startStepIndex: plan.steps.length + 1
    };
  }

  const startStepIndex =
    progress.lastAttemptedStepIndex && !completedStepIndexes.has(progress.lastAttemptedStepIndex)
      ? progress.lastAttemptedStepIndex
      : plan.steps.find((step) => !completedStepIndexes.has(step.index))?.index ??
        (plan.steps.length + 1);

  if (startStepIndex > plan.steps.length) {
    return {
      canResume: false,
      completedSteps,
      message: "No incomplete BUILD step remains in plan.md.",
      startStepIndex
    };
  }

  return {
    canResume: true,
    completedSteps,
    message: `Resuming BUILD mode from Step ${startStepIndex}.`,
    startStepIndex
  };
}

function getEntriesSinceLastBuildStart(
  transcript: readonly TranscriptEntry[]
): readonly TranscriptEntry[] {
  const buildStartIndex = [...transcript]
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .find(({ entry }) =>
      entry.content.includes("BUILD mode enabled. Executing")
    )?.index;

  if (buildStartIndex === undefined) {
    return [];
  }

  return transcript.slice(buildStartIndex);
}

function limitToolActivity(
  entries: readonly ActiveToolEntry[]
): ActiveToolEntry[] {
  return [...entries].slice(0, MAX_TOOL_ACTIVITY);
}

function upsertToolActivityEntry(
  entries: readonly ActiveToolEntry[],
  nextEntry: ActiveToolEntry
): ActiveToolEntry[] {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

  if (existingIndex === -1) {
    return [nextEntry, ...entries];
  }

  return entries.map((entry, index) =>
    index === existingIndex
      ? {
          ...entry,
          ...nextEntry,
          startedAt: entry.startedAt
        }
      : entry
  );
}

function createPhaseLabel(phase: AgentTurnPhase): string {
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

function createStatusLabel(phase: AgentTurnPhase, step: number): string {
  const phaseLabel = createPhaseLabel(phase);

  if (phase === "ready" || step <= 0) {
    return phaseLabel;
  }

  return `${phaseLabel} · step ${step}`;
}

function createSessionLabel(session: SessionRecord): string {
  return `${session.id} • ${session.title}`;
}

function createProjectHeaderLabel(
  project: ProjectRecord,
  context: ExecutionContext
): string {
  return isPathOutsideProject(context, context.cwd)
    ? `${project.displayName} • outside workspace`
    : project.displayName;
}

function createScopeHeaderLabel(context: ExecutionContext): string {
  return context.activeRemoteHostId
    ? `${readScopeLabel(context.scope)}:${context.activeRemoteHostId}`
    : readScopeLabel(context.scope);
}

function createApprovalHeaderLabel(
  status: ApprovalManagerStatus,
  pendingApprovalCount: number
): string {
  return `Approval ${formatApprovalPolicyPreset(status.policy.preset)} • ${formatApprovalGrantStatus(status)} • pending:${pendingApprovalCount}${pendingApprovalCount > 0 ? " • BLOCKED" : ""}`;
}

function createAutopilotHeaderLabel(
  enabled: boolean,
  isBusy: boolean
): string {
  if (!enabled) {
    return "Autopilot off";
  }

  return isBusy ? "AUTOPILOT ACTIVE" : "AUTOPILOT ON";
}

function createCwdHeaderLabel(context: ExecutionContext): string {
  return formatPathForDisplay(context, context.cwd);
}

function createAutoModeLabel(task: BackgroundTaskView | undefined): string {
  if (!task) {
    return "Auto off";
  }

  return task.isRunning ? "AUTO MODE RUNNING" : "Auto scheduled";
}

function formatAutoModeNextRun(
  task: BackgroundTaskView | undefined,
  now: number
): string {
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

function summarizeText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= MAX_TOOL_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TOOL_SUMMARY_LENGTH - 1)}…`;
}

function createToolSignature(tools: readonly RegisteredTool[]): string {
  return tools.map((tool) => `${tool.id}:${tool.name}`).join("|");
}

function createToolEntryId(
  turnId: number,
  step: number,
  toolCallId: string
): string {
  return `tool-${turnId}-${step}-${toolCallId}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function formatRemoteDirectoryError(targetPath: string, stderr: string): string {
  const normalized = stderr.trim();

  if (/no such file|can't cd|cannot access/i.test(normalized)) {
    return `Path "${targetPath}" does not exist on the remote host.`;
  }

  return normalized.length > 0
    ? `Remote directory change failed: ${normalized}`
    : `Remote directory change failed for "${targetPath}".`;
}

function createIdleWorkflowState(): WorkflowState {
  return {
    currentStep: 0,
    currentStepLabel: "No active plan",
    progressLabel: "Idle",
    totalSteps: 0
  };
}

function isBuildConfirmationInput(value: string): boolean {
  return value === "yes" || value === "y" || value === "build" || value === "confirm";
}

function createLoginFlowSteps(
  providers: readonly ProviderSummary[]
): readonly FlowStep[] {
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
      condition: (state) =>
        typeof state.provider === "string" && state.provider !== "local"
    },
    {
      key: "confirm",
      title: "Confirm Login",
      description: (state) =>
        `Save provider ${String(state.provider ?? "local")} and update the active runtime immediately.`,
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

function createSshWorkerFlowSteps(): readonly FlowStep[] {
  return [
    {
      key: "name",
      title: "Worker Name",
      description: "Choose the short name used in /ssh, /remote, and /scope commands.",
      inputType: "text",
      placeholder: "hans"
    },
    {
      key: "host",
      title: "Host",
      description: "Enter the SSH host, IP address, or VM DNS name.",
      inputType: "text",
      placeholder: "192.168.1.50"
    },
    {
      key: "username",
      title: "Username",
      description: "Optional SSH username. Leave blank to use your local username.",
      inputType: "text",
      placeholder: "kihi2024"
    },
    {
      key: "port",
      title: "Port",
      description: "Optional SSH port. Leave blank for 22.",
      inputType: "text",
      placeholder: "22"
    },
    {
      key: "authMethod",
      title: "Authentication",
      description: "Choose SSH key or password authentication for this worker.",
      inputType: "select",
      options: [
        {
          label: "SSH key / agent",
          value: "key"
        },
        {
          label: "Password",
          value: "password"
        }
      ]
    },
    {
      key: "sshPassword",
      title: "Password",
      description:
        "Enter the SSH password. It is stored in the local worker registry for non-interactive commands.",
      inputType: "text",
      mask: "*",
      placeholder: "password",
      condition: (state) => state.authMethod === "password"
    },
    {
      key: "workingDirectory",
      title: "Working Directory",
      description: "Optional remote working directory for agent commands.",
      inputType: "text",
      placeholder: "~/"
    },
    {
      key: "confirm",
      title: "Confirm Worker",
      description: (state) =>
        `Save SSH worker ${String(state.name ?? "this worker")} and make it available to remote tools.`,
      inputType: "confirm",
      options: [
        {
          label: "Save worker",
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

function createMcpDraftFlowSteps(
  mode: "add" | "edit" | "install"
): readonly FlowStep[] {
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
      description:
        "Choose how this MCP server communicates. STDIO covers local and command processes.",
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
      description: (state) =>
        `Review ${String(state.name ?? "this MCP server")} and save it to config with hot reload.`,
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

function createMarketplaceInstallFlowSteps(
  draft: McpServerDraft,
  prompts: readonly MarketplacePromptField[] = []
): readonly FlowStep[] {
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
  const promptSteps: FlowStep[] = prompts.map((prompt) => ({
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

function createDefaultMcpDraft(): McpServerDraft {
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

function createDefaultSshWorkerDraft(): SshWorkerDraft {
  return {
    host: "",
    name: ""
  };
}

function createDraftFromManagedServer(server: {
  definition: {
    args: string[];
    command: string;
    cwd: string;
    enabled: boolean;
    env: Record<string, string>;
    headers?: Record<string, string>;
    tools?: string[];
    transport: string;
    type: string;
    url?: string;
  };
  name: string;
}): McpServerDraft {
  return {
    args: [...server.definition.args],
    command: server.definition.command,
    cwd: server.definition.cwd,
    enabled: server.definition.enabled,
    env: { ...server.definition.env },
    headers: { ...(server.definition.headers ?? {}) },
    name: server.name,
    tools: [...(server.definition.tools ?? ["*"])],
    transport:
      server.definition.transport === "http" ||
      server.definition.transport === "sse"
        ? server.definition.transport
        : "stdio",
    type:
      server.definition.type === "local" ||
      server.definition.type === "command" ||
      server.definition.type === "http" ||
      server.definition.type === "sse"
        ? server.definition.type
        : "command",
    url: server.definition.url
  };
}

function buildSshWorkerFromFlow(flow: FlowState): SshWorkerDraft {
  return {
    host: readRequiredFlowString(flow, "host"),
    name: readRequiredFlowString(flow, "name"),
    password: readOptionalFlowString(flow, "sshPassword"),
    port: readOptionalPort(flow, "port"),
    username: readOptionalFlowString(flow, "username"),
    workingDirectory: readOptionalFlowString(flow, "workingDirectory")
  };
}

function buildDraftFromFlow(flow: FlowState): McpServerDraft {
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
    transport:
      type === "http" ? "http" : type === "sse" ? "sse" : "stdio",
    type,
    url: readOptionalFlowString(flow, "url")
  };
}

function readFlowProvider(flow: FlowState): ModelProvider {
  const provider = readRequiredFlowString(flow, "provider");

  if (!isModelProvider(provider)) {
    throw new Error(`Unsupported provider "${provider}".`);
  }

  return provider;
}

function readFlowServerType(flow: FlowState): "command" | "http" | "local" | "sse" {
  const type = readRequiredFlowString(flow, "type");

  if (type === "local" || type === "command" || type === "http" || type === "sse") {
    return type;
  }

  throw new Error(`Unsupported MCP server type "${type}".`);
}

function readRequiredFlowString(flow: FlowState, key: string): string {
  const value = flow.state[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Flow value "${key}" is required.`);
  }

  return value.trim();
}

function readOptionalFlowString(flow: FlowState, key: string): string | undefined {
  const value = flow.state[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalPort(flow: FlowState, key: string): number | undefined {
  const value = readOptionalFlowString(flow, key);

  if (!value) {
    return undefined;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SSH port must be a whole number from 1 to 65535.");
  }

  return port;
}

function parseListValue(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseToolFilter(value: string | undefined): string[] {
  if (!value || value.trim() === "*" || value.trim().length === 0) {
    return ["*"];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseRecordValue(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  if (value.trim().startsWith("{")) {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Expected a JSON object.");
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [key, String(entry)])
    );
  }

  const pairs = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const record: Record<string, string> = {};

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

function applyMarketplacePromptValues(
  draft: McpServerDraft,
  prompts: readonly MarketplacePromptField[],
  flow: FlowState
): McpServerDraft {
  if (prompts.length === 0) {
    return draft;
  }

  const nextDraft: McpServerDraft = {
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

function createMarketplacePromptStateKey(prompt: MarketplacePromptField): string {
  return `marketplace:${prompt.target}:${prompt.key}`;
}

function formatStringRecord(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function validateFlowSubmission(key: string, value: string): string | undefined {
  const trimmed = value.trim();

  if (key === "name" && trimmed.length === 0) {
    return "A name is required for this step.";
  }

  if (key === "host" && trimmed.length === 0) {
    return "A host is required for this step.";
  }

  if (key === "sshPassword" && trimmed.length === 0) {
    return "A password is required for password SSH authentication.";
  }

  if (key === "port" && trimmed.length > 0) {
    const port = Number(trimmed);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      return "Enter a valid TCP port from 1 to 65535.";
    }
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
    } catch {
      return "Enter a valid URL for this step.";
    }
  }

  if ((key === "env" || key === "headers") && trimmed.length > 0) {
    try {
      parseRecordValue(trimmed);
    } catch (error) {
      return error instanceof Error ? error.message : "Enter valid KEY=value pairs.";
    }
  }

  return undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

function isPersistedBuildProgress(
  value: unknown
): value is PersistedBuildProgress {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.completedStepIndexes) &&
    candidate.completedStepIndexes.every((item) => typeof item === "number") &&
    (candidate.lastAttemptedStepIndex === undefined ||
      typeof candidate.lastAttemptedStepIndex === "number") &&
    (candidate.lastCompletedStepIndex === undefined ||
      typeof candidate.lastCompletedStepIndex === "number") &&
    (candidate.status === "idle" ||
      candidate.status === "running" ||
      candidate.status === "blocked" ||
      candidate.status === "complete") &&
    typeof candidate.updatedAt === "number"
  );
}

function isApprovalManagerMetadata(
  value: unknown
): value is SessionAppMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  const approvalStatus = metadata.approvalStatus;

  return (
    typeof approvalStatus === "object" &&
    approvalStatus !== null &&
    "policy" in approvalStatus
  );
}

export function formatAutopilotStatus(input: {
  approvalStatus: ApprovalManagerStatus;
  autopilotEnabled: boolean;
  context: ExecutionContext;
  executionMode: ExecutionMode;
  isBusy: boolean;
  pendingApprovalCount: number;
}): string {
  return [
    "Autopilot status",
    "",
    `Autopilot: ${input.autopilotEnabled ? "on" : "off"}`,
    `Approval policy: ${formatApprovalPolicyPreset(input.approvalStatus.policy.preset)}`,
    `Blanket grant: ${formatApprovalGrantStatus(input.approvalStatus)}`,
    `Mode: ${formatExecutionModeLabel(input.executionMode)}`,
    `Scope: ${createScopeHeaderLabel(input.context)}`,
    `Cwd: ${createCwdHeaderLabel(input.context)}`,
    `Pending approvals: ${input.pendingApprovalCount}`,
    `Blocked on approval: ${input.pendingApprovalCount > 0 ? "yes" : "no"}`,
    `Agent state: ${input.autopilotEnabled && input.isBusy ? "running autonomously" : input.isBusy ? "running" : "idle"}`
  ].join("\n");
}

function createTaskId(
  sessionId: string,
  prompt: string,
  transcriptPrompt?: string
): string {
  const hash = createHash("sha1")
    .update(`${prompt}\n${transcriptPrompt ?? ""}`)
    .digest("hex")
    .slice(0, 12);

  return `task-${sessionId}-${hash}`;
}

function describeTaskStep(event: AgentTurnEvent): string {
  switch (event.type) {
    case "status":
      return event.phase === "thinking"
        ? "Thinking."
        : event.phase === "running_tool"
          ? "Running tool."
          : event.phase === "streaming"
            ? "Streaming response."
            : "Ready.";
    case "tool_started":
      return `Running ${event.toolCall.name}.`;
    case "tool_finished":
      return `${event.toolCall.name} ${event.result.isError ? "failed" : "completed"}.`;
    case "assistant_stream_started":
    case "assistant_stream_delta":
      return "Streaming response.";
    case "assistant_stream_completed":
      return "Finalizing response.";
    default:
      return "Running.";
  }
}

function extractApprovalRequestIds(content: string): string[] {
  return [...content.matchAll(/\b(approval-[a-z0-9-]+)\b/gi)].map(
    (match) => match[1]
  );
}

function formatPendingApprovalMessage(
  approvals: readonly ApprovalRequest[]
): string {
  const ids = approvals.map((approval) => approval.id).join(", ");
  return `Blocked on approval: ${ids}. Use /approve <id>, /approve once, /approve task, /approve session, /approve all, /approve full, /autopilot on, or say "go" to continue.`;
}

function formatApprovalPolicyPreset(
  preset: ApprovalPolicyPreset | undefined
): string {
  switch (preset) {
    case "ask-every-time":
      return "ask-every-time";
    case "approve-once":
      return "approve-once";
    case "approve-task":
      return "approve-task";
    case "approve-session":
      return "approve-session";
    case "approve-all":
      return "approve-all";
    case "auto-safe":
      return "auto-safe";
    case "auto-safe-medium":
      return "auto-safe-medium";
    case "full":
      return "full";
    case "strict":
    default:
      return preset ?? "strict";
  }
}

function formatApprovalGrantStatus(status: ApprovalManagerStatus | undefined): string {
  const grant = status?.blanketGrant ?? status?.policy.blanketGrant;

  if (!grant) {
    return "none";
  }

  return `${grant.scope}:${grant.maxSafety}`;
}

export function parseApprovalShortcutIntent(
  input: string,
  context: {
    activeSessionId?: string;
    activeTaskId?: string;
    pendingApprovalCount: number;
  }
): {
  approveLatestPending?: boolean;
  enableAutopilot?: boolean;
  policy?: ApprovalPolicyPreset;
  rerunBlockedTask: boolean;
  scope?: "once" | "task" | "session" | "all";
  summary: string;
} | undefined {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  const rerunBlockedTask = context.pendingApprovalCount > 0;

  if (
    context.pendingApprovalCount > 0 &&
    (normalized === "approve" || normalized === "approved")
  ) {
    return {
      rerunBlockedTask: true,
      scope: context.activeTaskId ? "task" : "once",
      summary: context.activeTaskId
        ? "Approved the current task and resumed it."
        : "Approved the blocked action once and resumed it."
    };
  }

  if (
    normalized === "approve once" ||
    normalized === "auto approve once"
  ) {
    return {
      rerunBlockedTask,
      scope: "once",
      summary: "Approved the next safe/medium action once."
    };
  }

  if (
    normalized === "approve task" ||
    normalized === "approve this task" ||
    normalized === "approve all for this task" ||
    normalized === "auto approve this task"
  ) {
    return {
      rerunBlockedTask,
      scope: context.activeTaskId ? "task" : "session",
      summary: context.activeTaskId
        ? "Approved all safe/medium actions for the current task."
        : "No active task was tracked, so approval was applied to the current session instead."
    };
  }

  if (
    normalized === "approve session" ||
    normalized === "approve this session" ||
    normalized === "approve all for this session" ||
    normalized === "auto approve this session" ||
    normalized === "auto approve everything for this session"
  ) {
    return {
      rerunBlockedTask,
      scope: "session",
      summary: "Approved all safe/medium actions for the current session."
    };
  }

  if (normalized === "approve all") {
    return {
      rerunBlockedTask,
      scope: "session",
      summary: "Approved all safe/medium actions for the current session."
    };
  }

  if (
    normalized === "approve full" ||
    normalized === "full perms" ||
    normalized === "full permissions" ||
    normalized === "full access"
  ) {
    return {
      policy: "full",
      rerunBlockedTask,
      summary: "Approval policy set to full."
    };
  }

  if (
    normalized === "autopilot on" ||
    normalized === "enable autopilot" ||
    normalized === "autopilot this" ||
    normalized === "auto approve this" ||
    normalized === "let it run"
  ) {
    return {
      enableAutopilot: true,
      rerunBlockedTask,
      summary: "Autopilot enabled using the current approval policy."
    };
  }

  if (normalized === "autopilot full") {
    return {
      enableAutopilot: true,
      policy: "full",
      rerunBlockedTask,
      summary: "Autopilot enabled with full approval policy for this session."
    };
  }

  if (
    normalized === "autopilot off" ||
    normalized === "disable autopilot"
  ) {
    return {
      enableAutopilot: false,
      rerunBlockedTask: false,
      summary: "Autopilot disabled."
    };
  }

  if (
    context.pendingApprovalCount > 0 &&
    (normalized === "go" ||
      normalized === "continue" ||
      normalized === "do it" ||
      normalized === "go ahead" ||
      normalized === "yes" ||
      normalized === "yes continue")
  ) {
    return {
      rerunBlockedTask: true,
      scope: context.activeTaskId ? "task" : "once",
      summary: context.activeTaskId
        ? "Approved the current task and resumed it."
        : "Approved the blocked action once and resumed it."
    };
  }

  return undefined;
}
