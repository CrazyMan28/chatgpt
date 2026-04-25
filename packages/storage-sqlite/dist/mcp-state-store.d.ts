import type { McpFavoriteRecord, McpSetRecord, McpStateStore, ProjectMcpSetAssignment } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteMcpStateStore implements McpStateStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    assignProjectSet(assignment: ProjectMcpSetAssignment): Promise<ProjectMcpSetAssignment>;
    favorite(name: string): Promise<McpFavoriteRecord>;
    getProjectAssignment(projectId: string): Promise<ProjectMcpSetAssignment | undefined>;
    listFavorites(): Promise<McpFavoriteRecord[]>;
    listSets(): Promise<McpSetRecord[]>;
    saveSet(setRecord: McpSetRecord): Promise<McpSetRecord>;
    unassignProjectSet(projectId: string): Promise<boolean>;
    unfavorite(name: string): Promise<boolean>;
}
//# sourceMappingURL=mcp-state-store.d.ts.map