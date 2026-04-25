import type { SessionRecord, SessionStore, SessionSummary } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteSessionStore implements SessionStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    createSession(initialState?: Partial<Pick<SessionRecord, "history" | "summary" | "transcript">>): Promise<SessionRecord>;
    listSessions(): Promise<SessionSummary[]>;
    loadSession(id: string): Promise<SessionRecord | undefined>;
    saveSession(session: SessionRecord): Promise<SessionRecord>;
}
//# sourceMappingURL=session-store.d.ts.map