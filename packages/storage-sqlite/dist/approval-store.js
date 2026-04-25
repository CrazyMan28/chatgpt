import { PlatformDatabase } from "./database.js";
export class SqliteApprovalStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async create(request) {
        this.database.run(`
        INSERT INTO approvals(
          id,
          created_at,
          updated_at,
          kind,
          state,
          summary,
          detail,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, request.id, request.createdAt, request.updatedAt, request.kind, request.state, request.summary, request.detail, JSON.stringify(request));
        return request;
    }
    async get(id) {
        const row = this.database.get(`
        SELECT *
        FROM approvals
        WHERE id = ?
      `, id);
        return row ? parseApprovalRow(row) : undefined;
    }
    async list() {
        return this.database
            .all(`
          SELECT *
          FROM approvals
          ORDER BY updated_at DESC
        `)
            .map(parseApprovalRow);
    }
    async listPending() {
        return this.database
            .all(`
          SELECT *
          FROM approvals
          WHERE state = 'pending'
          ORDER BY updated_at DESC
        `)
            .map(parseApprovalRow);
    }
    async update(request) {
        this.database.run(`
        INSERT INTO approvals(
          id,
          created_at,
          updated_at,
          kind,
          state,
          summary,
          detail,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          kind = excluded.kind,
          state = excluded.state,
          summary = excluded.summary,
          detail = excluded.detail,
          metadata_json = excluded.metadata_json
      `, request.id, request.createdAt, request.updatedAt, request.kind, request.state, request.summary, request.detail, JSON.stringify(request));
        return request;
    }
}
function parseApprovalRow(row) {
    return JSON.parse(row.metadata_json);
}
//# sourceMappingURL=approval-store.js.map