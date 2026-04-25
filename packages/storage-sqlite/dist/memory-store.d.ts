import { type MemoryRecord, type MemoryStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export interface ExtendedMemoryStore extends MemoryStore {
    clear(scope?: "global" | "workspace"): Promise<void>;
    compact(): Promise<{
        decisions: string[];
        constraints: string[];
        currentTask: Record<string, unknown>;
        goals: string[];
        historySummary: string;
    }>;
    forgetGlobal(key: string): Promise<boolean>;
    rememberGlobal(text: string): Promise<MemoryRecord>;
    search(keyword: string): Promise<MemoryRecord[]>;
}
export declare class SqliteMemoryStore implements ExtendedMemoryStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    listMemories(): Promise<MemoryRecord[]>;
    rememberFromUserMessage(message: string, options: {
        sessionId: string;
    }): Promise<MemoryRecord[]>;
    retrieveRelevantMemories(query: string, options?: {
        limit?: number;
    }): Promise<MemoryRecord[]>;
    clear(scope?: "global" | "workspace"): Promise<void>;
    compact(): Promise<{
        decisions: string[];
        constraints: string[];
        currentTask: Record<string, unknown>;
        goals: string[];
        historySummary: string;
    }>;
    rememberGlobal(text: string): Promise<MemoryRecord>;
    forgetGlobal(key: string): Promise<boolean>;
    search(keyword: string): Promise<MemoryRecord[]>;
    private upsertMemory;
}
//# sourceMappingURL=memory-store.d.ts.map