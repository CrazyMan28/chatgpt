import { randomBytes } from "node:crypto";
import { PlatformDatabase } from "./database.js";
export class SqliteTaskStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async createTask(input) {
        const now = Date.now();
        const task = {
            approvalRequestIds: input.approvalRequestIds ?? [],
            assignedAgentId: input.assignedAgentId,
            autoState: input.autoState,
            blockedReason: input.blockedReason,
            createdAt: now,
            currentStep: input.currentStep,
            goalId: input.goalId,
            id: createTaskId(),
            intervalMinutes: input.intervalMinutes,
            kind: input.kind ?? "scheduled",
            metadata: input.metadata,
            nextRunAt: now + Math.round(input.intervalMinutes * 60_000),
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
        };
        return this.saveTask(task);
    }
    async deleteTask(id) {
        const result = this.database.run("DELETE FROM tasks WHERE id = ?", id);
        return result.changes > 0;
    }
    async listTasks() {
        return this.database
            .all(`
          SELECT *
          FROM tasks
          ORDER BY next_run_at ASC
        `)
            .map((row) => parseTaskRow(row));
    }
    async loadTask(id) {
        const row = this.database.get("SELECT * FROM tasks WHERE id = ?", id);
        return row ? parseTaskRow(row) : undefined;
    }
    async saveTask(task) {
        const normalized = normalizeTask(task);
        this.database.run(`
        INSERT INTO tasks(
          id,
          created_at,
          updated_at,
          interval_minutes,
          kind,
          next_run_at,
          prompt,
          run_count,
          session_id,
          last_error,
          last_result_summary,
          last_run_at,
          auto_state_json,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          interval_minutes = excluded.interval_minutes,
          kind = excluded.kind,
          next_run_at = excluded.next_run_at,
          prompt = excluded.prompt,
          run_count = excluded.run_count,
          session_id = excluded.session_id,
          last_error = excluded.last_error,
          last_result_summary = excluded.last_result_summary,
          last_run_at = excluded.last_run_at,
          auto_state_json = excluded.auto_state_json,
          data_json = excluded.data_json
      `, normalized.id, normalized.createdAt, normalized.updatedAt, normalized.intervalMinutes, normalized.kind, normalized.nextRunAt, normalized.prompt, normalized.runCount, normalized.sessionId, normalized.lastError ?? null, normalized.lastResultSummary ?? null, normalized.lastRunAt ?? null, normalized.autoState ? JSON.stringify(normalized.autoState) : null, JSON.stringify(buildTaskData(normalized)));
        return normalized;
    }
}
function normalizeTask(task) {
    return {
        ...task,
        approvalRequestIds: dedupeStrings(task.approvalRequestIds ?? []),
        assignedAgentId: task.assignedAgentId?.trim() || undefined,
        blockedReason: task.blockedReason?.trim() || undefined,
        currentStep: task.currentStep?.trim() || undefined,
        goalId: task.goalId?.trim() || undefined,
        intervalMinutes: Math.round(task.intervalMinutes * 1000) / 1000,
        metadata: task.metadata ? { ...task.metadata } : undefined,
        prompt: task.prompt.trim(),
        requestedAction: task.requestedAction,
        resumePrompt: task.resumePrompt?.trim() || undefined,
        retries: Number.isFinite(task.retries) ? Math.max(0, Math.floor(task.retries)) : 0,
        state: readTaskState(task.state),
        title: (task.title ?? summarizeTaskTitle(task.prompt)).trim(),
        transcriptPrompt: task.transcriptPrompt?.trim() || undefined,
        updatedAt: task.updatedAt ?? Date.now(),
        validationStatus: readValidationStatus(task.validationStatus),
        watcherIds: dedupeStrings(task.watcherIds ?? [])
    };
}
function parseTaskRow(row) {
    const data = parseTaskData(row.data_json);
    return normalizeTask({
        approvalRequestIds: data.approvalRequestIds,
        assignedAgentId: data.assignedAgentId,
        autoState: row.auto_state_json
            ? JSON.parse(row.auto_state_json)
            : undefined,
        blockedReason: data.blockedReason,
        createdAt: row.created_at,
        currentStep: data.currentStep,
        goalId: data.goalId,
        id: row.id,
        intervalMinutes: row.interval_minutes,
        kind: row.kind,
        lastError: row.last_error ?? undefined,
        lastEventAt: data.lastEventAt,
        lastResultSummary: row.last_result_summary ?? undefined,
        lastRunAt: row.last_run_at ?? undefined,
        metadata: data.metadata,
        nextRunAt: row.next_run_at,
        prompt: row.prompt,
        requestedAction: data.requestedAction,
        resumePrompt: data.resumePrompt,
        retries: data.retries,
        runCount: row.run_count,
        sessionId: row.session_id,
        state: data.state,
        title: data.title,
        transcriptPrompt: data.transcriptPrompt,
        updatedAt: row.updated_at,
        validationStatus: data.validationStatus,
        watcherIds: data.watcherIds
    });
}
function buildTaskData(task) {
    return {
        approvalRequestIds: task.approvalRequestIds,
        assignedAgentId: task.assignedAgentId,
        blockedReason: task.blockedReason,
        currentStep: task.currentStep,
        goalId: task.goalId,
        lastEventAt: task.lastEventAt,
        metadata: task.metadata,
        requestedAction: task.requestedAction,
        resumePrompt: task.resumePrompt,
        retries: task.retries,
        state: task.state,
        title: task.title,
        transcriptPrompt: task.transcriptPrompt,
        validationStatus: task.validationStatus,
        watcherIds: task.watcherIds
    };
}
function parseTaskData(value) {
    if (!value) {
        return {
            approvalRequestIds: [],
            retries: 0,
            state: "queued",
            title: "Interactive task",
            validationStatus: "idle",
            watcherIds: []
        };
    }
    try {
        const parsed = JSON.parse(value);
        return {
            approvalRequestIds: readStringArray(parsed.approvalRequestIds),
            assignedAgentId: typeof parsed.assignedAgentId === "string"
                ? parsed.assignedAgentId
                : undefined,
            blockedReason: typeof parsed.blockedReason === "string"
                ? parsed.blockedReason
                : undefined,
            currentStep: typeof parsed.currentStep === "string" ? parsed.currentStep : undefined,
            goalId: typeof parsed.goalId === "string" ? parsed.goalId : undefined,
            lastEventAt: typeof parsed.lastEventAt === "number" ? parsed.lastEventAt : undefined,
            metadata: typeof parsed.metadata === "object" && parsed.metadata !== null
                ? parsed.metadata
                : undefined,
            requestedAction: readRequestedAction(parsed.requestedAction),
            resumePrompt: typeof parsed.resumePrompt === "string" ? parsed.resumePrompt : undefined,
            retries: typeof parsed.retries === "number" ? Math.max(0, Math.floor(parsed.retries)) : 0,
            state: readTaskState(parsed.state),
            title: typeof parsed.title === "string" && parsed.title.trim().length > 0
                ? parsed.title
                : "Interactive task",
            transcriptPrompt: typeof parsed.transcriptPrompt === "string"
                ? parsed.transcriptPrompt
                : undefined,
            validationStatus: readValidationStatus(parsed.validationStatus),
            watcherIds: readStringArray(parsed.watcherIds)
        };
    }
    catch {
        return {
            approvalRequestIds: [],
            retries: 0,
            state: "queued",
            title: "Interactive task",
            validationStatus: "idle",
            watcherIds: []
        };
    }
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
function dedupeStrings(values) {
    return [
        ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
    ];
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
function createTaskId() {
    return `task-${randomBytes(4).toString("hex")}`;
}
//# sourceMappingURL=task-store.js.map