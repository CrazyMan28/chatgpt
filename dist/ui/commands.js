import { formatResponseModeLabel, isResponseMode } from "../modes/response-mode.js";
const COMMAND_REFERENCE = [
    {
        command: "/help",
        usage: "/help",
        description: "Show the available commands."
    },
    {
        command: "/login",
        usage: "/login",
        description: "Start the provider login flow."
    },
    {
        command: "/models",
        usage: "/models",
        description: "List models for the active provider."
    },
    {
        command: "/model",
        usage: "/model <name>",
        description: "Switch the active model."
    },
    {
        command: "/mcp",
        usage: "/mcp add|list|enable <name>|disable <name>|remove <name>|edit <name>|marketplace|install <name>|info <name>",
        description: "Manage MCP servers and reload tools without restarting."
    },
    {
        command: "/plan",
        usage: "/plan",
        description: "Switch to read-only PLAN mode and generate plan.md."
    },
    {
        command: "/build",
        usage: "/build",
        description: "Review and execute plan.md after confirmation."
    },
    {
        command: "/auto",
        usage: "/auto <minutes>|stop",
        description: "Enable or stop autonomous improvement mode."
    },
    {
        command: "/new",
        usage: "/new",
        description: "Start a fresh session."
    },
    {
        command: "/list",
        usage: "/list",
        description: "List saved sessions."
    },
    {
        command: "/open",
        usage: "/open <id>",
        description: "Resume a saved session."
    },
    {
        command: "/mode",
        usage: "/mode <normal|plan|ultra>",
        description: "Change response style."
    },
    {
        command: "/tasks",
        usage: "/tasks",
        description: "List scheduled background tasks."
    },
    {
        command: "/schedule",
        usage: "/schedule <minutes> <prompt>",
        description: "Create a scheduled background task."
    }
];
export function parseAppCommand(input) {
    const normalized = input.trim();
    if (!normalized.startsWith("/")) {
        return undefined;
    }
    if (normalized === "/help") {
        return { type: "help" };
    }
    if (normalized === "/login") {
        return { type: "login" };
    }
    if (normalized === "/models") {
        return { type: "models" };
    }
    if (normalized === "/new") {
        return { type: "new" };
    }
    if (normalized === "/plan") {
        return { type: "plan" };
    }
    if (normalized === "/build") {
        return { type: "build" };
    }
    if (normalized === "/list") {
        return { type: "list" };
    }
    if (normalized === "/tasks") {
        return { type: "tasks" };
    }
    if (normalized.startsWith("/mcp")) {
        return parseMcpCommand(normalized);
    }
    if (normalized.startsWith("/auto")) {
        return parseAutoCommand(normalized);
    }
    if (normalized.startsWith("/model")) {
        return parseModelCommand(normalized);
    }
    if (normalized.startsWith("/mode")) {
        return parseModeCommand(normalized);
    }
    if (normalized.startsWith("/open")) {
        const [, ...rest] = normalized.split(/\s+/);
        const id = rest.join(" ").trim();
        if (id.length === 0) {
            return {
                type: "invalid",
                message: "Usage: /open <id>"
            };
        }
        return {
            id,
            type: "open"
        };
    }
    if (normalized.startsWith("/schedule")) {
        return parseScheduleCommand(normalized);
    }
    return buildUnknownCommand(normalized);
}
export function formatSessionList(sessions, currentSessionId) {
    if (sessions.length === 0) {
        return "No saved sessions yet.";
    }
    const lines = ["Saved sessions"];
    for (const session of sessions) {
        const marker = session.id === currentSessionId ? "*" : " ";
        const updatedAt = formatTimestamp(session.updatedAt);
        const turns = session.turnCount === 1 ? "1 turn" : `${session.turnCount} turns`;
        lines.push(`${marker} ${session.id}  ${updatedAt}  ${turns}  ${session.title}`);
    }
    lines.push("");
    lines.push("Use /open <id> to resume a session.");
    return lines.join("\n");
}
export function formatTaskList(tasks, currentSessionId) {
    if (tasks.length === 0) {
        return "No scheduled background tasks yet.";
    }
    const lines = ["Background tasks"];
    for (const task of tasks) {
        const marker = task.sessionId === currentSessionId ? "*" : " ";
        const taskLabel = task.kind === "auto" ? "[auto]" : "[task]";
        const state = task.isRunning
            ? "running"
            : task.lastError
                ? "error"
                : "idle";
        const interval = formatInterval(task.intervalMinutes);
        const nextRun = formatTimestamp(task.nextRunAt);
        const lastRun = task.lastRunAt ? formatTimestamp(task.lastRunAt) : "never";
        const summary = task.lastError ??
            task.autoState?.lastAction ??
            task.lastResultSummary ??
            task.prompt;
        lines.push(`${marker} ${taskLabel} ${task.id}  every ${interval}  next ${nextRun}  last ${lastRun}  ${state}  ${summary}`);
    }
    lines.push("");
    lines.push("Use /schedule <minutes> <prompt> for manual tasks or /auto <minutes> for autonomous mode.");
    return lines.join("\n");
}
export function formatModeMessage(mode) {
    return `Response mode set to ${formatResponseModeLabel(mode)}.`;
}
export function formatHelpMessage() {
    const lines = ["Commands"];
    for (const command of COMMAND_REFERENCE) {
        lines.push(`${command.usage}  ${command.description}`);
    }
    return lines.join("\n");
}
export function formatModelList(models, snapshot) {
    if (models.length === 0) {
        return `No models are available for ${snapshot.providerLabel}.`;
    }
    const lines = [`${snapshot.providerLabel} models`];
    for (const model of models) {
        const marker = model.id === snapshot.model ? "*" : " ";
        lines.push(`${marker} ${model.id}  ${model.label}`);
    }
    lines.push("");
    lines.push("Use /model <name> to switch models.");
    return lines.join("\n");
}
function parseModeCommand(input) {
    const [, rawMode] = input.split(/\s+/, 2);
    const normalizedMode = rawMode?.trim().toLowerCase();
    if (!normalizedMode || !isResponseMode(normalizedMode)) {
        return {
            type: "invalid",
            message: "Usage: /mode <normal|plan|ultra>"
        };
    }
    return {
        mode: normalizedMode,
        type: "mode"
    };
}
function parseMcpCommand(input) {
    const [, subcommand = "", ...rest] = input.split(/\s+/);
    const normalizedSubcommand = subcommand.trim().toLowerCase();
    const name = rest.join(" ").trim();
    switch (normalizedSubcommand) {
        case "add":
            return { type: "mcp_add" };
        case "list":
            return { type: "mcp_list" };
        case "marketplace":
            return { type: "mcp_marketplace" };
        case "install":
            return name.length > 0
                ? { name, type: "mcp_install" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp install <name>"
                };
        case "info":
            return name.length > 0
                ? { name, type: "mcp_info" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp info <name>"
                };
        case "enable":
            return name.length > 0
                ? { name, type: "mcp_enable" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp enable <name>"
                };
        case "disable":
            return name.length > 0
                ? { name, type: "mcp_disable" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp disable <name>"
                };
        case "remove":
            return name.length > 0
                ? { name, type: "mcp_remove" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp remove <name>"
                };
        case "edit":
            return name.length > 0
                ? { name, type: "mcp_edit" }
                : {
                    type: "invalid",
                    message: "Usage: /mcp edit <name>"
                };
        default:
            return {
                type: "invalid",
                message: "Usage: /mcp add | /mcp list | /mcp marketplace | /mcp info <name> | /mcp install <name> | /mcp enable <name> | /mcp disable <name> | /mcp remove <name> | /mcp edit <name>"
            };
    }
}
function parseModelCommand(input) {
    if (input === "/models") {
        return { type: "models" };
    }
    const [, ...rest] = input.split(/\s+/);
    const model = rest.join(" ").trim();
    if (model.length === 0) {
        return {
            type: "invalid",
            message: "Usage: /model <name>"
        };
    }
    return {
        model,
        type: "model"
    };
}
function parseScheduleCommand(input) {
    const trimmed = input.replace(/^\/schedule\s+/i, "").trim();
    const normalized = trimmed.startsWith("every ")
        ? trimmed.replace(/^every\s+/i, "")
        : trimmed;
    const [intervalToken, ...promptParts] = normalized.split(/\s+/);
    const intervalMinutes = Number(intervalToken);
    const prompt = promptParts.join(" ").trim();
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        return {
            type: "invalid",
            message: "Usage: /schedule <minutes> <prompt>"
        };
    }
    if (prompt.length === 0) {
        return {
            type: "invalid",
            message: "Usage: /schedule <minutes> <prompt>"
        };
    }
    return {
        intervalMinutes,
        prompt,
        type: "schedule"
    };
}
function parseAutoCommand(input) {
    const trimmed = input.replace(/^\/auto\s*/i, "").trim();
    if (trimmed.length === 0) {
        return {
            type: "invalid",
            message: "Usage: /auto <minutes> or /auto stop"
        };
    }
    if (trimmed.toLowerCase() === "stop") {
        return {
            type: "auto_stop"
        };
    }
    const intervalMinutes = Number(trimmed);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        return {
            type: "invalid",
            message: "Usage: /auto <minutes> or /auto stop"
        };
    }
    return {
        intervalMinutes,
        type: "auto"
    };
}
function formatInterval(value) {
    if (Number.isInteger(value)) {
        return `${value}m`;
    }
    return `${value}m`;
}
function formatTimestamp(value) {
    return new Date(value).toLocaleString([], {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}
function buildUnknownCommand(input) {
    const rawCommand = input.split(/\s+/, 1)[0] ?? input;
    const suggestions = suggestCommands(rawCommand);
    const suggestionText = suggestions.length > 0
        ? ` Did you mean ${formatCommandSuggestions(suggestions)}?`
        : "";
    return {
        type: "invalid",
        message: `Unknown command "${rawCommand}".${suggestionText} Use /help to see all commands.`
    };
}
function suggestCommands(command) {
    return COMMAND_REFERENCE.map((entry) => entry.command)
        .map((candidate) => ({
        candidate,
        distance: levenshteinDistance(command, candidate)
    }))
        .filter(({ candidate, distance }) => {
        if (candidate.startsWith(command) || command.startsWith(candidate)) {
            return true;
        }
        return distance <= 3;
    })
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 3)
        .map(({ candidate }) => candidate);
}
function formatCommandSuggestions(suggestions) {
    if (suggestions.length === 1) {
        return suggestions[0];
    }
    if (suggestions.length === 2) {
        return `${suggestions[0]} or ${suggestions[1]}`;
    }
    return `${suggestions[0]}, ${suggestions[1]}, or ${suggestions[2]}`;
}
function levenshteinDistance(left, right) {
    if (left === right) {
        return 0;
    }
    const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
    for (let row = 0; row <= left.length; row += 1) {
        matrix[row][0] = row;
    }
    for (let column = 0; column <= right.length; column += 1) {
        matrix[0][column] = column;
    }
    for (let row = 1; row <= left.length; row += 1) {
        for (let column = 1; column <= right.length; column += 1) {
            const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
            matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + substitutionCost);
        }
    }
    return matrix[left.length][right.length];
}
