export type TranscriptRole = "system" | "user" | "assistant" | "tool";
export interface TranscriptEntry {
    id: string;
    role: TranscriptRole;
    content: string;
    createdAt: number;
    persisted?: boolean;
    status?: "complete" | "streaming";
}
export interface ActiveToolEntry {
    id: string;
    isError?: boolean;
    name: string;
    startedAt: number;
    status: "running" | "complete";
    summary?: string;
}
//# sourceMappingURL=types.d.ts.map