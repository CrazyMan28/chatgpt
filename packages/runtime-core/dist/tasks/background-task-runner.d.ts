import type { ModelRuntimeManager } from "../providers/model-runtime.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRecord, SessionStore } from "../storage/session-store.js";
import type { BackgroundTaskRecord, TaskStore } from "../storage/task-store.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
export interface BackgroundTaskView extends BackgroundTaskRecord {
    isRunning: boolean;
}
export interface AutoModeView {
    intervalMinutes: number;
    isRunning: boolean;
    lastAction: string;
    lastError?: string;
    lastRunAt?: number;
    nextRunAt: number;
    runCount: number;
    sessionId: string;
    taskId: string;
}
export type BackgroundTaskEvent = {
    session?: SessionRecord;
    task: BackgroundTaskView;
    type: "task_updated";
} | {
    taskId: string;
    type: "task_removed";
};
export interface BackgroundTaskRunner {
    cancelTask(id: string): Promise<BackgroundTaskView | undefined>;
    close(): Promise<void>;
    enableAutoMode(input: {
        intervalMinutes: number;
        sessionId: string;
    }): Promise<AutoModeView>;
    getAutoMode(): AutoModeView | undefined;
    getTask(id: string): BackgroundTaskView | undefined;
    listTasks(): readonly BackgroundTaskView[];
    pauseTask(id: string): Promise<BackgroundTaskView | undefined>;
    retryTask(id: string): Promise<BackgroundTaskView | undefined>;
    resumeTask(id: string): Promise<BackgroundTaskView | undefined>;
    runTaskNow(id: string): Promise<BackgroundTaskView | undefined>;
    saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskView>;
    scheduleTask(input: {
        intervalMinutes: number;
        prompt: string;
        sessionId: string;
    }): Promise<BackgroundTaskView>;
    stopAutoMode(): Promise<boolean>;
    stopTask(id: string): Promise<BackgroundTaskView | undefined>;
    subscribe(listener: (event: BackgroundTaskEvent) => void): () => void;
}
export interface CreateBackgroundTaskRunnerOptions {
    memoryStore: MemoryStore;
    modelRuntime: ModelRuntimeManager;
    sessionStore: SessionStore;
    taskStore: TaskStore;
    toolRegistry?: ToolRegistry;
    workspaceRoot?: string;
}
export declare function createBackgroundTaskRunner({ memoryStore, modelRuntime, sessionStore, taskStore, toolRegistry, workspaceRoot }: CreateBackgroundTaskRunnerOptions): Promise<BackgroundTaskRunner>;
//# sourceMappingURL=background-task-runner.d.ts.map