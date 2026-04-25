import type { McpServerType } from "../config/app-config-schema.js";

interface BaseMcpServerConfig {
  name: string;
  toolNames?: readonly string[];
  type: McpServerType;
}

export interface McpStdioServerConfig extends BaseMcpServerConfig {
  transport: "stdio";
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface McpHttpServerConfig extends BaseMcpServerConfig {
  transport: "streamable-http";
  headers?: Record<string, string>;
  url: string;
}

export interface McpSseServerConfig extends BaseMcpServerConfig {
  transport: "sse";
  headers?: Record<string, string>;
  url: string;
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpHttpServerConfig
  | McpSseServerConfig;

export interface McpDiscoveredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
}
