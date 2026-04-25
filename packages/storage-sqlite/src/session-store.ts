import type { SessionRecord, SessionStore, SessionSummary } from "@chatgpt-code/runtime-core";
import {
  countSessionTurns,
  createInitialSessionState,
  deriveSessionTitle,
  summarizeSessionHistory
} from "@chatgpt-code/runtime-core";
import { randomBytes } from "node:crypto";

import { PlatformDatabase } from "./database.js";

interface SessionRow {
  created_at: number;
  history_json: string;
  id: string;
  summary_json: string;
  title: string;
  transcript_json: string;
  turn_count: number;
  updated_at: number;
  version: number;
}

export class SqliteSessionStore implements SessionStore {
  constructor(private readonly database: PlatformDatabase) {}

  async createSession(
    initialState?: Partial<Pick<SessionRecord, "history" | "summary" | "transcript">>
  ): Promise<SessionRecord> {
    const baseState = createInitialSessionState();
    const now = Date.now();
    const transcript = [...(initialState?.transcript ?? baseState.transcript)];
    const history = [...(initialState?.history ?? baseState.history)];
    const summary = initialState?.summary ?? summarizeSessionHistory(history, { now });
    const record = normalizeSessionRecord({
      createdAt: now,
      history,
      id: createSessionId(now),
      summary,
      title: deriveSessionTitle(transcript, history),
      transcript,
      turnCount: countSessionTurns(transcript),
      updatedAt: now,
      version: 2
    });

    return this.saveSession(record);
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.database
      .all<SessionRow>(
        `
          SELECT *
          FROM sessions
          ORDER BY updated_at DESC
        `
      )
      .map((row) => toSummary(parseSessionRow(row)));
  }

  async loadSession(id: string): Promise<SessionRecord | undefined> {
    const query = id.trim();
    const exact = this.database.get<SessionRow>(
      "SELECT * FROM sessions WHERE id = ?",
      query
    );

    if (exact) {
      return parseSessionRow(exact);
    }

    const partials = this.database.all<SessionRow>(
      "SELECT * FROM sessions WHERE id LIKE ? ORDER BY updated_at DESC",
      `${query}%`
    );

    if (partials.length === 1) {
      return parseSessionRow(partials[0]);
    }

    if (partials.length > 1) {
      throw new Error(
        `Session id "${query}" is ambiguous. Use a longer prefix or an exact id.`
      );
    }

    return undefined;
  }

  async saveSession(session: SessionRecord): Promise<SessionRecord> {
    const normalized = normalizeSessionRecord({
      ...session,
      updatedAt: Date.now()
    });

    this.database.run(
      `
        INSERT INTO sessions(
          id,
          created_at,
          updated_at,
          title,
          turn_count,
          history_json,
          transcript_json,
          summary_json,
          version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          title = excluded.title,
          turn_count = excluded.turn_count,
          history_json = excluded.history_json,
          transcript_json = excluded.transcript_json,
          summary_json = excluded.summary_json,
          version = excluded.version
      `,
      normalized.id,
      normalized.createdAt,
      normalized.updatedAt,
      normalized.title,
      normalized.turnCount,
      JSON.stringify(normalized.history),
      JSON.stringify(normalized.transcript),
      JSON.stringify(normalized.summary),
      normalized.version
    );

    return normalized;
  }
}

function normalizeSessionRecord(session: SessionRecord): SessionRecord {
  const updatedAt = session.updatedAt ?? Date.now();
  const history = [...session.history];
  const transcript = [...session.transcript];
  const summary = summarizeSessionHistory(history, { now: updatedAt });

  return {
    createdAt: session.createdAt,
    history,
    id: session.id,
    summary,
    title: deriveSessionTitle(transcript, history),
    transcript,
    turnCount: countSessionTurns(transcript),
    updatedAt,
    version: session.version ?? 2
  };
}

function parseSessionRow(row: SessionRow): SessionRecord {
  return normalizeSessionRecord({
    createdAt: row.created_at,
    history: JSON.parse(row.history_json) as SessionRecord["history"],
    id: row.id,
    summary: JSON.parse(row.summary_json) as SessionRecord["summary"],
    title: row.title,
    transcript: JSON.parse(row.transcript_json) as SessionRecord["transcript"],
    turnCount: row.turn_count,
    updatedAt: row.updated_at,
    version: row.version
  });
}

function toSummary(session: SessionRecord): SessionSummary {
  return {
    createdAt: session.createdAt,
    id: session.id,
    title: session.title,
    turnCount: session.turnCount,
    updatedAt: session.updatedAt
  };
}

function createSessionId(now: number): string {
  return `${new Date(now).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
}
