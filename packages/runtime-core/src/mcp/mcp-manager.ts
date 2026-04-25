import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import type {
  AppConfigFile,
  McpServerDefinition,
  McpServerTransport,
  McpServerType
} from "../config/app-config-schema.js";
import {
  createEnabledMcpServerConfigs,
  readAppConfigFile,
  writeAppConfigFile
} from "../config/app-config-file.js";
import type {
  LoadedToolRegistry,
  ToolRegistryReloadSummary
} from "../tools/load-tool-registry.js";

export interface ManagedMcpServer {
  name: string;
  status: "ENABLED" | "DISABLED";
  type: McpServerType;
  definition: McpServerDefinition;
}

export interface McpServerDraft {
  args: string[];
  command: string;
  cwd: string;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  name: string;
  tools: string[];
  transport: McpServerTransport;
  type: McpServerType;
  url?: string;
}

export interface McpMutationResult {
  configPath: string;
  reloadSummary: ToolRegistryReloadSummary;
  server?: ManagedMcpServer;
}

export interface McpManager {
  addServer(draft: McpServerDraft): Promise<McpMutationResult>;
  disableServer(name: string): Promise<McpMutationResult>;
  editServer(name: string, draft: McpServerDraft): Promise<McpMutationResult>;
  enableServer(name: string): Promise<McpMutationResult>;
  getServer(name: string): Promise<ManagedMcpServer | undefined>;
  listServers(): Promise<ManagedMcpServer[]>;
  removeServer(name: string): Promise<McpMutationResult>;
  refresh(): Promise<McpMutationResult>;
}

