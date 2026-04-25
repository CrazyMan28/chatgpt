import { NORMAL_MODE_ALLOWED_TOOL_NAMES, PLAN_MODE_ALLOWED_TOOL_NAMES } from "../modes/execution-mode.js";
const PLAN_MODE_ALLOWED_TOOL_SET = new Set(PLAN_MODE_ALLOWED_TOOL_NAMES);
const NORMAL_MODE_ALLOWED_TOOL_SET = new Set(NORMAL_MODE_ALLOWED_TOOL_NAMES);
export function createExecutionModeToolRegistry(toolRegistry, mode) {
    if (mode === "build") {
        return toolRegistry;
    }
    const allowedToolSet = mode === "plan" ? PLAN_MODE_ALLOWED_TOOL_SET : NORMAL_MODE_ALLOWED_TOOL_SET;
    const allowedToolNames = mode === "plan" ? PLAN_MODE_ALLOWED_TOOL_NAMES : NORMAL_MODE_ALLOWED_TOOL_NAMES;
    return {
        listTools() {
            return filterToolsForExecutionMode(toolRegistry.listTools(), mode);
        },
        listModelTools() {
            return toolRegistry
                .listModelTools()
                .filter((tool) => allowedToolSet.has(tool.name));
        },
        async executeTool(name, input) {
            if (!allowedToolSet.has(name)) {
                return {
                    content: [
                        `Tool "${name}" is unavailable in ${mode.toUpperCase()} mode.`,
                        `Allowed tools: ${allowedToolNames.join(", ")}.`,
                        mode === "plan"
                            ? "PLAN mode is read-only. Use /build or /mode build to execute changes."
                            : "Switch modes only if you want broader execution permissions."
                    ].join("\n"),
                    isError: true
                };
            }
            return toolRegistry.executeTool(name, input);
        }
    };
}
export function filterToolsForExecutionMode(tools, mode) {
    if (mode === "build") {
        return [...tools];
    }
    const allowedToolSet = mode === "plan" ? PLAN_MODE_ALLOWED_TOOL_SET : NORMAL_MODE_ALLOWED_TOOL_SET;
    return tools.filter((tool) => allowedToolSet.has(tool.name));
}
//# sourceMappingURL=execution-mode-tool-registry.js.map