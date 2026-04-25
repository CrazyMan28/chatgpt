export function buildMemoryContextMessages(memories) {
    if (memories.length === 0) {
        return [];
    }
    return [
        {
            role: "system",
            content: [
                "Persistent user memory:",
                ...memories.map((memory) => `- [${memory.scope}/${memory.type}] ${memory.text} (session ${memory.sessionId})`),
                "Use these memories only when they are relevant to the current request. If the current request conflicts with a memory, trust the current request."
            ].join("\n")
        }
    ];
}
//# sourceMappingURL=build-memory-context.js.map