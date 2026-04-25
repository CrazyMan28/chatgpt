const DEFAULT_SESSION_TITLE = "New session";
const MAX_SESSION_TITLE_LENGTH = 60;
export const DEFAULT_SESSION_RECENT_MESSAGE_LIMIT = 12;
const MAX_SUMMARY_POINTS = 4;
const MAX_SUMMARY_TOOL_NAMES = 6;
const MAX_SUMMARY_SNIPPET_LENGTH = 120;
export function createInitialSessionState(now = Date.now()) {
    return {
        history: [],
        summary: createEmptySessionSummary(now),
        transcript: [
            {
                id: "system-ready",
                role: "system",
                content: "Agent connected. Submit a prompt below to run a turn through the active model and tool registry.",
                createdAt: now,
                status: "complete"
            },
            {
                id: "system-hint",
                role: "system",
                content: "Use /help for commands, /login to connect a provider, /models to inspect the active provider, /model <name> to switch models, /mcp to manage MCP servers live, /plan to generate a read-only implementation plan, /build to execute plan.md after confirmation, /new to start a fresh session, /list to inspect saved sessions, and /open <id> to resume one. Tool activity streams into the transcript and the sidebar stays synced with the live registry.",
                createdAt: now + 1,
                status: "complete"
            }
        ]
    };
}
export function createEmptySessionSummary(now = Date.now()) {
    return {
        content: "",
        summarizedMessageCount: 0,
        updatedAt: now
    };
}
export function deriveSessionTitle(transcript, history) {
    const transcriptPrompt = transcript.find((entry) => entry.role === "user")?.content;
    const historyPrompt = history.find((message) => message.role === "user")?.content;
    const source = transcriptPrompt ?? historyPrompt;
    if (!source) {
        return DEFAULT_SESSION_TITLE;
    }
    return truncateTitle(source);
}
export function countSessionTurns(transcript) {
    return transcript.filter((entry) => entry.role === "user").length;
}
export function filterPersistedTranscript(transcript) {
    return transcript.filter((entry) => entry.persisted !== false);
}
export function summarizeSessionHistory(history, options) {
    const now = options?.now ?? Date.now();
    const recentMessageLimit = options?.recentMessageLimit ?? DEFAULT_SESSION_RECENT_MESSAGE_LIMIT;
    const summarizedMessages = history.slice(0, Math.max(0, history.length - recentMessageLimit));
    if (summarizedMessages.length === 0) {
        return createEmptySessionSummary(now);
    }
    const recentUserRequests = collectRecentUserSummaries(summarizedMessages);
    const recentAssistantProgress = collectRecentAssistantSummaries(summarizedMessages);
    const recentToolNames = collectRecentToolNames(summarizedMessages);
    const lines = [];
    lines.push(`Summary covers ${summarizedMessages.length} earlier messages from this session.`);
    if (recentUserRequests.length > 0) {
        lines.push(`Prior user requests: ${recentUserRequests.join(" | ")}`);
    }
    if (recentAssistantProgress.length > 0) {
        lines.push(`Prior assistant progress: ${recentAssistantProgress.join(" | ")}`);
    }
    if (recentToolNames.length > 0) {
        lines.push(`Earlier tool usage: ${recentToolNames.join(", ")}.`);
    }
    if (lines.length === 1) {
        lines.push("Earlier conversation exists but did not produce a compact summary.");
    }
    return {
        content: lines.join("\n"),
        summarizedMessageCount: summarizedMessages.length,
        updatedAt: now
    };
}
export function getRecentSessionHistory(history, options) {
    const limit = options?.limit ?? DEFAULT_SESSION_RECENT_MESSAGE_LIMIT;
    const startIndex = Math.max(0, history.length - limit);
    return history.slice(startIndex).map((message) => ({ ...message }));
}
export function buildSessionSummaryContextMessages(summary) {
    if (summary.content.trim().length === 0 || summary.summarizedMessageCount === 0) {
        return [];
    }
    return [
        {
            role: "system",
            content: [
                "Earlier session summary:",
                summary.content,
                "Use this summary as background context. Prefer the recent chat if there is any conflict."
            ].join("\n")
        }
    ];
}
function collectRecentUserSummaries(history) {
    return collectDistinctSnippets([...history]
        .reverse()
        .filter((message) => {
        return message.role === "user" && message.content.trim().length > 0;
    })
        .map((message) => truncateSnippet(message.content)), MAX_SUMMARY_POINTS);
}
function collectRecentAssistantSummaries(history) {
    return collectDistinctSnippets([...history]
        .reverse()
        .filter((message) => message.role === "assistant" && message.content.trim().length > 0)
        .map((message) => truncateSnippet(message.content)), MAX_SUMMARY_POINTS);
}
function collectRecentToolNames(history) {
    const names = [];
    for (const message of [...history].reverse()) {
        if (message.role === "assistant") {
            for (const toolCall of message.toolCalls ?? []) {
                if (toolCall.name.trim().length > 0) {
                    names.push(toolCall.name.trim());
                }
            }
        }
        if (message.role === "tool" && message.toolName.trim().length > 0) {
            names.push(message.toolName.trim());
        }
    }
    return collectDistinctSnippets(names, MAX_SUMMARY_TOOL_NAMES);
}
function collectDistinctSnippets(values, limit) {
    const seen = new Set();
    const results = [];
    for (const value of values) {
        const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        results.push(value.trim().replace(/\s+/g, " "));
        if (results.length >= limit) {
            break;
        }
    }
    return results;
}
function truncateSnippet(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= MAX_SUMMARY_SNIPPET_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_SUMMARY_SNIPPET_LENGTH - 1)}…`;
}
function truncateTitle(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
        return DEFAULT_SESSION_TITLE;
    }
    if (normalized.length <= MAX_SESSION_TITLE_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_SESSION_TITLE_LENGTH - 1)}…`;
}
