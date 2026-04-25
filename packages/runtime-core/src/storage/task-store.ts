import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TASK_FILE_PATH = ".chatgpt-code/tasks.json";
const TASK_SCHEMA_VERSION = 2;
const DEFAULT_TASK_KIND: BackgroundTaskKind = "scheduled";
const AUTO_ACTION_HISTORY_LIMIT = 12;
const AUTO_COMPLETED_TASK_LIMIT = 24;

export type BackgroundTaskKind = "scheduled" | "auto" | "interactive";
export type BackgroundTaskState =
  | "queued"
  | "planning"
  | "waiting_approval"
  | "running"
  | "validating"
  | "paused"
  | "blocked"
  | "rate_limited"
  | "complete"
  | "failed"
  | "cancelled";
export type TaskValidationStatus = "idle" | "running" | "passed" | "failed";
export type TaskRequestedAction =
  | "pause"
  | "resume"
  | "retry"
  | "stop"
  | "cancel";

export interface AutoModeActionRecord {
  changedFiles: string[];
  cycleNumber: number;
  summary: string;
  timestamp: number;
}

export interface AutoModeState {
  completedTasks: string[];
  lastAction?: string;
  previousActions: AutoModeActionRecord[];
}

export interface BackgroundTaskRecord {
  approvalRequestIds: string[];
  assignedAgentId?: string;
  autoState?: AutoModeState;
  blockedReason?: string;
  createdAt: number;
  currentStep?: string;
  goalId?: string;
  id: string;
  intervalMinutes: number;
  kind: BackgroundTaskKind;
  lastError?: string;
  lastEventAt?: number;
  lastResultSummary?: string;
  lastRunAt?: number;
  metadata?: Record<string, unknown>;
  nextRunAt: number;
  prompt: string;
  requestedAction?: TaskRequestedAction;
  resumePrompt?: string;
  retries: number;
  runCount: number;
  sessionId: string;
  state: BackgroundTaskState;
  title: string;
  transcriptPrompt?: string;
  updatedAt: number;
  validationStatus: TaskValidationStatus;
  watcherIds: string[];
}

interface TaskSnapshot {
  tasks: BackgroundTaskRecord[];
  version: number;
}

export interface TaskStore {
  createTask(input: {
    approvalRequestIds?: string[];
    assignedAgentId?: string;
    autoState?: AutoModeState;
    blockedReason?: string;
    currentStep?: string;
    goalId?: string;
    intervalMinutes: number;
    kind?: BackgroundTaskKind;
    metadata?: Record<string, unknown>;
    prompt: string;
    requestedAction?: TaskRequestedAction;
    resumePrompt?: string;
    sessionId: string;
    state?: BackgroundTaskState;
    title?: string;
    transcriptPrompt?: string;
    validationStatus?: TaskValidationStatus;
    watcherIds?: string[];
  }): Promise<BackgroundTaskRecord>;
  deleteTask(id: string): Promise<boolean>;
  listTasks(): Promise<BackgroundTaskRecord[]>;
  loadTask(id: string): Promise<BackgroundTaskRecord | undefined>;
  saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskRecord>;
}

export class JsonTaskStore implements TaskStore {
  private readonly filePath: string;

  constructor(workspaceRoot = process.cwd()) {
    this.filePath = resolve(workspaceRoot, TASK_FILE_PATH);
  }