export function createMcpManager(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  toolRegistry: LoadedToolRegistry;
}): McpManager {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const toolRegistry = options.toolRegistry;

  return {
    async addServer(draft) {
      return mutateConfig(async (file, configDirectory) => {
        validateServerName(draft.name);

        if (file.mcpServers[draft.name]) {
          throw new Error(`MCP server "${draft.name}" already exists.`);
        }

        const normalized = await normalizeDraft(draft, configDirectory);
        file.mcpServers[draft.name] = toDefinition(normalized);

        return {
          file,
          name: normalized.name
        };
      });
    },
    async disableServer(name) {
      return mutateConfig(async (file) => {
        const definition = file.mcpServers[name];

        if (!definition) {
          throw new Error(`MCP server "${name}" was not found.`);
        }

        file.mcpServers[name] = {
          ...definition,
          enabled: false
        };

        return {
          file,
          name
        };
      });
    },
    async editServer(name, draft) {
      return mutateConfig(async (file, configDirectory) => {
        const existing = file.mcpServers[name];

        if (!existing) {
          throw new Error(`MCP server "${name}" was not found.`);
        }

        const nextName = draft.name.trim().length > 0 ? draft.name.trim() : name;

        validateServerName(nextName);

        if (nextName !== name && file.mcpServers[nextName]) {
          throw new Error(`MCP server "${nextName}" already exists.`);
        }

        const normalized = await normalizeDraft(
          {
            ...draft,
            enabled: existing.enabled,
            name: nextName,
            type: draft.type
          },
          configDirectory
        );

        delete file.mcpServers[name];
        file.mcpServers[nextName] = toDefinition({
          ...normalized,
          enabled: existing.enabled
        });

        return {
          file,
          name: nextName
        };
      });
    },
    async enableServer(name) {
      return mutateConfig(async (file, configDirectory) => {
        const definition = file.mcpServers[name];

        if (!definition) {
          throw new Error(`MCP server "${name}" was not found.`);
        }

        const normalized = await normalizeDraft(
          {
            ...fromDefinition(name, definition),
            enabled: true
          },
          configDirectory
        );

        file.mcpServers[name] = toDefinition({
          ...normalized,
          enabled: true
        });

        return {
          file,
          name
        };
      });
    },
    async getServer(name) {
      return listServersInternal().then((servers) =>
        servers.find((server) => server.name === name)
      );
    },
    async listServers() {
      return listServersInternal();
    },
    async removeServer(name) {
      return mutateConfig(async (file) => {
        if (!file.mcpServers[name]) {
          throw new Error(`MCP server "${name}" was not found.`);
        }

        delete file.mcpServers[name];

        return {
          file,
          name: undefined
        };
      });
    },
    async refresh() {
      const resolved = readAppConfigFile(env, cwd);
      const reloadSummary = await toolRegistry.reload(
        createEnabledMcpServerConfigs(resolved.file, resolved.configDirectory)
      );

      return {
        configPath: resolved.configPath,
        reloadSummary
      };
    }
  };

  async function listServersInternal(): Promise<ManagedMcpServer[]> {
    const resolved = readAppConfigFile(env, cwd);

    return Object.entries(resolved.file.mcpServers)
      .map(([name, definition]) => ({
        name,
        status: definition.enabled ? ("ENABLED" as const) : ("DISABLED" as const),
        type: definition.type,
        definition
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function mutateConfig(
    mutator: (
      file: AppConfigFile,
      configDirectory: string
    ) => Promise<{ file: AppConfigFile; name: string | undefined }>
  ): Promise<McpMutationResult> {
    const resolved = readAppConfigFile(env, cwd);
    const result = await mutator(resolved.file, resolved.configDirectory);

    writeAppConfigFile(resolved.configPath, result.file);

    const reloadSummary = await toolRegistry.reload(
      createEnabledMcpServerConfigs(result.file, resolved.configDirectory)
    );
    const server =
      result.name === undefined
        ? undefined
        : {
            name: result.name,
            status: result.file.mcpServers[result.name]?.enabled
              ? ("ENABLED" as const)
              : ("DISABLED" as const),
            type: result.file.mcpServers[result.name]?.type ?? "command",
            definition: result.file.mcpServers[result.name] ?? {
              enabled: false,
              transport: "stdio",
              type: "command",
              command: "",
              args: [],
              cwd: "",
              env: {},
              headers: {},
              tools: ["*"]
            }
          };

    return {
      configPath: resolved.configPath,
      reloadSummary,
      server
    };
  }
}

export function formatMcpServerList(
  servers: readonly ManagedMcpServer[]
): string {
  if (servers.length === 0) {
    return "No MCP servers configured yet.";
  }

  const lines = [
    "MCP servers",
    "",
    `${padCell("name", 14)} ${padCell("type", 8)} status`
  ];

  for (const server of servers) {
    lines.push(
      `${padCell(server.name, 14)} ${padCell(server.type, 8)} ${server.status}`
    );
  }

  return lines.join("\n");
}

export function formatMcpReloadSummary(
  actionLabel: string,
  result: McpMutationResult
): string {
  const loadedSummary =
    result.reloadSummary.loadedServerNames.length > 0
      ? `Loaded: ${result.reloadSummary.loadedServerNames.join(", ")}.`
      : "Loaded: none.";
  const failedSummary =
    result.reloadSummary.failedServerNames.length > 0
      ? ` Failed: ${result.reloadSummary.failedServerNames.join(", ")}.`
      : "";

  return `${actionLabel} Config: ${result.configPath}. ${loadedSummary}${failedSummary}`;
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function validateServerName(name: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(name.trim())) {
    throw new Error(
      "MCP server names must use only letters, numbers, dot, dash, or underscore."
    );
  }
}

async function normalizeDraft(
  draft: McpServerDraft,
  configDirectory: string
): Promise<McpServerDraft> {
  const name = draft.name.trim();
  const cwd = draft.cwd.trim();

  if (name.length === 0) {
    throw new Error("MCP server name is required.");
  }

  if (draft.type === "http") {
    const url = draft.url?.trim() ?? "";

    if (url.length === 0) {
      throw new Error("HTTP MCP servers require a URL.");
    }

    try {
      new URL(url);
    } catch {
      throw new Error(`"${url}" is not a valid MCP server URL.`);
    }

    return {
      ...draft,
      command: "",
      cwd,
      name,
      transport: "http",
      url
    };
  }

  if (draft.type === "sse") {
    const url = draft.url?.trim() ?? "";

    if (url.length === 0) {
      throw new Error("SSE MCP servers require a URL.");
    }

    try {
      new URL(url);
    } catch {
      throw new Error(`"${url}" is not a valid MCP server URL.`);
    }

    return {
      ...draft,
      command: "",
      cwd,
      name,
      transport: "sse",
      url
    };
  }

  const command = draft.command.trim();

  if (command.length === 0) {
    throw new Error("Command-based MCP servers require a command.");
  }

  validateExecutable(command, cwd, configDirectory);

  return {
    ...draft,
    command,
    cwd,
    name,
    transport: "stdio",
    url: undefined
  };
}

function validateExecutable(
  command: string,
  cwd: string,
  configDirectory: string
): void {
  if (command.includes("/") || command.startsWith(".")) {
    const resolvedPath = resolve(
      cwd.length > 0 ? resolve(configDirectory, cwd) : configDirectory,
      command
    );

    if (!existsSync(resolvedPath)) {
      throw new Error(`Command path does not exist: ${resolvedPath}`);
    }

    return;
  }

  const result = spawnSync("which", [command], {
    stdio: "ignore"
  });

  if (result.status !== 0) {
    throw new Error(`Command "${command}" was not found in PATH.`);
  }
}

function toDefinition(draft: McpServerDraft): McpServerDefinition {
  return {
    enabled: draft.enabled,
    headers:
      draft.headers && Object.keys(draft.headers).length > 0
        ? { ...draft.headers }
        : {},
    tools:
      draft.tools.length > 0
        ? [...draft.tools]
        : ["*"],
    transport: draft.transport,
    type: draft.type,
    command: draft.command,
    url: draft.transport === "stdio" ? undefined : draft.url,
    args: [...draft.args],
    cwd: draft.cwd,
    env: { ...draft.env }
  };
}

function fromDefinition(
  name: string,
  definition: McpServerDefinition
): McpServerDraft {
  return {
    args: [...definition.args],
    command: definition.command,
    cwd: definition.cwd,
    enabled: definition.enabled,
    env: { ...definition.env },
    headers: { ...(definition.headers ?? {}) },
    name,
    tools: [...(definition.tools ?? ["*"])],
    transport: definition.transport,
    type: definition.type,
    url: definition.url
  };
}
