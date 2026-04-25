import type { ModelToolCall } from "../models/model-client.js";
import type { SessionRecord } from "../storage/session-store.js";
import type { AutoModeState, BackgroundTaskRecord } from "../storage/task-store.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
export declare const AUTO_MODE_PROMPT_PLACEHOLDER = "Autonomous project improvement mode";
export declare const AUTO_MODE_MAX_AGENT_STEPS = 100;
export declare const AUTO_MODE_MAX_TOOL_ACTIONS = 100;
export declare function createEmptyAutoModeState(): AutoModeState;
export declare function buildAutoModeCyclePrompt(input: {
    session: SessionRecord;
    task: BackgroundTaskRecord;
}): string;
export declare function createAutoModeToolRegistry(toolRegistry: ToolRegistry | undefined, options?: {
    maxActions?: number;
}): ToolRegistry | undefined;
export declare function collectChangedFilesFromToolCall(toolCall: ModelToolCall): string[];
export declare function updateAutoModeState(currentState: AutoModeState | undefined, input: {
    assistantContent: string;
    changedFiles: readonly string[];
    cycleNumber: number;
    timestamp: number;
}): AutoModeState;
export declare function appendAutoModeLog(input: {
    changedFiles: readonly string[];
    cycleNumber: number;
    error?: string;
    intervalMinutes: number;
    sessionId: string;
    summary: string;
    taskId: string;
    timestamp: number;
    workspaceRoot?: string;
}): Promise<void>;
//# sourceMappingURL=auto-mode.d.ts.map