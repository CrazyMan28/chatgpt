import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultExecutionContext } from "../platform/execution-context.js";
import { analyzeCommandPathAccess, classifyPathScope, classifyCommandSafety, classifyFileReadSafety, classifyFileWriteSafety, ensureLocalPathAllowed, formatPathForDisplay, PathAccessError, readScopeLabel, resolvePathFromContext } from "./workspace-safety.js";
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const MAX_COMMAND_TIMEOUT_MS = 300_000;
const MAX_COMMAND_TOTAL_RUNTIME_MS = 1_800_000;
const MAX_COMMAND_RETRIES = 3;
const COMMAND_MONITOR_INTERVAL_MS = 1_000;
const COMMAND_PROGRESS_EXTENSION_MS = 5_000;
const MAX_COMMAND_IDLE_TIMEOUT_MS = 30_000;
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
export function createCoreToolRegistrations(options) {
    return [
        {
            tool: {
                id: "core::run_command",
                name: "run_command",
                owner: "core",
                source: "core",
                originalName: "run_command",
                description: "Run a non-interactive command inside the currently granted scope and capture stdout, stderr, and exit status.",
                inputSchema: runCommandSchema
            },
            execute: async (input) => runCommandTool(options, input)
        },
        {
            tool: {
                id: "core::list_files",
                name: "list_files",
                owner: "core",
                source: "core",
                originalName: "list_files",
                description: "List files and directories inside the currently granted scope with optional path and depth controls.",
                inputSchema: listFilesSchema
            },
            execute: async (input) => listFilesTool(options, input)
        },
        {
            tool: {
                id: "core::read_file",
                name: "read_file",
                owner: "core",
                source: "core",
                originalName: "read_file",
                description: "Read a UTF-8 text file inside the currently granted scope and return its contents.",
                inputSchema: readFileSchema
            },
            execute: async (input) => readFileTool(options, input)
        },
        {
            tool: {
                id: "core::write_file",
                name: "write_file",
                owner: "core",
                source: "core",
                originalName: "write_file",
                description: "Write UTF-8 text to a file inside the currently granted scope, creating parent directories when needed.",
                inputSchema: writeFileSchema
            },
            execute: async (input) => writeFileTool(options, input)
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
            description: "Optional working directory relative to the current execution context."
        },
        timeoutMs: {
            type: "number",
            description: "Optional initial idle timeout in milliseconds, capped at 300000 and automatically extended while progress is detected."
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
            description: "Path to a UTF-8 text file relative to the current working directory."
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
            description: "Optional directory path relative to the current working directory. Defaults to the current working directory."
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
            description: "Path to a UTF-8 text file relative to the current working directory."
        },
        content: {
            type: "string",
            description: "Full file contents to write."
        }
    },
    required: ["path", "content"]
};
async function runCommandTool(options, input) {
    try {
        const context = readExecutionContext(options);
        const command = readString(input.command, "command");
        const args = readStringArray(input.args, "args");
        const timeoutMs = clampTimeout(input.timeoutMs);
        const cwdValue = typeof input.cwd === "string" && input.cwd.trim().length > 0
            ? readString(input.cwd, "cwd")
            : undefined;
        if (FORBIDDEN_COMMANDS.has(command)) {
            return {
                content: `Command "${command}" is blocked by the safety policy.`,
                isError: true
            };
        }
        if (context.scope === "remote-host") {
            const remoteDecision = await authorizeAction(options, {
                context,
                detail: `Run remote command "${command}" on host ${context.activeRemoteHostId ?? "unknown"}.`,
                kind: "remote",
                metadata: {
                    args,
                    command
                },
                resource: context.activeRemoteHostId,
                safetyLevel: classifyCommandSafety(command, args),
                summary: `Remote command "${command}" requires ${readScopeLabel(context.scope)} access.`
            });
            if (!remoteDecision.approved) {
                return remoteDecision.result;
            }
            if (!context.activeRemoteHostId || !options.remoteExecutor) {
                return {
                    content: "Remote-host scope is active, but no registered remote host executor is available.",
                    isError: true
                };
            }
            const watcher = await createWatcher(options, {
                scope: context.scope,
                summary: `Remote command ${command}`,
                target: context.activeRemoteHostId,
                type: "remote"
            });
            const result = await options.remoteExecutor.runCommand({
                args,
                command,
                cwd: cwdValue ?? context.cwd,
                hostId: context.activeRemoteHostId,
                timeoutMs
            });
            await finishWatcher(options, watcher?.id, result.isError ? "failed" : "completed");
            return withWatcherResult(result, watcher?.id);
        }
        const cwd = cwdValue
            ? resolvePathFromContext(context, cwdValue)
            : context.cwd;
        const commandPathAnalysis = analyzeCommandPathAccess(context, command, args, cwd);
        ensureLocalPathAllowed(context, cwd);
        for (const targetPath of commandPathAnalysis.targetPaths) {
            ensureLocalPathAllowed(context, targetPath);
        }
        const decision = await authorizeAction(options, {
            context,
            detail: commandPathAnalysis.primaryTargetPath
                ? `Run command "${command}" in ${cwd} targeting ${commandPathAnalysis.primaryTargetPath}.`
                : `Run command "${command}" in ${cwd}.`,
            kind: "tool",
            metadata: {
                args,
                command,
                cwd,
                targetPaths: commandPathAnalysis.targetPaths
            },
            resource: commandPathAnalysis.primaryTargetPath ?? cwd,
            safetyLevel: classifyCommandSafety(command, args, {
                context,
                cwd
            }),
            scope: commandPathAnalysis.resolvedScope,
            summary: `Command "${command}" requires ${readScopeLabel(commandPathAnalysis.resolvedScope)} access.`
        });
        if (!decision.approved) {
            return decision.result;
        }
        const watcher = await createWatcher(options, {
            scope: commandPathAnalysis.resolvedScope,
            summary: `Command ${command}`,
            target: commandPathAnalysis.primaryTargetPath ?? cwd,
            type: classifyCommandWatcherType(command, args)
        });
        const execution = await executeCommand({
            command,
            args,
            context,
            cwd,
            onWatcherActivity: (input) => {
                void noteWatcherActivity(options, watcher?.id, input);
            },
            timeoutMs
        });
        await finishWatcher(options, watcher?.id, execution.watcherStatus, {
            attemptCount: execution.attemptCount
        });
        return withWatcherResult(execution.result, watcher?.id);
    }
    catch (error) {
        return {
            content: formatToolError(error, "Invalid run_command arguments."),
            isError: true
        };
    }
}
async function readFileTool(options, input) {
    try {
        const context = readExecutionContext(options);
        const path = readString(input.path, "path");
        if (context.scope === "remote-host") {
            if (!context.activeRemoteHostId || !options.remoteExecutor) {
                return {
                    content: "Remote-host scope is active, but no registered remote host executor is available.",
                    isError: true
                };
            }
            const decision = await authorizeAction(options, {
                context,
                detail: `Read remote file "${path}" from host ${context.activeRemoteHostId}.`,
                kind: "remote",
                resource: path,
                safetyLevel: "safe",
                summary: `Read remote file "${path}".`
            });
            if (!decision.approved) {
                return decision.result;
            }
            return options.remoteExecutor.readFile({
                hostId: context.activeRemoteHostId,
                path
            });
        }
        const targetPath = resolvePathFromContext(context, path);
        ensureLocalPathAllowed(context, targetPath);
        const decision = await authorizeAction(options, {
            context,
            detail: `Read file "${targetPath}".`,
            kind: "tool",
            resource: targetPath,
            safetyLevel: classifyFileReadSafety(context, targetPath),
            scope: classifyPathScope(context, targetPath),
            summary: `Read file "${formatPathForDisplay(context, targetPath)}".`
        });
        if (!decision.approved) {
            return decision.result;
        }
        const rawContent = await readFile(targetPath, "utf8");
        const content = rawContent.length > MAX_READ_BYTES
            ? `${rawContent.slice(0, MAX_READ_BYTES)}\n... [truncated]`
            : rawContent;
        return {
            content: `Path: ${formatPathForDisplay(context, targetPath)}\n${content}`,
            isError: false
        };
    }
    catch (error) {
        return {
            content: formatToolError(error, "Failed to read the requested file."),
            isError: true
        };
    }
}
async function listFilesTool(options, input) {
    try {
        const context = readExecutionContext(options);
        const requestedPath = typeof input.path === "string" && input.path.trim().length > 0
            ? readString(input.path, "path")
            : ".";
        const maxDepth = clampNumber(input.maxDepth, DEFAULT_LIST_FILES_MAX_DEPTH, 0, MAX_LIST_FILES_MAX_DEPTH, "maxDepth");
        const maxEntries = clampNumber(input.maxEntries, DEFAULT_LIST_FILES_MAX_ENTRIES, 1, MAX_LIST_FILES_MAX_ENTRIES, "maxEntries");
        if (context.scope === "remote-host") {
            if (!context.activeRemoteHostId || !options.remoteExecutor) {
                return {
                    content: "Remote-host scope is active, but no registered remote host executor is available.",
                    isError: true
                };
            }
            const decision = await authorizeAction(options, {
                context,
                detail: `List remote path "${requestedPath}" on host ${context.activeRemoteHostId}.`,
                kind: "remote",
                resource: requestedPath,
                safetyLevel: "safe",
                summary: `List remote path "${requestedPath}".`
            });
            if (!decision.approved) {
                return decision.result;
            }
            return options.remoteExecutor.listFiles({
                hostId: context.activeRemoteHostId,
                maxDepth,
                maxEntries,
                path: requestedPath
            });
        }
        const targetPath = resolvePathFromContext(context, requestedPath);
        ensureLocalPathAllowed(context, targetPath);
        const decision = await authorizeAction(options, {
            context,
            detail: `List directory "${targetPath}".`,
            kind: "tool",
            resource: targetPath,
            safetyLevel: "safe",
            scope: classifyPathScope(context, targetPath),
            summary: `List files in "${formatPathForDisplay(context, targetPath)}".`
        });
        if (!decision.approved) {
            return decision.result;
        }
        const targetStats = await stat(targetPath);
        if (!targetStats.isDirectory()) {
            return {
                content: `Path: ${formatPathForDisplay(context, targetPath)}`,
                isError: false
            };
        }
        const lines = [];
        const walkState = {
            entries: 0,
            truncated: false
        };
        await walkDirectory({
            context,
            currentDepth: 0,
            currentPath: targetPath,
            lines,
            maxDepth,
            maxEntries,
            state: walkState
        });
        const body = lines.length > 0 ? lines.join("\n") : "(empty directory)";
        const suffix = walkState.truncated ? "\n... [truncated]" : "";
        return {
            content: `Path: ${formatPathForDisplay(context, targetPath)}\n${body}${suffix}`,
            isError: false
        };
    }
    catch (error) {
        return {
            content: formatToolError(error, "Failed to list the requested directory."),
            isError: true
        };
    }
}
async function writeFileTool(options, input) {
    try {
        const context = readExecutionContext(options);
        const path = readString(input.path, "path");
        const content = readString(input.content, "content");
        if (context.scope === "remote-host") {
            if (!context.activeRemoteHostId || !options.remoteExecutor) {
                return {
                    content: "Remote-host scope is active, but no registered remote host executor is available.",
                    isError: true
                };
            }
            const decision = await authorizeAction(options, {
                context,
                detail: `Write remote file "${path}" on host ${context.activeRemoteHostId}.`,
                kind: "remote",
                resource: path,
                safetyLevel: "dangerous",
                summary: `Write remote file "${path}".`
            });
            if (!decision.approved) {
                return decision.result;
            }
            const watcher = await createWatcher(options, {
                scope: context.scope,
                summary: `Remote write ${path}`,
                target: path,
                type: "remote"
            });
            const result = await options.remoteExecutor.writeFile({
                content,
                hostId: context.activeRemoteHostId,
                path
            });
            await finishWatcher(options, watcher?.id, result.isError ? "failed" : "completed");
            return withWatcherResult(result, watcher?.id);
        }
        const targetPath = resolvePathFromContext(context, path);
        ensureLocalPathAllowed(context, targetPath);
        const decision = await authorizeAction(options, {
            context,
            detail: `Write file "${targetPath}".`,
            kind: "tool",
            resource: targetPath,
            safetyLevel: classifyFileWriteSafety(context, targetPath),
            scope: classifyPathScope(context, targetPath),
            summary: `Write file "${formatPathForDisplay(context, targetPath)}".`
        });
        if (!decision.approved) {
            return decision.result;
        }
        const watcher = await createWatcher(options, {
            scope: classifyPathScope(context, targetPath),
            summary: `Write file ${formatPathForDisplay(context, targetPath)}`,
            target: targetPath,
            type: "file"
        });
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, "utf8");
        await finishWatcher(options, watcher?.id, "completed");
        return withWatcherResult({
            content: `Wrote ${content.length} characters to ${formatPathForDisplay(context, targetPath)}.`,
            isError: false
        }, watcher?.id);
    }
    catch (error) {
        return {
            content: formatToolError(error, "Failed to write the requested file."),
            isError: true
        };
    }
}
async function executeCommand({ command, args, context, cwd, onWatcherActivity, timeoutMs }) {
    const attempts = [];
    for (let attempt = 1; attempt <= MAX_COMMAND_RETRIES; attempt += 1) {
        const result = await runCommandAttempt({
            args,
            command,
            cwd,
            onWatcherActivity,
            timeoutMs
        });
        attempts.push(result);
        if (result.failureKind === "success") {
            break;
        }
        if (!shouldRetryCommand(result.failureKind) || attempt === MAX_COMMAND_RETRIES) {
            break;
        }
    }
    const finalResult = attempts[attempts.length - 1];
    const location = formatPathForDisplay(context, cwd);
    const sections = [
        `Command: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`,
        `Cwd: ${location}`,
        ...attempts.map((attempt, index) => {
            const lines = [
                `Attempt ${index + 1}/${attempts.length}`,
                `Result: ${formatFailureKind(attempt.failureKind)}`,
                `Duration: ${attempt.durationMs}ms`
            ];
            if (attempt.signal) {
                lines.push(`Signal: ${attempt.signal}`);
            }
            else {
                lines.push(`Exit code: ${attempt.code ?? 0}`);
            }
            if (attempt.stdout.trim().length > 0) {
                lines.push(`stdout:\n${attempt.stdout.trimEnd()}`);
            }
            if (attempt.stderr.trim().length > 0) {
                lines.push(`stderr:\n${attempt.stderr.trimEnd()}`);
            }
            return lines.join("\n");
        })
    ];
    return {
        attemptCount: attempts.length,
        result: {
            content: sections.join("\n\n"),
            isError: finalResult.failureKind !== "success"
        },
        watcherStatus: finalResult.failureKind === "success"
            ? "completed"
            : finalResult.failureKind === "stalled"
                ? "stalled"
                : "failed"
    };
}
async function runCommandAttempt(input) {
    return new Promise((resolve) => {
        const child = spawn(input.command, input.args, {
            cwd: input.cwd,
            env: process.env,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"]
        });
        const startedAt = Date.now();
        let lastOutputAt = startedAt;
        let idleTimeoutMs = Math.min(Math.max(input.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS), MAX_COMMAND_IDLE_TIMEOUT_MS);
        let stdout = "";
        let stderr = "";
        let settled = false;
        let failureKind = "success";
        let lastWatcherActivityAt = 0;
        const monitor = setInterval(() => {
            const now = Date.now();
            if (now - startedAt > MAX_COMMAND_TOTAL_RUNTIME_MS) {
                failureKind = "timeout";
                child.kill("SIGTERM");
                return;
            }
            if (now - lastOutputAt > idleTimeoutMs) {
                failureKind = "stalled";
                input.onWatcherActivity?.({
                    metadata: {
                        idleTimeoutMs
                    },
                    status: "stalled"
                });
                child.kill("SIGTERM");
            }
        }, COMMAND_MONITOR_INTERVAL_MS);
        const emitWatcherActivity = (metadata) => {
            const now = Date.now();
            if (now - lastWatcherActivityAt < 1_000) {
                return;
            }
            lastWatcherActivityAt = now;
            input.onWatcherActivity?.({
                metadata,
                status: "healthy"
            });
        };
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout = appendOutput(stdout, chunk);
            lastOutputAt = Date.now();
            emitWatcherActivity({
                stream: "stdout"
            });
            if (looksLikeProgress(chunk)) {
                idleTimeoutMs = Math.min(MAX_COMMAND_IDLE_TIMEOUT_MS, idleTimeoutMs + COMMAND_PROGRESS_EXTENSION_MS);
                emitWatcherActivity({
                    idleTimeoutMs,
                    stream: "stdout"
                });
            }
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr = appendOutput(stderr, chunk);
            lastOutputAt = Date.now();
            emitWatcherActivity({
                stream: "stderr"
            });
            if (looksLikeProgress(chunk)) {
                idleTimeoutMs = Math.min(MAX_COMMAND_IDLE_TIMEOUT_MS, idleTimeoutMs + COMMAND_PROGRESS_EXTENSION_MS);
                emitWatcherActivity({
                    idleTimeoutMs,
                    stream: "stderr"
                });
            }
        });
        child.once("error", (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearInterval(monitor);
            resolve({
                code: null,
                durationMs: Date.now() - startedAt,
                failureKind: /not found|ENOENT|command not found/i.test(error.message)
                    ? "missing_dependency"
                    : "spawn_error",
                signal: null,
                stderr: error.message,
                stdout
            });
        });
        child.once("close", (code, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            clearInterval(monitor);
            if (failureKind === "success") {
                if (signal) {
                    failureKind = "stalled";
                }
                else if (code !== 0) {
                    failureKind = classifyNonZeroExit(stdout, stderr);
                }
            }
            resolve({
                code,
                durationMs: Date.now() - startedAt,
                failureKind,
                signal,
                stderr,
                stdout
            });
        });
    });
}
async function createWatcher(options, input) {
    if (!options.watcherStore) {
        return undefined;
    }
    const id = `watcher-${randomBytes(4).toString("hex")}`;
    const currentContext = readExecutionContext(options);
    const approvalStatus = options.approvalManager?.getStatus();
    await options.watcherStore.create({
        activityAt: Date.now(),
        createdAt: Date.now(),
        id,
        projectId: currentContext.projectId,
        retryCount: 0,
        scope: input.scope,
        sessionId: approvalStatus?.activeSessionId,
        status: "active",
        summary: input.summary,
        target: input.target,
        taskId: approvalStatus?.activeTaskId,
        type: input.type,
        updatedAt: Date.now()
    });
    return {
        id
    };
}
async function finishWatcher(options, watcherId, status, metadata) {
    if (!watcherId || !options.watcherStore) {
        return;
    }
    const current = await options.watcherStore.get(watcherId);
    if (!current) {
        return;
    }
    await options.watcherStore.update({
        ...current,
        activityAt: Date.now(),
        metadata: {
            ...(current.metadata ?? {}),
            ...(metadata ?? {})
        },
        status,
        updatedAt: Date.now()
    });
}
function withWatcherResult(result, watcherId) {
    if (!watcherId) {
        return result;
    }
    return {
        ...result,
        content: `Watcher: ${watcherId}\n${result.content}`
    };
}
async function noteWatcherActivity(options, watcherId, input) {
    if (!watcherId || !options.watcherStore) {
        return;
    }
    const current = await options.watcherStore.get(watcherId);
    if (!current) {
        return;
    }
    await options.watcherStore.update({
        ...current,
        activityAt: Date.now(),
        metadata: {
            ...(current.metadata ?? {}),
            ...(input?.metadata ?? {})
        },
        status: input?.status ?? "healthy",
        updatedAt: Date.now()
    });
}
async function authorizeAction(options, input) {
    if (!options.approvalManager) {
        return {
            approved: true
        };
    }
    const decision = await options.approvalManager.request({
        detail: input.detail,
        kind: input.kind,
        metadata: input.metadata,
        policy: input.context.approvalPolicy,
        resource: input.resource,
        safetyLevel: input.safetyLevel,
        scope: input.scope ?? input.context.scope,
        summary: input.summary
    });
    if (decision.approved) {
        return {
            approved: true
        };
    }
    return {
        approved: false,
        result: {
            content: [
                `Approval required: ${decision.request.id}`,
                decision.request.summary,
                input.resource ? `Resolved target path: ${input.resource}` : undefined,
                `Resolved scope: ${readScopeLabel(input.scope ?? input.context.scope)}`,
                `Active scope: ${readScopeLabel(input.context.scope)}`,
                "Blocked because the current approval policy requires confirmation for this action.",
                "Use /approve <id>, /approve task, /approve session, /approve full, /autopilot on, or /reject <id> before retrying this action."
            ]
                .filter((line) => typeof line === "string")
                .join("\n"),
            isError: true
        }
    };
}
async function walkDirectory({ context, currentDepth, currentPath, lines, maxDepth, maxEntries, state }) {
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
        const entryLabel = `${"  ".repeat(currentDepth)}${formatPathForDisplay(context, entryPath)}${dirent.isDirectory() ? "/" : ""}`;
        lines.push(entryLabel);
        state.entries += 1;
        if (dirent.isDirectory() &&
            !dirent.isSymbolicLink() &&
            currentDepth < maxDepth) {
            await walkDirectory({
                context,
                currentDepth: currentDepth + 1,
                currentPath: entryPath,
                lines,
                maxDepth,
                maxEntries,
                state
            });
        }
    }
}
function readExecutionContext(options) {
    return options.getExecutionContext?.() ??
        createDefaultExecutionContext({
            projectId: "workspace",
            projectRoot: options.workspaceRoot
        });
}
function classifyNonZeroExit(stdout, stderr) {
    const combined = `${stdout}\n${stderr}`;
    if (/not found|command not found|No such file or directory|ENOENT/i.test(combined)) {
        return "missing_dependency";
    }
    return "non_zero_exit";
}
function shouldRetryCommand(failureKind) {
    return (failureKind === "stalled" ||
        failureKind === "spawn_error" ||
        failureKind === "timeout");
}
function formatFailureKind(failureKind) {
    switch (failureKind) {
        case "success":
            return "success";
        case "missing_dependency":
            return "missing dependency";
        case "non_zero_exit":
            return "non-zero exit";
        case "spawn_error":
            return "spawn error";
        case "stalled":
            return "stalled";
        case "timeout":
            return "timeout";
        default:
            return failureKind;
    }
}
function formatToolError(error, fallback) {
    if (error instanceof PathAccessError) {
        const lines = [error.message];
        if (error.path) {
            lines.push(`Resolved path: ${error.path}`);
        }
        if (error.details?.resolvedScope) {
            lines.push(`Resolved scope: ${readScopeLabel(error.details.resolvedScope)}`);
        }
        if (error.details?.activeScope) {
            lines.push(`Active scope: ${readScopeLabel(error.details.activeScope)}`);
        }
        if (error.details?.reason) {
            lines.push(`Reason: ${error.details.reason}`);
        }
        return lines.join("\n");
    }
    if (isMissingFileError(error)) {
        return `Path "${error.path}" does not exist.`;
    }
    return error instanceof Error ? error.message : fallback;
}
function looksLikeProgress(value) {
    return /\b(download(?:ing)?|install(?:ing)?|extract(?:ing)?|copy(?:ing)?|compile(?:ing|d)?|build(?:ing)?|fetch(?:ing)?|transpil(?:e|ing)|bundl(?:e|ing))\b/i.test(value);
}
function classifyCommandWatcherType(command, args) {
    const normalized = [command, ...args].join(" ").toLowerCase();
    if (/\b(test(?:ing)?|jest|vitest|playwright|cypress|pytest|cargo test|go test)\b/.test(normalized)) {
        return "test";
    }
    if (/\b(build(?:ing)?|compile(?:ing|d)?|tsc|webpack|rollup|vite build|next build|gradle assemble|xcodebuild)\b/.test(normalized)) {
        return "build";
    }
    if (/\b(tail|journalctl|logcat|watch|follow)\b/.test(normalized) ||
        normalized.includes("/var/log")) {
        return "log";
    }
    return "command";
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
function isMissingFileError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT");
}
function readAttemptCount(value) {
    return value.match(/^Attempt /gm)?.length ?? 0;
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
//# sourceMappingURL=core-tools.js.map