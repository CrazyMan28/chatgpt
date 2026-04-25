import type {
  WatcherRecord,
  WatcherStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface WatcherRow {
  activity_at: number | null;
  created_at: number;
  detail: string | null;
  id: string;
  metadata_json: string | null;
  project_id: string | null;
  retry_count: number | null;
  scope: string | null;
  session_id: string | null;
  status: WatcherRecord["status"];
  summary: string;
  target: string | null;
  task_id: string | null;
  type: WatcherRecord["type"];
  updated_at: number;
}

export class SqliteWatcherStore implements WatcherStore {
  constructor(private readonly database: PlatformDatabase) {}

  async create(watcher: WatcherRecord): Promise<WatcherRecord> {
    return this.update(watcher);
  }

  async get(id: string): Promise<WatcherRecord | undefined> {
    const row = this.database.get<WatcherRow>(
      `
        SELECT *
        FROM watchers
        WHERE id = ?
      `,
      id
    );

    return row ? parseWatcherRow(row) : undefined;
  }

  async list(): Promise<WatcherRecord[]> {
    return this.database
      .all<WatcherRow>(
        `
          SELECT *
          FROM watchers
          ORDER BY updated_at DESC
        `
      )
      .map(parseWatcherRow);
  }

  async listActive(): Promise<WatcherRecord[]> {
    return this.database
      .all<WatcherRow>(
        `
          SELECT *
          FROM watchers
          WHERE status IN ('active', 'healthy', 'stalled')
          ORDER BY updated_at DESC
        `
      )
      .map(parseWatcherRow);
  }

  async update(watcher: WatcherRecord): Promise<WatcherRecord> {
    this.database.run(
      `
        INSERT INTO watchers(
          id,
          created_at,
          updated_at,
          type,
          status,
          summary,
          detail,
          target,
          session_id,
          task_id,
          project_id,
          scope,
          activity_at,
          retry_count,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          type = excluded.type,
          status = excluded.status,
          summary = excluded.summary,
          detail = excluded.detail,
          target = excluded.target,
          session_id = excluded.session_id,
          task_id = excluded.task_id,
          project_id = excluded.project_id,
          scope = excluded.scope,
          activity_at = excluded.activity_at,
          retry_count = excluded.retry_count,
          metadata_json = excluded.metadata_json
      `,
      watcher.id,
      watcher.createdAt,
      watcher.updatedAt,
      watcher.type,
      watcher.status,
      watcher.summary,
      watcher.detail ?? null,
      watcher.target ?? null,
      watcher.sessionId ?? null,
      watcher.taskId ?? null,
      watcher.projectId ?? null,
      watcher.scope ?? null,
      watcher.activityAt ?? null,
      watcher.retryCount ?? null,
      watcher.metadata ? JSON.stringify(watcher.metadata) : null
    );

    return watcher;
  }
}

function parseWatcherRow(row: WatcherRow): WatcherRecord {
  return {
    activityAt: row.activity_at ?? undefined,
    createdAt: row.created_at,
    detail: row.detail ?? undefined,
    id: row.id,
    metadata: row.metadata_json
      ? (JSON.parse(row.metadata_json) as Record<string, unknown>)
      : undefined,
    projectId: row.project_id ?? undefined,
    retryCount: row.retry_count ?? undefined,
    scope: row.scope as WatcherRecord["scope"],
    sessionId: row.session_id ?? undefined,
    status: row.status,
    summary: row.summary,
    target: row.target ?? undefined,
    taskId: row.task_id ?? undefined,
    type: row.type,
    updatedAt: row.updated_at
  };
}
