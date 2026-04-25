import { PlatformDatabase } from "./database.js";
export class SqliteProjectRegistryStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async get(id) {
        const row = this.database.get(`
        SELECT data_json, path
        FROM project_registry
        WHERE name = ?
      `, id);
        return row ? parseProjectRow(row) : undefined;
    }
    async getByPath(path) {
        const row = this.database.get(`
        SELECT data_json, path
        FROM project_registry
        WHERE path = ?
      `, path);
        return row ? parseProjectRow(row) : undefined;
    }
    async list() {
        return this.database
            .all(`
          SELECT data_json, path
          FROM project_registry
          ORDER BY updated_at DESC
        `)
            .map(parseProjectRow);
    }
    async save(project) {
        this.database.run(`
        INSERT INTO project_registry(name, path, data_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          path = excluded.path,
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
      `, project.id, project.path, JSON.stringify(project), project.updatedAt);
        return project;
    }
}
function parseProjectRow(row) {
    return JSON.parse(row.data_json);
}
//# sourceMappingURL=project-registry-store.js.map