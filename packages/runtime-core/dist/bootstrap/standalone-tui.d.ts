import type { AuthStore } from "../auth/auth-store.js";
import type { ApprovalStore } from "../storage/approval-store.js";
import type { FleetStore } from "../storage/fleet-store.js";
import type { ProjectRegistryStore } from "../storage/project-registry-store.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRegistryStore } from "../storage/session-registry-store.js";
import type { SessionStore } from "../storage/session-store.js";
import type { TaskStore } from "../storage/task-store.js";
import type { TimelineStore } from "../storage/timeline-store.js";
import type { WatcherStore } from "../storage/watcher-store.js";
type StandaloneRemoteManager = {
    add(agent: {
        capabilities: string[];
        connectionType: "ssh" | "local" | "container" | "subprocess";
        host: string;
        id: string;
        name: string;
        password?: string;
        port?: number;
        role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
        status: "idle" | "running" | "waiting" | "degraded" | "offline";
        username?: string;
        workingDirectory?: string;
    }): Promise<unknown>;
    connect(id: string): Promise<{
        status: string;
    }>;
    disconnect(id: string): Promise<{
        status: string;
    }>;
    get(id: string): Promise<unknown>;
    list(): Promise<readonly {
        currentTask?: string;
        host: string;
        id: string;
        name: string;
        role: string;
        status: string;
    }[]>;
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
};
export interface StandaloneTuiDependencies {
    approvalStore: ApprovalStore;
    authStore: AuthStore;
    fleetStore?: FleetStore;
    memoryStore: MemoryStore;
    projectRegistryStore: ProjectRegistryStore;
    remoteManager?: StandaloneRemoteManager;
    sessionRegistryStore: SessionRegistryStore;
    sessionStore: SessionStore;
    taskStore: TaskStore;
    timelineStore?: TimelineStore;
    watcherStore?: WatcherStore;
    workspaceRoot: string;
}
export declare function runStandaloneTui({ approvalStore, authStore, fleetStore, memoryStore, projectRegistryStore, remoteManager, sessionRegistryStore, sessionStore, taskStore, timelineStore, watcherStore, workspaceRoot }: StandaloneTuiDependencies): Promise<void>;
export {};
//# sourceMappingURL=standalone-tui.d.ts.map