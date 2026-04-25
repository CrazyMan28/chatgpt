import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { resolveWorkspacePath } from "./workspace-safety.js";
const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const MAX_COMMAND_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_CHARS = 16_000;
const MAX_READ_BYTES = 64_000;
const DEFAULT_LIST_FILES_MAX_DEPTH = 4;
const MAX_LIST_FILES_MAX_DEPTH = 8;
const DEFAULT_LIST_FILES_MAX_ENTRIES = 400;
const MAX_LIST_FILES_MAX_ENTRIES = 1_000;
const FORBIDDEN_COMMANDS = new Set([
    "dd",
    "fdisk",
    "halt",
    "mkfs",
    "mount",
    "parted",
    "passwd",
    "poweroff",
    "reboot",
    "shutdown",
    "su",
    "sudo",
    "umount"
]);
export function createCoreToolRegistrations({ workspaceRoot }) {
    return [
        {
            tool: {
                id: "core::run_command",
                name: "run_command",
                owner: "core",
                source: "core",
                originalName: "run_command",
                description: "Run a non-interactive command inside the workspace and capture stdout, stderr, and exit status.",
                inputSchema: runCommandSchema
            },
            execute: async (input) => runCommandTool(workspaceRoot, input)
        },
        {
            tool: {
                id: "core::list_files",
                name: "list_files",
                owner: "core",
                source: "core",
                originalName: "list_files",
                description: "List files and directories inside the workspace with optional path and depth controls.",
                inputSchema: listFilesSchema
            },
            execute: async (input) => listFilesTool(workspaceRoot, input)
        },
        {
            tool: {
                id: "core::read_file",
                name: "read_file",
                owner: "core",
                source: "core",
                originalName: "read_file",
                description: "Read a UTF-8 text file inside the workspace and return its contents.",
                inputSchema: readFileSchema
            },
            execute: async (input) => readFileTool(workspaceRoot, input)
        },
        {
            tool: {
                id: "core::write_file",
                name: "write_file",
                owner: "core",
                source: "core",
                originalName: "write_file",
                description: "Write UTF-8 text to a file inside the workspace, creating parent directories when needed.",
                inputSchema: writeFileSchema
            },
            execute: async (input) => writeFileTool(workspaceRoot, input)
        }
    ];
}
const runCommandSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        command: {
            type: "string",
            description: "Executable to run, such as `git` or `npm`."
        },
        args: {
            type: "array",
            description: "Optional command arguments.",
            items: {
                type: "string"
            }
        },
        cwd: {
            type: "string",
            description: "Optional working directory relative to the workspace root."
        },
        timeoutMs: {
            type: "number",
            description: "Optional timeout in milliseconds, capped at 20000."
        }
    },
    required: ["command"]
};
const readFileSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        path: {
            type: "string",
            description: "Path to a UTF-8 text file relative to the workspace root."
        }
    },
    required: ["path"]
};
const listFilesSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        path: {
            type: "string",
            description: "Optional directory path relative to the workspace root. Defaults to the workspace root."
        },
        maxDepth: {
            type: "number",
            description: "Optional recursion depth, capped at 8."
        },
        maxEntries: {
            type: "number",
            description: "Optional maximum number of listed entries, capped at 1000."
        }
    }
};
const writeFileSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        path: {
            type: "string",
            description: "Path to a UTF-8 text file relative to the workspace root."
        },
        content: {
            type: "string",
            description: "Full file contents to write."
        }
    },
    required: ["path", "content"]
};
async function runCommandTool(workspaceRoot, input) {
    try {
        const command = readString(input.command, "command");
        const args = readStringArray(input.args, "args");
        const cwd = input.cwd
            ? resolveWorkspacePath(workspaceRoot, readString(input.cwd, "cwd"))
            : workspaceRoot;
        const timeoutMs = clampTimeout(input.timeoutMs);
        if (FORBIDDEN_COMMANDS.has(command)) {
            return {
                content: `Command "${command}" is blocked by the safety policy.`,
                isError: true
            };
        }
        return executeCommand({
            workspaceRoot,
            command,
            args,
            cwd,
            timeoutMs
        });
    }
    catch (error) {
        return {
            content: error instanceof Error
                ? error.message
                : "Invalid run_command arguments.",
            isError: true
        };
    }
}
async function readFileTool(workspaceRoot, input) {
    try {
        const path = readString(input.path, "path");
        const targetPath = resolveWorkspacePath(workspaceRoot, path);
        const rawContent = await readFile(targetPath, "utf8");
        const content = rawContent.length > MAX_READ_BYTES
            ? `${rawContent.slice(0, MAX_READ_BYTES)}\n... [truncated]`
            : rawContent;
        return {
            content: `Path: ${relative(workspaceRoot, targetPath) || "."}\n${content}`,
            isError: false
        };
    }
    catch (error) {
        return {
            content: error instanceof Error ? error.message : "Failed to read the requested file.",
            isError: true
        };
    }
}
async function listFilesTool(workspaceRoot, input) {
    try {
        const relativePath = typeof input.path === "string" && input.path.trim().length > 0
            ? readString(input.path, "path")
            : ".";
        const maxDepth = clampNumber(input.maxDepth, DEFAULT_LIST_FILES_MAX_DEPTH, 0, MAX_LIST_FILES_MAX_DEPTH, "maxDepth");
        const maxEntries = clampNumber(input.maxEntries, DEFAULT_LIST_FILES_MAX_ENTRIES, 1, MAX_LIST_FILES_MAX_ENTRIES, "maxEntries");
        const targetPath = resolveWorkspacePath(workspaceRoot, relativePath);
        const targetStats = await stat(targetPath);
        if (!targetStats.isDirectory()) {
            return {
                content: `Path: ${relative(workspaceRoot, targetPath) || "."}`,
                isError: false
            };
        }
        const lines = [];
        const walkState = {
            entries: 0,
            truncated: false
        };
        await walkDirectory({
            currentDepth: 0,
            currentPath: targetPath,
            lines,
            maxDepth,
            maxEntries,
            state: walkState,
            workspaceRoot
        });
        const body = lines.length > 0 ? lines.join("\n") : "(empty directory)";
        const suffix = walkState.truncated ? "\n... [truncated]" : "";
        return {
            content: `Path: ${relative(workspaceRoot, targetPath) || "."}\n${body}${suffix}`,
            isError: false
        };
    }
    catch (error) {
        return {
            content: error instanceof Error
                ? error.message
                : "Failed to list the requested directory.",
            isError: true
        };
    }
}
async function writeFileTool(workspaceRoot, input) {
    try {
        const path = readString(input.path, "path");
        const content = readString(input.content, "content");
        const targetPath = resolveWorkspacePath(workspaceRoot, path);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, "utf8");
        return {
            content: `Wrote ${content.length} characters to ${relative(workspaceRoot, targetPath) || "."}.`,
            isError: false
        };
    }
    catch (error) {
        return {
            content: error instanceof Error ? error.message : "Failed to write the requested file.",
            isError: true
        };
    }
}
async function executeCommand({ workspaceRoot, command, args, cwd, timeoutMs }) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd,
            env: process.env,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, timeoutMs);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout = appendOutput(stdout, chunk);
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr = appendOutput(stderr, chunk);
        });
        child.once("error", (error) => {
            clearTimeout(timer);
            resolve({
                content: `Command failed to start: ${error.message}`,
                isError: true
            });
        });
        child.once("close", (code, signal) => {
            clearTimeout(timer);
            const location = relative(workspaceRoot, cwd) || ".";
            const sections = [
                `Command: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`,
                `Cwd: ${location}`
            ];
            if (timedOut) {
                sections.push(`Status: timed out after ${timeoutMs}ms`);
            }
            else if (signal) {
                sections.push(`Status: terminated by signal ${signal}`);
            }
            else {
                sections.push(`Exit code: ${code ?? 0}`);
            }
            if (stdout.trim().length > 0) {
                sections.push(`stdout:\n${stdout.trimEnd()}`);
            }
            if (stderr.trim().length > 0) {
                sections.push(`stderr:\n${stderr.trimEnd()}`);
            }
            resolve({
                content: sections.join("\n\n"),
                isError: timedOut || code !== 0
            });
        });
    });
}
async function walkDirectory({ currentDepth, currentPath, lines, maxDepth, maxEntries, state, workspaceRoot }) {
    const dirents = await readdir(currentPath, {
        withFileTypes: true
    });
    dirents.sort((left, right) => {
        if (left.isDirectory() && !right.isDirectory()) {
            return -1;
        }
        if (!left.isDirectory() && right.isDirectory()) {
            return 1;
        }
        return left.name.localeCompare(right.name);
    });
    for (const dirent of dirents) {
        if (state.entries >= maxEntries) {
            state.truncated = true;
            return;
        }
        const entryPath = join(currentPath, dirent.name);
        const entryLabel = `${"  ".repeat(currentDepth)}${relative(workspaceRoot, entryPath) || "."}${dirent.isDirectory() ? "/" : ""}`;
        lines.push(entryLabel);
        state.entries += 1;
        if (dirent.isDirectory() &&
            !dirent.isSymbolicLink() &&
            currentDepth < maxDepth) {
            await walkDirectory({
                currentDepth: currentDepth + 1,
                currentPath: entryPath,
                lines,
                maxDepth,
                maxEntries,
                state,
                workspaceRoot
            });
        }
    }
}
function appendOutput(existing, chunk) {
    if (existing.length >= MAX_OUTPUT_CHARS) {
        return existing;
    }
    const combined = existing + chunk;
    if (combined.length <= MAX_OUTPUT_CHARS) {
        return combined;
    }
    return `${combined.slice(0, MAX_OUTPUT_CHARS)}\n... [truncated]`;
}
function clampNumber(value, defaultValue, minValue, maxValue, fieldName) {
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`"${fieldName}" must be a finite number.`);
    }
    return Math.max(minValue, Math.min(maxValue, Math.floor(value)));
}
function clampTimeout(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return DEFAULT_COMMAND_TIMEOUT_MS;
    }
    return Math.max(100, Math.min(MAX_COMMAND_TIMEOUT_MS, Math.floor(value)));
}
function readString(value, fieldName) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`"${fieldName}" must be a non-empty string.`);
    }
    return value;
}
function readStringArray(value, fieldName) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
        throw new Error(`"${fieldName}" must be an array of strings.`);
    }
    return value;
}
