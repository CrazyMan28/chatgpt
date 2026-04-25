import { randomBytes } from "node:crypto";
import { PlatformDatabase } from "./database.js";
export class SqliteTimelineStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async filterByType(type) {
        return this.database
            .all(`
          SELECT *
          FROM timeline_events
          WHERE type = ?
          ORDER BY created_at DESC
        `, type)
            .map(parseTimelineRow);
    }
    async listRecent(limit = 20) {
        return this.database
            .all(`
          SELECT *
          FROM timeline_events
          ORDER BY created_at DESC
          LIMIT ?
        `, limit)
            .map(parseTimelineRow);
    }
    async record(event) {
        const timelineEvent = {
            createdAt: event.createdAt ?? Date.now(),
            detail: event.detail,
            id: event.id ?? `evt-${randomBytes(4).toString("hex")}`,
            metadata: event.metadata,
            sessionId: event.sessionId,
            summary: event.summary,
            taskId: event.taskId,
            type: event.type
        };
        this.database.run(`
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
      `, timelineEvent.id, timelineEvent.createdAt, timelineEvent.type, timelineEvent.sessionId ?? null, timelineEvent.taskId ?? null, timelineEvent.summary, timelineEvent.detail ?? null, timelineEvent.metadata ? JSON.stringify(timelineEvent.metadata) : null);
        return timelineEvent;
    }
}
function parseTimelineRow(row) {
    return {
        createdAt: row.created_at,
        detail: row.detail ?? undefined,
        id: row.id,
        metadata: row.metadata_json
            ? JSON.parse(row.metadata_json)
            : undefined,
        sessionId: row.session_id ?? undefined,
        summary: row.summary,
        taskId: row.task_id ?? undefined,
        type: row.type
    };
}
//# sourceMappingURL=timeline-store.js.map