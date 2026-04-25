import type { TimelineEvent } from "@chatgpt-code/runtime-core";
import { randomBytes } from "node:crypto";

import { PlatformDatabase } from "./database.js";

export interface TimelineStore {
  filterByType(type: TimelineEvent["type"]): Promise<TimelineEvent[]>;
  listRecent(limit?: number): Promise<TimelineEvent[]>;
  record(event: Omit<TimelineEvent, "createdAt" | "id"> & Partial<Pick<TimelineEvent, "createdAt" | "id">>): Promise<TimelineEvent>;
}

interface TimelineRow {
  created_at: number;
  detail: string | null;
  id: string;
  metadata_json: string | null;
  session_id: string | null;
  summary: string;
  task_id: string | null;
  type: TimelineEvent["type"];
}

export class SqliteTimelineStore implements TimelineStore {
  constructor(private readonly database: PlatformDatabase) {}

  async filterByType(type: TimelineEvent["type"]): Promise<TimelineEvent[]> {
    return this.database
      .all<TimelineRow>(
        `
          SELECT *
          FROM timeline_events
          WHERE type = ?
          ORDER BY created_at DESC
        `,
        type
      )
      .map(parseTimelineRow);
  }

  async listRecent(limit = 20): Promise<TimelineEvent[]> {
    return this.database
      .all<TimelineRow>(
        `
          SELECT *
          FROM timeline_events
          ORDER BY created_at DESC
          LIMIT ?
        `,
        limit
      )
      .map(parseTimelineRow);
  }

  async record(
    event: Omit<TimelineEvent, "createdAt" | "id"> &
      Partial<Pick<TimelineEvent, "createdAt" | "id">>
  ): Promise<TimelineEvent> {
    const timelineEvent: TimelineEvent = {
      createdAt: event.createdAt ?? Date.now(),
      detail: event.detail,
      id: event.id ?? `evt-${randomBytes(4).toString("hex")}`,
      metadata: event.metadata,
      sessionId: event.sessionId,
      summary: event.summary,
      taskId: event.taskId,
      type: event.type
    };

    this.database.run(
      `
        INSERT INTO timeline_events(
          id,
          created_at,
          type,
          session_id,
          task_id,
          summary,
          detail,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      timelineEvent.id,
      timelineEvent.createdAt,
      timelineEvent.type,
      timelineEvent.sessionId ?? null,
      timelineEvent.taskId ?? null,
      timelineEvent.summary,
      timelineEvent.detail ?? null,
      timelineEvent.metadata ? JSON.stringify(timelineEvent.metadata) : null
    );

    return timelineEvent;
  }
}

function parseTimelineRow(row: TimelineRow): TimelineEvent {
  return {
    createdAt: row.created_at,
    detail: row.detail ?? undefined,
    id: row.id,
    metadata: row.metadata_json
      ? (JSON.parse(row.metadata_json) as Record<string, unknown>)
      : undefined,
    sessionId: row.session_id ?? undefined,
    summary: row.summary,
    taskId: row.task_id ?? undefined,
    type: row.type
  };
}
