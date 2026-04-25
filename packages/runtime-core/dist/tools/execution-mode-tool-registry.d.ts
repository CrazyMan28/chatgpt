import type { ExecutionMode } from "../modes/execution-mode.js";
import type { RegisteredTool, ToolRegistry } from "./tool-registry.js";
export declare function createExecutionModeToolRegistry(toolRegistry: ToolRegistry, mode: ExecutionMode): ToolRegistry;
export declare function filterToolsForExecutionMode(tools: readonly RegisteredTool[], mode: ExecutionMode): RegisteredTool[];
//# sourceMappingURL=execution-mode-tool-registry.d.ts.map