import { PlatformDatabase } from "./database.js";
export class SqliteSessionRegistryStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async attachClient(attachment) {
        this.database.run(`
        INSERT INTO session_clients(
          id,
          session_id,
          client_id,
          client_type,
          attached_at,
          detached_at,
          is_active,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          detached_at = excluded.detached_at,
          is_active = excluded.is_active,
          data_json = excluded.data_json
      `, attachment.id, attachment.sessionId, attachment.clientId, attachment.clientType, attachment.attachedAt, attachment.detachedAt ?? null, attachment.isActive ? 1 : 0, JSON.stringify(attachment));
        return attachment;
    }
    async detachClient(attachmentId) {
        const current = await this.database
            .get(`
          SELECT data_json
          FROM session_clients
          WHERE id = ?
        `, attachmentId);
        if (!current) {
            return undefined;
        }
        const parsed = JSON.parse(current.data_json);
        const detached = {
            ...parsed,
            detachedAt: Date.now(),
            isActive: false
        };
        await this.attachClient(detached);
        return detached;
    }
    async get(sessionId) {
        const row = this.database.get(`
        SELECT data_json
        FROM session_registry
        WHERE session_id = ?
      `, sessionId);
        return row ? parseSessionRegistryRow(row) : undefined;
    }
    async list() {
        return this.database
            .all(`
          SELECT data_json
          FROM session_registry
          ORDER BY updated_at DESC
        `)
            .map(parseSessionRegistryRow);
    }
    async listAttachments(sessionId) {
        return this.database
            .all(`
          SELECT data_json
          FROM session_clients
          WHERE session_id = ?
          ORDER BY attached_at DESC
        `, sessionId)
            .map(parseSessionClientRow);
    }
    async save(entry) {
        this.database.run(`
        INSERT INTO session_registry(
          session_id,
          project_id,
          owner_id,
          title,
          mode,
          style,
          provider,
          model,
          cwd,
          scope,
          active_remote_host_id,
          background_state,
          last_activity_at,
          updated_at,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          project_id = excluded.project_id,
          owner_id = excluded.owner_id,
          title = excluded.title,
          mode = excluded.mode,
          style = excluded.style,
          provider = excluded.provider,
          model = excluded.model,
          cwd = excluded.cwd,
          scope = excluded.scope,
          active_remote_host_id = excluded.active_remote_host_id,
          background_state = excluded.background_state,
          last_activity_at = excluded.last_activity_at,
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `, entry.sessionId, entry.projectId, entry.ownerId, entry.title, entry.mode, entry.style, entry.provider, entry.model, entry.cwd, entry.scope, entry.activeRemoteHostId ?? null, entry.backgroundState, entry.lastActivityAt, entry.updatedAt, JSON.stringify(entry));
        return entry;
    }
}
function parseSessionRegistryRow(row) {
    return JSON.parse(row.data_json);
}
function parseSessionClientRow(row) {
    return JSON.parse(row.data_json);
}
//# sourceMappingURL=session-registry-store.js.map