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
export declare const DEFAULT_MCP_SERVER_DEFAULTS: McpServerDefaults;
export declare function serializeAppConfigFile(config: AppConfigFile): string;
//# sourceMappingURL=app-config-schema.d.ts.map