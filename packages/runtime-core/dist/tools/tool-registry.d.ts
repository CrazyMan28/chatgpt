import type { McpDiscoveredTool } from "../mcp/mcp-server-config.js";
import type { ModelToolDefinition } from "../models/model-client.js";
export interface RegisteredTool {
    id: string;
    name: string;
    owner: string;
    source: "core" | "mcp";
    originalName: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface ToolExecutionResult {
    content: string;
    isError: boolean;
}
export interface ToolRegistration {
    tool: RegisteredTool;
    execute: (input: Record<string, unknown>) => Promise<ToolExecutionResult>;
}
export interface ToolRegistry {
    listTools(): readonly RegisteredTool[];
    listModelTools(): readonly ModelToolDefinition[];
    executeTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
}
export declare class InMemoryToolRegistry implements ToolRegistry {
    private readonly registrationsById;
    private readonly toolIdsByOwner;
    addTools(owner: string, registrations: readonly ToolRegistration[]): void;
    replaceOwnerTools(owner: string, registrations: readonly ToolRegistration[]): void;
    clearOwner(owner: string): void;
    listTools(): readonly RegisteredTool[];
    listModelTools(): readonly ModelToolDefinition[];
    executeTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
    private listRegistrations;
}
export declare function createRegisteredTools(serverName: string, discoveredTools: readonly McpDiscoveredTool[]): RegisteredTool[];
//# sourceMappingURL=tool-registry.d.ts.map