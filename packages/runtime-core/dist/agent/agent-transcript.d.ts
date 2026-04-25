import type { AgentTurnEvent } from "./run-agent-turn.js";
import type { TranscriptEntry } from "../ui/types.js";
export declare function createEntryId(prefix: string): string;
export declare function createSystemEntry(content: string, persisted: boolean): TranscriptEntry;
export declare function createUserEntry(content: string): TranscriptEntry;
export declare function appendTranscriptEntry(entries: readonly TranscriptEntry[], entry: TranscriptEntry): TranscriptEntry[];
export declare function reduceTranscriptEntries(entries: readonly TranscriptEntry[], event: AgentTurnEvent, turnId: string | number): TranscriptEntry[];
export declare function upsertTranscriptEntry(entries: readonly TranscriptEntry[], nextEntry: TranscriptEntry): TranscriptEntry[];
export declare function updateTranscriptEntry(entries: readonly TranscriptEntry[], entryId: string, nextValue: Pick<TranscriptEntry, "content" | "status">): TranscriptEntry[];
//# sourceMappingURL=agent-transcript.d.ts.map