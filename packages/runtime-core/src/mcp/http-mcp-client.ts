import type {
  McpDiscoveredTool,
  McpHttpServerConfig,
  McpToolCallResult
} from "./mcp-server-config.js";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

interface JsonRpcRequest {
  id?: number;
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcError {
  code: number;
  data?: unknown;
  message: string;
}

interface JsonRpcResponse {
  id?: number;
  jsonrpc: "2.0";
  result?: unknown;
  error?: JsonRpcError;
}

interface InitializeResult {
  capabilities?: unknown;
}

interface ListToolsResult {
  nextCursor?: string;
  tools?: unknown[];
}

export class HttpMcpClient {
  private connected = false;
  private nextId = 1;
  private sessionId?: string;

  constructor(private readonly config: McpHttpServerConfig) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.request<InitializeResult>("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "chatgpt-code",
        version: "0.1.0"
      }
    });
    await this.notify("notifications/initialized");
    this.connected = true;
  }

  onNotification(): () => void {
    return () => undefined;
  }

  async listTools(): Promise<McpDiscoveredTool[]> {
    const tools: McpDiscoveredTool[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.request<ListToolsResult>(
        "tools/list",
        cursor ? { cursor } : {}
      );

      tools.push(...parseDiscoveredTools(result.tools));
      cursor = result.nextCursor;
    } while (cursor !== undefined);

    return tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpToolCallResult> {
    return this.request<McpToolCallResult>("tools/call", {
      name,
      arguments: args
    });
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    await this.postJsonRpc({
      jsonrpc: "2.0",
      method,
      params
    });
  }

  private async request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const response = await this.postJsonRpc({
      jsonrpc: "2.0",
      id,
      method,
      params
    });

    if (response.error) {
      throw new Error(
        `HTTP MCP server "${this.config.name}" returned an error for "${method}": ${response.error.message}`
      );
    }

    return response.result as T;
  }

  private async postJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, DEFAULT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          ...(this.config.headers ?? {}),
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {})
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      const nextSessionId = response.headers.get("mcp-session-id");

      if (nextSessionId) {
        this.sessionId = nextSessionId;
      }

      if (response.status === 202 || response.status === 204) {
        return {
          jsonrpc: "2.0"
        };
      }

      const payload = (await response.json()) as JsonRpcResponse;

      if (!response.ok) {
        const message =
          payload.error?.message ??
          `HTTP status ${response.status} while calling MCP server "${this.config.name}".`;
        throw new Error(message);
      }

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `HTTP MCP request to "${this.config.name}" timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms.`
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseDiscoveredTools(tools: unknown[] | undefined): McpDiscoveredTool[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools
    .map((tool) => parseDiscoveredTool(tool))
    .filter((tool): tool is McpDiscoveredTool => tool !== undefined);
}

function parseDiscoveredTool(tool: unknown): McpDiscoveredTool | undefined {
  if (typeof tool !== "object" || tool === null) {
    return undefined;
  }

  const value = tool as Record<string, unknown>;

  if (
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    !isRecord(value.inputSchema)
  ) {
    return undefined;
  }

  return {
    name: value.name,
    title: typeof value.title === "string" ? value.title : undefined,
    description: value.description,
    inputSchema: value.inputSchema
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
