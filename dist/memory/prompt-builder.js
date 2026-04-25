import { buildSessionSummaryContextMessages, getRecentSessionHistory } from "../storage/session-state.js";
import { buildMemoryContextMessages } from "./build-memory-context.js";
const DEFAULT_MEMORY_RETRIEVAL_LIMIT = 4;
export async function buildAgentPromptContext(input) {
    const memories = await input.memoryStore.retrieveRelevantMemories(input.prompt, {
        limit: input.memoryLimit ?? DEFAULT_MEMORY_RETRIEVAL_LIMIT
    });
    return {
        contextMessages: buildPromptContextMessages({
            memories,
            sessionSummary: input.sessionSummary,
            systemMessages: input.systemMessages
        }),
        memories,
        recentHistory: getRecentSessionHistory(input.history, {
            limit: input.recentMessageLimit
        })
    };
}
export function buildPromptContextMessages(input) {
    return [
        ...(input.systemMessages?.map((message) => ({ ...message })) ?? []),
        ...buildSessionSummaryContextMessages(input.sessionSummary),
        ...buildMemoryContextMessages(input.memories)
    ];
}
export function mergeAgentTurnHistory(fullHistory, recentHistory, turnHistory) {
    const appendedMessages = turnHistory.slice(recentHistory.length).map((message) => ({
        ...message
    }));
    return [...fullHistory.map((message) => ({ ...message })), ...appendedMessages];
}
