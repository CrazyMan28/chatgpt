import type {
  FleetAgentRecord,
  FleetStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface FleetAgentRow {
  data_json: string;
}

export class SqliteFleetStore implements FleetStore {
  constructor(private readonly database: PlatformDatabase) {}

  async getAgent(id: string): Promise<FleetAgentRecord | undefined> {
    const row = this.database.get<FleetAgentRow>(
      `
        SELECT data_json
        FROM fleet_assignments
        WHERE id = ?
      `,
      id
    );

    return row ? (JSON.parse(row.data_json) as FleetAgentRecord) : undefined;
  }

  async listAgents(): Promise<FleetAgentRecord[]> {
    return this.database
      .all<FleetAgentRow>(
        `
          SELECT data_json
          FROM fleet_assignments
          ORDER BY updated_at DESC
        `
      )
      .map((row) => JSON.parse(row.data_json) as FleetAgentRecord);
  }

  async saveAgent(agent: FleetAgentRecord): Promise<FleetAgentRecord> {
    this.database.run(
      `
        INSERT INTO fleet_assignments(
          id,
          agent_id,
          parent_session_id,
          worker_session_id,
          role,
          state,
          task,
          created_at,
          updated_at,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          agent_id = excluded.agent_id,
          parent_session_id = excluded.parent_session_id,
          worker_session_id = excluded.worker_session_id,
          role = excluded.role,
          state = excluded.state,
          task = excluded.task,
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `,
      agent.id,
      agent.id,
      agent.parentSessionId,
      agent.workerSessionId ?? null,
      agent.role,
      agent.state,
      agent.task,
      agent.createdAt,
      agent.updatedAt,
      JSON.stringify(agent)
    );

    return agent;
  }
}
