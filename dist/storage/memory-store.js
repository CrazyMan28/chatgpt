import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { extractTypedMemoryFacts, inferMemoryFactType } from "../memory/extract-memory-facts.js";
import { cosineSimilarity, embedText } from "../memory/text-embedding.js";
const MEMORY_FILE_PATH = ".chatgpt-code/memory.json";
const MEMORY_SCHEMA_VERSION = 2;
const DEFAULT_RETRIEVAL_LIMIT = 4;
export class JsonMemoryStore {
    filePath;
    constructor(workspaceRoot = process.cwd()) {
        this.filePath = resolve(workspaceRoot, MEMORY_FILE_PATH);
    }
    async listMemories() {
        const snapshot = await this.readSnapshot();
        return [...snapshot.memories].sort((left, right) => right.timestamp - left.timestamp);
    }
    async rememberFromUserMessage(message, options) {
        const facts = extractTypedMemoryFacts(message);
        if (facts.length === 0) {
            return [];
        }
        const snapshot = await this.readSnapshot();
        const now = Date.now();
        const stored = [];
        for (const fact of facts) {
            const normalizedText = normalizeMemoryText(fact.text);
            const existing = snapshot.memories.find((memory) => normalizeMemoryText(memory.text) === normalizedText);
            if (existing) {
                existing.embedding = embedText(existing.text);
                existing.sessionId = options.sessionId;
                existing.text = fact.text;
                existing.timestamp = now;
                existing.type = fact.type;
                stored.push({ ...existing });
                continue;
            }
            const nextMemory = {
                embedding: embedText(fact.text),
                id: createMemoryId(),
                sessionId: options.sessionId,
                text: fact.text,
                timestamp: now,
                type: fact.type
            };
            snapshot.memories.push(nextMemory);
            stored.push({ ...nextMemory });
        }
        await this.writeSnapshot(snapshot);
        return stored.sort((left, right) => right.timestamp - left.timestamp);
    }
    async retrieveRelevantMemories(query, options) {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length === 0) {
            return [];
        }
        const snapshot = await this.readSnapshot();
        const queryEmbedding = embedText(normalizedQuery);
        const limit = options?.limit ?? DEFAULT_RETRIEVAL_LIMIT;
        return snapshot.memories
            .map((memory) => ({
            memory,
            score: scoreMemory(memory, queryEmbedding, normalizedQuery)
        }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            return right.memory.timestamp - left.memory.timestamp;
        })
            .slice(0, limit)
            .map((entry) => ({ ...entry.memory }));
    }
    async readSnapshot() {
        try {
            const raw = await readFile(this.filePath, "utf8");
            return parseSnapshot(JSON.parse(raw));
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return {
                    memories: [],
                    version: MEMORY_SCHEMA_VERSION
                };
            }
            throw error;
        }
    }
    async writeSnapshot(snapshot) {
        const normalized = normalizeSnapshot(snapshot);
        const directoryPath = dirname(this.filePath);
        await mkdir(directoryPath, { recursive: true });
        const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
        await rename(tempPath, this.filePath);
    }
}
function parseSnapshot(value) {
    if (!isRecord(value)) {
        return {
            memories: [],
            version: MEMORY_SCHEMA_VERSION
        };
    }
    const rawMemories = Array.isArray(value.memories) ? value.memories : [];
    return normalizeSnapshot({
        memories: rawMemories
            .map((memory) => parseMemoryRecord(memory))
            .filter((memory) => memory !== undefined),
        version: typeof value.version === "number" ? value.version : MEMORY_SCHEMA_VERSION
    });
}
function normalizeSnapshot(snapshot) {
    return {
        memories: snapshot.memories
            .map((memory) => ({
            ...memory,
            embedding: Array.isArray(memory.embedding) && memory.embedding.length > 0
                ? normalizeEmbedding(memory.embedding)
                : embedText(memory.text),
            text: normalizeMemoryOutputText(memory.text)
        }))
            .sort((left, right) => right.timestamp - left.timestamp),
        version: MEMORY_SCHEMA_VERSION
    };
}
function parseMemoryRecord(value) {
    if (!isRecord(value) || typeof value.id !== "string") {
        return undefined;
    }
    if (typeof value.text === "string" &&
        Array.isArray(value.embedding) &&
        typeof value.type === "string" &&
        typeof value.sessionId === "string" &&
        typeof value.timestamp === "number") {
        return {
            embedding: normalizeEmbedding(value.embedding.filter((entry) => typeof entry === "number")),
            id: value.id,
            sessionId: value.sessionId,
            text: normalizeMemoryOutputText(value.text),
            timestamp: value.timestamp,
            type: isMemoryFactType(value.type) ? value.type : "fact"
        };
    }
    if (typeof value.text !== "string") {
        return undefined;
    }
    const legacySessionId = typeof value.sourceSessionId === "string" ? value.sourceSessionId : "legacy";
    const legacyTimestamp = typeof value.updatedAt === "number"
        ? value.updatedAt
        : typeof value.createdAt === "number"
            ? value.createdAt
            : Date.now();
    return {
        embedding: embedText(value.text),
        id: value.id,
        sessionId: legacySessionId,
        text: normalizeMemoryOutputText(value.text),
        timestamp: legacyTimestamp,
        type: inferMemoryFactType(value.text)
    };
}
function scoreMemory(memory, queryEmbedding, query) {
    const similarity = cosineSimilarity(memory.embedding, queryEmbedding);
    const normalizedQuery = normalizeMemoryText(query);
    const normalizedMemoryText = normalizeMemoryText(memory.text);
    if (similarity < 0.15 &&
        !normalizedQuery.includes(normalizedMemoryText) &&
        !normalizedMemoryText.includes(normalizedQuery)) {
        return 0;
    }
    let score = similarity * 10;
    if (normalizedQuery.includes(normalizedMemoryText) ||
        normalizedMemoryText.includes(normalizedQuery)) {
        score += 2;
    }
    score += Math.max(0, 1 - (Date.now() - memory.timestamp) / 86_400_000) * 0.5;
    return score;
}
function normalizeEmbedding(embedding) {
    const numbers = embedding.map((value) => (Number.isFinite(value) ? value : 0));
    const magnitude = Math.sqrt(numbers.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) {
        return [...numbers];
    }
    return numbers.map((value) => Number((value / magnitude).toFixed(6)));
}
function normalizeMemoryText(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}
function normalizeMemoryOutputText(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
        return normalized;
    }
    return normalized;
}
function createMemoryId() {
    return `mem_${randomBytes(6).toString("hex")}`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isMemoryFactType(value) {
    return (value === "identity" ||
        value === "preference" ||
        value === "project" ||
        value === "workflow" ||
        value === "fact");
}
function isMissingFileError(error) {
    return (isRecord(error) &&
        typeof error.code === "string" &&
        error.code === "ENOENT");
}
