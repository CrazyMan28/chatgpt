import type { McpDiscoveredTool, McpHttpServerConfig, McpToolCallResult } from "./mcp-server-config.js";
export declare class HttpMcpClient {
    private readonly config;
    private connected;
    private nextId;
    private sessionId?;
    constructor(config: McpHttpServerConfig);
    connect(): Promise<void>;
    onNotification(): () => void;
    listTools(): Promise<McpDiscoveredTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    close(): Promise<void>;
    private notify;
    private request;
    private postJsonRpc;
}
//# sourceMappingURL=http-mcp-client.d.ts.map