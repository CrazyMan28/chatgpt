import type {
  ProjectRecord,
  ProjectRegistryStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface ProjectRegistryRow {
  data_json: string;
  path: string;
}

export class SqliteProjectRegistryStore implements ProjectRegistryStore {
  constructor(private readonly database: PlatformDatabase) {}

  async get(id: string): Promise<ProjectRecord | undefined> {
    const row = this.database.get<ProjectRegistryRow>(
      `
        SELECT data_json, path
        FROM project_registry
        WHERE name = ?
      `,
      id
    );

    return row ? parseProjectRow(row) : undefined;
  }

  async getByPath(path: string): Promise<ProjectRecord | undefined> {
    const row = this.database.get<ProjectRegistryRow>(
      `
        SELECT data_json, path
        FROM project_registry
        WHERE path = ?
      `,
      path
    );

    return row ? parseProjectRow(row) : undefined;
  }

  async list(): Promise<ProjectRecord[]> {
    return this.database
      .all<ProjectRegistryRow>(
        `
          SELECT data_json, path
          FROM project_registry
          ORDER BY updated_at DESC
        `
      )
      .map(parseProjectRow);
  }

  async save(project: ProjectRecord): Promise<ProjectRecord> {
    this.database.run(
      `
        INSERT INTO project_registry(name, path, data_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          path = excluded.path,
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
      `,
      project.id,
      project.path,
      JSON.stringify(project),
      project.updatedAt
    );

    return project;
  }
}

function parseProjectRow(row: ProjectRegistryRow): ProjectRecord {
  return JSON.parse(row.data_json) as ProjectRecord;
}
