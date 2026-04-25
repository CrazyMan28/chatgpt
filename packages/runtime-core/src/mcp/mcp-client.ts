import type {
  McpDiscoveredTool,
  McpServerConfig,
  McpToolCallResult
} from "./mcp-server-config.js";
import { HttpMcpClient } from "./http-mcp-client.js";
import { SseMcpClient } from "./sse-mcp-client.js";
import { StdioMcpClient } from "./stdio-mcp-client.js";

export interface McpClient {
  connect(): Promise<void>;
  listTools(): Promise<McpDiscoveredTool[]>;
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpToolCallResult>;
  onNotification(
    handler: (notification: { method: string; params?: unknown }) => void
  ): () => void;
  close(): Promise<void>;
}

export function createMcpClient(config: McpServerConfig): McpClient {
  if (config.transport === "stdio") {
    return new StdioMcpClient(config);
  }

  if (config.transport === "sse") {
    return new SseMcpClient(config);
  }

  return new HttpMcpClient(config);
}
