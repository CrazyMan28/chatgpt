import type { ProjectDossier, UserDossier } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export interface DossierStore {
    generateProjectDossier(workspaceRoot: string): Promise<ProjectDossier>;
    generateUserDossier(existing?: Partial<UserDossier>): Promise<UserDossier>;
    loadProjectDossier(projectKey: string): Promise<ProjectDossier | undefined>;
    loadUserDossier(): Promise<UserDossier | undefined>;
    saveProjectDossier(projectKey: string, dossier: ProjectDossier): Promise<ProjectDossier>;
    saveUserDossier(dossier: UserDossier): Promise<UserDossier>;
}
export declare class SqliteDossierStore implements DossierStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    generateProjectDossier(workspaceRoot: string): Promise<ProjectDossier>;
    generateUserDossier(existing?: Partial<UserDossier>): Promise<UserDossier>;
    loadProjectDossier(projectKey: string): Promise<ProjectDossier | undefined>;
    loadUserDossier(): Promise<UserDossier | undefined>;
    saveProjectDossier(projectKey: string, dossier: ProjectDossier): Promise<ProjectDossier>;
    saveUserDossier(dossier: UserDossier): Promise<UserDossier>;
}
//# sourceMappingURL=dossier-store.d.ts.map