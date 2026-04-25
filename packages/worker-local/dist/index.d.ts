import { type AgentMode, type AgentTurnEvent, type MemoryStore, type ModelRuntimeManager, type ResponseMode, type SessionRecord, type SessionStore, type ToolRegistry } from "@chatgpt-code/runtime-core";
export interface LocalWorkerDependencies {
    memoryStore: MemoryStore;
    modelRuntime: ModelRuntimeManager;
    sessionStore: SessionStore;
    toolRegistry: ToolRegistry;
}
export interface LocalWorkerRunInput {
    mode: AgentMode;
    prompt: string;
    sessionId: string;
    style: ResponseMode;
}
export interface LocalWorkerRunResult {
    content: string;
    session: SessionRecord;
}
export interface LocalWorker {
    runPrompt(input: LocalWorkerRunInput, options?: {
        onEvent?: (event: AgentTurnEvent) => void | Promise<void>;
        onRetry?: (input: {
            attempt: number;
            delayMs: number;
            error: unknown;
        }) => void | Promise<void>;
        shouldContinue?: () => {
            ok: true;
        } | {
            ok: false;
            reason?: string;
            state: "cancelled" | "paused";
        };
    }): Promise<LocalWorkerRunResult>;
}
export declare function createLocalWorker(dependencies: LocalWorkerDependencies): LocalWorker;
//# sourceMappingURL=index.d.ts.map