import type { FleetAgentRecord, FleetStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteFleetStore implements FleetStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    getAgent(id: string): Promise<FleetAgentRecord | undefined>;
    listAgents(): Promise<FleetAgentRecord[]>;
    saveAgent(agent: FleetAgentRecord): Promise<FleetAgentRecord>;
}
//# sourceMappingURL=fleet-store.d.ts.map