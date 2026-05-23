import { execFile } from "node:child_process";
import { createModelResponse } from "./model-client.js";
const COPILOT_COMMAND = "copilot";
const COPILOT_CHAT_TIMEOUT_MS = 180_000;
const DISABLED_COPILOT_TOOLS = [
    "apply_patch",
    "ask_user",
    "bash",
    "create",
    "edit",
    "glob",
    "grep",
    "list_agents",
    "list_bash",
    "read_agent",
    "read_bash",
    "skill",
    "stop_bash",
    "task",
    "view",
    "web_fetch",
    "write_bash"
];
export class CopilotCliModelClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async generate(request) {
        if (this.config.authMode === "unavailable") {
            throw new Error("Copilot provider unavailable: missing SDK/CLI support. Install GitHub Copilot CLI and run `copilot login`, then retry /login.");
        }
        const prompt = buildCopilotPrompt(request);
        try {
            const result = await execCopilot(buildCopilotArgs(this.config, prompt));
            const content = normalizeCopilotStdout(result.stdout);
            if (content.length === 0) {
                throw new Error("Copilot CLI returned an empty response.");
            }
            return createModelResponse(content, []);
        }
        catch (error) {
            throw normalizeCopilotError(error);
        }
    }
}
function buildCopilotArgs(config, prompt) {
    return [
        "-p",
        prompt,
        "--model",
        config.model,
        "--silent",
        "--stream=off",
        "--disable-builtin-mcps",
        "--no-custom-instructions",
        "--no-ask-user",
        `--excluded-tools=${DISABLED_COPILOT_TOOLS.join(",")}`
    ];
}
function buildCopilotPrompt(request) {
    const sections = [
        "You are being used as a model provider inside another agentic TUI.",
        "Return only the assistant response text.",
        "Do not execute tools, request tool approvals, edit files, run shell commands, or rely on GitHub Copilot CLI tools.",
        request.tools.length > 0
            ? "The host runtime owns tool calls. Native Copilot tool calls are unavailable in this integration, so explain plans in text when tool use would be needed."
            : undefined,
        "",
        "Conversation:",
        ...request.messages.map(formatCopilotMessage)
    ].filter((part) => part !== undefined);
    return sections.join("\n");
}
function formatCopilotMessage(message) {
    switch (message.role) {
        case "system":
            return `System:\n${message.content}`;
        case "user":
            return `User:\n${message.content}`;
        case "assistant":
            return `Assistant:\n${message.content}${message.toolCalls && message.toolCalls.length > 0
                ? `\nAssistant tool calls:\n${JSON.stringify(message.toolCalls)}`
                : ""}`;
        case "tool":
            return `Tool result (${message.toolName}, ${message.isError ? "error" : "ok"}):\n${message.content}`;
        default:
            return assertNever(message);
    }
}
function execCopilot(args) {
    return new Promise((resolve, reject) => {
        execFile(COPILOT_COMMAND, [...args], {
            env: process.env,
            maxBuffer: 8 * 1024 * 1024,
            timeout: COPILOT_CHAT_TIMEOUT_MS,
            windowsHide: true
        }, (error, stdout, stderr) => {
            if (error) {
                reject(Object.assign(error, {
                    stderr,
                    stdout
                }));
                return;
            }
            resolve({
                stdout,
                stderr
            });
        });
    });
}
function normalizeCopilotStdout(stdout) {
    return stdout
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => !/^\s*$/.test(line) || stdout.includes("\n\n"))
        .join("\n")
        .trim();
}
function normalizeCopilotError(error) {
    const message = readErrorMessage(error);
    const stderr = readProcessText(error, "stderr");
    const stdout = readProcessText(error, "stdout");
    const detail = [stderr, stdout, message]
        .map((part) => part.trim())
        .filter((part, index, parts) => part.length > 0 && parts.indexOf(part) === index)
        .join(" ");
    const normalized = detail.toLowerCase();
    if (/enoent|not found|command not found/.test(normalized)) {
        return new Error("Copilot CLI is not installed or not logged in. Install/login first, then retry /login.");
    }
    if (/no authentication|not logged in|unauthenticated|authentication/.test(normalized)) {
        return new Error("Copilot is not logged in. Run `copilot login` or set COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN, then retry.");
    }
    if (/subscription|not authorized|forbidden|copilot access|copilot plan/.test(normalized)) {
        return new Error("Copilot request was rejected because this account does not have an active Copilot subscription or the organization policy blocks access.");
    }
    if (/quota|rate limit|too many requests|premium request/.test(normalized)) {
        return new Error("Copilot quota or rate limit was reached. Check your Copilot usage and try again later.");
    }
    if (/model|not available|unavailable|unsupported/.test(normalized)) {
        return new Error("Copilot model unavailable for this account or CLI version. Choose another model with /model <name>.");
    }
    if (/network|econnrefused|enotfound|fetch failed|timeout|timed out/.test(normalized)) {
        return new Error("Copilot network request failed. Check connectivity and try again.");
    }
    return new Error(`Copilot request failed: ${detail || "unknown error"}`);
}
function readProcessText(error, key) {
    if (typeof error !== "object" || error === null || !(key in error)) {
        return "";
    }
    const value = error[key];
    return typeof value === "string" ? value : "";
}
function readErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function assertNever(value) {
    throw new Error(`Unsupported model message: ${JSON.stringify(value)}`);
}
//# sourceMappingURL=copilot-client.js.map