import { createMcpClient } from "../mcp/mcp-client.js";
import { createCoreToolRegistrations } from "./core-tools.js";
import { createRegisteredTools, InMemoryToolRegistry } from "./tool-registry.js";
export async function loadToolRegistry(serverConfigs, workspaceRoot = process.cwd()) {
    const registry = new ReloadableToolRegistry(workspaceRoot);
    await registry.reload(serverConfigs);
    return registry;
}
class ReloadableToolRegistry extends InMemoryToolRegistry {
    connectedServers = new Map();
    constructor(workspaceRoot) {
        super();
        this.addTools("core", createCoreToolRegistrations({ workspaceRoot }));
    }
    async reload(serverConfigs) {
        const previousConnections = [...this.connectedServers.values()];
        this.connectedServers.clear();
        await Promise.allSettled(previousConnections.map((connection) => connection.close()));
        const results = await Promise.all(serverConfigs.map((serverConfig) => connectServerToRegistry(serverConfig, this)));
        const loadedServerNames = [];
        const failedServerNames = [];
        for (const result of results) {
            if (result === undefined) {
                continue;
            }
            if ("runtime" in result) {
                this.connectedServers.set(result.runtime.owner, result.runtime);
                loadedServerNames.push(result.runtime.name);
                continue;
            }
            failedServerNames.push(result.serverName);
        }
        return {
            failedServerNames,
            loadedServerNames
        };
    }
    async close() {
        await this.reload([]);
    }
}
async function connectServerToRegistry(serverConfig, registry) {
    const client = createMcpClient(serverConfig);
    const owner = `mcp:${serverConfig.name}`;
    try {
        await client.connect();
        const refreshTools = async () => {
            try {
                const tools = await client.listTools();
                registry.replaceOwnerTools(owner, createMcpToolRegistrations(serverConfig, tools, client));
            }
            catch {
                registry.clearOwner(owner);
            }
        };
        await refreshTools();
        const unsubscribe = client.onNotification((notification) => {
            if (notification.method === "notifications/tools/list_changed") {
                void refreshTools();
            }
        });
        return {
            runtime: {
                name: serverConfig.name,
                owner,
                async close() {
                    unsubscribe();
                    registry.clearOwner(owner);
                    await client.close();
                }
            }
        };
    }
    catch (error) {
        registry.clearOwner(owner);
        await client.close().catch(() => undefined);
        return {
            error: error instanceof Error
                ? error.message
                : `Unable to connect to MCP server "${serverConfig.name}".`,
            serverName: serverConfig.name
        };
    }
}
function createMcpToolRegistrations(serverConfig, discoveredTools, client) {
    const allowedToolNames = serverConfig.toolNames;
    const filteredTools = !allowedToolNames || allowedToolNames.length === 0
        ? discoveredTools
        : discoveredTools.filter((tool) => allowedToolNames.includes(tool.name));
    const registeredTools = createRegisteredTools(serverConfig.name, filteredTools);
    return registeredTools.map((tool) => ({
        tool,
        execute: async (input) => {
            try {
                const result = await client.callTool(tool.originalName, input);
                return formatMcpToolResult(tool, result);
            }
            catch (error) {
                return {
                    content: error instanceof Error
                        ? error.message
                        : `Failed to run MCP tool "${tool.name}".`,
                    isError: true
                };
            }
        }
    }));
}
function formatMcpToolResult(tool, result) {
    const textParts = Array.isArray(result.content)
        ? result.content
            .map((item) => formatMcpContentItem(item))
            .filter((item) => item !== undefined)
        : [];
    const structured = result.structuredContent === undefined
        ? undefined
        : JSON.stringify(result.structuredContent, null, 2);
    const sections = [`Tool: ${tool.name}`];
    if (textParts.length > 0) {
        sections.push(textParts.join("\n"));
    }
    if (structured) {
        sections.push(`structuredContent:\n${structured}`);
    }
    return {
        content: sections.length > 1
            ? sections.join("\n\n")
            : `Tool "${tool.name}" completed without output.`,
        isError: Boolean(result.isError)
    };
}
function formatMcpContentItem(item) {
    if (!isRecord(item)) {
        return undefined;
    }
    if (item.type === "text" && typeof item.text === "string") {
        return item.text;
    }
    return JSON.stringify(item, null, 2);
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
