import { PLAN_MODE_ALLOWED_TOOL_NAMES } from "../modes/execution-mode.js";
const PLAN_MODE_ALLOWED_TOOL_SET = new Set(PLAN_MODE_ALLOWED_TOOL_NAMES);
export function createExecutionModeToolRegistry(toolRegistry, mode) {
    if (mode === "build") {
        return toolRegistry;
    }
    return {
        listTools() {
            return filterToolsForExecutionMode(toolRegistry.listTools(), mode);
        },
        listModelTools() {
            return toolRegistry
                .listModelTools()
                .filter((tool) => PLAN_MODE_ALLOWED_TOOL_SET.has(tool.name));
        },
        async executeTool(name, input) {
            if (!PLAN_MODE_ALLOWED_TOOL_SET.has(name)) {
                return {
                    content: [
                        `Tool "${name}" is unavailable in PLAN mode.`,
                        `Allowed tools: ${PLAN_MODE_ALLOWED_TOOL_NAMES.join(", ")}.`
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
    return tools.filter((tool) => PLAN_MODE_ALLOWED_TOOL_SET.has(tool.name));
}
