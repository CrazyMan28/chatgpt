import type {
  McpFavoriteRecord,
  McpSetRecord,
  ProjectMcpSetAssignment
} from "../platform/types.js";

export interface McpStateStore {
  assignProjectSet(assignment: ProjectMcpSetAssignment): Promise<ProjectMcpSetAssignment>;
  favorite(name: string): Promise<McpFavoriteRecord>;
  listFavorites(): Promise<McpFavoriteRecord[]>;
  listSets(): Promise<McpSetRecord[]>;
  saveSet(setRecord: McpSetRecord): Promise<McpSetRecord>;
  unassignProjectSet(projectId: string): Promise<boolean>;
  unfavorite(name: string): Promise<boolean>;
  getProjectAssignment(projectId: string): Promise<ProjectMcpSetAssignment | undefined>;
}
