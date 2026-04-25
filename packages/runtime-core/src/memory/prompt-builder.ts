import type {
  ModelMessage
} from "../models/model-client.js";
import type { MemoryStore, MemoryRecord } from "../storage/memory-store.js";
import {
  buildSessionSummaryContextMessages,
  getRecentSessionHistory,
  type SessionSummaryState
} from "../storage/session-state.js";

import { buildMemoryContextMessages } from "./build-memory-context.js";

const DEFAULT_MEMORY_RETRIEVAL_LIMIT = 4;

export interface AgentPromptContext {
  contextMessages: Extract<ModelMessage, { role: "system" }>[];
  memories: MemoryRecord[];
  recentHistory: ModelMessage[];
}

export async function buildAgentPromptContext(input: {
  history: readonly ModelMessage[];
  memoryStore: MemoryStore;
  prompt: string;
  sessionSummary: SessionSummaryState;
  systemMessages?: readonly Extract<ModelMessage, { role: "system" }>[];
  memoryLimit?: number;
  recentMessageLimit?: number;
}): Promise<AgentPromptContext> {
  const memories = await input.memoryStore.retrieveRelevantMemories(input.prompt, {
    limit: input.memoryLimit ?? DEFAULT_MEMORY_RETRIEVAL_LIMIT
  });
  if (memories.length > 0) {
    emitPromptMemoryDebugLog(
      `recalled ${memories.length} memories for "${input.prompt.trim()}": ${memories
        .map((memory) => `${memory.scope}:${memory.type}:${memory.text}`)
        .join(" | ")}`
    );
  }

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

export function buildPromptContextMessages(input: {
  memories: readonly MemoryRecord[];
  sessionSummary: SessionSummaryState;
  systemMessages?: readonly Extract<ModelMessage, { role: "system" }>[];
}): Extract<ModelMessage, { role: "system" }>[] {
  return [
    ...(input.systemMessages?.map((message) => ({ ...message })) ?? []),
    ...buildSessionSummaryContextMessages(input.sessionSummary),
    ...buildMemoryContextMessages(input.memories)
  ];
}

export function mergeAgentTurnHistory(
  fullHistory: readonly ModelMessage[],
  recentHistory: readonly ModelMessage[],
  turnHistory: readonly ModelMessage[]
): ModelMessage[] {
  const appendedMessages = turnHistory.slice(recentHistory.length).map((message) => ({
    ...message
  }));

  return [...fullHistory.map((message) => ({ ...message })), ...appendedMessages];
}

function emitPromptMemoryDebugLog(message: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[memory] ${message}\n`);
}
