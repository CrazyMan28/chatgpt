import type { BackgroundTaskKind, BackgroundTaskRecord, BackgroundTaskState, TaskStore, TaskValidationStatus } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteTaskStore implements TaskStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    createTask(input: {
        approvalRequestIds?: string[];
        assignedAgentId?: string;
        autoState?: BackgroundTaskRecord["autoState"];
        blockedReason?: string;
        currentStep?: string;
        goalId?: string;
        intervalMinutes: number;
        kind?: BackgroundTaskKind;
        metadata?: Record<string, unknown>;
        prompt: string;
        requestedAction?: BackgroundTaskRecord["requestedAction"];
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
//# sourceMappingURL=task-store.d.ts.map