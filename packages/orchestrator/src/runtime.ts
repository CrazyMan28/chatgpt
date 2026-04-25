import { createHash, randomBytes } from "node:crypto";

import {
  AgentControlError,
  createApprovalManager,
  createFleetManager,
  createMcpManager,
  createModelRuntimeManager,
  createBackgroundTaskRunner,
  JsonGoalStore,
  type AgentTurnEvent,
  type BackgroundTaskRecord,
  type BackgroundTaskView,
  loadAppConfig,
  loadToolRegistry,
  type ApprovalRequest,
  type AgentMode,
  type AuthSession,
  type DevicePairing,
  type GoalRecord,
  type MarketplaceEntry,
  type McpFavoriteRecord,
  type McpSetRecord,
  type ModelRuntimeSnapshot,
  type ProjectDossier,
  type ProjectRecord,
  type QueueItem,
  type ProviderModelDefinition,
  type SessionClientAttachment,
  type SessionRecord,
  type SessionRegistryEntry,
  type SessionSummary,
  type FleetAgentRecord,
  type UserDossier,
  type WatcherRecord,
  type WorkerSpec
} from "@chatgpt-code/runtime-core";
import {
  buildUnifiedMarketplace,
  type MarketplaceBuildOptions
} from "@chatgpt-code/mcp-platform";
import {
  PlatformDatabase,
  SqliteApprovalStore,
  SqliteDevicePairingStore,
  SqliteDossierStore,
  SqliteFleetStore,
  SqliteMemoryStore,
  SqliteMcpStateStore,
  SqliteProjectRegistryStore,
  SqliteSessionRegistryStore,
  SqliteSessionStore,
  SqliteTaskStore,
  SqliteTimelineStore,
  SqliteVaultAuthStore,
  SqliteWatcherStore,
  migrateLegacyWorkspaceState,
  type DossierStore,
  type ExtendedMemoryStore,
  type TimelineStore
} from "@chatgpt-code/storage-sqlite";
import { createLocalWorker } from "@chatgpt-code/worker-local";
import {
  createRemoteWorkerRegistry,
  type RemoteWorkerRegistry
} from "@chatgpt-code/worker-remote";

