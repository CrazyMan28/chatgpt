export type McpServerTransport = "http" | "sse" | "stdio";
export type McpServerType = "command" | "http" | "local" | "sse";

export interface McpServerDefaults {
  timeout: number;
  restartOnFail: boolean;
  log: boolean;
}

export interface McpServerDefinition {
  enabled: boolean;
  headers?: Record<string, string>;
  type: McpServerType;
  transport: McpServerTransport;
  command: string;
  url?: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  tools?: string[];
}

export type McpServerDefinitions = Record<string, McpServerDefinition>;

export interface AppConfigFile {
  defaults: McpServerDefaults;
  mcpServers: McpServerDefinitions;
}

export const DEFAULT_MCP_SERVER_DEFAULTS: McpServerDefaults = {
  timeout: 30_000,
  restartOnFail: true,
  log: false
};

export function serializeAppConfigFile(config: AppConfigFile): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
