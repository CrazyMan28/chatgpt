export const DEFAULT_EXECUTION_MODE = "build";
export const PLAN_MODE_ALLOWED_TOOL_NAMES = ["list_files", "read_file"];
export function formatExecutionModeLabel(mode) {
    return mode === "plan" ? "PLAN" : "BUILD";
}
export function buildExecutionModeContextMessage(mode) {
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