export interface OrchestratorRuntime {
  readonly approvals: ApprovalRequest[];
  readonly database: PlatformDatabase;
  readonly dossierStore: DossierStore;
  readonly fleet: {
    assign(input: {
      mode: AgentMode;
      parentSessionId: string;
      role: WorkerSpec["role"];
      style: "normal" | "plan" | "ultra";
      task: string;
    }): Promise<FleetAgentRecord>;
    getAgent(id: string): FleetAgentRecord | undefined;
    isEnabled(): boolean;
    listAgents(): readonly FleetAgentRecord[];
    pauseAgent(id: string): Promise<FleetAgentRecord | undefined>;
    restartAgent(id: string): Promise<FleetAgentRecord | undefined>;
    resumeAgent(id: string): Promise<FleetAgentRecord | undefined>;
    start(): void;
    stop(): Promise<void>;
    stopAgent(id: string): Promise<FleetAgentRecord | undefined>;
  };
  readonly goalStore: JsonGoalStore;
  readonly memoryStore: ExtendedMemoryStore;
  readonly remoteWorkers: RemoteWorkerRegistry;
  readonly timelineStore: TimelineStore;
  readonly devicePairingStore: SqliteDevicePairingStore;
  readonly mcpStateStore: SqliteMcpStateStore;
  readonly projectRegistryStore: SqliteProjectRegistryStore;
  readonly sessionRegistryStore: SqliteSessionRegistryStore;
  readonly watcherStore: SqliteWatcherStore;
  approveRequest(id: string): Promise<ApprovalRequest | undefined>;
  assignProjectMcpSet(projectId: string, setId: string): Promise<{
    createdAt: number;
    projectId: string;
    setId: string;
    updatedAt: number;
  }>;
  attachSession(input: {
    clientId: string;
    clientType: SessionClientAttachment["clientType"];
    metadata?: Record<string, unknown>;
    sessionId: string;
  }): Promise<SessionClientAttachment>;
  close(): Promise<void>;
  createAuthSession(input: {
    clientType: AuthSession["clientType"];
    deviceLabel: string;
    ownerId?: string;
  }): Promise<AuthSession>;
  createDevicePairing(input?: {
    expiresInMinutes?: number;
    label?: string;
    ownerId?: string;
  }): Promise<DevicePairing>;
  createSession(): Promise<SessionRecord>;
  detachSession(attachmentId: string): Promise<SessionClientAttachment | undefined>;
  favoriteMcp(name: string): Promise<McpFavoriteRecord>;
  generateProjectDossier(): Promise<ProjectDossier>;
  generateUserDossier(existing?: Partial<UserDossier>): Promise<UserDossier>;
  getDoctorReport(): Promise<{
    checks: { name: string; status: "OK" | "WARN" | "FAIL"; detail: string }[];
    status: "OK" | "WARN" | "FAIL";
  }>;
  getHealthReport(): Promise<{
    checks: { name: string; status: "OK" | "WARN" | "FAIL"; detail: string }[];
    status: "OK" | "WARN" | "FAIL";
  }>;
  getOrchestratorQueue(): Promise<QueueItem[]>;
  getOrchestratorStatus(): Promise<{
    approvals: {
      pending: number;
      total: number;
    };
    fleet: {
      agents: readonly FleetAgentRecord[];
      enabled: boolean;
    };
    mode: AgentMode;
    models: readonly ProviderModelDefinition[];
    project: ProjectRecord;
    provider: ModelRuntimeSnapshot;
    queue: QueueItem[];
    sessions: SessionRegistryEntry[];
    tasks: ReturnType<OrchestratorRuntime["listTasks"]> extends Promise<infer T> ? T : never;
    toolCount: number;
    watchers: {
      active: number;
      total: number;
    };
    workers: WorkerSpec[];
  }>;
  getProjectDossier(): Promise<ProjectDossier | undefined>;
  getFleetAgent(id: string): Promise<FleetAgentRecord | undefined>;
  getSession(sessionId: string): Promise<{
    attachments: SessionClientAttachment[];
    registry?: SessionRegistryEntry;
    session?: SessionRecord;
  }>;
  getSessionBackgroundState(sessionId: string): Promise<SessionRegistryEntry["backgroundState"] | undefined>;
  getStatus(): Promise<{
    mode: AgentMode;
    models: readonly ProviderModelDefinition[];
    provider: ModelRuntimeSnapshot;
    tasks: ReturnType<OrchestratorRuntime["listTasks"]> extends Promise<infer T> ? T : never;
    toolCount: number;
    workers: WorkerSpec[];
  }>;
  getUnifiedMarketplace(): Promise<MarketplaceEntry[]>;
  getTask(id: string): Promise<BackgroundTaskView | undefined>;
  getUserDossier(): Promise<UserDossier | undefined>;
  listApprovals(): Promise<ApprovalRequest[]>;
  assignFleetTask(input: {
    mode: AgentMode;
    parentSessionId: string;
    role: WorkerSpec["role"];
    style: "normal" | "plan" | "ultra";
    task: string;
  }): Promise<FleetAgentRecord>;
  listAuthSessions(): Promise<AuthSession[]>;
  listGoals(): Promise<GoalRecord[]>;
  listFleetAgents(): Promise<readonly FleetAgentRecord[]>;
  listMcpFavorites(): Promise<McpFavoriteRecord[]>;
  listMcpSets(): Promise<McpSetRecord[]>;
  listPairings(): Promise<DevicePairing[]>;
  listSessions(): Promise<SessionSummary[]>;
  listSessionRegistry(): Promise<SessionRegistryEntry[]>;
  listTasks(): Promise<readonly BackgroundTaskView[]>;
  listWatchers(): Promise<WatcherRecord[]>;
  listWorkers(): Promise<WorkerSpec[]>;
  pauseFleetAgent(id: string): Promise<FleetAgentRecord | undefined>;
  pauseTask(id: string): Promise<BackgroundTaskView | undefined>;
  login(input: { apiKey?: string; provider: ModelRuntimeSnapshot["provider"] }): Promise<ModelRuntimeSnapshot>;
  rejectRequest(id: string): Promise<ApprovalRequest | undefined>;
  rememberGlobal(text: string): Promise<void>;
  restartFleetAgent(id: string): Promise<FleetAgentRecord | undefined>;
  resumeFleetAgent(id: string): Promise<FleetAgentRecord | undefined>;
  resumeTask(id: string): Promise<BackgroundTaskView | undefined>;
  runPrompt(input: {
    mode: AgentMode;
    prompt: string;
    sessionId: string;
    style: "normal" | "plan" | "ultra";
  }): Promise<{
    content: string;
    session: SessionRecord;
  }>;
  saveMcpSet(input: {
    description?: string;
    name: string;
    projectId?: string;
    serverNames: string[];
  }): Promise<McpSetRecord>;
  searchMemory(keyword: string): Promise<Awaited<ReturnType<ExtendedMemoryStore["search"]>>>;
  searchMarketplace(keyword: string): Promise<MarketplaceEntry[]>;
  setSessionBackgroundState(
    sessionId: string,
    state: SessionRegistryEntry["backgroundState"]
  ): Promise<SessionRegistryEntry | undefined>;
  setModel(model: string): Promise<ModelRuntimeSnapshot>;
  startTask(input: {
    mode?: AgentMode;
    prompt?: string;
    sessionId?: string;
    style?: "normal" | "plan" | "ultra";
    taskId?: string;
  }): Promise<BackgroundTaskView | undefined>;
  stopFleetAgent(id: string): Promise<FleetAgentRecord | undefined>;
  stopTask(id: string): Promise<BackgroundTaskView | undefined>;
  subscribe(listener: (event: OrchestratorEvent) => void): () => void;
  cancelTask(id: string): Promise<BackgroundTaskView | undefined>;
  retryTask(id: string): Promise<BackgroundTaskView | undefined>;
  unfavoriteMcp(name: string): Promise<boolean>;
  updateWatcher(
    id: string,
    status: WatcherRecord["status"]
  ): Promise<WatcherRecord | undefined>;
}