  async createTask(input: {
    approvalRequestIds?: string[];
    assignedAgentId?: string;
    autoState?: AutoModeState;
    blockedReason?: string;
    currentStep?: string;
    goalId?: string;
    intervalMinutes: number;
    kind?: BackgroundTaskKind;
    metadata?: Record<string, unknown>;
    prompt: string;
    requestedAction?: TaskRequestedAction;
    resumePrompt?: string;
    sessionId: string;
    state?: BackgroundTaskState;
    title?: string;
    transcriptPrompt?: string;
    validationStatus?: TaskValidationStatus;
    watcherIds?: string[];
  }): Promise<BackgroundTaskRecord> {
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

  async deleteTask(id: string): Promise<boolean> {
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

  async listTasks(): Promise<BackgroundTaskRecord[]> {
    const snapshot = await this.readSnapshot();

    return [...snapshot.tasks].sort((left, right) => left.nextRunAt - right.nextRunAt);
  }

  async loadTask(id: string): Promise<BackgroundTaskRecord | undefined> {
    const snapshot = await this.readSnapshot();
    return snapshot.tasks.find((task) => task.id === id);
  }

  async saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskRecord> {
    const snapshot = await this.readSnapshot();
    const normalized = normalizeTask({
      ...task,
      updatedAt: Date.now()
    });
    const existingIndex = snapshot.tasks.findIndex(
      (entry) => entry.id === normalized.id
    );

    if (existingIndex === -1) {
      snapshot.tasks.push(normalized);
    } else {
      snapshot.tasks[existingIndex] = normalized;
    }

    await this.writeSnapshot(snapshot);

    return normalized;
  }

  private async readSnapshot(): Promise<TaskSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return parseSnapshot(JSON.parse(raw) as unknown);
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          tasks: [],
          version: TASK_SCHEMA_VERSION
        };
      }

      throw error;
    }
  }

  private async writeSnapshot(snapshot: TaskSnapshot): Promise<void> {
    const normalized = normalizeSnapshot(snapshot);
    const directoryPath = dirname(this.filePath);

    await mkdir(directoryPath, { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}

function parseSnapshot(value: unknown): TaskSnapshot {
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
          .filter((task): task is BackgroundTaskRecord => task !== undefined)
      : [],
    version:
      typeof value.version === "number" ? value.version : TASK_SCHEMA_VERSION
  });
}

function normalizeSnapshot(snapshot: TaskSnapshot): TaskSnapshot {
  return {
    tasks: snapshot.tasks.map((task) => normalizeTask(task)),
    version: TASK_SCHEMA_VERSION
  };
}

function normalizeTask(task: BackgroundTaskRecord): BackgroundTaskRecord {
  return {
    ...task,
    approvalRequestIds: dedupeStrings(task.approvalRequestIds ?? []),
    assignedAgentId: task.assignedAgentId?.trim() || undefined,
    autoState:
      task.kind === "auto"
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

function parseTaskRecord(value: unknown): BackgroundTaskRecord | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.prompt !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.intervalMinutes !== "number" ||
    typeof value.createdAt !== "number" ||
    typeof value.updatedAt !== "number" ||
    typeof value.nextRunAt !== "number" ||
    typeof value.runCount !== "number"
  ) {
    return undefined;
  }

  return normalizeTask({
    approvalRequestIds: readStringArray(value.approvalRequestIds),
    assignedAgentId:
      typeof value.assignedAgentId === "string" ? value.assignedAgentId : undefined,
    autoState: parseAutoModeState(value.autoState),
    blockedReason:
      typeof value.blockedReason === "string" ? value.blockedReason : undefined,
    createdAt: value.createdAt,
    currentStep:
      typeof value.currentStep === "string" ? value.currentStep : undefined,
    goalId: typeof value.goalId === "string" ? value.goalId : undefined,
    id: value.id,
    intervalMinutes: value.intervalMinutes,
    kind: isTaskKind(value.kind) ? value.kind : DEFAULT_TASK_KIND,
    lastError: typeof value.lastError === "string" ? value.lastError : undefined,
    lastEventAt: typeof value.lastEventAt === "number" ? value.lastEventAt : undefined,
    lastResultSummary:
      typeof value.lastResultSummary === "string"
        ? value.lastResultSummary
        : undefined,
    lastRunAt: typeof value.lastRunAt === "number" ? value.lastRunAt : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
    nextRunAt: value.nextRunAt,
    prompt: value.prompt,
    requestedAction: readRequestedAction(value.requestedAction),
    resumePrompt:
      typeof value.resumePrompt === "string" ? value.resumePrompt : undefined,
    retries: typeof value.retries === "number" ? value.retries : 0,
    runCount: value.runCount,
    sessionId: value.sessionId,
    state: readTaskState(value.state),
    title:
      typeof value.title === "string"
        ? value.title
        : summarizeTaskTitle(value.prompt),
    transcriptPrompt:
      typeof value.transcriptPrompt === "string"
        ? value.transcriptPrompt
        : undefined,
    updatedAt: value.updatedAt,
    validationStatus: readValidationStatus(value.validationStatus),
    watcherIds: readStringArray(value.watcherIds)
  });
}

