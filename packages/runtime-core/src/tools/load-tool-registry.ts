import type {
  McpServerConfig,
  McpToolCallResult
} from "../mcp/mcp-server-config.js";
import type { ExecutionContext } from "../platform/types.js";
import type { ApprovalManager } from "../platform/approval-manager.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import { createMcpClient, type McpClient } from "../mcp/mcp-client.js";

import {
  createCoreToolRegistrations,
  type RemoteToolExecutor
} from "./core-tools.js";
import {
  createRegisteredTools,
  InMemoryToolRegistry,
  type RegisteredTool,
  type ToolExecutionResult,
  type ToolRegistration
} from "./tool-registry.js";

export interface ToolRegistryReloadSummary {
  failedServerNames: string[];
  loadedServerNames: string[];
}

export interface LoadedToolRegistry extends InMemoryToolRegistry {
  close(): Promise<void>;
  reload(serverConfigs: readonly McpServerConfig[]): Promise<ToolRegistryReloadSummary>;
}

export interface ToolRegistryRuntimeOptions {
  approvalManager?: ApprovalManager;
  getExecutionContext?: () => ExecutionContext;
  remoteExecutor?: RemoteToolExecutor;
  watcherStore?: WatcherStore;
  workspaceRoot?: string;
}

export async function loadToolRegistry(
  serverConfigs: readonly McpServerConfig[],
  workspaceRootOrOptions: string | ToolRegistryRuntimeOptions = process.cwd()
): Promise<LoadedToolRegistry> {
  const options =
    typeof workspaceRootOrOptions === "string"
      ? {
          workspaceRoot: workspaceRootOrOptions
        }
      : workspaceRootOrOptions;
  const registry = new ReloadableToolRegistry({
    workspaceRoot: options.workspaceRoot ?? process.cwd(),
    approvalManager: options.approvalManager,
    getExecutionContext: options.getExecutionContext,
    remoteExecutor: options.remoteExecutor,
    watcherStore: options.watcherStore
  });
  await registry.reload(serverConfigs);
  return registry;
}

interface ConnectedServer {
  name: string;
  owner: string;
  close(): Promise<void>;
}

class ReloadableToolRegistry
  extends InMemoryToolRegistry
  implements LoadedToolRegistry
{
  private readonly connectedServers = new Map<string, ConnectedServer>();

  constructor(options: {
    approvalManager?: ApprovalManager;
    getExecutionContext?: () => ExecutionContext;
    remoteExecutor?: RemoteToolExecutor;
    watcherStore?: WatcherStore;
    workspaceRoot: string;
  }) {
    super();
    this.addTools("core", createCoreToolRegistrations(options));
  }

  async reload(
    serverConfigs: readonly McpServerConfig[]
  ): Promise<ToolRegistryReloadSummary> {
    const previousConnections = [...this.connectedServers.values()];

    this.connectedServers.clear();

    await Promise.allSettled(
      previousConnections.map((connection) => connection.close())
    );

    const results = await Promise.all(
      serverConfigs.map((serverConfig) =>
        connectServerToRegistry(serverConfig, this)
      )
    );
    const loadedServerNames: string[] = [];
    const failedServerNames: string[] = [];

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

  async close(): Promise<void> {
    await this.reload([]);
  }
}

interface ConnectServerFailure {
  error: string;
  serverName: string;
}

interface ConnectServerSuccess {
  runtime: ConnectedServer;
}

async function connectServerToRegistry(
  serverConfig: McpServerConfig,
  registry: InMemoryToolRegistry
): Promise<ConnectServerFailure | ConnectServerSuccess | undefined> {
  const client = createMcpClient(serverConfig);
  const owner = `mcp:${serverConfig.name}`;

  try {
    await client.connect();

    const refreshTools = async (): Promise<void> => {
      try {
        const tools = await client.listTools();
        registry.replaceOwnerTools(
          owner,
          createMcpToolRegistrations(serverConfig, tools, client)
        );
      } catch {
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
        async close(): Promise<void> {
          unsubscribe();
          registry.clearOwner(owner);
          await client.close();
        }
      }
    };
  } catch (error) {
    registry.clearOwner(owner);
    await client.close().catch(() => undefined);
    return {
      error:
        error instanceof Error
          ? error.message
          : `Unable to connect to MCP server "${serverConfig.name}".`,
      serverName: serverConfig.name
    };
  }
}

function createMcpToolRegistrations(
  serverConfig: McpServerConfig,
  discoveredTools: readonly {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }[],
  client: McpClient
): ToolRegistration[] {
  const allowedToolNames = serverConfig.toolNames;
  const filteredTools =
    !allowedToolNames || allowedToolNames.length === 0
      ? discoveredTools
      : discoveredTools.filter((tool) => allowedToolNames.includes(tool.name));
  const registeredTools = createRegisteredTools(serverConfig.name, filteredTools);

  return registeredTools.map((tool) => ({
    tool,
    execute: async (input) => {
      try {
        const result = await client.callTool(tool.originalName, input);
        return formatMcpToolResult(tool, result);
      } catch (error) {
        return {
          content:
            error instanceof Error
              ? error.message
              : `Failed to run MCP tool "${tool.name}".`,
          isError: true
        };
      }
    }
  }));
}

function formatMcpToolResult(
  tool: RegisteredTool,
  result: McpToolCallResult
): ToolExecutionResult {
  const textParts = Array.isArray(result.content)
    ? result.content
        .map((item) => formatMcpContentItem(item))
        .filter((item): item is string => item !== undefined)
    : [];
  const structured =
    result.structuredContent === undefined
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
    content:
      sections.length > 1
        ? sections.join("\n\n")
        : `Tool "${tool.name}" completed without output.`,
    isError: Boolean(result.isError)
  };
}

function formatMcpContentItem(item: unknown): string | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  if (item.type === "text" && typeof item.text === "string") {
    return item.text;
  }

  return JSON.stringify(item, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
