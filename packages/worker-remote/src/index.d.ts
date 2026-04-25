import type { ToolExecutionResult, WorkerSpec } from "@chatgpt-code/runtime-core";
export interface RemoteAgentDefinition extends WorkerSpec {
    host: string;
    port?: number;
    username?: string;
    workingDirectory?: string;
    env?: Record<string, string>;
}
export interface RemoteWorkerRegistry {
    add(agent: RemoteAgentDefinition): Promise<RemoteAgentDefinition>;
    connect(id: string): Promise<RemoteAgentDefinition>;
    disconnect(id: string): Promise<RemoteAgentDefinition>;
    get(id: string): Promise<RemoteAgentDefinition | undefined>;
    list(): Promise<RemoteAgentDefinition[]>;
    remove(id: string): Promise<boolean>;
    runCommand(id: string, command: string, args?: string[]): Promise<{
        code: number | null;
        stderr: string;
        stdout: string;
    }>;
    testConnection(id: string): Promise<{
        ok: boolean;
        output: string;
    }>;
}
export interface CreateRemoteWorkerRegistryOptions {
    workspaceRoot?: string;
}
export declare function createRemoteWorkerRegistry(options?: CreateRemoteWorkerRegistryOptions): RemoteWorkerRegistry;
export declare function createRemoteToolExecutor(registry: RemoteWorkerRegistry): {
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
};
//# sourceMappingURL=index.d.ts.map