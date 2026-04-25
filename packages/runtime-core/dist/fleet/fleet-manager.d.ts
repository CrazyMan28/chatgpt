import { type ResponseMode } from "../modes/response-mode.js";
import type { AgentMode, FleetAgentRecord, WorkerSpec } from "../platform/types.js";
import type { ModelRuntimeManager } from "../providers/model-runtime.js";
import type { FleetStore } from "../storage/fleet-store.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionStore } from "../storage/session-store.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
export interface FleetManager {
    assign(input: {
        mode: AgentMode;
        parentSessionId: string;
        role: WorkerSpec["role"];
        style: ResponseMode;
        task: string;
    }): Promise<FleetAgentRecord>;
    getAgent(id: string): FleetAgentRecord | undefined;
    isEnabled(): boolean;
    listAgents(): readonly FleetAgentRecord[];
    pauseAgent(id: string): Promise<FleetAgentRecord | undefined>;
    restartAgent(id: string): Promise<FleetAgentRecord | undefined>;
    resumeAgent(id: string): Promise<FleetAgentRecord | undefined>;
    start(): void;
    stop(): Promise<void>;
    stopAgent(id: string): Promise<FleetAgentRecord | undefined>;
    subscribe(listener: (agents: readonly FleetAgentRecord[]) => void): () => void;
}
export interface FleetManagerDependencies {
    fleetStore?: FleetStore;
    initialAgents?: readonly FleetAgentRecord[];
    maxConcurrentAgents?: number;
    memoryStore: MemoryStore;
    modelRuntime: ModelRuntimeManager;
    sessionStore: SessionStore;
    toolRegistry: ToolRegistry;
}
export declare function createFleetManager(dependencies: FleetManagerDependencies): FleetManager;
export declare function detectFleetDelegationIntent(prompt: string): boolean;
export declare function inferFleetRoleFromPrompt(prompt: string): WorkerSpec["role"];
//# sourceMappingURL=fleet-manager.d.ts.map