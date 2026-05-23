import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface CommandResult {
  code: number | null;
  command: string;
  stderr: string;
  stdout: string;
}

export async function runCommand(
  command: string,
  args: readonly string[] = [],
  options: {
    env?: NodeJS.ProcessEnv;
    input?: string;
    timeoutMs?: number;
  } = {}
): Promise<CommandResult> {
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
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
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
    } else {
      child.stdin.end();
    }
  });
}

export async function runShell(
  command: string,
  options: { input?: string; timeoutMs?: number } = {}
): Promise<CommandResult> {
  return runCommand("sh", ["-lc", command], options);
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await runShell(`command -v ${shellQuote(command)}`, {
    timeoutMs: 2_000
  }).catch(() => undefined);

  return Boolean(result && result.code === 0 && result.stdout.length > 0);
}

export async function listAvailableCommands(
  commands: readonly string[]
): Promise<string[]> {
  const availability = await Promise.all(
    commands.map(async (command) => ({
      command,
      exists: await commandExists(command)
    }))
  );

  return availability
    .filter((entry) => entry.exists)
    .map((entry) => entry.command);
}

export async function firstAvailable(
  commands: readonly string[]
): Promise<string | undefined> {
  for (const command of commands) {
    if (await commandExists(command)) {
      return command;
    }
  }

  return undefined;
}

export function readString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number.`);
  }

  return value;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 14))}... [truncated]`;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

export async function hashFile(path: string): Promise<string | undefined> {
  try {
    const buffer = await readFile(path);

    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return undefined;
  }
}
