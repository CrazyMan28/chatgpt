import { extractTypedMemoryFacts, inferMemoryFactType } from "@chatgpt-code/runtime-core";
import { randomBytes } from "node:crypto";
import { cosineSimilarity, embedText } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
const DEFAULT_RETRIEVAL_LIMIT = 4;
export class SqliteMemoryStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async listMemories() {
        return this.database
            .all(`
          SELECT *
          FROM memories
          ORDER BY timestamp DESC
        `)
            .map(parseMemoryRow);
    }
    async rememberFromUserMessage(message, options) {
        const facts = extractTypedMemoryFacts(message);
        if (facts.length === 0) {
            return [];
        }
        const now = Date.now();
        const stored = [];
        for (const fact of facts) {
            emitMemoryDebugLog(`extracted ${fact.type} fact: ${fact.text}`);
            const scope = shouldPersistFactGlobally(message, fact.type)
                ? "global"
                : "workspace";
            const existing = this.database.get(`
          SELECT *
          FROM memories
          WHERE scope = ?
            AND lower(text) = lower(?)
          LIMIT 1
        `, scope, fact.text.trim());
            const nextMemory = existing
                ? {
                    ...parseMemoryRow(existing),
                    embedding: embedText(fact.text),
                    sessionId: options.sessionId,
                    scope,
                    text: fact.text,
                    timestamp: now,
                    type: fact.type
                }
                : {
                    embedding: embedText(fact.text),
                    id: createMemoryId(),
                    sessionId: options.sessionId,
                    scope,
                    text: fact.text,
                    timestamp: now,
                    type: fact.type
                };
            this.upsertMemory(scope, nextMemory);
            emitMemoryDebugLog(`stored ${scope} memory ${nextMemory.id}: ${nextMemory.text}`);
            stored.push(nextMemory);
        }
        return stored.sort((left, right) => right.timestamp - left.timestamp);
    }
    async retrieveRelevantMemories(query, options) {
        const normalized = query.trim();
        if (normalized.length === 0) {
            return [];
        }
        const limit = options?.limit ?? DEFAULT_RETRIEVAL_LIMIT;
        const queryEmbedding = embedText(normalized);
        return this.database
            .all(`
          SELECT *
          FROM memories
          ORDER BY timestamp DESC
        `)
            .map(parseMemoryRow)
            .map((memory) => ({
            memory,
            score: scoreMemory(memory, queryEmbedding, normalized)
        }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            return right.memory.timestamp - left.memory.timestamp;
        })
            .slice(0, limit)
            .map((entry) => entry.memory);
    }
    async clear(scope = "workspace") {
        this.database.run("DELETE FROM memories WHERE scope = ?", scope);
    }
    async compact() {
        const memories = await this.listMemories();
        const recent = memories.slice(0, 8);
        const goals = recent.filter((memory) => isGoalMemory(memory));
        const constraints = recent.filter((memory) => isConstraintMemory(memory));
        const taskMemory = recent.find((memory) => isTaskMemory(memory));
        const decisions = recent.filter((memory) => isDecisionMemory(memory));
        return {
            decisions: decisions.map((memory) => memory.text),
            constraints: constraints.map((memory) => memory.text),
            currentTask: taskMemory ? { summary: taskMemory.text } : {},
            goals: goals.map((memory) => memory.text),
            historySummary: recent.map((memory) => memory.text).join(" | ")
        };
    }
    async rememberGlobal(text) {
        const normalized = text.trim();
        if (normalized.length === 0) {
            throw new Error("Global memory text is required.");
        }
        const memory = {
            embedding: embedText(normalized),
            id: createMemoryId(),
            sessionId: "global",
            scope: "global",
            text: normalized,
            timestamp: Date.now(),
            type: inferMemoryFactType(normalized)
        };
        this.upsertMemory("global", memory);
        emitMemoryDebugLog(`stored global memory ${memory.id}: ${memory.text}`);
        return memory;
    }
    async forgetGlobal(key) {
        const result = this.database.run(`
        DELETE FROM memories
        WHERE scope = 'global'
          AND (id = ? OR text LIKE ?)
      `, key, `%${key}%`);
        return result.changes > 0;
    }
    async search(keyword) {
        const normalized = keyword.trim();
        if (normalized.length === 0) {
            return [];
        }
        return this.database
            .all(`
          SELECT *
          FROM memories
          WHERE lower(text) LIKE lower(?)
          ORDER BY timestamp DESC
        `, `%${normalized}%`)
            .map(parseMemoryRow);
    }
    upsertMemory(scope, memory) {
        this.database.run(`
        INSERT INTO memories(id, scope, session_id, type, text, timestamp, embedding_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          scope = excluded.scope,
          session_id = excluded.session_id,
          type = excluded.type,
          text = excluded.text,
          timestamp = excluded.timestamp,
          embedding_json = excluded.embedding_json
      `, memory.id, scope, memory.sessionId, memory.type, memory.text, memory.timestamp, JSON.stringify(memory.embedding));
    }
}
function parseMemoryRow(row) {
    return {
        embedding: JSON.parse(row.embedding_json),
        id: row.id,
        sessionId: row.session_id,
        scope: row.scope === "global" ? "global" : "workspace",
        text: row.text,
        timestamp: row.timestamp,
        type: isMemoryFactType(row.type) ? row.type : inferMemoryFactType(row.text)
    };
}
function createMemoryId() {
    return `memory-${randomBytes(4).toString("hex")}`;
}
function scoreMemory(memory, queryEmbedding, query) {
    const similarity = cosineSimilarity(memory.embedding, queryEmbedding);
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedMemoryText = memory.text.trim().toLowerCase();
    if (similarity < 0.15 &&
        !normalizedQuery.includes(normalizedMemoryText) &&
        !normalizedMemoryText.includes(normalizedQuery)) {
        return 0;
    }
    const recencyBoost = Math.max(0, 1 - (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24 * 30));
    let score = similarity + recencyBoost * 0.1;
    if (memory.scope === "global") {
        score += 0.35;
    }
    if (memory.type === "identity" && /\b(name|call me|who am i)\b/i.test(query)) {
        score += 3;
    }
    if (memory.type === "project" && /\b(project|repo|codebase|working on)\b/i.test(query)) {
        score += 1.5;
    }
    return score;
}
function isMemoryFactType(value) {
    return (value === "fact" ||
        value === "identity" ||
        value === "preference" ||
        value === "project" ||
        value === "workflow");
}
function isGoalMemory(memory) {
    return (memory.type === "project" ||
        /\b(goal|ship|release|finish|complete|roadmap)\b/i.test(memory.text));
}
function isConstraintMemory(memory) {
    return /\bmust|cannot|can't|should not|do not|constraint|limit\b/i.test(memory.text);
}
function isTaskMemory(memory) {
    return /\bcurrent task|working on|next step|implement|fix|build\b/i.test(memory.text);
}
function isDecisionMemory(memory) {
    return /\bdecided|decision|chosen|using|will use|selected\b/i.test(memory.text);
}
function shouldPersistFactGlobally(message, type) {
    return (/\b(?:remember|save)\b/i.test(message) ||
        type === "identity" ||
        type === "preference" ||
        type === "workflow" ||
        type === "project");
}
function emitMemoryDebugLog(message) {
    if (process.env.CHATGPT_CODE_DEBUG !== "1") {
        return;
    }
    process.stderr.write(`[memory] ${message}\n`);
}
//# sourceMappingURL=memory-store.js.map