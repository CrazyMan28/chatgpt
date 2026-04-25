import type { ModelMessage } from "../models/model-client.js";
import type { TranscriptEntry } from "../ui/types.js";
import { type SessionSummaryState } from "./session-state.js";
export interface SessionSummary {
    createdAt: number;
    id: string;
    title: string;
    turnCount: number;
    updatedAt: number;
}
export interface SessionRecord extends SessionSummary {
    history: ModelMessage[];
    summary: SessionSummaryState;
    transcript: TranscriptEntry[];
    version: number;
}
export interface SessionStore {
    createSession(initialState?: Partial<Pick<SessionRecord, "history" | "summary" | "transcript">>): Promise<SessionRecord>;
    listSessions(): Promise<SessionSummary[]>;
    loadSession(id: string): Promise<SessionRecord | undefined>;
    saveSession(session: SessionRecord): Promise<SessionRecord>;
}
export declare class FileSessionStore implements SessionStore {
    private readonly directoryPath;
    constructor(workspaceRoot?: string);
    createSession(initialState?: Partial<Pick<SessionRecord, "history" | "summary" | "transcript">>): Promise<SessionRecord>;
    listSessions(): Promise<SessionSummary[]>;
    loadSession(id: string): Promise<SessionRecord | undefined>;
    saveSession(session: SessionRecord): Promise<SessionRecord>;
    private ensureDirectory;
    private createSessionFilePath;
    private listSessionFiles;
    private resolveSessionFilePath;
    private readSessionFile;
}
//# sourceMappingURL=session-store.d.ts.map