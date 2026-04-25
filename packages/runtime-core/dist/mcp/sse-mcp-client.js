const MCP_PROTOCOL_VERSION = "2025-11-25";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export class SseMcpClient {
    config;
    connected = false;
    endpointUrl;
    eventReaderAbort;
    nextId = 1;
    notificationHandlers = new Set();
    pendingRequests = new Map();
    constructor(config) {
        this.config = config;
    }
    async connect() {
        if (this.connected) {
            return;
        }
        await this.openEventStream();
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
    onNotification(handler) {
        this.notificationHandlers.add(handler);
        return () => {
            this.notificationHandlers.delete(handler);
        };
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
        this.rejectAllPending(new Error(`MCP SSE server "${this.config.name}" closed.`));
        this.eventReaderAbort?.abort();
    }
    async notify(method, params) {
        await this.postMessage({
            jsonrpc: "2.0",
            method,
            params
        });
    }
    async request(method, params) {
        const id = this.nextId++;
        const responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`SSE MCP request to "${this.config.name}" timed out waiting for "${method}".`));
            }, DEFAULT_REQUEST_TIMEOUT_MS);
            this.pendingRequests.set(id, {
                reject,
                resolve: (value) => resolve(value),
                timer
            });
        });
        await this.postMessage({
            id,
            jsonrpc: "2.0",
            method,
            params
        });
        return responsePromise;
    }
    async openEventStream() {
        const controller = new AbortController();
        this.eventReaderAbort = controller;
        const response = await fetch(this.config.url, {
            headers: {
                Accept: "text/event-stream",
                ...(this.config.headers ?? {})
            },
            signal: controller.signal
        });
        if (!response.ok || !response.body) {
            throw new Error(`Unable to open MCP SSE stream "${this.config.name}" at ${this.config.url}.`);
        }
        void this.readEventStream(response.body, controller).catch((error) => {
            this.rejectAllPending(error);
        });
        await waitForEndpoint(() => this.endpointUrl);
    }
    async readEventStream(body, controller) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "message";
        let eventDataLines = [];
        while (!controller.signal.aborted) {
            const next = await reader.read();
            if (next.done) {
                break;
            }
            buffer += decoder.decode(next.value, { stream: true });
            while (true) {
                const separatorIndex = buffer.indexOf("\n");
                if (separatorIndex === -1) {
                    break;
                }
                const rawLine = buffer.slice(0, separatorIndex).replace(/\r$/, "");
                buffer = buffer.slice(separatorIndex + 1);
                if (rawLine.length === 0) {
                    this.handleEvent(eventName, eventDataLines.join("\n"));
                    eventName = "message";
                    eventDataLines = [];
                    continue;
                }
                if (rawLine.startsWith("event:")) {
                    eventName = rawLine.slice(6).trim() || "message";
                    continue;
                }
                if (rawLine.startsWith("data:")) {
                    eventDataLines.push(rawLine.slice(5).trimStart());
                }
            }
        }
    }
    handleEvent(eventName, data) {
        if (eventName === "endpoint") {
            this.endpointUrl = new URL(data, this.config.url).toString();
            return;
        }
        if (data.trim().length === 0) {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(data);
        }
        catch {
            return;
        }
        if (!isRecord(payload) || payload.jsonrpc !== "2.0") {
            return;
        }
        if (typeof payload.id === "number") {
            const pending = this.pendingRequests.get(payload.id);
            if (!pending) {
                return;
            }
            clearTimeout(pending.timer);
            this.pendingRequests.delete(payload.id);
            if (isRecord(payload.error) && typeof payload.error.message === "string") {
                pending.reject(new Error(payload.error.message));
                return;
            }
            pending.resolve(payload.result);
            return;
        }
        if (typeof payload.method === "string") {
            for (const handler of this.notificationHandlers) {
                handler({
                    method: payload.method,
                    params: payload.params
                });
            }
        }
    }
    async postMessage(request) {
        const endpointUrl = this.endpointUrl ?? this.config.url;
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.config.headers ?? {})
            },
            body: JSON.stringify(request)
        });
        if (!response.ok && response.status !== 202 && response.status !== 204) {
            throw new Error(`SSE MCP request to "${this.config.name}" failed with status ${response.status}.`);
        }
        if (response.headers.get("content-type")?.includes("application/json")) {
            const payload = (await response.json());
            if (payload.id !== undefined) {
                const pending = this.pendingRequests.get(payload.id);
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pendingRequests.delete(payload.id);
                    if (payload.error?.message) {
                        pending.reject(new Error(payload.error.message));
                        return;
                    }
                    pending.resolve(payload.result);
                }
            }
        }
    }
    rejectAllPending(error) {
        for (const [id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timer);
            pending.reject(error);
            this.pendingRequests.delete(id);
        }
    }
}
async function waitForEndpoint(readEndpoint) {
    const startedAt = Date.now();
    while (!readEndpoint()) {
        if (Date.now() - startedAt > DEFAULT_REQUEST_TIMEOUT_MS) {
            throw new Error("SSE MCP server did not provide a message endpoint.");
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
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
    if (!isRecord(tool)) {
        return undefined;
    }
    if (typeof tool.name !== "string" ||
        typeof tool.description !== "string" ||
        !isRecord(tool.inputSchema)) {
        return undefined;
    }
    return {
        name: tool.name,
        title: typeof tool.title === "string" ? tool.title : undefined,
        description: tool.description,
        inputSchema: tool.inputSchema
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=sse-mcp-client.js.map