import type { McpDiscoveredTool, McpServerConfig, McpToolCallResult } from "./mcp-server-config.js";
export interface McpClient {
    connect(): Promise<void>;
    listTools(): Promise<McpDiscoveredTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    onNotification(handler: (notification: {
        method: string;
        params?: unknown;
    }) => void): () => void;
    close(): Promise<void>;
}
export declare function createMcpClient(config: McpServerConfig): McpClient;
//# sourceMappingURL=mcp-client.d.ts.map