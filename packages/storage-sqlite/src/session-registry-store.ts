import type {
  SessionClientAttachment,
  SessionRegistryEntry,
  SessionRegistryStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface SessionRegistryRow {
  data_json: string;
}

interface SessionClientRow {
  data_json: string;
}

export class SqliteSessionRegistryStore implements SessionRegistryStore {
  constructor(private readonly database: PlatformDatabase) {}

  async attachClient(
    attachment: SessionClientAttachment
  ): Promise<SessionClientAttachment> {
    this.database.run(
      `
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
      `,
      attachment.id,
      attachment.sessionId,
      attachment.clientId,
      attachment.clientType,
      attachment.attachedAt,
      attachment.detachedAt ?? null,
      attachment.isActive ? 1 : 0,
      JSON.stringify(attachment)
    );

    return attachment;
  }

  async detachClient(
    attachmentId: string
  ): Promise<SessionClientAttachment | undefined> {
    const current = await this.database
      .get<SessionClientRow>(
        `
          SELECT data_json
          FROM session_clients
          WHERE id = ?
        `,
        attachmentId
      );

    if (!current) {
      return undefined;
    }

    const parsed = JSON.parse(current.data_json) as SessionClientAttachment;
    const detached: SessionClientAttachment = {
      ...parsed,
      detachedAt: Date.now(),
      isActive: false
    };

    await this.attachClient(detached);
    return detached;
  }

  async get(sessionId: string): Promise<SessionRegistryEntry | undefined> {
    const row = this.database.get<SessionRegistryRow>(
      `
        SELECT data_json
        FROM session_registry
        WHERE session_id = ?
      `,
      sessionId
    );

    return row ? parseSessionRegistryRow(row) : undefined;
  }

  async list(): Promise<SessionRegistryEntry[]> {
    return this.database
      .all<SessionRegistryRow>(
        `
          SELECT data_json
          FROM session_registry
          ORDER BY updated_at DESC
        `
      )
      .map(parseSessionRegistryRow);
  }

  async listAttachments(sessionId: string): Promise<SessionClientAttachment[]> {
    return this.database
      .all<SessionClientRow>(
        `
          SELECT data_json
          FROM session_clients
          WHERE session_id = ?
          ORDER BY attached_at DESC
        `,
        sessionId
      )
      .map(parseSessionClientRow);
  }

  async save(entry: SessionRegistryEntry): Promise<SessionRegistryEntry> {
    this.database.run(
      `
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
      `,
      entry.sessionId,
      entry.projectId,
      entry.ownerId,
      entry.title,
      entry.mode,
      entry.style,
      entry.provider,
      entry.model,
      entry.cwd,
      entry.scope,
      entry.activeRemoteHostId ?? null,
      entry.backgroundState,
      entry.lastActivityAt,
      entry.updatedAt,
      JSON.stringify(entry)
    );

    return entry;
  }
}

function parseSessionRegistryRow(row: SessionRegistryRow): SessionRegistryEntry {
  return JSON.parse(row.data_json) as SessionRegistryEntry;
}

function parseSessionClientRow(row: SessionClientRow): SessionClientAttachment {
  return JSON.parse(row.data_json) as SessionClientAttachment;
}
