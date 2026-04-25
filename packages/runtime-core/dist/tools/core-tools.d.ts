import type { ApprovalManager } from "../platform/approval-manager.js";
import type { ExecutionContext } from "../platform/types.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import type { ToolExecutionResult, ToolRegistration } from "./tool-registry.js";
export interface RemoteToolExecutor {
    listFiles(input: {
        hostId: string;
        maxDepth: number;
        maxEntries: number;
        path: string;
    }): Promise<ToolExecutionResult>;
    readFile(input: {
        hostId: string;
        path: string;
    }): Promise<ToolExecutionResult>;
    runCommand(input: {
        args: string[];
        command: string;
        cwd?: string;
        hostId: string;
        timeoutMs: number;
    }): Promise<ToolExecutionResult>;
    writeFile(input: {
        content: string;
        hostId: string;
        path: string;
    }): Promise<ToolExecutionResult>;
}
export interface CoreToolOptions {
    approvalManager?: ApprovalManager;
    getExecutionContext?: () => ExecutionContext;
    remoteExecutor?: RemoteToolExecutor;
    watcherStore?: WatcherStore;
    workspaceRoot: string;
}
export declare function createCoreToolRegistrations(options: CoreToolOptions): ToolRegistration[];
//# sourceMappingURL=core-tools.d.ts.map