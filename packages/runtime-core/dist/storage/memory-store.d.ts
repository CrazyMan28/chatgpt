import { type MemoryFactType } from "../memory/extract-memory-facts.js";
export type MemoryScope = "global" | "workspace";
export interface MemoryRecord {
    embedding: number[];
    id: string;
    sessionId: string;
    scope: MemoryScope;
    text: string;
    timestamp: number;
    type: MemoryFactType;
}
export interface MemoryStore {
    listMemories(): Promise<MemoryRecord[]>;
    rememberFromUserMessage(message: string, options: {
        sessionId: string;
    }): Promise<MemoryRecord[]>;
    retrieveRelevantMemories(query: string, options?: {
        limit?: number;
    }): Promise<MemoryRecord[]>;
}
export declare class JsonMemoryStore implements MemoryStore {
    private readonly filePath;
    constructor(workspaceRoot?: string);
    listMemories(): Promise<MemoryRecord[]>;
    rememberFromUserMessage(message: string, options: {
        sessionId: string;
    }): Promise<MemoryRecord[]>;
    retrieveRelevantMemories(query: string, options?: {
        limit?: number;
    }): Promise<MemoryRecord[]>;
    clear(scope?: MemoryScope): Promise<void>;
    compact(): Promise<{
        decisions: string[];
        constraints: string[];
        currentTask: Record<string, unknown>;
        goals: string[];
        historySummary: string;
    }>;
    private readSnapshot;
    private writeSnapshot;
}
//# sourceMappingURL=memory-store.d.ts.map