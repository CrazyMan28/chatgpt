import type { McpDiscoveredTool, McpStdioServerConfig, McpToolCallResult } from "./mcp-server-config.js";
interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}
export declare class StdioMcpClient {
    private readonly config;
    private readonly notificationHandlers;
    private readonly pendingRequests;
    private readonly stderrLines;
    private child?;
    private exitPromise?;
    private nextId;
    private stdoutBuffer;
    private connected;
    constructor(config: McpStdioServerConfig);
    connect(): Promise<void>;
    onNotification(handler: (notification: JsonRpcNotification) => void): () => void;
    listTools(): Promise<McpDiscoveredTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    close(): Promise<void>;
    private request;
    private sendNotification;
    private handleStdoutChunk;
    private handleMessage;
    private dispatchMessage;
    private respondMethodNotSupported;
    private resolvePending;
    private rejectPending;
    private rejectAllPending;
    private captureStderr;
    private formatServerError;
}
export {};
//# sourceMappingURL=stdio-mcp-client.d.ts.map