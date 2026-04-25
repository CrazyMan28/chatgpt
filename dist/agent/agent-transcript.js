export function createEntryId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
export function createSystemEntry(content, persisted) {
    return {
        id: createEntryId("system"),
        role: "system",
        content,
        createdAt: Date.now(),
        persisted,
        status: "complete"
    };
}
export function createUserEntry(content) {
    return {
        id: createEntryId("user"),
        role: "user",
        content,
        createdAt: Date.now(),
        status: "complete"
    };
}
export function appendTranscriptEntry(entries, entry) {
    return [...entries, entry];
}
export function reduceTranscriptEntries(entries, event, turnId) {
    switch (event.type) {
        case "tool_started":
            return upsertTranscriptEntry(entries, {
                id: createToolEntryId(turnId, event.step, event.toolCall.id),
                role: "tool",
                content: formatToolStartMessage(event.toolCall.name),
                createdAt: Date.now(),
                status: "streaming"
            });
        case "tool_finished":
            return upsertTranscriptEntry(entries, {
                id: createToolEntryId(turnId, event.step, event.toolCall.id),
                role: "tool",
                content: formatToolResultMessage(event.toolCall.name, event.result),
                createdAt: Date.now(),
                status: "complete"
            });
        case "assistant_stream_started":
            return upsertTranscriptEntry(entries, {
                id: event.entryId,
                role: "assistant",
                content: "",
                createdAt: Date.now(),
                status: "streaming"
            });
        case "assistant_stream_delta":
            return updateTranscriptEntry(entries, event.entryId, {
                content: event.content,
                status: "streaming"
            });
        case "assistant_stream_completed":
            return upsertTranscriptEntry(entries, {
                id: event.entryId,
                role: "assistant",
                content: event.content,
                createdAt: Date.now(),
                status: "complete"
            });
        default:
            return entries;
    }
}
export function upsertTranscriptEntry(entries, nextEntry) {
    const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
    if (existingIndex === -1) {
        return [...entries, nextEntry];
    }
    return entries.map((entry, index) => index === existingIndex
        ? {
            ...entry,
            ...nextEntry,
            createdAt: entry.createdAt
        }
        : entry);
}
export function updateTranscriptEntry(entries, entryId, nextValue) {
    return entries.map((entry) => entry.id === entryId
        ? {
            ...entry,
            ...nextValue
        }
        : entry);
}
function createToolEntryId(turnId, step, toolCallId) {
    return `tool-${turnId}-${step}-${toolCallId}`;
}
function formatToolStartMessage(toolName) {
    return `Running ${toolName}…`;
}
function formatToolResultMessage(toolName, result) {
    const prefix = result.isError ? "Failed" : "Completed";
    const content = result.content.trim();
    return content.length > 0
        ? `${prefix} ${toolName}.\n\n${content}`
        : `${prefix} ${toolName}.`;
}
