import type { McpDiscoveredTool, McpSseServerConfig, McpToolCallResult } from "./mcp-server-config.js";
export declare class SseMcpClient {
    private readonly config;
    private connected;
    private endpointUrl?;
    private eventReaderAbort?;
    private nextId;
    private readonly notificationHandlers;
    private readonly pendingRequests;
    constructor(config: McpSseServerConfig);
    connect(): Promise<void>;
    onNotification(handler: (notification: {
        method: string;
        params?: unknown;
    }) => void): () => void;
    listTools(): Promise<McpDiscoveredTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
    close(): Promise<void>;
    private notify;
    private request;
    private openEventStream;
    private readEventStream;
    private handleEvent;
    private postMessage;
    private rejectAllPending;
}
//# sourceMappingURL=sse-mcp-client.d.ts.map