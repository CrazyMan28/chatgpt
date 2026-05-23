import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
export async function runCommand(command, args = [], options = {}) {
    const timeoutMs = options.timeoutMs ?? 10_000;
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            env: {
                ...process.env,
                ...(options.env ?? {})
            },
            stdio: "pipe"
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            child.kill("SIGTERM");
            reject(new Error(`Command timed out: ${formatCommand(command, args)}`));
        }, timeoutMs);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            reject(error);
        });
        child.on("close", (code) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({
                code,
                command: formatCommand(command, args),
                stderr: stderr.trim(),
                stdout: stdout.trim()
            });
        });
        if (options.input !== undefined) {
            child.stdin.end(options.input);
        }
        else {
            child.stdin.end();
        }
    });
}
export async function runShell(command, options = {}) {
    return runCommand("sh", ["-lc", command], options);
}
export async function commandExists(command) {
    const result = await runShell(`command -v ${shellQuote(command)}`, {
        timeoutMs: 2_000
    }).catch(() => undefined);
    return Boolean(result && result.code === 0 && result.stdout.length > 0);
}
export async function listAvailableCommands(commands) {
    const availability = await Promise.all(commands.map(async (command) => ({
        command,
        exists: await commandExists(command)
    })));
    return availability
        .filter((entry) => entry.exists)
        .map((entry) => entry.command);
}
export async function firstAvailable(commands) {
    for (const command of commands) {
        if (await commandExists(command)) {
            return command;
        }
    }
    return undefined;
}
export function readString(value, key) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${key} must be a non-empty string.`);
    }
    return value.trim();
}
export function readOptionalString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
export function readBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
export function readNumber(value, key) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${key} must be a finite number.`);
    }
    return value;
}
export function readStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
export function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 14))}... [truncated]`;
}
export function shellQuote(value) {
    return `'${value.replace(/'/g, "'\\''")}'`;
}
export function formatCommand(command, args) {
    return [command, ...args].join(" ");
}
export async function hashFile(path) {
    try {
        const buffer = await readFile(path);
        return createHash("sha256").update(buffer).digest("hex");
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=utils.js.map