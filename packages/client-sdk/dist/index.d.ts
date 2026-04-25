import type { AgentMode, ApprovalRequest, AuthSession, BackgroundTaskView, DevicePairing, FleetAgentRecord, MarketplaceEntry, McpFavoriteRecord, McpSetRecord, ModelRuntimeSnapshot, ProjectDossier, QueueItem, SessionRecord, SessionClientAttachment, SessionRegistryEntry, SessionSummary, TimelineEvent, UserDossier } from "@chatgpt-code/runtime-core";
export interface DaemonClientOptions {
    baseUrl?: string;
}
export interface DaemonEventMap {
    session: SessionRecord;
    status: unknown;
    timeline: TimelineEvent;
}
export declare class DaemonClient {
    readonly baseUrl: string;
    constructor(options?: DaemonClientOptions);
    createSession(): Promise<SessionRecord>;
    createAuthSession(input: {
        clientType: "tui" | "web" | "mobile" | "remote" | "desktop" | "daemon";
        deviceLabel: string;
        ownerId?: string;
    }): Promise<AuthSession>;
    createDevicePairing(input?: {
        expiresInMinutes?: number;
        label?: string;
        ownerId?: string;
    }): Promise<DevicePairing>;
    generateProjectDossier(): Promise<ProjectDossier>;
    generateUserDossier(): Promise<UserDossier>;
    getMarketplace(): Promise<MarketplaceEntry[]>;
    getOrchestratorQueue(): Promise<QueueItem[]>;
    getOrchestratorStatus<T = unknown>(): Promise<T>;
    listGoals<T = unknown[]>(): Promise<T>;
    listTasks<T = BackgroundTaskView[]>(): Promise<T>;
    getTask<T = BackgroundTaskView>(id: string): Promise<T>;
    startTask<T = BackgroundTaskView>(input: {
        mode?: AgentMode;
        prompt?: string;
        sessionId?: string;
        style?: "normal" | "plan" | "ultra";
        taskId?: string;
    }): Promise<T>;
    pauseTask<T = BackgroundTaskView>(id: string): Promise<T>;
    resumeTask<T = BackgroundTaskView>(id: string): Promise<T>;
    stopTask<T = BackgroundTaskView>(id: string): Promise<T>;
    cancelTask<T = BackgroundTaskView>(id: string): Promise<T>;
    retryTask<T = BackgroundTaskView>(id: string): Promise<T>;
    listApprovals(): Promise<ApprovalRequest[]>;
    listAuthSessions(): Promise<AuthSession[]>;
    listFleet<T = unknown>(): Promise<T>;
    listAgents<T = FleetAgentRecord[]>(): Promise<T>;
    getAgent<T = FleetAgentRecord>(id: string): Promise<T>;
    startFleet(): Promise<{
        enabled: boolean;
    }>;
    stopFleet(): Promise<{
        enabled: boolean;
    }>;
    assignFleet(input: {
        mode: AgentMode;
        parentSessionId: string;
        role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
        style: "normal" | "plan" | "ultra";
        task: string;
    }): Promise<unknown>;
    pauseAgent<T = FleetAgentRecord>(id: string): Promise<T>;
    resumeAgent<T = FleetAgentRecord>(id: string): Promise<T>;
    stopAgent<T = FleetAgentRecord>(id: string): Promise<T>;
    restartAgent<T = FleetAgentRecord>(id: string): Promise<T>;
    listWorkers<T = unknown[]>(): Promise<T>;
    addWorker<T = unknown>(input: {
        capabilities: string[];
        connectionType: "local" | "ssh" | "container" | "subprocess";
        host: string;
        id: string;
        name: string;
        port?: number;
        role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
        status: "idle" | "running" | "waiting" | "degraded" | "offline";
        username?: string;
        workingDirectory?: string;
    }): Promise<T>;
    connectWorker<T = unknown>(id: string): Promise<T>;
    disconnectWorker<T = unknown>(id: string): Promise<T>;
    testWorker<T = unknown>(id: string): Promise<T>;
    getProjectDossier(): Promise<ProjectDossier | undefined>;
    getStatus<T = unknown>(): Promise<T>;
    getUserDossier(): Promise<UserDossier | undefined>;
    listModels<T = unknown>(): Promise<T>;
    listSessions(): Promise<SessionSummary[]>;
    listDevicePairings(): Promise<DevicePairing[]>;
    listMcpFavorites(): Promise<McpFavoriteRecord[]>;
    listMcpSets(): Promise<McpSetRecord[]>;
    listWatchers<T = unknown[]>(): Promise<T>;
    login(input: {
        apiKey?: string;
        provider: "local" | "openai" | "anthropic" | "mistral";
    }): Promise<ModelRuntimeSnapshot>;
    rememberGlobal(text: string): Promise<void>;
    approveRequest(id: string): Promise<ApprovalRequest | undefined>;
    rejectRequest(id: string): Promise<ApprovalRequest | undefined>;
    runPrompt(input: {
        mode: AgentMode;
        prompt: string;
        sessionId: string;
        style: "normal" | "plan" | "ultra";
    }): Promise<{
        content: string;
        session: SessionRecord;
    }>;
    searchMemory<T = unknown>(keyword: string): Promise<T>;
    searchMarketplace(keyword: string): Promise<MarketplaceEntry[]>;
    getSession<T = {
        attachments: SessionClientAttachment[];
        registry?: SessionRegistryEntry;
        session?: SessionRecord;
    }>(id: string): Promise<T>;
    sendSessionInput(input: {
        mode: AgentMode;
        prompt: string;
        sessionId: string;
        style: "normal" | "plan" | "ultra";
    }): Promise<{
        content: string;
        session: SessionRecord;
    }>;
    attachSession(input: {
        clientId: string;
        clientType: "tui" | "web" | "mobile" | "remote" | "desktop" | "daemon";
        metadata?: Record<string, unknown>;
        sessionId: string;
    }): Promise<SessionClientAttachment>;
    detachSession(attachmentId: string, sessionId: string): Promise<SessionClientAttachment | undefined>;
    setSessionBackgroundState(sessionId: string, action: "resume" | "start" | "stop"): Promise<SessionRegistryEntry | undefined>;
    setModel(model: string): Promise<ModelRuntimeSnapshot>;
    cancelWatcher(id: string): Promise<unknown>;
    getWatcher<T = unknown>(id: string): Promise<T>;
    favoriteMcp(name: string): Promise<McpFavoriteRecord>;
    unfavoriteMcp(name: string): Promise<{
        removed: boolean;
    }>;
    saveMcpSet(input: {
        description?: string;
        name: string;
        projectId?: string;
        serverNames: string[];
    }): Promise<McpSetRecord>;
    assignMcpSet(projectId: string, setId: string): Promise<{
        createdAt: number;
        projectId: string;
        setId: string;
        updatedAt: number;
    }>;
    timelineRecent(): Promise<TimelineEvent[]>;
    removeWorker(id: string): Promise<{
        removed: boolean;
    }>;
    subscribe(listener: <K extends keyof DaemonEventMap>(event: {
        payload: DaemonEventMap[K];
        type: K;
    }) => void): () => void;
    private get;
    private post;
}
//# sourceMappingURL=index.d.ts.map