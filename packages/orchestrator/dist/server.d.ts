import type { OrchestratorRuntime } from "./runtime.js";
export interface OrchestratorServer {
    close(): Promise<void>;
    url: string;
}
export declare function startOrchestratorServer(options: {
    host?: string;
    port?: number;
    runtime: OrchestratorRuntime;
}): Promise<OrchestratorServer>;
//# sourceMappingURL=server.d.ts.map