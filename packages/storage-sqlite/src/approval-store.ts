import type {
  ApprovalRequest,
  ApprovalStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface ApprovalRow {
  created_at: number;
  detail: string;
  id: string;
  kind: ApprovalRequest["kind"];
  metadata_json: string;
  state: ApprovalRequest["state"];
  summary: string;
  updated_at: number;
}

export class SqliteApprovalStore implements ApprovalStore {
  constructor(private readonly database: PlatformDatabase) {}

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    this.database.run(
      `
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
      `,
      request.id,
      request.createdAt,
      request.updatedAt,
      request.kind,
      request.state,
      request.summary,
      request.detail,
      JSON.stringify(request)
    );

    return request;
  }

  async get(id: string): Promise<ApprovalRequest | undefined> {
    const row = this.database.get<ApprovalRow>(
      `
        SELECT *
        FROM approvals
        WHERE id = ?
      `,
      id
    );

    return row ? parseApprovalRow(row) : undefined;
  }

  async list(): Promise<ApprovalRequest[]> {
    return this.database
      .all<ApprovalRow>(
        `
          SELECT *
          FROM approvals
          ORDER BY updated_at DESC
        `
      )
      .map(parseApprovalRow);
  }

  async listPending(): Promise<ApprovalRequest[]> {
    return this.database
      .all<ApprovalRow>(
        `
          SELECT *
          FROM approvals
          WHERE state = 'pending'
          ORDER BY updated_at DESC
        `
      )
      .map(parseApprovalRow);
  }

  async update(request: ApprovalRequest): Promise<ApprovalRequest> {
    this.database.run(
      `
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
      `,
      request.id,
      request.createdAt,
      request.updatedAt,
      request.kind,
      request.state,
      request.summary,
      request.detail,
      JSON.stringify(request)
    );

    return request;
  }
}

function parseApprovalRow(row: ApprovalRow): ApprovalRequest {
  return JSON.parse(row.metadata_json) as ApprovalRequest;
}
