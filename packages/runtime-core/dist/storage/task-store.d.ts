export type BackgroundTaskKind = "scheduled" | "auto" | "interactive";
export type BackgroundTaskState = "queued" | "planning" | "waiting_approval" | "running" | "validating" | "paused" | "blocked" | "rate_limited" | "complete" | "failed" | "cancelled";
export type TaskValidationStatus = "idle" | "running" | "passed" | "failed";
export type TaskRequestedAction = "pause" | "resume" | "retry" | "stop" | "cancel";
export interface AutoModeActionRecord {
    changedFiles: string[];
    cycleNumber: number;
    summary: string;
    timestamp: number;
}
export interface AutoModeState {
    completedTasks: string[];
    lastAction?: string;
    previousActions: AutoModeActionRecord[];
}
export interface BackgroundTaskRecord {
    approvalRequestIds: string[];
    assignedAgentId?: string;
    autoState?: AutoModeState;
    blockedReason?: string;
    createdAt: number;
    currentStep?: string;
    goalId?: string;
    id: string;
    intervalMinutes: number;
    kind: BackgroundTaskKind;
    lastError?: string;
    lastEventAt?: number;
    lastResultSummary?: string;
    lastRunAt?: number;
    metadata?: Record<string, unknown>;
    nextRunAt: number;
    prompt: string;
    requestedAction?: TaskRequestedAction;
    resumePrompt?: string;
    retries: number;
    runCount: number;
    sessionId: string;
    state: BackgroundTaskState;
    title: string;
    transcriptPrompt?: string;
    updatedAt: number;
    validationStatus: TaskValidationStatus;
    watcherIds: string[];
}
export interface TaskStore {
    createTask(input: {
        approvalRequestIds?: string[];
        assignedAgentId?: string;
        autoState?: AutoModeState;
        blockedReason?: string;
        currentStep?: string;
        goalId?: string;
        intervalMinutes: number;
        kind?: BackgroundTaskKind;
        metadata?: Record<string, unknown>;
        prompt: string;
        requestedAction?: TaskRequestedAction;
        resumePrompt?: string;
        sessionId: string;
        state?: BackgroundTaskState;
        title?: string;
        transcriptPrompt?: string;
        validationStatus?: TaskValidationStatus;
        watcherIds?: string[];
    }): Promise<BackgroundTaskRecord>;
    deleteTask(id: string): Promise<boolean>;
    listTasks(): Promise<BackgroundTaskRecord[]>;
    loadTask(id: string): Promise<BackgroundTaskRecord | undefined>;
    saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskRecord>;
}
export declare class JsonTaskStore implements TaskStore {
    private readonly filePath;
    constructor(workspaceRoot?: string);
    createTask(input: {
        approvalRequestIds?: string[];
        assignedAgentId?: string;
        autoState?: AutoModeState;
        blockedReason?: string;
        currentStep?: string;
        goalId?: string;
        intervalMinutes: number;
        kind?: BackgroundTaskKind;
        metadata?: Record<string, unknown>;
        prompt: string;
        requestedAction?: TaskRequestedAction;
        resumePrompt?: string;
        sessionId: string;
        state?: BackgroundTaskState;
        title?: string;
        transcriptPrompt?: string;
        validationStatus?: TaskValidationStatus;
        watcherIds?: string[];
    }): Promise<BackgroundTaskRecord>;
    deleteTask(id: string): Promise<boolean>;
    listTasks(): Promise<BackgroundTaskRecord[]>;
    loadTask(id: string): Promise<BackgroundTaskRecord | undefined>;
    saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskRecord>;
    private readSnapshot;
    private writeSnapshot;
}
//# sourceMappingURL=task-store.d.ts.map