function normalizeInterval(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Task interval must be a positive number of minutes.");
  }

  return Math.round(value * 1000) / 1000;
}

function parseAutoModeState(value: unknown): AutoModeState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const previousActions = Array.isArray(value.previousActions)
    ? value.previousActions
        .map((entry) => parseAutoModeActionRecord(entry))
        .filter((entry): entry is AutoModeActionRecord => entry !== undefined)
    : [];
  const completedTasks = Array.isArray(value.completedTasks)
    ? value.completedTasks.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const lastAction =
    typeof value.lastAction === "string" ? value.lastAction : undefined;

  return normalizeAutoModeState({
    completedTasks,
    lastAction,
    previousActions
  });
}

function parseAutoModeActionRecord(
  value: unknown
): AutoModeActionRecord | undefined {
  if (
    !isRecord(value) ||
    typeof value.cycleNumber !== "number" ||
    typeof value.summary !== "string" ||
    typeof value.timestamp !== "number" ||
    !Array.isArray(value.changedFiles)
  ) {
    return undefined;
  }

  return {
    changedFiles: value.changedFiles.filter(
      (entry): entry is string => typeof entry === "string"
    ),
    cycleNumber: value.cycleNumber,
    summary: value.summary,
    timestamp: value.timestamp
  };
}

function normalizeAutoModeState(value: AutoModeState | undefined): AutoModeState {
  const previousActions = [...(value?.previousActions ?? [])]
    .map((entry) => ({
      ...entry,
      changedFiles: dedupeStrings(entry.changedFiles).slice(0, 12),
      summary: entry.summary.trim()
    }))
    .filter((entry) => entry.summary.length > 0)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, AUTO_ACTION_HISTORY_LIMIT);
  const completedTasks = dedupeStrings(
    (value?.completedTasks ?? []).map((task) => task.trim())
  ).slice(0, AUTO_COMPLETED_TASK_LIMIT);
  const lastAction = value?.lastAction?.trim();

  return {
    completedTasks,
    lastAction:
      lastAction && lastAction.length > 0 ? lastAction : previousActions[0]?.summary,
    previousActions
  };
}

function createTaskId(): string {
  return randomBytes(4).toString("hex");
}

function minutesToMilliseconds(minutes: number): number {
  return minutes * 60_000;
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTaskKind(value: unknown): value is BackgroundTaskKind {
  return value === "scheduled" || value === "auto" || value === "interactive";
}

function readTaskState(value: unknown): BackgroundTaskState {
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

function readValidationStatus(value: unknown): TaskValidationStatus {
  return value === "idle" ||
    value === "running" ||
    value === "passed" ||
    value === "failed"
    ? value
    : "idle";
}

function readRequestedAction(value: unknown): TaskRequestedAction | undefined {
  return value === "pause" ||
    value === "resume" ||
    value === "retry" ||
    value === "stop" ||
    value === "cancel"
    ? value
    : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function summarizeTaskTitle(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return "Interactive task";
  }

  return normalized.length <= 96
    ? normalized
    : `${normalized.slice(0, 95)}…`;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0)
    )
  ];
}
