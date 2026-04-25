import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { PlatformDatabase } from "./database.js";
const USER_SCOPE_KEY = "global";
export class SqliteDossierStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async generateProjectDossier(workspaceRoot) {
        const packageJsonPath = join(workspaceRoot, "package.json");
        let packageName = relative(workspaceRoot, workspaceRoot) || "project";
        let scripts = [];
        try {
            const raw = await readFile(packageJsonPath, "utf8");
            const parsed = JSON.parse(raw);
            packageName = parsed.name ?? packageName;
            scripts = Object.entries(parsed.scripts ?? {}).map(([name, command]) => `${name}: ${command}`);
        }
        catch {
            scripts = [];
        }
        return {
            architectureNotes: [
                "Workspace is organized as a multi-package TypeScript monorepo.",
                "Ink TUI, orchestrator daemon, and shared runtime packages live in the same repository."
            ],
            howToRun: scripts.filter((script) => script.startsWith("dev:") || script.startsWith("start:") || script.startsWith("dev")),
            howToTest: scripts.filter((script) => script.startsWith("test") || script.startsWith("build")),
            keyFiles: [
                "package.json",
                "chatgpt-code.config.json",
                "plan.md"
            ],
            knownIssues: [],
            mcpUsage: [
                "MCP servers are configured through chatgpt-code.config.json and reloaded live."
            ],
            purpose: `Development workspace for ${packageName}.`,
            status: "active",
            summary: `Project dossier generated from workspace files for ${packageName}.`,
            updatedAt: Date.now()
        };
    }
    async generateUserDossier(existing) {
        return {
            importantPreferences: [...(existing?.importantPreferences ?? [])],
            preferredCodingStyle: [...(existing?.preferredCodingStyle ?? ["typed", "modular"])],
            preferredName: existing?.preferredName,
            preferredProviders: [...(existing?.preferredProviders ?? [])],
            preferredTools: [...(existing?.preferredTools ?? ["read_file", "list_files"])],
            recurringWorkflows: [...(existing?.recurringWorkflows ?? [])],
            updatedAt: Date.now()
        };
    }
    async loadProjectDossier(projectKey) {
        const row = this.database.get(`
        SELECT data_json
        FROM dossiers
        WHERE kind = 'project' AND scope_key = ?
      `, projectKey);
        return row ? JSON.parse(row.data_json) : undefined;
    }
    async loadUserDossier() {
        const row = this.database.get(`
        SELECT data_json
        FROM dossiers
        WHERE kind = 'user' AND scope_key = ?
      `, USER_SCOPE_KEY);
        return row ? JSON.parse(row.data_json) : undefined;
    }
    async saveProjectDossier(projectKey, dossier) {
        this.database.run(`
        INSERT INTO dossiers(kind, scope_key, updated_at, data_json)
        VALUES ('project', ?, ?, ?)
        ON CONFLICT(kind, scope_key) DO UPDATE SET
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `, projectKey, dossier.updatedAt, JSON.stringify(dossier));
        return dossier;
    }
    async saveUserDossier(dossier) {
        this.database.run(`
        INSERT INTO dossiers(kind, scope_key, updated_at, data_json)
        VALUES ('user', ?, ?, ?)
        ON CONFLICT(kind, scope_key) DO UPDATE SET
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `, USER_SCOPE_KEY, dossier.updatedAt, JSON.stringify(dossier));
        return dossier;
    }
}
//# sourceMappingURL=dossier-store.js.map