export type OrchestratorEvent =
  | {
      payload: Awaited<ReturnType<OrchestratorRuntime["getStatus"]>>;
      type: "status";
    }
  | {
      payload: SessionRecord;
      type: "session";
    }
  | {
      payload: Awaited<ReturnType<TimelineStore["record"]>>;
      type: "timeline";
    };

export interface CreateOrchestratorRuntimeOptions {
  passphrase: string;
  workspaceRoot: string;
}

export async function createOrchestratorRuntime({
  passphrase,
  workspaceRoot
}: CreateOrchestratorRuntimeOptions): Promise<OrchestratorRuntime> {
  const database = new PlatformDatabase(workspaceRoot);
  await migrateLegacyWorkspaceState({
    database,
    passphrase,
    workspaceRoot
  });

  const authStore = new SqliteVaultAuthStore(database, passphrase);
  const approvalStore = new SqliteApprovalStore(database);
  const approvalManager = createApprovalManager(approvalStore, {
    dangerousRequiresApproval: true,
    fullMachineRequiresApproval: true,
    homeWriteRequiresApproval: true,
    mediumRequiresApproval: false,
    remoteHostRequiresApproval: true,
    safeAutoApprove: true
  });
  const devicePairingStore = new SqliteDevicePairingStore(database);
  const memoryStore = new SqliteMemoryStore(database);
  const mcpStateStore = new SqliteMcpStateStore(database);
  const projectRegistryStore = new SqliteProjectRegistryStore(database);
  const sessionRegistryStore = new SqliteSessionRegistryStore(database);
  const sessionStore = new SqliteSessionStore(database);
  const taskStore = new SqliteTaskStore(database);
  const dossierStore = new SqliteDossierStore(database);
  const fleetStore = new SqliteFleetStore(database);
  const timelineStore = new SqliteTimelineStore(database);
  const watcherStore = new SqliteWatcherStore(database);
  const projectRecord = await ensureProjectRecord(projectRegistryStore, workspaceRoot);
  const config = loadAppConfig(process.env, workspaceRoot);
  const modelRuntime = await createModelRuntimeManager({
    authStore,
    bootstrapModelConfig: config.model
  });
  const toolRegistry = await loadToolRegistry(config.mcpServers, {
    approvalManager,
    watcherStore,
    workspaceRoot
  });
  const mcpManager = createMcpManager({
    cwd: workspaceRoot,
    env: process.env,
    toolRegistry
  });
  const taskRunner = await createBackgroundTaskRunner({
    memoryStore,
    modelRuntime,
    sessionStore,
    taskStore,
    toolRegistry,
    workspaceRoot
  });
  const localWorker = createLocalWorker({
    memoryStore,
    modelRuntime,
    sessionStore,
    toolRegistry
  });
  const fleetManager = createFleetManager({
    fleetStore,
    initialAgents: await fleetStore.listAgents(),
    memoryStore,
    maxConcurrentAgents: readFleetSoftLimit(),
    modelRuntime,
    sessionStore,
    toolRegistry
  });
  const goalStore = new JsonGoalStore(workspaceRoot);
  const remoteWorkers = createRemoteWorkerRegistry({
    workspaceRoot
  });
  const listeners = new Set<(event: OrchestratorEvent) => void>();
  const approvals: ApprovalRequest[] = [...(await approvalManager.list())];

  const emit = (event: OrchestratorEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  modelRuntime.subscribe(async () => {
    emit({
      payload: await buildStatus(),
      type: "status"
    });
  });

  taskRunner.subscribe(async (event) => {
    const timelineEvent = await timelineStore.record({
      detail:
        event.type === "task_updated"
          ? `Task ${event.task.id} updated`
          : `Task ${event.taskId} removed`,
      summary:
        event.type === "task_updated"
          ? `Task ${event.task.id} ${event.task.isRunning ? "running" : "updated"}`
          : `Task ${event.taskId} removed`,
      type: "system"
    });

    emit({
      payload: timelineEvent,
      type: "timeline"
    });
    emit({
      payload: await buildStatus(),
      type: "status"
    });
  });

  async function syncApprovalCache(): Promise<ApprovalRequest[]> {
    approvals.splice(0, approvals.length, ...(await approvalManager.list()));
    return [...approvals];
  }

  async function ensureSessionRegistryEntry(
    session: SessionRecord,
    overrides?: Partial<SessionRegistryEntry>
  ): Promise<SessionRegistryEntry> {
    const existing = await sessionRegistryStore.get(session.id);
    const snapshot = modelRuntime.getSnapshot();
    const nextEntry: SessionRegistryEntry = {
      activeRemoteHostId: existing?.activeRemoteHostId,
      allowedRoots: existing?.allowedRoots ?? [projectRecord.path],
      backgroundState: existing?.backgroundState ?? "idle",
      createdAt: session.createdAt,
      cwd: existing?.cwd ?? projectRecord.lastCwd,
      lastActivityAt: Date.now(),
      mode: existing?.mode ?? "normal",
      model: snapshot.model,
      ownerId: "local-owner",
      projectId: projectRecord.id,
      provider: snapshot.provider,
      scope: existing?.scope ?? projectRecord.lastScope,
      sessionId: session.id,
      style: existing?.style ?? "normal",
      title: session.title,
      updatedAt: Date.now(),
      ...existing,
      ...overrides
    };

    return sessionRegistryStore.save(nextEntry);
  }

  async function buildMarketplaceEntries(): Promise<MarketplaceEntry[]> {
    const favorites = await mcpStateStore.listFavorites();
    const favoriteNames = new Set(favorites.map((favorite) => favorite.name));
    const entries = await buildUnifiedMarketplace({
      installedServers: await mcpManager.listServers(),
      workspaceRoot
    } satisfies MarketplaceBuildOptions);

    return entries.map((entry) => ({
      ...entry,
      favorite: favoriteNames.has(entry.name)
    }));
  }

  async function buildQueue(): Promise<QueueItem[]> {
    const [pendingApprovals, watcherRecords, workerList] = await Promise.all([
      approvalManager.listPending(),
      watcherStore.list(),
      remoteWorkers.list()
    ]);
    const queueItems: QueueItem[] = [];

    for (const approval of pendingApprovals) {
      queueItems.push({
        approvalId: approval.id,
        createdAt: approval.createdAt,
        detail: approval.detail,
        id: `approval:${approval.id}`,
        metadata: approval.metadata,
        state: "waiting_approval",
        summary: approval.summary,
        type: "approval",
        updatedAt: approval.updatedAt
      });
    }

    for (const watcher of watcherRecords) {
      queueItems.push({
        createdAt: watcher.createdAt,
        detail: watcher.detail,
        id: `watcher:${watcher.id}`,
        metadata: watcher.metadata,
        sessionId: watcher.sessionId,
        state:
          watcher.status === "active"
            ? "running"
            : watcher.status === "healthy"
              ? "running"
              : watcher.status === "stalled"
                ? "blocked"
                : watcher.status === "completed"
                  ? "complete"
                  : watcher.status === "cancelled"
                    ? "failed"
                    : "failed",
        summary: watcher.summary,
        type: "watcher",
        updatedAt: watcher.updatedAt,
        watcherId: watcher.id
      });
    }

    for (const task of taskRunner.listTasks()) {
      queueItems.push({
        createdAt: task.createdAt,
        detail: task.currentStep ?? task.lastError ?? task.blockedReason ?? task.lastResultSummary,
        id: `task:${task.id}`,
        sessionId: task.sessionId,
        state:
          task.state === "running" ||
          task.state === "planning" ||
          task.state === "validating"
            ? "running"
            : task.state === "waiting_approval"
              ? "waiting_approval"
              : task.state === "paused" ||
                  task.state === "blocked" ||
                  task.state === "rate_limited"
                ? "blocked"
                : task.state === "complete"
                  ? "complete"
                  : task.state === "failed" || task.state === "cancelled"
                    ? "failed"
                    : "queued",
        summary: task.title,
        type: "task",
        updatedAt: task.updatedAt
      });
    }

    for (const agent of fleetManager.listAgents()) {
      queueItems.push({
        agentId: agent.id,
        createdAt: agent.createdAt,
        detail: agent.summary ?? agent.error,
        id: `fleet:${agent.id}`,
        sessionId: agent.parentSessionId,
        state:
          agent.state === "queued"
            ? "queued"
            : agent.state === "waiting" || agent.state === "paused"
              ? "blocked"
              : agent.state === "running"
                ? "running"
                : agent.state === "complete"
                  ? "complete"
                  : "failed",
        summary: agent.task,
        type: "fleet",
        updatedAt: agent.updatedAt
      });
    }

    for (const worker of workerList.filter((entry) => entry.status !== "offline")) {
      queueItems.push({
        createdAt: worker.lastHeartbeat ?? Date.now(),
        detail: worker.currentTask,
        id: `remote:${worker.id}`,
        state: worker.status === "running" ? "running" : "queued",
        summary: `${worker.name} (${worker.status})`,
        type: "remote",
        updatedAt: worker.lastHeartbeat ?? Date.now(),
        workerId: worker.id
      });
    }

    return queueItems.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function buildInteractiveTaskRecord(input: {
    prompt: string;
    sessionId: string;
  }): BackgroundTaskRecord {
    const taskId = createInteractiveTaskId(input.sessionId, input.prompt);
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
      sessionId: input.sessionId,
      state: "planning",
      title: existing?.title ?? summarizeText(input.prompt),
      transcriptPrompt: existing?.transcriptPrompt ?? input.prompt,
      updatedAt: now,
      validationStatus: "idle",
      watcherIds: existing?.watcherIds ?? []
    };
  }

  function readTaskControlDecision(
    taskId: string
  ):
    | { ok: true }
    | { ok: false; reason?: string; state: "cancelled" | "paused" } {
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
  }

  async function executeInteractivePrompt(input: {
    mode: AgentMode;
    prompt: string;
    sessionId: string;
    style: "normal" | "plan" | "ultra";
  }): Promise<{
    content: string;
    session: SessionRecord;
    task: BackgroundTaskView;
  }> {
    const approvalSnapshot = approvalManager.getStatus();
    const taskId = createInteractiveTaskId(input.sessionId, input.prompt);
    const blockedApprovalIds = new Set<string>();
    let trackedTask = await taskRunner.saveTask(
      buildInteractiveTaskRecord({
        prompt: input.prompt,
        sessionId: input.sessionId
      })
    );

    approvalManager.setActiveSession(input.sessionId);
    approvalManager.setActiveTask(taskId);
    approvalManager.setMode(input.mode);

    try {
      const existingSession = await sessionStore.loadSession(input.sessionId);

      if (existingSession) {
        await ensureSessionRegistryEntry(existingSession, {
          backgroundState: "running",
          lastActivityAt: Date.now(),
          mode: input.mode,
          style: input.style
        });
      }

      const result = await (
        localWorker.runPrompt as (
          runInput: {
            mode: AgentMode;
            prompt: string;
            sessionId: string;
            style: "normal" | "plan" | "ultra";
          },
          options: {
            onEvent?: (event: AgentTurnEvent) => void | Promise<void>;
            onRetry?: (input: {
              attempt: number;
              delayMs: number;
              error: unknown;
            }) => void | Promise<void>;
            shouldContinue?: () =>
              | { ok: true }
              | { ok: false; reason?: string; state: "cancelled" | "paused" };
          }
        ) => Promise<{
          content: string;
          session: SessionRecord;
        }>
      )(input, {
        onEvent: async (event: AgentTurnEvent) => {
          if (event.type === "tool_finished") {
            for (const approvalId of extractApprovalRequestIds(event.result.content)) {
              blockedApprovalIds.add(approvalId);
            }
          }

          trackedTask = await taskRunner.saveTask({
            ...trackedTask,
            approvalRequestIds: [...blockedApprovalIds],
            currentStep: describeTaskStep(event),
            lastEventAt: Date.now(),
            requestedAction: undefined,
            state: "running",
            validationStatus: "running"
          });
        },
        onRetry: async ({
          attempt,
          delayMs
        }: {
          attempt: number;
          delayMs: number;
          error: unknown;
        }) => {
          trackedTask = await taskRunner.saveTask({
            ...trackedTask,
            currentStep: `Rate limited, retry ${attempt}/3 in ${delayMs}ms.`,
            lastEventAt: Date.now(),
            requestedAction: undefined,
            state: "rate_limited"
          });
        },
        shouldContinue: () => readTaskControlDecision(taskId)
      });

      const relevantPendingApprovals =
        blockedApprovalIds.size > 0
          ? (await approvalManager.listPending()).filter((approval) => {
              return (
                approval.metadata.sessionId === result.session.id &&
                (blockedApprovalIds.has(approval.id) || approval.metadata.taskId === taskId)
              );
            })
          : [];

      trackedTask = await taskRunner.saveTask({
        ...trackedTask,
        approvalRequestIds: relevantPendingApprovals.map((approval) => approval.id),
        blockedReason:
          relevantPendingApprovals.length > 0 ? "Waiting for approval." : undefined,
        currentStep:
          relevantPendingApprovals.length > 0 ? "Awaiting approval." : "Complete.",
        lastEventAt: Date.now(),
        lastResultSummary: summarizeText(result.content),
        lastRunAt: Date.now(),
        requestedAction: undefined,
        runCount: trackedTask.runCount + 1,
        state:
          relevantPendingApprovals.length > 0 ? "waiting_approval" : "complete",
        validationStatus: "passed"
      });

      await ensureSessionRegistryEntry(result.session, {
        backgroundState: "idle",
        lastActivityAt: Date.now(),
        mode: input.mode,
        model: modelRuntime.getSnapshot().model,
        provider: modelRuntime.getSnapshot().provider,
        style: input.style,
        title: result.session.title
      });
      await syncApprovalCache();

      const timelineEvent = await timelineStore.record({
        sessionId: result.session.id,
        summary:
          relevantPendingApprovals.length > 0
            ? `Prompt waiting for approval in ${input.mode.toUpperCase()} mode`
            : `Prompt completed in ${input.mode.toUpperCase()} mode`,
        type: "system"
      });
      emit({
        payload: timelineEvent,
        type: "timeline"
      });
      emit({
        payload: result.session,
        type: "session"
      });

      return {
        ...result,
        task: trackedTask
      };
    } catch (error) {
      trackedTask = await taskRunner.saveTask({
        ...trackedTask,
        blockedReason:
          error instanceof AgentControlError ? error.message : undefined,
        currentStep: undefined,
        lastError:
          error instanceof AgentControlError
            ? undefined
            : error instanceof Error
              ? error.message
              : "Interactive task failed.",
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
        validationStatus:
          error instanceof AgentControlError ? trackedTask.validationStatus : "failed"
      });

      const session = await sessionStore.loadSession(input.sessionId);

      if (session) {
        await ensureSessionRegistryEntry(session, {
          backgroundState:
            error instanceof AgentControlError && error.state === "paused"
              ? "paused"
              : "idle",
          lastActivityAt: Date.now(),
          mode: input.mode,
          style: input.style,
          title: session.title
        });
      }

      await syncApprovalCache();
      throw error;
    } finally {
      approvalManager.restore({
        activeSessionId: approvalSnapshot.activeSessionId,
        activeTaskId: approvalSnapshot.activeTaskId,
        mode: approvalSnapshot.mode,
        policy: approvalSnapshot.policy
      });
    }
  }

  async function runTrackedTaskById(input: {
    mode?: AgentMode;
    retry?: boolean;
    style?: "normal" | "plan" | "ultra";
    taskId: string;
  }): Promise<BackgroundTaskView | undefined> {
    const task = taskRunner.getTask(input.taskId);

    if (!task) {
      return undefined;
    }

    if (task.kind !== "interactive") {
      if (input.retry) {
        await taskRunner.retryTask(task.id);
      } else {
        await taskRunner.resumeTask(task.id);
      }

      return taskRunner.runTaskNow(task.id);
    }

    if (input.retry) {
      await taskRunner.retryTask(task.id);
    } else {
      await taskRunner.resumeTask(task.id);
    }

    const result = await executeInteractivePrompt({
      mode: input.mode ?? "normal",
      prompt: task.resumePrompt ?? task.prompt,
      sessionId: task.sessionId,
      style: input.style ?? "normal"
    });

    return result.task;
  }

  async function buildHealthReport(): Promise<{
    checks: { name: string; status: "OK" | "WARN" | "FAIL"; detail: string }[];
    status: "OK" | "WARN" | "FAIL";
  }> {
    const marketplace = await buildUnifiedMarketplace({
      installedServers: await mcpManager.listServers(),
      workspaceRoot
    });
    const checks = [
      {
        detail: `Database ready at ${database.filePath}`,
        name: "database",
        status: "OK" as const
      },
      {
        detail: `${toolRegistry.listTools().length} tools loaded`,
        name: "tools",
        status: "OK" as const
      },
      {
        detail: `${marketplace.length} marketplace entries available`,
        name: "marketplace",
        status: "OK" as const
      },
      {
        detail: modelRuntime.getSnapshot().loginLabel,
        name: "provider",
        status: modelRuntime.getSnapshot().isAuthenticated ? ("OK" as const) : ("WARN" as const)
      }
    ];

    return {
      checks,
      status: checks.some((check) => check.status === "WARN") ? "WARN" : "OK"
    };
  }

  return {
    approvals,
    database,
    devicePairingStore,
    dossierStore,
    fleet: fleetManager,
    goalStore,
    memoryStore,
    mcpStateStore,
    projectRegistryStore,
    remoteWorkers,
    sessionRegistryStore,
    timelineStore,
    watcherStore,
    async approveRequest(id) {
      const request = await approvalManager.approve(id);
      await syncApprovalCache();
      return request;
    },
    async assignProjectMcpSet(projectId, setId) {
      return mcpStateStore.assignProjectSet({
        createdAt: Date.now(),
        projectId,
        setId,
        updatedAt: Date.now()
      });
    },
    async attachSession(input) {
      return sessionRegistryStore.attachClient({
        attachedAt: Date.now(),
        clientId: input.clientId,
        clientType: input.clientType,
        id: `attach-${randomBytes(4).toString("hex")}`,
        isActive: true,
        metadata: input.metadata,
        sessionId: input.sessionId
      });
    },
    async close() {
      await taskRunner.close();
      await toolRegistry.close();
      database.close();
    },
    async createAuthSession(input) {
      return devicePairingStore.createAuthSession({
        clientType: input.clientType,
        createdAt: Date.now(),
        deviceLabel: input.deviceLabel,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
        id: `auth-${randomBytes(6).toString("hex")}`,
        ownerId: input.ownerId ?? "local-owner",
        refreshTokenHash: createHash("sha256")
          .update(randomBytes(16).toString("hex"))
          .digest("hex"),
        updatedAt: Date.now()
      });
    },
    async createDevicePairing(input) {
      return devicePairingStore.createPairing({
        code: randomBytes(3).toString("hex").toUpperCase(),
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * (input?.expiresInMinutes ?? 15),
        id: `pair-${randomBytes(6).toString("hex")}`,
        label: input?.label ?? "New device",
        ownerId: input?.ownerId ?? "local-owner",
        state: "pending",
        updatedAt: Date.now()
      });
    },
    async createSession() {
      const session = await sessionStore.createSession();
      await ensureSessionRegistryEntry(session);
      emit({
        payload: session,
        type: "session"
      });
      return session;
    },
    async detachSession(attachmentId) {
      return sessionRegistryStore.detachClient(attachmentId);
    },
    async favoriteMcp(name) {
      return mcpStateStore.favorite(name);
    },
    async generateProjectDossier() {
      const dossier = await dossierStore.generateProjectDossier(workspaceRoot);
      await dossierStore.saveProjectDossier(workspaceRoot, dossier);
      return dossier;
    },
    async generateUserDossier(existing) {
      const dossier = await dossierStore.generateUserDossier(existing);
      await dossierStore.saveUserDossier(dossier);
      return dossier;
    },
    async getHealthReport() {
      return buildHealthReport();
    },
    async getDoctorReport() {
      const base = await buildHealthReport();
      const [sessions, watchers, pairings] = await Promise.all([
        sessionRegistryStore.list(),
        watcherStore.list(),
        devicePairingStore.listPairings()
      ]);
      const checks = [
        ...base.checks,
        {
          detail: `${sessions.length} registered sessions`,
          name: "sessions",
          status: "OK" as const
        },
        {
          detail: `${watchers.length} persisted watchers`,
          name: "watchers",
          status: "OK" as const
        },
        {
          detail: `${pairings.length} device pairings issued`,
          name: "pairings",
          status: "OK" as const
        }
      ];

      return {
        checks,
        status: checks.some((check) => check.status === "WARN") ? "WARN" : "OK"
      };
    },
    async getProjectDossier() {
      return dossierStore.loadProjectDossier(workspaceRoot);
    },
    async getFleetAgent(id) {
      return fleetManager.getAgent(id);
    },
    async getOrchestratorQueue() {
      return buildQueue();
    },
    async getOrchestratorStatus() {
      const [queue, sessions, watcherRecords, workerList, approvalRecords] = await Promise.all([
        buildQueue(),
        sessionRegistryStore.list(),
        watcherStore.list(),
        remoteWorkers.list(),
        approvalManager.list()
      ]);

      return {
        approvals: {
          pending: approvalRecords.filter((approval) => approval.state === "pending").length,
          total: approvalRecords.length
        },
        fleet: {
          agents: fleetManager.listAgents(),
          enabled: fleetManager.isEnabled()
        },
        mode: "normal" as AgentMode,
        models: await modelRuntime.listModels(),
        project: projectRecord,
        provider: modelRuntime.getSnapshot(),
        queue,
        sessions,
        tasks: taskRunner.listTasks(),
        toolCount: toolRegistry.listTools().length,
        watchers: {
          active: watcherRecords.filter((watcher) =>
            watcher.status === "active" ||
            watcher.status === "healthy" ||
            watcher.status === "stalled"
          ).length,
          total: watcherRecords.length
        },
        workers: workerList
      };
    },
    async getSession(sessionId) {
      return {
        attachments: await sessionRegistryStore.listAttachments(sessionId),
        registry: await sessionRegistryStore.get(sessionId),
        session: await sessionStore.loadSession(sessionId)
      };
    },
    async getSessionBackgroundState(sessionId) {
      return (await sessionRegistryStore.get(sessionId))?.backgroundState;
    },
    async getStatus() {
      return buildStatus();
    },
    async getUnifiedMarketplace() {
      return buildMarketplaceEntries();
    },
    async getTask(id) {
      return taskRunner.getTask(id);
    },
    async getUserDossier() {
      return dossierStore.loadUserDossier();
    },
    async listApprovals() {
      return syncApprovalCache();
    },
    async assignFleetTask(input) {
      return fleetManager.assign(input);
    },
    async listAuthSessions() {
      return devicePairingStore.listAuthSessions();
    },
    async listGoals() {
      return goalStore.listGoals();
    },
    async listFleetAgents() {
      return fleetManager.listAgents();
    },
    async listMcpFavorites() {
      return mcpStateStore.listFavorites();
    },
    async listMcpSets() {
      return mcpStateStore.listSets();
    },
    async listPairings() {
      return devicePairingStore.listPairings();
    },
    async listSessions() {
      return sessionStore.listSessions();
    },
    async listSessionRegistry() {
      return sessionRegistryStore.list();
    },
    async listTasks() {
      return taskRunner.listTasks();
    },
    async listWatchers() {
      return watcherStore.list();
    },
    async listWorkers() {
      return remoteWorkers.list();
    },
    async pauseFleetAgent(id) {
      return fleetManager.pauseAgent(id);
    },
    async pauseTask(id) {
      return taskRunner.pauseTask(id);
    },
    async login(input) {
      const snapshot = await modelRuntime.login(input);
      const timelineEvent = await timelineStore.record({
        summary: `Provider switched to ${snapshot.providerLabel}`,
        type: "mode_switch"
      });
      emit({
        payload: timelineEvent,
        type: "timeline"
      });
      emit({
        payload: await buildStatus(),
        type: "status"
      });
      return snapshot;
    },
    async rejectRequest(id) {
      const request = await approvalManager.reject(id);
      await syncApprovalCache();
      return request;
    },
    async rememberGlobal(text) {
      await memoryStore.rememberGlobal(text);
    },
    async restartFleetAgent(id) {
      return fleetManager.restartAgent(id);
    },
    async resumeFleetAgent(id) {
      return fleetManager.resumeAgent(id);
    },
    async resumeTask(id) {
      return runTrackedTaskById({
        taskId: id
      });
    },
    async runPrompt(input) {
      const result = await executeInteractivePrompt(input);
      return result;
    },
    async searchMemory(keyword) {
      return memoryStore.search(keyword);
    },
    async saveMcpSet(input) {
      const setRecord: McpSetRecord = {
        createdAt: Date.now(),
        id: `set-${randomBytes(5).toString("hex")}`,
        metadata: input.description
          ? {
              description: input.description
            }
          : undefined,
        name: input.name,
        serverNames: input.serverNames,
        updatedAt: Date.now()
      };
      const saved = await mcpStateStore.saveSet(setRecord);

      if (input.projectId) {
        await mcpStateStore.assignProjectSet({
          createdAt: Date.now(),
          projectId: input.projectId,
          setId: saved.id,
          updatedAt: Date.now()
        });
      }

      return saved;
    },
    async searchMarketplace(keyword) {
      const query = keyword.trim().toLowerCase();
      const marketplace = await buildMarketplaceEntries();

      if (query.length === 0) {
        return marketplace;
      }

      return marketplace.filter((entry) => {
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.description.toLowerCase().includes(query) ||
          entry.category.toLowerCase().includes(query) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
    },
    async setSessionBackgroundState(sessionId, state) {
      const existing = await sessionRegistryStore.get(sessionId);

      if (!existing) {
        return undefined;
      }

      return sessionRegistryStore.save({
        ...existing,
        backgroundState: state,
        lastActivityAt: Date.now(),
        updatedAt: Date.now()
      });
    },
    async setModel(model) {
      const snapshot = await modelRuntime.setModel(model);
      const timelineEvent = await timelineStore.record({
        summary: `Model changed to ${snapshot.model}`,
        type: "system"
      });
      emit({
        payload: timelineEvent,
        type: "timeline"
      });
      emit({
        payload: await buildStatus(),
        type: "status"
      });
      return snapshot;
    },
    async startTask(input) {
      if (input.taskId) {
        return runTrackedTaskById({
          mode: input.mode,
          style: input.style,
          taskId: input.taskId
        });
      }

      if (!input.prompt || !input.sessionId) {
        throw new Error("Usage: task start requires taskId or prompt + sessionId.");
      }

      const result = await executeInteractivePrompt({
        mode: input.mode ?? "normal",
        prompt: input.prompt,
        sessionId: input.sessionId,
        style: input.style ?? "normal"
      });

      return result.task;
    },
    async stopFleetAgent(id) {
      return fleetManager.stopAgent(id);
    },
    async stopTask(id) {
      return taskRunner.stopTask(id);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async cancelTask(id) {
      return taskRunner.cancelTask(id);
    },
    async retryTask(id) {
      return runTrackedTaskById({
        retry: true,
        taskId: id
      });
    },
    async unfavoriteMcp(name) {
      return mcpStateStore.unfavorite(name);
    },
    async updateWatcher(id, status) {
      const watcher = await watcherStore.get(id);

      if (!watcher) {
        return undefined;
      }

      return watcherStore.update({
        ...watcher,
        status,
        updatedAt: Date.now()
      });
    }
  };

  async function buildStatus() {
    const [approvalRecords, watcherRecords, sessions, queue] = await Promise.all([
      approvalManager.list(),
      watcherStore.list(),
      sessionRegistryStore.list(),
      buildQueue()
    ]);

    return {
      approvals: {
        pending: approvalRecords.filter((approval) => approval.state === "pending").length,
        total: approvalRecords.length
      },
      mode: "normal" as AgentMode,
      fleet: {
        agents: fleetManager.listAgents(),
        enabled: fleetManager.isEnabled()
      },
      goals: await goalStore.listGoals(),
      models: await modelRuntime.listModels(),
      provider: modelRuntime.getSnapshot(),
      project: projectRecord,
      queue,
      sessions,
      tasks: taskRunner.listTasks(),
      toolCount: toolRegistry.listTools().length,
      watchers: {
        active: watcherRecords.filter((watcher) =>
          watcher.status === "active" ||
          watcher.status === "healthy" ||
          watcher.status === "stalled"
        ).length,
        total: watcherRecords.length
      },
      workers: await remoteWorkers.list()
    };
  }
}

function createInteractiveTaskId(sessionId: string, prompt: string): string {
  const hash = createHash("sha1")
    .update(`${sessionId}\n${prompt}`)
    .digest("hex")
    .slice(0, 12);

  return `task-${sessionId}-${hash}`;
}

function extractApprovalRequestIds(content: string): string[] {
  return [...content.matchAll(/\b(approval-[a-z0-9-]+)\b/gi)].map(
    (match) => match[1]
  );
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

function summarizeText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= 96) {
    return normalized || "Completed.";
  }

  return `${normalized.slice(0, 95)}…`;
}

async function ensureProjectRecord(
  projectRegistryStore: SqliteProjectRegistryStore,
  workspaceRoot: string
): Promise<ProjectRecord> {
  const existing = await projectRegistryStore.getByPath(workspaceRoot);

  if (existing) {
    return existing;
  }

  const name = workspaceRoot.split("/").filter(Boolean).at(-1) ?? "workspace";
  const project: ProjectRecord = {
    createdAt: Date.now(),
    displayName: name,
    id: createProjectId(workspaceRoot),
    lastCwd: workspaceRoot,
    lastScope: "workspace",
    name,
    path: workspaceRoot,
    updatedAt: Date.now()
  };

  await projectRegistryStore.save(project);
  return project;
}

function createProjectId(workspaceRoot: string): string {
  return createHash("sha1").update(workspaceRoot).digest("hex").slice(0, 12);
}

function readFleetSoftLimit(): number {
  const value = Number(process.env.CHATGPT_CODE_FLEET_MAX_AGENTS);

  if (!Number.isFinite(value) || value < 1) {
    return 8;
  }

  return Math.floor(value);
}
