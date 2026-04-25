import type { ModelMessage } from "../models/model-client.js";
import type { MemoryRecord } from "../storage/memory-store.js";

export function buildMemoryContextMessages(
  memories: readonly MemoryRecord[]
): Extract<ModelMessage, { role: "system" }>[] {
  if (memories.length === 0) {
    return [];
  }

  return [
    {
      role: "system",
      content: [
        "Persistent user memory:",
        ...memories.map(
          (memory) =>
            `- [${memory.scope}/${memory.type}] ${memory.text} (session ${memory.sessionId})`
        ),
        "Use these memories only when they are relevant to the current request. If the current request conflicts with a memory, trust the current request."
      ].join("\n")
    }
  ];
}
