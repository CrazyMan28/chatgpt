export const DEFAULT_EXECUTION_MODE = "normal";
export const PLAN_MODE_ALLOWED_TOOL_NAMES = ["list_files", "read_file"];
export const NORMAL_MODE_ALLOWED_TOOL_NAMES = [
    "list_files",
    "read_file",
    "run_command",
    "write_file"
];
export function formatExecutionModeLabel(mode) {
    switch (mode) {
        case "normal":
            return "NORMAL";
        case "plan":
            return "PLAN";
        case "build":
            return "BUILD";
        default:
            return mode;
    }
}
export function buildExecutionModeContextMessage(mode) {
    if (mode === "normal") {
        return {
            role: "system",
            content: [
                "Execution mode: NORMAL.",
                "You are in guided chat mode with useful default tooling.",
                `Use only safe tools automatically: ${NORMAL_MODE_ALLOWED_TOOL_NAMES.join(", ")}.`,
                "Keep changes scoped and avoid broad rewrites unless the user explicitly switches to BUILD mode."
            ].join("\n")
        };
    }
    if (mode === "plan") {
        return {
            role: "system",
            content: [
                "Execution mode: PLAN.",
                "You are in read-only planning mode.",
                `Only use these tools when needed: ${PLAN_MODE_ALLOWED_TOOL_NAMES.join(", ")}.`,
                "Do not write files, do not run commands, and do not attempt to change the project.",
                "Inspect the repository, identify the next meaningful improvements, and produce an actionable plan."
            ].join("\n")
        };
    }
    return {
        role: "system",
        content: [
            "Execution mode: BUILD.",
            "You may use the available tools to implement changes.",
            "Work step by step, keep changes scoped to the current task, and summarize results clearly."
        ].join("\n")
    };
}
//# sourceMappingURL=execution-mode.js.map