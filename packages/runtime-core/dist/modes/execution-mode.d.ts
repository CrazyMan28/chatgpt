import type { ModelMessage } from "../models/model-client.js";
import type { AgentMode } from "../platform/types.js";
export type ExecutionMode = AgentMode;
export declare const DEFAULT_EXECUTION_MODE: ExecutionMode;
export declare const PLAN_MODE_ALLOWED_TOOL_NAMES: readonly ["list_files", "read_file"];
export declare const NORMAL_MODE_ALLOWED_TOOL_NAMES: readonly ["list_files", "read_file", "run_command", "write_file"];
export declare function formatExecutionModeLabel(mode: ExecutionMode): string;
export declare function buildExecutionModeContextMessage(mode: ExecutionMode): Extract<ModelMessage, {
    role: "system";
}>;
//# sourceMappingURL=execution-mode.d.ts.map