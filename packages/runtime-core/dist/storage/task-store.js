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
            approvalRequestIds: input.approvalRequestIds ?? [],
            assignedAgentId: input.assignedAgentId,
            autoState: input.autoState,
            blockedReason: input.blockedReason,
            createdAt: now,
            currentStep: input.currentStep,
            goalId: input.goalId,
            id: createTaskId(),
            intervalMinutes: input.intervalMinutes,
            kind: input.kind ?? DEFAULT_TASK_KIND,
            metadata: input.metadata,
            nextRunAt: now + minutesToMilliseconds(input.intervalMinutes),
            prompt: input.prompt,
            requestedAction: input.requestedAction,
            resumePrompt: input.resumePrompt,
            retries: 0,
            runCount: 0,
            sessionId: input.sessionId,
            state: input.state ?? "queued",
            title: input.title ?? summarizeTaskTitle(input.prompt),
            transcriptPrompt: input.transcriptPrompt,
            updatedAt: now,
            validationStatus: input.validationStatus ?? "idle",
            watcherIds: input.watcherIds ?? []
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
        approvalRequestIds: dedupeStrings(task.approvalRequestIds ?? []),
        assignedAgentId: task.assignedAgentId?.trim() || undefined,
        autoState: task.kind === "auto"
            ? normalizeAutoModeState(task.autoState)
            : undefined,
        blockedReason: task.blockedReason?.trim() || undefined,
        currentStep: task.currentStep?.trim() || undefined,
        goalId: task.goalId?.trim() || undefined,
        intervalMinutes: normalizeInterval(task.intervalMinutes),
        kind: task.kind ?? DEFAULT_TASK_KIND,
        metadata: task.metadata ? { ...task.metadata } : undefined,
        prompt: task.prompt.trim(),
        requestedAction: readRequestedAction(task.requestedAction),
        resumePrompt: task.resumePrompt?.trim() || undefined,
        retries: Number.isFinite(task.retries) ? Math.max(0, Math.floor(task.retries)) : 0,
        state: readTaskState(task.state),
        title: (task.title ?? summarizeTaskTitle(task.prompt)).trim(),
        transcriptPrompt: task.transcriptPrompt?.trim() || undefined,
        updatedAt: task.updatedAt,
        validationStatus: readValidationStatus(task.validationStatus),
        watcherIds: dedupeStrings(task.watcherIds ?? [])
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
        approvalRequestIds: readStringArray(value.approvalRequestIds),
        assignedAgentId: typeof value.assignedAgentId === "string" ? value.assignedAgentId : undefined,
        autoState: parseAutoModeState(value.autoState),
        blockedReason: typeof value.blockedReason === "string" ? value.blockedReason : undefined,
        createdAt: value.createdAt,
        currentStep: typeof value.currentStep === "string" ? value.currentStep : undefined,
        goalId: typeof value.goalId === "string" ? value.goalId : undefined,
        id: value.id,
        intervalMinutes: value.intervalMinutes,
        kind: isTaskKind(value.kind) ? value.kind : DEFAULT_TASK_KIND,
        lastError: typeof value.lastError === "string" ? value.lastError : undefined,
        lastEventAt: typeof value.lastEventAt === "number" ? value.lastEventAt : undefined,
        lastResultSummary: typeof value.lastResultSummary === "string"
            ? value.lastResultSummary
            : undefined,
        lastRunAt: typeof value.lastRunAt === "number" ? value.lastRunAt : undefined,
        metadata: isRecord(value.metadata) ? value.metadata : undefined,
        nextRunAt: value.nextRunAt,
        prompt: value.prompt,
        requestedAction: readRequestedAction(value.requestedAction),
        resumePrompt: typeof value.resumePrompt === "string" ? value.resumePrompt : undefined,
        retries: typeof value.retries === "number" ? value.retries : 0,
        runCount: value.runCount,
        sessionId: value.sessionId,
        state: readTaskState(value.state),
        title: typeof value.title === "string"
            ? value.title
            : summarizeTaskTitle(value.prompt),
        transcriptPrompt: typeof value.transcriptPrompt === "string"
            ? value.transcriptPrompt
            : undefined,
        updatedAt: value.updatedAt,
        validationStatus: readValidationStatus(value.validationStatus),
        watcherIds: readStringArray(value.watcherIds)
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
        changedFiles: dedupeStrings(entry.changedFiles).slice(0, 12),
        summary: entry.summary.trim()
    }))
        .filter((entry) => entry.summary.length > 0)
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, AUTO_ACTION_HISTORY_LIMIT);
    const completedTasks = dedupeStrings((value?.completedTasks ?? []).map((task) => task.trim())).slice(0, AUTO_COMPLETED_TASK_LIMIT);
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
    return value === "scheduled" || value === "auto" || value === "interactive";
}
function readTaskState(value) {
    return value === "queued" ||
        value === "planning" ||
        value === "waiting_approval" ||
        value === "running" ||
        value === "validating" ||
        value === "paused" ||
        value === "blocked" ||
        value === "rate_limited" ||
        value === "complete" ||
        value === "failed" ||
        value === "cancelled"
        ? value
        : "queued";
}
function readValidationStatus(value) {
    return value === "idle" ||
        value === "running" ||
        value === "passed" ||
        value === "failed"
        ? value
        : "idle";
}
function readRequestedAction(value) {
    return value === "pause" ||
        value === "resume" ||
        value === "retry" ||
        value === "stop" ||
        value === "cancel"
        ? value
        : undefined;
}
function readStringArray(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === "string")
        : [];
}
function summarizeTaskTitle(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length === 0) {
        return "Interactive task";
    }
    return normalized.length <= 96
        ? normalized
        : `${normalized.slice(0, 95)}…`;
}
function dedupeStrings(values) {
    return [
        ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
    ];
}
//# sourceMappingURL=task-store.js.map