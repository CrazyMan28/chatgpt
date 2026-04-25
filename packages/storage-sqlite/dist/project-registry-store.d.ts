import type { ProjectRecord, ProjectRegistryStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteProjectRegistryStore implements ProjectRegistryStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    get(id: string): Promise<ProjectRecord | undefined>;
    getByPath(path: string): Promise<ProjectRecord | undefined>;
    list(): Promise<ProjectRecord[]>;
    save(project: ProjectRecord): Promise<ProjectRecord>;
}
//# sourceMappingURL=project-registry-store.d.ts.map