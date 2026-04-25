import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

import type {
  ToolExecutionResult,
  WorkerSpec
} from "@chatgpt-code/runtime-core";

const REMOTE_REGISTRY_PATH = ".chatgpt-code/remote-workers.json";

export interface RemoteAgentDefinition extends WorkerSpec {
  host: string;
  port?: number;
  username?: string;
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface RemoteWorkerRegistry {
  add(agent: RemoteAgentDefinition): Promise<RemoteAgentDefinition>;
  connect(id: string): Promise<RemoteAgentDefinition>;
  disconnect(id: string): Promise<RemoteAgentDefinition>;
  get(id: string): Promise<RemoteAgentDefinition | undefined>;
  list(): Promise<RemoteAgentDefinition[]>;
  remove(id: string): Promise<boolean>;
  runCommand(
    id: string,
    command: string,
    args?: string[]
  ): Promise<{
    code: number | null;
    stderr: string;
    stdout: string;
  }>;
  testConnection(id: string): Promise<{
    ok: boolean;
    output: string;
  }>;
}

export interface CreateRemoteWorkerRegistryOptions {
  workspaceRoot?: string;
}

export function createRemoteWorkerRegistry(
  options: CreateRemoteWorkerRegistryOptions = {}
): RemoteWorkerRegistry {
  const persistence = createPersistence(options.workspaceRoot);
  const agents = new Map<string, RemoteAgentDefinition>(
    persistence.read().map((agent) => [agent.id, agent])
  );

  const save = (): void => {
    persistence.write([...agents.values()]);
  };

  return {
    async add(agent) {
      const normalized = normalizeAgent(agent);
      agents.set(agent.id, normalized);
      save();
      return normalized;
    },
    async connect(id) {
      const agent = getRequiredAgent(agents, id);

      try {
        const probe = await runRemoteProbe(agent);
        const next = {
          ...agent,
          currentTask: undefined,
          lastHeartbeat: Date.now(),
          status: probe.code === 0 ? "idle" : "degraded"
        } satisfies RemoteAgentDefinition;
        agents.set(id, next);
        save();
        return next;
      } catch {
        const next = {
          ...agent,
          status: "degraded"
        } satisfies RemoteAgentDefinition;
        agents.set(id, next);
        save();
        return next;
      }
    },
    async disconnect(id) {
      const agent = getRequiredAgent(agents, id);
      const next = {
        ...agent,
        currentTask: undefined,
        status: "offline"
      } satisfies RemoteAgentDefinition;
      agents.set(id, next);
      save();
      return next;
    },
    async get(id) {
      return agents.get(id);
    },
    async list() {
      return [...agents.values()].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
    },
    async remove(id) {
      const removed = agents.delete(id);

      if (removed) {
        save();
      }

      return removed;
    },
    async runCommand(id, command, args = []) {
      const agent = getRequiredAgent(agents, id);

      if (agent.connectionType === "ssh") {
        const sshArgs = [
          ...(agent.port ? ["-p", String(agent.port)] : []),
          `${agent.username ? `${agent.username}@` : ""}${agent.host}`,
          buildRemoteCommand(agent, command, args)
        ];
        const result = await runProcess("ssh", sshArgs);

        agents.set(id, {
          ...agent,
          currentTask: `${command} ${args.join(" ")}`.trim(),
          lastHeartbeat: Date.now(),
          status: result.code === 0 ? "idle" : "degraded"
        });
        save();
        return result;
      }

      if (agent.connectionType === "container") {
        const shellCommand = buildRemoteCommand(agent, command, args);
        const result = await runProcess("docker", ["exec", agent.host, "sh", "-lc", shellCommand]);

        agents.set(id, {
          ...agent,
          currentTask: `${command} ${args.join(" ")}`.trim(),
          lastHeartbeat: Date.now(),
          status: result.code === 0 ? "idle" : "degraded"
        });
        save();
        return result;
      }

      const result = await runProcess(command, args, {
        cwd: agent.workingDirectory,
        env: {
          ...process.env,
          ...(agent.env ?? {})
        }
      });

      agents.set(id, {
        ...agent,
        currentTask: `${command} ${args.join(" ")}`.trim(),
        lastHeartbeat: Date.now(),
        status: result.code === 0 ? "idle" : "degraded"
      });
      save();
      return result;
    },
    async testConnection(id) {
      const agent = getRequiredAgent(agents, id);
      const result = await runRemoteProbe(agent);

      agents.set(id, {
        ...agent,
        lastHeartbeat: Date.now(),
        status: result.code === 0 ? "idle" : "degraded"
      });
      save();

      return {
        ok: result.code === 0,
        output: [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n")
      };
    }
  };
}

export function createRemoteToolExecutor(registry: RemoteWorkerRegistry): {
  listFiles(input: {
    hostId: string;
    maxDepth: number;
    maxEntries: number;
    path: string;
  }): Promise<ToolExecutionResult>;
  readFile(input: { hostId: string; path: string }): Promise<ToolExecutionResult>;
  runCommand(input: {
    args: string[];
    command: string;
    cwd?: string;
    hostId: string;
    timeoutMs: number;
  }): Promise<ToolExecutionResult>;
  writeFile(input: {
    content: string;
    hostId: string;
    path: string;
  }): Promise<ToolExecutionResult>;
} {
  return {
    async listFiles(input) {
      const script = [
        `find ${shellEscape(input.path)} -maxdepth ${Math.max(0, input.maxDepth)} 2>/dev/null`,
        `sed -n '1,${Math.max(1, input.maxEntries)}p'`
      ].join(" | ");
      const result = await registry.runCommand(input.hostId, "sh", ["-lc", script]);
      return formatRemoteToolResult(result, `Path: ${input.path}`);
    },
    async readFile(input) {
      const result = await registry.runCommand(input.hostId, "cat", ["--", input.path]);
      return formatRemoteToolResult(result, `Path: ${input.path}`);
    },
    async runCommand(input) {
      const result = await registry.runCommand(
        input.hostId,
        input.command,
        input.args
      );

      return formatRemoteToolResult(
        result,
        `Remote command: ${input.command}${input.args.length > 0 ? ` ${input.args.join(" ")}` : ""}`
      );
    },
    async writeFile(input) {
      const encoded = Buffer.from(input.content, "utf8").toString("base64");
      const script = [
        `mkdir -p "$(dirname -- ${shellEscape(input.path)})"`,
        `printf '%s' ${shellEscape(encoded)} | base64 -d > ${shellEscape(input.path)}`
      ].join(" && ");
      const result = await registry.runCommand(input.hostId, "sh", ["-lc", script]);
      return formatRemoteToolResult(
        result,
        `Wrote ${input.content.length} characters to ${input.path}.`
      );
    }
  };
}

function normalizeAgent(agent: RemoteAgentDefinition): RemoteAgentDefinition {
  return {
    ...agent,
    capabilities: [...agent.capabilities],
    env: agent.env ? { ...agent.env } : undefined,
    name: agent.name.trim(),
    status: agent.status ?? "offline"
  };
}

function getRequiredAgent(
  agents: Map<string, RemoteAgentDefinition>,
  id: string
): RemoteAgentDefinition {
  const agent = agents.get(id);

  if (!agent) {
    throw new Error(`Remote agent "${id}" was not found.`);
  }

  return agent;
}

async function runRemoteProbe(
  agent: RemoteAgentDefinition
): Promise<{
  code: number | null;
  stderr: string;
  stdout: string;
}> {
  if (agent.connectionType === "ssh") {
    const sshArgs = [
      ...(agent.port ? ["-p", String(agent.port)] : []),
      `${agent.username ? `${agent.username}@` : ""}${agent.host}`,
      buildRemoteCommand(agent, "printf", ["connected"])
    ];
    return runProcess("ssh", sshArgs);
  }

  if (agent.connectionType === "container") {
    return runProcess("docker", ["exec", agent.host, "sh", "-lc", "printf connected"]);
  }

  return runProcess("printf", ["connected"], {
    cwd: agent.workingDirectory,
    env: {
      ...process.env,
      ...(agent.env ?? {})
    }
  });
}

function buildRemoteCommand(
  agent: RemoteAgentDefinition,
  command: string,
  args: string[]
): string {
  const envPrefix = Object.entries(agent.env ?? {})
    .map(([key, value]) => `${shellEscape(key)}=${shellEscape(value)}`)
    .join(" ");
  const cwdPrefix = agent.workingDirectory
    ? `cd ${shellEscape(agent.workingDirectory)} && `
    : "";
  const rawCommand = [command, ...args.map((value) => shellEscape(value))].join(" ");

  return `${envPrefix.length > 0 ? `${envPrefix} ` : ""}${cwdPrefix}${rawCommand}`;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function createPersistence(workspaceRoot?: string): {
  read(): RemoteAgentDefinition[];
  write(agents: readonly RemoteAgentDefinition[]): void;
} {
  if (!workspaceRoot) {
    return {
      read: () => [],
      write: () => {}
    };
  }

  const filePath = resolve(workspaceRoot, REMOTE_REGISTRY_PATH);

  return {
    read() {
      if (!existsSync(filePath)) {
        return [];
      }

      try {
        const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

        if (!Array.isArray(raw)) {
          return [];
        }

        return raw
          .filter((value): value is RemoteAgentDefinition => isRemoteAgentDefinition(value))
          .map((agent) => normalizeAgent(agent));
      } catch {
        return [];
      }
    },
    write(agents) {
      mkdirSync(dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(agents, null, 2)}\n`, "utf8");
      renameSync(tempPath, filePath);
    }
  };
}

function isRemoteAgentDefinition(value: unknown): value is RemoteAgentDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RemoteAgentDefinition).id === "string" &&
    typeof (value as RemoteAgentDefinition).name === "string" &&
    typeof (value as RemoteAgentDefinition).role === "string" &&
    typeof (value as RemoteAgentDefinition).connectionType === "string" &&
    Array.isArray((value as RemoteAgentDefinition).capabilities) &&
    typeof (value as RemoteAgentDefinition).status === "string" &&
    typeof (value as RemoteAgentDefinition).host === "string"
  );
}

function runProcess(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<{
  code: number | null;
  stderr: string;
  stdout: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stderr,
        stdout
      });
    });
  });
}

function formatRemoteToolResult(
  result: {
    code: number | null;
    stderr: string;
    stdout: string;
  },
  prefix: string
): ToolExecutionResult {
  const sections = [prefix];

  if (result.stdout.trim().length > 0) {
    sections.push(result.stdout.trimEnd());
  }

  if (result.stderr.trim().length > 0) {
    sections.push(`stderr:\n${result.stderr.trimEnd()}`);
  }

  if (result.code !== 0) {
    sections.push(`Exit code: ${result.code ?? "unknown"}`);
  }

  return {
    content: sections.join("\n"),
    isError: result.code !== 0
  };
}
