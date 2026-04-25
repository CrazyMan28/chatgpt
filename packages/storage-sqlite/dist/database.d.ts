import Database from "better-sqlite3";
export declare const DEFAULT_DATABASE_PATH = ".chatgpt-code/orchestrator.db";
export declare class PlatformDatabase {
    private readonly database;
    readonly filePath: string;
    constructor(workspaceRoot: string, filePath?: string);
    close(): void;
    exec(sql: string): void;
    get<T>(sql: string, ...parameters: unknown[]): T | undefined;
    all<T>(sql: string, ...parameters: unknown[]): T[];
    run(sql: string, ...parameters: unknown[]): Database.RunResult;
    transaction<T>(callback: () => T): T;
    setMeta(key: string, value: string): void;
    getMeta(key: string): string | undefined;
    private initialize;
    private ensureColumn;
}
//# sourceMappingURL=database.d.ts.map