import type { ProjectRecord } from "../platform/types.js";
export interface ProjectRegistryStore {
    get(id: string): Promise<ProjectRecord | undefined>;
    getByPath(path: string): Promise<ProjectRecord | undefined>;
    list(): Promise<ProjectRecord[]>;
    save(project: ProjectRecord): Promise<ProjectRecord>;
}
//# sourceMappingURL=project-registry-store.d.ts.map