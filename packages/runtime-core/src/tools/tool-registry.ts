import { createHash } from "node:crypto";

import type { McpDiscoveredTool } from "../mcp/mcp-server-config.js";
import type { ModelToolDefinition } from "../models/model-client.js";

const MAX_MODEL_TOOL_NAME_LENGTH = 64;

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
  executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult>;
}

export class InMemoryToolRegistry implements ToolRegistry {
  private readonly registrationsById = new Map<string, ToolRegistration>();
  private readonly toolIdsByOwner = new Map<string, string[]>();

  addTools(owner: string, registrations: readonly ToolRegistration[]): void {
    const existingToolIds = this.toolIdsByOwner.get(owner) ?? [];
    const nextToolIds = [...existingToolIds];

    for (const registration of registrations) {
      this.registrationsById.set(registration.tool.id, registration);
      nextToolIds.push(registration.tool.id);
    }

    this.toolIdsByOwner.set(owner, nextToolIds);
  }

  replaceOwnerTools(
    owner: string,
    registrations: readonly ToolRegistration[]
  ): void {
    this.clearOwner(owner);
    this.addTools(owner, registrations);
  }

  clearOwner(owner: string): void {
    const toolIds = this.toolIdsByOwner.get(owner);

    if (!toolIds) {
      return;
    }

    for (const toolId of toolIds) {
      this.registrationsById.delete(toolId);
    }

    this.toolIdsByOwner.delete(owner);
  }

  listTools(): readonly RegisteredTool[] {
    return this.listRegistrations().map((registration) => registration.tool);
  }

  listModelTools(): readonly ModelToolDefinition[] {
    return this.listTools().map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const registration = this.listRegistrations().find(
      (entry) => entry.tool.name === name
    );

    if (!registration) {
      return {
        content: `Tool "${name}" is not registered.`,
        isError: true
      };
    }

    return registration.execute(input);
  }

  private listRegistrations(): ToolRegistration[] {
    return [...this.registrationsById.values()].sort((left, right) =>
      left.tool.name.localeCompare(right.tool.name)
    );
  }
}

export function createRegisteredTools(
  serverName: string,
  discoveredTools: readonly McpDiscoveredTool[]
): RegisteredTool[] {
  const usedNames = new Set<string>();

  return discoveredTools.map((tool) => {
    const name = createModelToolName(serverName, tool.name, usedNames);
    const id = `${serverName}::${tool.name}`;

    return {
      id,
      name,
      owner: serverName,
      source: "mcp",
      originalName: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    };
  });
}

function createModelToolName(
  serverName: string,
  toolName: string,
  usedNames: Set<string>
): string {
  const baseName = sanitizeToolName(`${serverName}__${toolName}`);
  const hash = createHash("sha1")
    .update(`${serverName}:${toolName}`)
    .digest("hex")
    .slice(0, 8);

  const truncated =
    baseName.length <= MAX_MODEL_TOOL_NAME_LENGTH
      ? baseName
      : `${baseName.slice(0, MAX_MODEL_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;

  if (!usedNames.has(truncated)) {
    usedNames.add(truncated);
    return truncated;
  }

  const fallback = `${truncated.slice(0, MAX_MODEL_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
  usedNames.add(fallback);
  return fallback;
}

function sanitizeToolName(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "tool";
}
