const FACT_PREFIX_PATTERNS = [
    /^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i,
    /^(?:my|our)\s+\b.+/i,
    /^(?:i am|i'm|i prefer|i use|i work|i live|i like|we are|we use|we prefer|our team|our project)\b.+/i
];
const NON_FACT_PREFIX_PATTERNS = [
    /^(?:can|could|would|should|do|does|did|is|are|will|read|write|run|open|list|show|fix|create|build)\b/i
];
export function extractMemoryFacts(message) {
    return extractTypedMemoryFacts(message).map((fact) => fact.text);
}
export function extractTypedMemoryFacts(message) {
    const facts = splitIntoSentences(message)
        .map((sentence) => extractFact(sentence))
        .filter((fact) => fact !== undefined);
    const uniqueFacts = new Map();
    for (const fact of facts) {
        const normalizedText = normalizeFactText(fact.text);
        if (!uniqueFacts.has(normalizedText.toLowerCase())) {
            uniqueFacts.set(normalizedText.toLowerCase(), {
                text: normalizedText,
                type: fact.type
            });
        }
    }
    return [...uniqueFacts.values()];
}
function extractFact(sentence) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0 || trimmed.endsWith("?")) {
        return undefined;
    }
    if (NON_FACT_PREFIX_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return undefined;
    }
    const rememberMatch = trimmed.match(FACT_PREFIX_PATTERNS[0]);
    if (rememberMatch) {
        return {
            text: rememberMatch[1],
            type: inferMemoryFactType(rememberMatch[1])
        };
    }
    if (FACT_PREFIX_PATTERNS.slice(1).some((pattern) => pattern.test(trimmed))) {
        return {
            text: trimmed,
            type: inferMemoryFactType(trimmed)
        };
    }
    return undefined;
}
export function inferMemoryFactType(value) {
    const normalized = value.trim().toLowerCase();
    if (/\b(my name is|call me|i am|i'm|we are)\b/.test(normalized) &&
        !/\b(building|working on|developer|engineer|team)\b/.test(normalized)) {
        return "identity";
    }
    if (/\b(i prefer|we prefer|i like|we like|favorite|favourite|prefer to|prefer using)\b/.test(normalized)) {
        return "preference";
    }
    if (/\b(project|building|working on|roadmap|release|feature|product)\b/.test(normalized)) {
        return "project";
    }
    if (/\b(i use|we use|always|usually|workflow|process|routine|stack|tooling)\b/.test(normalized)) {
        return "workflow";
    }
    return "fact";
}
function splitIntoSentences(message) {
    return message
        .split(/(?<=[.!?])\s+|\n+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
}
function normalizeFactText(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
        return normalized;
    }
    const suffixed = /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
    return `${suffixed.slice(0, 1).toUpperCase()}${suffixed.slice(1)}`;
}
