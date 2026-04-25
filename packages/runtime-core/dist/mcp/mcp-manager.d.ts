import type { McpServerDefinition, McpServerTransport, McpServerType } from "../config/app-config-schema.js";
import type { LoadedToolRegistry, ToolRegistryReloadSummary } from "../tools/load-tool-registry.js";
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
export declare function createMcpManager(options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    toolRegistry: LoadedToolRegistry;
}): McpManager;
export declare function formatMcpServerList(servers: readonly ManagedMcpServer[]): string;
export declare function formatMcpReloadSummary(actionLabel: string, result: McpMutationResult): string;
//# sourceMappingURL=mcp-manager.d.ts.map