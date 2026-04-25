import type { FleetAgentRecord } from "../platform/types.js";

export interface FleetStore {
  getAgent(id: string): Promise<FleetAgentRecord | undefined>;
  listAgents(): Promise<FleetAgentRecord[]>;
  saveAgent(agent: FleetAgentRecord): Promise<FleetAgentRecord>;
}
