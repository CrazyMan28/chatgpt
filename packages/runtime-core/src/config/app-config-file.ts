import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { McpServerConfig } from "../mcp/mcp-server-config.js";

import {
  DEFAULT_MCP_SERVER_DEFAULTS,
  serializeAppConfigFile,
  type AppConfigFile,
  type McpServerDefaults,
  type McpServerDefinition,
  type McpServerDefinitions,
  type McpServerTransport,
  type McpServerType
} from "./app-config-schema.js";
import { DEFAULT_APP_CONFIG } from "./default-app-config.js";

export const DEFAULT_CONFIG_FILENAME = "chatgpt-code.config.json";

export interface ResolvedAppConfigFile {
  configDirectory: string;
  configPath: string;
  file: AppConfigFile;
}

export function resolveAppConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): string {
  const explicitPath = readOptionalValue(env.CHATGPT_CODE_CONFIG_PATH);

  return explicitPath
    ? resolve(cwd, explicitPath)
    : resolve(cwd, DEFAULT_CONFIG_FILENAME);
}

export function readAppConfigFile(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): ResolvedAppConfigFile {
  const configPath = resolveAppConfigPath(env, cwd);
  const explicitPath = readOptionalValue(env.CHATGPT_CODE_CONFIG_PATH);

  if (!existsSync(configPath)) {
    if (explicitPath) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    ensureDefaultConfigFile(configPath);
  }

  const rawConfig = readFileSync(configPath, "utf8");

  return {
    configDirectory: dirname(configPath),
    configPath,
    file: normalizeAppConfigFile(JSON.parse(rawConfig) as unknown)
  };
}

export function writeAppConfigFile(
  configPath: string,
  file: AppConfigFile
): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, serializeAppConfigFile(file), "utf8");
}

export function normalizeAppConfigFile(value: unknown): AppConfigFile {
  return {
    defaults: parseMcpDefaults(value),
    mcpServers: parseMcpServerDefinitions(value)
  };
}

export function createEnabledMcpServerConfigs(
  file: AppConfigFile,
  configDirectory: string
): McpServerConfig[] {
  return Object.entries(file.mcpServers)
    .map(([name, definition]) =>
      toMcpServerConfig(name, definition, configDirectory)
    )
    .filter((config): config is McpServerConfig => config !== undefined);
}

function parseMcpDefaults(value: unknown): McpServerDefaults {
  if (!isRecord(value) || !isRecord(value.defaults)) {
    return { ...DEFAULT_MCP_SERVER_DEFAULTS };
  }

  return {
    timeout:
      typeof value.defaults.timeout === "number" &&
      Number.isFinite(value.defaults.timeout)
        ? value.defaults.timeout
        : DEFAULT_MCP_SERVER_DEFAULTS.timeout,
    restartOnFail:
      typeof value.defaults.restartOnFail === "boolean"
        ? value.defaults.restartOnFail
        : DEFAULT_MCP_SERVER_DEFAULTS.restartOnFail,
    log:
      typeof value.defaults.log === "boolean"
        ? value.defaults.log
        : DEFAULT_MCP_SERVER_DEFAULTS.log
  };
}

function parseMcpServerDefinitions(value: unknown): McpServerDefinitions {
  if (!isRecord(value) || !isRecord(value.mcpServers)) {
    return {};
  }

  const definitions = Object.entries(value.mcpServers)
    .map(([name, definition]) => {
      if (!isRecord(definition)) {
        return undefined;
      }

      return [name, toMcpServerDefinition(definition)] as const;
    })
    .filter(
      (
        entry
      ): entry is readonly [string, McpServerDefinition] => entry !== undefined
    );

  return Object.fromEntries(definitions);
}

function toMcpServerConfig(
  name: string,
  definition: McpServerDefinition,
  configDirectory: string
): McpServerConfig | undefined {
  if (!definition.enabled) {
    return undefined;
  }

  if (definition.transport === "http") {
    const url = definition.url?.trim() ?? "";

    if (url.length === 0) {
      return undefined;
    }

    return {
      headers:
        definition.headers && Object.keys(definition.headers).length > 0
          ? definition.headers
          : undefined,
      name,
      transport: "streamable-http",
      type: definition.type,
      toolNames: normalizeToolNames(definition.tools),
      url
    };
  }

  if (definition.transport === "sse") {
    const url = definition.url?.trim() ?? "";

    if (url.length === 0) {
      return undefined;
    }

    return {
      headers:
        definition.headers && Object.keys(definition.headers).length > 0
          ? definition.headers
          : undefined,
      name,
      transport: "sse",
      type: definition.type,
      toolNames: normalizeToolNames(definition.tools),
      url
    };
  }

  const command = definition.command.trim();

  if (command.length === 0) {
    return undefined;
  }

  return {
    name,
    transport: "stdio",
    type: definition.type,
    command,
    args: definition.args,
    cwd:
      definition.cwd.trim().length > 0
        ? resolve(configDirectory, definition.cwd)
        : undefined,
    env:
      Object.keys(definition.env).length > 0
        ? definition.env
        : undefined,
    toolNames: normalizeToolNames(definition.tools)
  };
}

function toMcpServerDefinition(value: Record<string, unknown>): McpServerDefinition {
  const transport = parseMcpServerTransport(value.transport, value.type);
  const type = parseMcpServerType(value.type);

  return {
    enabled: value.enabled !== false,
    headers: parseStringRecord(value.headers) ?? {},
    type,
    transport,
    command: typeof value.command === "string" ? value.command : "",
    url: typeof value.url === "string" ? value.url : undefined,
    args: parseStringArray(value.args),
    cwd: typeof value.cwd === "string" ? value.cwd : "",
    env: parseStringRecord(value.env) ?? {},
    tools: parseStringArray(value.tools)
  };
}

function parseMcpServerType(value: unknown): McpServerType {
  return value === "http" || value === "local" || value === "sse"
    ? value
    : "command";
}

function parseMcpServerTransport(
  transportValue: unknown,
  typeValue: unknown
): McpServerTransport {
  if (
    transportValue === "stdio" ||
    transportValue === "http" ||
    transportValue === "sse"
  ) {
    return transportValue;
  }

  if (typeValue === "http") {
    return "http";
  }

  if (typeValue === "sse") {
    return "sse";
  }

  return "stdio";
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseStringRecord(
  value: unknown
): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeToolNames(
  value: readonly string[] | undefined
): readonly string[] | undefined {
  if (!value || value.length === 0 || value.includes("*")) {
    return undefined;
  }

  const toolNames = value
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return toolNames.length > 0 ? toolNames : undefined;
}

function readOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureDefaultConfigFile(configPath: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, serializeAppConfigFile(DEFAULT_APP_CONFIG), {
    encoding: "utf8",
    flag: "wx"
  });
}
