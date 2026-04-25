import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { countSessionTurns, createInitialSessionState, deriveSessionTitle, summarizeSessionHistory } from "./session-state.js";
const SESSION_DIRECTORY = ".chatgpt-code/sessions";
const SESSION_SCHEMA_VERSION = 2;
const SESSION_FILE_EXTENSION = ".json";
export class FileSessionStore {
    directoryPath;
    constructor(workspaceRoot = process.cwd()) {
        this.directoryPath = resolve(workspaceRoot, SESSION_DIRECTORY);
    }
    async createSession(initialState) {
        const baseState = createInitialSessionState();
        const now = Date.now();
        const transcript = [...(initialState?.transcript ?? baseState.transcript)];
        const history = [...(initialState?.history ?? baseState.history)];
        const session = normalizeSessionRecord({
            createdAt: now,
            history,
            id: createSessionId(now),
            summary: initialState?.summary ?? baseState.summary,
            title: deriveSessionTitle(transcript, history),
            transcript,
            updatedAt: now,
            version: SESSION_SCHEMA_VERSION
        });
        return this.saveSession(session);
    }
    async listSessions() {
        const filePaths = await this.listSessionFiles();
        const sessions = await Promise.all(filePaths.map(async (filePath) => {
            const session = await this.readSessionFile(filePath);
            return toSessionSummary(session);
        }));
        return sessions.sort((left, right) => right.updatedAt - left.updatedAt);
    }
    async loadSession(id) {
        const filePath = await this.resolveSessionFilePath(id);
        if (!filePath) {
            return undefined;
        }
        return this.readSessionFile(filePath);
    }
    async saveSession(session) {
        await this.ensureDirectory();
        const normalized = normalizeSessionRecord({
            ...session,
            updatedAt: Date.now(),
            version: SESSION_SCHEMA_VERSION
        });
        const filePath = this.createSessionFilePath(normalized.id);
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
        await rename(tempPath, filePath);
        return normalized;
    }
    async ensureDirectory() {
        await mkdir(this.directoryPath, { recursive: true });
    }
    createSessionFilePath(id) {
        return join(this.directoryPath, `${id}${SESSION_FILE_EXTENSION}`);
    }
    async listSessionFiles() {
        await this.ensureDirectory();
        const entries = await readdir(this.directoryPath, {
            withFileTypes: true
        });
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(SESSION_FILE_EXTENSION))
            .map((entry) => join(this.directoryPath, entry.name));
    }
    async resolveSessionFilePath(id) {
        const query = normalizeSessionIdQuery(id);
        const filePaths = await this.listSessionFiles();
        const matchingFiles = filePaths.filter((filePath) => sessionIdFromFilePath(filePath).startsWith(query));
        const exactFile = matchingFiles.find((filePath) => sessionIdFromFilePath(filePath) === query);
        if (exactFile) {
            return exactFile;
        }
        if (matchingFiles.length === 1) {
            return matchingFiles[0];
        }
        if (matchingFiles.length > 1) {
            throw new Error(`Session id "${query}" is ambiguous. Use a longer prefix or an exact id.`);
        }
        return undefined;
    }
    async readSessionFile(filePath) {
        const raw = await readFile(filePath, "utf8");
        return parseSessionRecord(JSON.parse(raw));
    }
}
function normalizeSessionRecord(value) {
    const transcript = value.transcript.map((entry) => ({ ...entry }));
    const history = value.history.map((message) => ({ ...message }));
    const updatedAt = value.updatedAt ?? Date.now();
    const summary = summarizeSessionHistory(history, { now: updatedAt });
    return {
        createdAt: value.createdAt,
        history,
        id: value.id,
        summary,
        title: deriveSessionTitle(transcript, history),
        transcript,
        turnCount: countSessionTurns(transcript),
        updatedAt,
        version: value.version ?? SESSION_SCHEMA_VERSION
    };
}
function parseSessionRecord(value) {
    if (!isRecord(value)) {
        throw new Error("Invalid session file: expected an object.");
    }
    const id = readString(value.id, "session id");
    const createdAt = readNumber(value.createdAt, "session createdAt");
    const updatedAt = readNumber(value.updatedAt, "session updatedAt");
    const history = parseHistory(value.history);
    const transcript = parseTranscript(value.transcript);
    const summary = parseOptionalSessionSummary(value.summary);
    return normalizeSessionRecord({
        createdAt,
        history,
        id,
        summary,
        transcript,
        updatedAt,
        version: readOptionalNumber(value.version) ?? SESSION_SCHEMA_VERSION
    });
}
function parseHistory(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(isModelMessage);
}
function parseTranscript(value) {
    if (!Array.isArray(value)) {
        return createInitialSessionState().transcript;
    }
    return value.filter(isTranscriptEntry);
}
function isModelMessage(value) {
    if (!isRecord(value) || typeof value.role !== "string") {
        return false;
    }
    switch (value.role) {
        case "system":
            return typeof value.content === "string";
        case "user":
            return typeof value.content === "string";
        case "assistant":
            return (typeof value.content === "string" &&
                (value.toolCalls === undefined || Array.isArray(value.toolCalls)));
        case "tool":
            return (typeof value.content === "string" &&
                typeof value.toolCallId === "string" &&
                typeof value.toolName === "string" &&
                typeof value.isError === "boolean");
        default:
            return false;
    }
}
function isTranscriptEntry(value) {
    return (isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.role === "string" &&
        typeof value.content === "string" &&
        typeof value.createdAt === "number" &&
        (value.status === undefined ||
            value.status === "complete" ||
            value.status === "streaming") &&
        (value.persisted === undefined || typeof value.persisted === "boolean"));
}
function toSessionSummary(session) {
    return {
        createdAt: session.createdAt,
        id: session.id,
        title: session.title,
        turnCount: session.turnCount,
        updatedAt: session.updatedAt
    };
}
function parseOptionalSessionSummary(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    if (typeof value.content !== "string" ||
        typeof value.summarizedMessageCount !== "number" ||
        typeof value.updatedAt !== "number") {
        return undefined;
    }
    return {
        content: value.content,
        summarizedMessageCount: value.summarizedMessageCount,
        updatedAt: value.updatedAt
    };
}
function createSessionId(timestamp) {
    const date = new Date(timestamp);
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    const second = `${date.getSeconds()}`.padStart(2, "0");
    const suffix = randomBytes(3).toString("hex");
    return `${year}${month}${day}-${hour}${minute}${second}-${suffix}`;
}
function sessionIdFromFilePath(filePath) {
    const fileName = basename(filePath);
    return fileName.slice(0, -SESSION_FILE_EXTENSION.length);
}
function normalizeSessionIdQuery(value) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error("Session id is required.");
    }
    if (normalized.includes("/") || normalized.includes("\\")) {
        throw new Error("Session id must not contain path separators.");
    }
    return normalized;
}
function readString(value, label) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Invalid ${label}: expected a non-empty string.`);
    }
    return value;
}
function readNumber(value, label) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`Invalid ${label}: expected a number.`);
    }
    return value;
}
function readOptionalNumber(value) {
    return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
