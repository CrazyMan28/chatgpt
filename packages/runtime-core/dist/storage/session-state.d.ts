import type { ModelMessage } from "../models/model-client.js";
import type { TranscriptEntry } from "../ui/types.js";
export declare const DEFAULT_SESSION_RECENT_MESSAGE_LIMIT = 12;
export interface SessionSummaryState {
    content: string;
    summarizedMessageCount: number;
    updatedAt: number;
}
export interface SessionConversationState {
    history: ModelMessage[];
    summary: SessionSummaryState;
    transcript: TranscriptEntry[];
}
export declare function createInitialSessionState(now?: number): SessionConversationState;
export declare function createEmptySessionSummary(now?: number): SessionSummaryState;
export declare function deriveSessionTitle(transcript: readonly TranscriptEntry[], history: readonly ModelMessage[]): string;
export declare function countSessionTurns(transcript: readonly TranscriptEntry[]): number;
export declare function filterPersistedTranscript(transcript: readonly TranscriptEntry[]): TranscriptEntry[];
export declare function summarizeSessionHistory(history: readonly ModelMessage[], options?: {
    now?: number;
    recentMessageLimit?: number;
}): SessionSummaryState;
export declare function getRecentSessionHistory(history: readonly ModelMessage[], options?: {
    limit?: number;
}): ModelMessage[];
export declare function buildSessionSummaryContextMessages(summary: SessionSummaryState): Extract<ModelMessage, {
    role: "system";
}>[];
//# sourceMappingURL=session-state.d.ts.map