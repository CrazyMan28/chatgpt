import type { ModelMessage } from "../models/model-client.js";
import type { MemoryStore, MemoryRecord } from "../storage/memory-store.js";
import { type SessionSummaryState } from "../storage/session-state.js";
export interface AgentPromptContext {
    contextMessages: Extract<ModelMessage, {
        role: "system";
    }>[];
    memories: MemoryRecord[];
    recentHistory: ModelMessage[];
}
export declare function buildAgentPromptContext(input: {
    history: readonly ModelMessage[];
    memoryStore: MemoryStore;
    prompt: string;
    sessionSummary: SessionSummaryState;
    systemMessages?: readonly Extract<ModelMessage, {
        role: "system";
    }>[];
    memoryLimit?: number;
    recentMessageLimit?: number;
}): Promise<AgentPromptContext>;
export declare function buildPromptContextMessages(input: {
    memories: readonly MemoryRecord[];
    sessionSummary: SessionSummaryState;
    systemMessages?: readonly Extract<ModelMessage, {
        role: "system";
    }>[];
}): Extract<ModelMessage, {
    role: "system";
}>[];
export declare function mergeAgentTurnHistory(fullHistory: readonly ModelMessage[], recentHistory: readonly ModelMessage[], turnHistory: readonly ModelMessage[]): ModelMessage[];
//# sourceMappingURL=prompt-builder.d.ts.map