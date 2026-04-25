import type { McpServerConfig } from "../mcp/mcp-server-config.js";
import type { ExecutionContext } from "../platform/types.js";
import type { ApprovalManager } from "../platform/approval-manager.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import { type RemoteToolExecutor } from "./core-tools.js";
import { InMemoryToolRegistry } from "./tool-registry.js";
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
export declare function loadToolRegistry(serverConfigs: readonly McpServerConfig[], workspaceRootOrOptions?: string | ToolRegistryRuntimeOptions): Promise<LoadedToolRegistry>;
//# sourceMappingURL=load-tool-registry.d.ts.map