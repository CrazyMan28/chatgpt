const MCP_PROTOCOL_VERSION = "2025-11-25";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export class HttpMcpClient {
    config;
    connected = false;
    nextId = 1;
    sessionId;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        if (this.connected) {
            return;
        }
        await this.request("initialize", {
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
    onNotification() {
        return () => undefined;
    }
    async listTools() {
        const tools = [];
        let cursor;
        do {
            const result = await this.request("tools/list", cursor ? { cursor } : {});
            tools.push(...parseDiscoveredTools(result.tools));
            cursor = result.nextCursor;
        } while (cursor !== undefined);
        return tools;
    }
    async callTool(name, args) {
        return this.request("tools/call", {
            name,
            arguments: args
        });
    }
    async close() {
        this.connected = false;
    }
    async notify(method, params) {
        await this.postJsonRpc({
            jsonrpc: "2.0",
            method,
            params
        });
    }
    async request(method, params) {
        const id = this.nextId++;
        const response = await this.postJsonRpc({
            jsonrpc: "2.0",
            id,
            method,
            params
        });
        if (response.error) {
            throw new Error(`HTTP MCP server "${this.config.name}" returned an error for "${method}": ${response.error.message}`);
        }
        return response.result;
    }
    async postJsonRpc(request) {
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
            const payload = (await response.json());
            if (!response.ok) {
                const message = payload.error?.message ??
                    `HTTP status ${response.status} while calling MCP server "${this.config.name}".`;
                throw new Error(message);
            }
            return payload;
        }
        catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`HTTP MCP request to "${this.config.name}" timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms.`);
            }
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
function parseDiscoveredTools(tools) {
    if (!Array.isArray(tools)) {
        return [];
    }
    return tools
        .map((tool) => parseDiscoveredTool(tool))
        .filter((tool) => tool !== undefined);
}
function parseDiscoveredTool(tool) {
    if (typeof tool !== "object" || tool === null) {
        return undefined;
    }
    const value = tool;
    if (typeof value.name !== "string" ||
        typeof value.description !== "string" ||
        !isRecord(value.inputSchema)) {
        return undefined;
    }
    return {
        name: value.name,
        title: typeof value.title === "string" ? value.title : undefined,
        description: value.description,
        inputSchema: value.inputSchema
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=http-mcp-client.js.map