import { JsonGoalStore, type BackgroundTaskView, type ApprovalRequest, type AgentMode, type AuthSession, type DevicePairing, type GoalRecord, type MarketplaceEntry, type McpFavoriteRecord, type McpSetRecord, type ModelRuntimeSnapshot, type ProjectDossier, type ProjectRecord, type QueueItem, type ProviderModelDefinition, type SessionClientAttachment, type SessionRecord, type SessionRegistryEntry, type SessionSummary, type FleetAgentRecord, type UserDossier, type WatcherRecord, type WorkerSpec } from "@chatgpt-code/runtime-core";
import { PlatformDatabase, SqliteDevicePairingStore, SqliteMcpStateStore, SqliteProjectRegistryStore, SqliteSessionRegistryStore, SqliteWatcherStore, type DossierStore, type ExtendedMemoryStore, type TimelineStore } from "@chatgpt-code/storage-sqlite";
import { type RemoteWorkerRegistry } from "@chatgpt-code/worker-remote";
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
        checks: {
            name: string;
            status: "OK" | "WARN" | "FAIL";
            detail: string;
        }[];
        status: "OK" | "WARN" | "FAIL";
    }>;
    getHealthReport(): Promise<{
        checks: {
            name: string;
            status: "OK" | "WARN" | "FAIL";
            detail: string;
        }[];
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
    login(input: {
        apiKey?: string;
        provider: ModelRuntimeSnapshot["provider"];
    }): Promise<ModelRuntimeSnapshot>;
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
    setSessionBackgroundState(sessionId: string, state: SessionRegistryEntry["backgroundState"]): Promise<SessionRegistryEntry | undefined>;
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
    updateWatcher(id: string, status: WatcherRecord["status"]): Promise<WatcherRecord | undefined>;
}
export type OrchestratorEvent = {
    payload: Awaited<ReturnType<OrchestratorRuntime["getStatus"]>>;
    type: "status";
} | {
    payload: SessionRecord;
    type: "session";
} | {
    payload: Awaited<ReturnType<TimelineStore["record"]>>;
    type: "timeline";
};
export interface CreateOrchestratorRuntimeOptions {
    passphrase: string;
    workspaceRoot: string;
}
export declare function createOrchestratorRuntime({ passphrase, workspaceRoot }: CreateOrchestratorRuntimeOptions): Promise<OrchestratorRuntime>;
//# sourceMappingURL=runtime.d.ts.map