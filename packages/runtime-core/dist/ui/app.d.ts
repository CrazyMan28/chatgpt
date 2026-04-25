import { type FleetManager } from "../fleet/fleet-manager.js";
import type { GoalStore } from "../goals/goal-store.js";
import { type ExecutionMode } from "../modes/execution-mode.js";
import { type PlanDocument, type PlanStep } from "../plan/plan-workflow.js";
import { type McpManager } from "../mcp/mcp-manager.js";
import type { ApprovalManager, ApprovalManagerStatus } from "../platform/approval-manager.js";
import type { ExecutionContextController } from "../platform/execution-context.js";
import type { ModelRuntimeManager } from "../providers/model-runtime.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRecord, SessionStore } from "../storage/session-store.js";
import type { ProjectRegistryStore } from "../storage/project-registry-store.js";
import type { SessionRegistryStore } from "../storage/session-registry-store.js";
import type { BackgroundTaskRunner } from "../tasks/background-task-runner.js";
import type { LoadedToolRegistry } from "../tools/load-tool-registry.js";
import type { TimelineStore } from "../storage/timeline-store.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import type { TranscriptEntry } from "./types.js";
import type { ApprovalPolicyPreset, ExecutionContext, ProjectRecord, WorkerSpec } from "../platform/types.js";
interface RemoteWorkerView {
    currentTask?: string;
    host: string;
    id: string;
    name: string;
    role: string;
    status: string;
}
interface ResumableBuildState {
    canResume: boolean;
    completedSteps: readonly PlanStep[];
    message: string;
    startStepIndex: number;
}
export interface AppProps {
    approvalManager: ApprovalManager;
    executionContextController: ExecutionContextController;
    fleetManager?: FleetManager;
    goalStore?: GoalStore;
    initialSession: SessionRecord;
    memoryStore: MemoryStore;
    mcpManager: McpManager;
    modelRuntime: ModelRuntimeManager;
    projectRecord: ProjectRecord;
    projectRegistryStore: ProjectRegistryStore;
    remoteManager?: {
        add(agent: {
            capabilities: string[];
            connectionType: "ssh" | "local" | "container" | "subprocess";
            host: string;
            id: string;
            name: string;
            password?: string;
            port?: number;
            role: WorkerSpec["role"];
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
        list(): Promise<readonly RemoteWorkerView[]>;
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
    sessionRegistryStore: SessionRegistryStore;
    sessionStore: SessionStore;
    taskRunner: BackgroundTaskRunner;
    toolRegistry: LoadedToolRegistry;
    timelineStore?: TimelineStore;
    watcherStore?: WatcherStore;
    workspaceRoot: string;
}
export declare function App({ approvalManager, executionContextController, fleetManager, goalStore, initialSession, memoryStore, mcpManager, modelRuntime, projectRecord, projectRegistryStore, remoteManager, sessionRegistryStore, sessionStore, taskRunner, toolRegistry, timelineStore, watcherStore, workspaceRoot }: AppProps): React.JSX.Element;
export declare function runAgentTurnWithRateLimitRecovery<T>(input: {
    onRetry?: (input: {
        attempt: number;
        delayMs: number;
        error: unknown;
    }) => void | Promise<void>;
    run: () => Promise<T>;
}): Promise<T>;
export declare function deriveResumableBuildState(transcript: readonly TranscriptEntry[], plan: PlanDocument): ResumableBuildState;
export declare function formatAutopilotStatus(input: {
    approvalStatus: ApprovalManagerStatus;
    autopilotEnabled: boolean;
    context: ExecutionContext;
    executionMode: ExecutionMode;
    isBusy: boolean;
    pendingApprovalCount: number;
}): string;
export declare function parseApprovalShortcutIntent(input: string, context: {
    activeSessionId?: string;
    activeTaskId?: string;
    pendingApprovalCount: number;
}): {
    approveLatestPending?: boolean;
    enableAutopilot?: boolean;
    policy?: ApprovalPolicyPreset;
    rerunBlockedTask: boolean;
    scope?: "once" | "task" | "session" | "all";
    summary: string;
} | undefined;
export {};
//# sourceMappingURL=app.d.ts.map