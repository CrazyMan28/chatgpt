import { PlatformDatabase } from "./database.js";
export class SqliteMcpStateStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async assignProjectSet(assignment) {
        this.database.run(`
        INSERT INTO project_mcp_assignments(project_id, set_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          set_id = excluded.set_id,
          updated_at = excluded.updated_at
      `, assignment.projectId, assignment.setId, assignment.createdAt, assignment.updatedAt);
        return assignment;
    }
    async favorite(name) {
        const now = Date.now();
        const record = {
            createdAt: now,
            name,
            updatedAt: now
        };
        this.database.run(`
        INSERT INTO mcp_favorites(name, created_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          updated_at = excluded.updated_at
      `, record.name, record.createdAt, record.updatedAt);
        return record;
    }
    async getProjectAssignment(projectId) {
        const row = this.database.get(`
        SELECT project_id, set_id, created_at, updated_at
        FROM project_mcp_assignments
        WHERE project_id = ?
      `, projectId);
        return row
            ? {
                createdAt: row.created_at,
                projectId: row.project_id,
                setId: row.set_id,
                updatedAt: row.updated_at
            }
            : undefined;
    }
    async listFavorites() {
        return this.database
            .all(`
          SELECT name, created_at, updated_at
          FROM mcp_favorites
          ORDER BY updated_at DESC
        `)
            .map((row) => ({
            createdAt: row.created_at,
            name: row.name,
            updatedAt: row.updated_at
        }));
    }
    async listSets() {
        return this.database
            .all(`
          SELECT data_json
          FROM mcp_sets
          ORDER BY updated_at DESC
        `)
            .map((row) => JSON.parse(row.data_json));
    }
    async saveSet(setRecord) {
        this.database.run(`
        INSERT INTO mcp_sets(id, name, created_at, updated_at, data_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `, setRecord.id, setRecord.name, setRecord.createdAt, setRecord.updatedAt, JSON.stringify(setRecord));
        return setRecord;
    }
    async unassignProjectSet(projectId) {
        const result = this.database.run(`
        DELETE FROM project_mcp_assignments
        WHERE project_id = ?
      `, projectId);
        return result.changes > 0;
    }
    async unfavorite(name) {
        const result = this.database.run(`
        DELETE FROM mcp_favorites
        WHERE name = ?
      `, name);
        return result.changes > 0;
    }
}
//# sourceMappingURL=mcp-state-store.js.map