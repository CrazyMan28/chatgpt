import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const TASK_FILE_PATH = ".chatgpt-code/tasks.json";
const TASK_SCHEMA_VERSION = 2;
const DEFAULT_TASK_KIND = "scheduled";
const AUTO_ACTION_HISTORY_LIMIT = 12;
const AUTO_COMPLETED_TASK_LIMIT = 24;
export class JsonTaskStore {
    filePath;
    constructor(workspaceRoot = process.cwd()) {
        this.filePath = resolve(workspaceRoot, TASK_FILE_PATH);
    }
    async createTask(input) {
        const snapshot = await this.readSnapshot();
        const now = Date.now();
        const task = normalizeTask({
            autoState: input.autoState,
            createdAt: now,
            id: createTaskId(),
            intervalMinutes: input.intervalMinutes,
            kind: input.kind ?? DEFAULT_TASK_KIND,
            nextRunAt: now + minutesToMilliseconds(input.intervalMinutes),
            prompt: input.prompt,
            runCount: 0,
            sessionId: input.sessionId,
            updatedAt: now
        });
        snapshot.tasks.push(task);
        await this.writeSnapshot(snapshot);
        return task;
    }
    async deleteTask(id) {
        const snapshot = await this.readSnapshot();
        const nextTasks = snapshot.tasks.filter((task) => task.id !== id);
        if (nextTasks.length === snapshot.tasks.length) {
            return false;
        }
        await this.writeSnapshot({
            ...snapshot,
            tasks: nextTasks
        });
        return true;
    }
    async listTasks() {
        const snapshot = await this.readSnapshot();
        return [...snapshot.tasks].sort((left, right) => left.nextRunAt - right.nextRunAt);
    }
    async loadTask(id) {
        const snapshot = await this.readSnapshot();
        return snapshot.tasks.find((task) => task.id === id);
    }
    async saveTask(task) {
        const snapshot = await this.readSnapshot();
        const normalized = normalizeTask({
            ...task,
            updatedAt: Date.now()
        });
        const existingIndex = snapshot.tasks.findIndex((entry) => entry.id === normalized.id);
        if (existingIndex === -1) {
            snapshot.tasks.push(normalized);
        }
        else {
            snapshot.tasks[existingIndex] = normalized;
        }
        await this.writeSnapshot(snapshot);
        return normalized;
    }
    async readSnapshot() {
        try {
            const raw = await readFile(this.filePath, "utf8");
            return parseSnapshot(JSON.parse(raw));
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return {
                    tasks: [],
                    version: TASK_SCHEMA_VERSION
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
            tasks: [],
            version: TASK_SCHEMA_VERSION
        };
    }
    return normalizeSnapshot({
        tasks: Array.isArray(value.tasks)
            ? value.tasks
                .map((task) => parseTaskRecord(task))
                .filter((task) => task !== undefined)
            : [],
        version: typeof value.version === "number" ? value.version : TASK_SCHEMA_VERSION
    });
}
function normalizeSnapshot(snapshot) {
    return {
        tasks: snapshot.tasks.map((task) => normalizeTask(task)),
        version: TASK_SCHEMA_VERSION
    };
}
function normalizeTask(task) {
    return {
        ...task,
        autoState: task.kind === "auto"
            ? normalizeAutoModeState(task.autoState)
            : undefined,
        intervalMinutes: normalizeInterval(task.intervalMinutes),
        kind: task.kind ?? DEFAULT_TASK_KIND,
        prompt: task.prompt.trim(),
        updatedAt: task.updatedAt
    };
}
function parseTaskRecord(value) {
    if (!isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.prompt !== "string" ||
        typeof value.sessionId !== "string" ||
        typeof value.intervalMinutes !== "number" ||
        typeof value.createdAt !== "number" ||
        typeof value.updatedAt !== "number" ||
        typeof value.nextRunAt !== "number" ||
        typeof value.runCount !== "number") {
        return undefined;
    }
    return normalizeTask({
        autoState: parseAutoModeState(value.autoState),
        createdAt: value.createdAt,
        id: value.id,
        intervalMinutes: value.intervalMinutes,
        kind: isTaskKind(value.kind) ? value.kind : DEFAULT_TASK_KIND,
        lastError: typeof value.lastError === "string" ? value.lastError : undefined,
        lastResultSummary: typeof value.lastResultSummary === "string"
            ? value.lastResultSummary
            : undefined,
        lastRunAt: typeof value.lastRunAt === "number" ? value.lastRunAt : undefined,
        nextRunAt: value.nextRunAt,
        prompt: value.prompt,
        runCount: value.runCount,
        sessionId: value.sessionId,
        updatedAt: value.updatedAt
    });
}
function normalizeInterval(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Task interval must be a positive number of minutes.");
    }
    return Math.round(value * 1000) / 1000;
}
function parseAutoModeState(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const previousActions = Array.isArray(value.previousActions)
        ? value.previousActions
            .map((entry) => parseAutoModeActionRecord(entry))
            .filter((entry) => entry !== undefined)
        : [];
    const completedTasks = Array.isArray(value.completedTasks)
        ? value.completedTasks.filter((entry) => typeof entry === "string")
        : [];
    const lastAction = typeof value.lastAction === "string" ? value.lastAction : undefined;
    return normalizeAutoModeState({
        completedTasks,
        lastAction,
        previousActions
    });
}
function parseAutoModeActionRecord(value) {
    if (!isRecord(value) ||
        typeof value.cycleNumber !== "number" ||
        typeof value.summary !== "string" ||
        typeof value.timestamp !== "number" ||
        !Array.isArray(value.changedFiles)) {
        return undefined;
    }
    return {
        changedFiles: value.changedFiles.filter((entry) => typeof entry === "string"),
        cycleNumber: value.cycleNumber,
        summary: value.summary,
        timestamp: value.timestamp
    };
}
function normalizeAutoModeState(value) {
    const previousActions = [...(value?.previousActions ?? [])]
        .map((entry) => ({
        ...entry,
        changedFiles: [...new Set(entry.changedFiles.map((file) => file.trim()))]
            .filter((file) => file.length > 0)
            .slice(0, 12),
        summary: entry.summary.trim()
    }))
        .filter((entry) => entry.summary.length > 0)
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, AUTO_ACTION_HISTORY_LIMIT);
    const completedTasks = [...new Set((value?.completedTasks ?? []).map((task) => task.trim()))]
        .filter((task) => task.length > 0)
        .slice(0, AUTO_COMPLETED_TASK_LIMIT);
    const lastAction = value?.lastAction?.trim();
    return {
        completedTasks,
        lastAction: lastAction && lastAction.length > 0 ? lastAction : previousActions[0]?.summary,
        previousActions
    };
}
function createTaskId() {
    return randomBytes(4).toString("hex");
}
function minutesToMilliseconds(minutes) {
    return minutes * 60_000;
}
function isMissingFileError(error) {
    return isRecord(error) && error.code === "ENOENT";
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isTaskKind(value) {
    return value === "scheduled" || value === "auto";
}
