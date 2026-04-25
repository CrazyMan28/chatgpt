import { spawn } from "node:child_process";
const MCP_PROTOCOL_VERSION = "2025-11-25";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 1_000;
const SERVER_LOG_LIMIT = 20;
export class StdioMcpClient {
    config;
    notificationHandlers = new Set();
    pendingRequests = new Map();
    stderrLines = [];
    child;
    exitPromise;
    nextId = 1;
    stdoutBuffer = "";
    connected = false;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        if (this.connected) {
            return;
        }
        this.child = spawn(this.config.command, this.config.args, {
            cwd: this.config.cwd,
            env: {
                ...process.env,
                ...this.config.env
            },
            stdio: "pipe"
        });
        this.exitPromise = new Promise((resolve) => {
            this.child?.once("exit", () => {
                this.connected = false;
                this.rejectAllPending(new Error(this.formatServerError("MCP server exited unexpectedly.")));
                resolve();
            });
        });
        this.child.once("error", (error) => {
            this.rejectAllPending(new Error(this.formatServerError(`MCP server failed to start: ${error.message}`)));
        });
        this.child.stdout.setEncoding("utf8");
        this.child.stdout.on("data", (chunk) => {
            this.handleStdoutChunk(chunk);
        });
        this.child.stderr.setEncoding("utf8");
        this.child.stderr.on("data", (chunk) => {
            this.captureStderr(chunk);
        });
        await this.request("initialize", {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: "chatgpt-code",
                version: "0.1.0"
            }
        });
        this.sendNotification("notifications/initialized");
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
        const child = this.child;
        if (!child) {
            return;
        }
        this.child = undefined;
        this.connected = false;
        this.rejectAllPending(new Error(this.formatServerError("MCP server connection closed.")));
        child.stdout.removeAllListeners();
        child.stderr.removeAllListeners();
        child.stdin.end();
        const exitPromise = this.exitPromise;
        if (exitPromise) {
            const terminated = await raceWithTimeout(exitPromise.then(() => true), SHUTDOWN_TIMEOUT_MS);
            if (!terminated) {
                child.kill("SIGTERM");
                const killed = await raceWithTimeout(exitPromise.then(() => true), SHUTDOWN_TIMEOUT_MS);
                if (!killed) {
                    child.kill("SIGKILL");
                    await exitPromise;
                }
            }
        }
    }
    async request(method, params) {
        const child = this.child;
        if (!child) {
            throw new Error(this.formatServerError("MCP server is not connected."));
        }
        const id = this.nextId++;
        const payload = {
            jsonrpc: "2.0",
            id,
            method,
            params
        };
        const responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(this.formatServerError(`MCP request timed out while waiting for "${method}".`)));
            }, DEFAULT_REQUEST_TIMEOUT_MS);
            this.pendingRequests.set(id, {
                resolve: (value) => resolve(value),
                reject,
                timer
            });
        });
        child.stdin.write(`${JSON.stringify(payload)}\n`);
        return responsePromise;
    }
    sendNotification(method, params) {
        const child = this.child;
        if (!child) {
            return;
        }
        const payload = {
            jsonrpc: "2.0",
            method,
            params
        };
        child.stdin.write(`${JSON.stringify(payload)}\n`);
    }
    handleStdoutChunk(chunk) {
        this.stdoutBuffer += chunk;
        while (true) {
            const newlineIndex = this.stdoutBuffer.indexOf("\n");
            if (newlineIndex === -1) {
                break;
            }
            const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
            if (line.length === 0) {
                continue;
            }
            this.handleMessage(line);
        }
    }
    handleMessage(rawMessage) {
        let message;
        try {
            message = JSON.parse(rawMessage);
        }
        catch (error) {
            this.rejectAllPending(new Error(this.formatServerError(error instanceof Error
                ? `Received invalid JSON from MCP server: ${error.message}`
                : "Received invalid JSON from MCP server.")));
            return;
        }
        if (Array.isArray(message)) {
            for (const entry of message) {
                this.dispatchMessage(entry);
            }
            return;
        }
        this.dispatchMessage(message);
    }
    dispatchMessage(message) {
        if (!isJsonRpcMessage(message)) {
            return;
        }
        if (isJsonRpcSuccessResponse(message)) {
            this.resolvePending(message.id, message.result);
            return;
        }
        if (isJsonRpcErrorResponse(message)) {
            this.rejectPending(message.id, new Error(this.formatServerError(`MCP request failed (${message.error.code}): ${message.error.message}`)));
            return;
        }
        if (isJsonRpcRequest(message)) {
            this.respondMethodNotSupported(message.id);
            return;
        }
        if (isJsonRpcNotification(message)) {
            for (const handler of this.notificationHandlers) {
                handler(message);
            }
        }
    }
    respondMethodNotSupported(id) {
        const child = this.child;
        if (!child) {
            return;
        }
        const response = {
            jsonrpc: "2.0",
            id,
            error: {
                code: -32601,
                message: "Method not supported by client."
            }
        };
        child.stdin.write(`${JSON.stringify(response)}\n`);
    }
    resolvePending(id, result) {
        const pending = this.pendingRequests.get(id);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(id);
        pending.resolve(result);
    }
    rejectPending(id, error) {
        const pending = this.pendingRequests.get(id);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(id);
        pending.reject(error);
    }
    rejectAllPending(error) {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(error);
            this.pendingRequests.delete(id);
        }
    }
    captureStderr(chunk) {
        const lines = chunk
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        for (const line of lines) {
            this.stderrLines.push(line);
        }
        if (this.stderrLines.length > SERVER_LOG_LIMIT) {
            this.stderrLines.splice(0, this.stderrLines.length - SERVER_LOG_LIMIT);
        }
    }
    formatServerError(message) {
        const suffix = this.stderrLines.length > 0
            ? ` Recent server stderr: ${this.stderrLines.join(" | ")}`
            : "";
        return `[${this.config.name}] ${message}${suffix}`;
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
    const name = typeof tool.name === "string" ? tool.name.trim() : "";
    const description = typeof tool.description === "string" ? tool.description.trim() : "";
    const title = typeof tool.title === "string" ? tool.title.trim() : undefined;
    if (name.length === 0 || !isRecord(tool.inputSchema)) {
        return undefined;
    }
    return {
        name,
        title: title && title.length > 0 ? title : undefined,
        description: description.length > 0 ? description : "No description provided.",
        inputSchema: tool.inputSchema
    };
}
function isJsonRpcMessage(value) {
    if (!isRecord(value)) {
        return false;
    }
    return value.jsonrpc === "2.0";
}
function isJsonRpcSuccessResponse(value) {
    return "id" in value && typeof value.id === "number" && "result" in value;
}
function isJsonRpcErrorResponse(value) {
    return ("id" in value &&
        typeof value.id === "number" &&
        "error" in value &&
        isJsonRpcErrorObject(value.error));
}
function isJsonRpcRequest(value) {
    return ("id" in value &&
        typeof value.id === "number" &&
        "method" in value &&
        typeof value.method === "string");
}
function isJsonRpcNotification(value) {
    return !("id" in value) && "method" in value && typeof value.method === "string";
}
function isJsonRpcErrorObject(value) {
    return (isRecord(value) &&
        typeof value.code === "number" &&
        typeof value.message === "string");
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
async function raceWithTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            resolve(undefined);
        }, timeoutMs);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
//# sourceMappingURL=stdio-mcp-client.js.map