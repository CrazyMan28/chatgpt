import {
  appendTranscriptEntry,
  createSystemEntry,
  createUserEntry,
  reduceTranscriptEntries
} from "../agent/agent-transcript.js";
import {
  formatRetryDelay,
  runWithRateLimitRecovery
} from "../agent/rate-limit-recovery.js";
import {
  AgentControlError,
  runAgentTurn,
  type AgentTurnEvent
} from "../agent/run-agent-turn.js";
import {
  buildAgentPromptContext,
  buildPromptContextMessages,
  mergeAgentTurnHistory
} from "../memory/prompt-builder.js";
import type { ModelRuntimeManager } from "../providers/model-runtime.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRecord, SessionStore } from "../storage/session-store.js";
import {
  filterPersistedTranscript,
  getRecentSessionHistory
} from "../storage/session-state.js";
import type {
  AutoModeState,
  BackgroundTaskRecord,
  TaskRequestedAction,
  TaskStore
} from "../storage/task-store.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import {
  appendAutoModeLog,
  AUTO_MODE_MAX_AGENT_STEPS,
  AUTO_MODE_MAX_TOOL_ACTIONS,
  AUTO_MODE_PROMPT_PLACEHOLDER,
  buildAutoModeCyclePrompt,
  collectChangedFilesFromToolCall,
  createAutoModeToolRegistry,
  createEmptyAutoModeState,
  updateAutoModeState
} from "./auto-mode.js";

const DEFAULT_TASK_PREVIEW_LENGTH = 72;
const TASK_APPROVAL_ID_PATTERN = /\b(approval-[a-z0-9-]+)\b/gi;
const TASK_WATCHER_ID_PATTERN = /\b(watcher-[a-z0-9-]+)\b/gi;

interface TaskRuntimeState {
  isRunning: boolean;
  timer?: NodeJS.Timeout;
}

export interface BackgroundTaskView extends BackgroundTaskRecord {
  isRunning: boolean;
}

export interface AutoModeView {
  intervalMinutes: number;
  isRunning: boolean;
  lastAction: string;
  lastError?: string;
  lastRunAt?: number;
  nextRunAt: number;
  runCount: number;
  sessionId: string;
  taskId: string;
}

export type BackgroundTaskEvent =
  | {
      session?: SessionRecord;
      task: BackgroundTaskView;
      type: "task_updated";
    }
  | {
      taskId: string;
      type: "task_removed";
    };

export interface BackgroundTaskRunner {
  cancelTask(id: string): Promise<BackgroundTaskView | undefined>;
  close(): Promise<void>;
  enableAutoMode(input: {
    intervalMinutes: number;
    sessionId: string;
  }): Promise<AutoModeView>;
  getAutoMode(): AutoModeView | undefined;
  getTask(id: string): BackgroundTaskView | undefined;
  listTasks(): readonly BackgroundTaskView[];
  pauseTask(id: string): Promise<BackgroundTaskView | undefined>;
  retryTask(id: string): Promise<BackgroundTaskView | undefined>;
  resumeTask(id: string): Promise<BackgroundTaskView | undefined>;
  runTaskNow(id: string): Promise<BackgroundTaskView | undefined>;
  saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskView>;
  scheduleTask(input: {
    intervalMinutes: number;
    prompt: string;
    sessionId: string;
  }): Promise<BackgroundTaskView>;
  stopAutoMode(): Promise<boolean>;
  stopTask(id: string): Promise<BackgroundTaskView | undefined>;
  subscribe(listener: (event: BackgroundTaskEvent) => void): () => void;
}

export interface CreateBackgroundTaskRunnerOptions {
  memoryStore: MemoryStore;
  modelRuntime: ModelRuntimeManager;
  sessionStore: SessionStore;
  taskStore: TaskStore;
  toolRegistry?: ToolRegistry;
  workspaceRoot?: string;
}

export async function createBackgroundTaskRunner({
  memoryStore,
  modelRuntime,
  sessionStore,
  taskStore,
  toolRegistry,
  workspaceRoot
}: CreateBackgroundTaskRunnerOptions): Promise<BackgroundTaskRunner> {
  const runner = new BackgroundTaskRunnerImpl({
    memoryStore,
    modelRuntime,
    sessionStore,
    taskStore,
    toolRegistry,
    workspaceRoot
  });

  await runner.initialize();

  return runner;
}

class BackgroundTaskRunnerImpl implements BackgroundTaskRunner {
  private readonly listeners = new Set<(event: BackgroundTaskEvent) => void>();
  private readonly removedTaskIds = new Set<string>();
  private readonly runtimesById = new Map<string, TaskRuntimeState>();
  private readonly tasksById = new Map<string, BackgroundTaskRecord>();

  constructor(
    private readonly options: CreateBackgroundTaskRunnerOptions
  ) {}

  async initialize(): Promise<void> {
    const tasks = await this.options.taskStore.listTasks();

    for (const task of tasks) {
      const recovered = await this.recoverTask(task);
      this.tasksById.set(recovered.id, recovered);

      if (this.shouldSchedule(recovered)) {
        this.scheduleNextRun(recovered);
      }
    }
  }

  listTasks(): readonly BackgroundTaskView[] {
    return [...this.tasksById.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((task) => this.toTaskView(task));
  }

  getTask(id: string): BackgroundTaskView | undefined {
    const task = this.tasksById.get(id);
    return task ? this.toTaskView(task) : undefined;
  }

  getAutoMode(): AutoModeView | undefined {
    const autoTask = this.findAutoTask();

    if (!autoTask) {
      return undefined;
    }

    return this.toAutoModeView(autoTask);
  }

  async saveTask(task: BackgroundTaskRecord): Promise<BackgroundTaskView> {
    const saved = await this.persistTask(task);
    return this.toTaskView(saved);
  }

  async scheduleTask(input: {
    intervalMinutes: number;
    prompt: string;
    sessionId: string;
  }): Promise<BackgroundTaskView> {
    const task = await this.options.taskStore.createTask({
      intervalMinutes: input.intervalMinutes,
      kind: "scheduled",
      prompt: input.prompt,
      sessionId: input.sessionId,
      state: "queued",
      title: summarizePreview(input.prompt)
    });

    const saved = await this.persistTask(task);
    return this.toTaskView(saved);
  }

  async enableAutoMode(input: {
    intervalMinutes: number;
    sessionId: string;
  }): Promise<AutoModeView> {
    const existing = this.findAutoTask();
    const nextRunAt = Date.now() + minutesToMilliseconds(input.intervalMinutes);

    const task = existing
      ? await this.options.taskStore.saveTask({
          ...existing,
          autoState: existing.autoState ?? createEmptyAutoModeState(),
          blockedReason: undefined,
          intervalMinutes: input.intervalMinutes,
          kind: "auto",
          lastError: undefined,
          nextRunAt,
          prompt: AUTO_MODE_PROMPT_PLACEHOLDER,
          requestedAction: undefined,
          sessionId: input.sessionId,
          state: "queued",
          title: "Autonomous improvement mode"
        })
      : await this.options.taskStore.createTask({
          autoState: createEmptyAutoModeState(),
          intervalMinutes: input.intervalMinutes,
          kind: "auto",
          prompt: AUTO_MODE_PROMPT_PLACEHOLDER,
          sessionId: input.sessionId,
          state: "queued",
          title: "Autonomous improvement mode"
        });

    const saved = await this.persistTask(task);
    return this.toAutoModeView(saved);
  }

  async stopAutoMode(): Promise<boolean> {
    const autoTask = this.findAutoTask();

    if (!autoTask) {
      return false;
    }

    const runtime = this.runtimesById.get(autoTask.id);

    if (runtime?.timer) {
      clearTimeout(runtime.timer);
    }

    this.removedTaskIds.add(autoTask.id);
    this.runtimesById.delete(autoTask.id);
    this.tasksById.delete(autoTask.id);
    await this.options.taskStore.deleteTask(autoTask.id);
    this.emit({
      taskId: autoTask.id,
      type: "task_removed"
    });

    return true;
  }

  async pauseTask(id: string): Promise<BackgroundTaskView | undefined> {
    const task = this.tasksById.get(id);

    if (!task) {
      return undefined;
    }

    const runtime = this.ensureRuntime(id);

    if (runtime.timer) {
      clearTimeout(runtime.timer);
      runtime.timer = undefined;
    }

    const saved = await this.persistTask({
      ...task,
      blockedReason: runtime.isRunning ? "Pause requested." : task.blockedReason,
      requestedAction: "pause",
      state: runtime.isRunning ? task.state : "paused"
    });

    return this.toTaskView(saved);
  }

  async resumeTask(id: string): Promise<BackgroundTaskView | undefined> {
    const task = this.tasksById.get(id);

    if (!task) {
      return undefined;
    }

    const nextTask: BackgroundTaskRecord = {
      ...task,
      blockedReason: undefined,
      lastError: undefined,
      nextRunAt: this.shouldSchedule(task) ? Date.now() : task.nextRunAt,
      requestedAction: undefined,
      state: "queued"
    };
    const saved = await this.persistTask(nextTask);
    return this.toTaskView(saved);
  }

  async retryTask(id: string): Promise<BackgroundTaskView | undefined> {
    const task = this.tasksById.get(id);

    if (!task) {
      return undefined;
    }

    const nextTask: BackgroundTaskRecord = {
      ...task,
      approvalRequestIds: [],
      blockedReason: undefined,
      currentStep: undefined,
      lastError: undefined,
      nextRunAt: this.shouldSchedule(task) ? Date.now() : task.nextRunAt,
      requestedAction: undefined,
      retries: task.retries + 1,
      state: "queued",
      validationStatus: "idle",
      watcherIds: []
    };
    const saved = await this.persistTask(nextTask);
    return this.toTaskView(saved);
  }

  async stopTask(id: string): Promise<BackgroundTaskView | undefined> {
    const task = this.tasksById.get(id);

    if (!task) {
      return undefined;
    }

    const runtime = this.ensureRuntime(id);

    if (runtime.timer) {
      clearTimeout(runtime.timer);
      runtime.timer = undefined;
    }

    const saved = await this.persistTask({
      ...task,
      blockedReason: runtime.isRunning ? "Stop requested." : "Stopped by user.",
      requestedAction: runtime.isRunning ? "stop" : "cancel",
      state: runtime.isRunning ? task.state : "cancelled"
    });

    return this.toTaskView(saved);
  }

  async runTaskNow(id: string): Promise<BackgroundTaskView | undefined> {
    const task = this.tasksById.get(id);

    if (!task) {
      return undefined;
    }

    const saved = await this.persistTask({
      ...task,
      blockedReason: undefined,
      nextRunAt: Date.now(),
      requestedAction: undefined,
      state: "queued"
    });

    if (this.shouldSchedule(saved)) {
      this.scheduleNextRun(saved);
    }

    return this.toTaskView(saved);
  }

  subscribe(listener: (event: BackgroundTaskEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    for (const runtime of this.runtimesById.values()) {
      if (runtime.timer) {
        clearTimeout(runtime.timer);
      }
    }

    this.runtimesById.clear();
    this.listeners.clear();
  }

  async cancelTask(id: string): Promise<BackgroundTaskView | undefined> {
    return this.stopTask(id);
  }

  private shouldSchedule(task: BackgroundTaskRecord): boolean {
    return (
      (task.kind === "scheduled" || task.kind === "auto") &&
      task.state !== "paused" &&
      task.state !== "cancelled"
    );
  }

  private async recoverTask(
    task: BackgroundTaskRecord
  ): Promise<BackgroundTaskRecord> {
    if (
      task.kind === "interactive" &&
      (task.state === "planning" ||
        task.state === "running" ||
        task.state === "rate_limited" ||
        task.state === "validating")
    ) {
      return this.options.taskStore.saveTask({
        ...task,
        blockedReason:
          task.blockedReason ??
          "Recovered after restart. Resume or retry this task explicitly.",
        requestedAction: undefined,
        state: "blocked"
      });
    }

    if (
      (task.kind === "scheduled" || task.kind === "auto") &&
      (task.state === "planning" ||
        task.state === "running" ||
        task.state === "rate_limited" ||
        task.state === "validating")
    ) {
      return this.options.taskStore.saveTask({
        ...task,
        blockedReason: undefined,
        requestedAction: undefined,
        state: "queued"
      });
    }

    return task;
  }

  private scheduleNextRun(task: BackgroundTaskRecord): void {
    if (!this.shouldSchedule(task)) {
      return;
    }

    const runtime = this.ensureRuntime(task.id);

    if (runtime.timer) {
      clearTimeout(runtime.timer);
    }

    const delayMs = Math.max(0, task.nextRunAt - Date.now());

    runtime.timer = setTimeout(() => {
      void this.runTask(task.id);
    }, delayMs);
  }

  private async runTask(taskId: string): Promise<void> {
    const task = this.tasksById.get(taskId);

    if (!task || task.kind === "interactive") {
      return;
    }

    const runtime = this.ensureRuntime(taskId);

    if (runtime.isRunning || task.state === "paused" || task.state === "cancelled") {
      return;
    }

    runtime.isRunning = true;
    await this.persistTask(
      {
        ...task,
        blockedReason: undefined,
        currentStep: "Preparing execution context.",
        lastEventAt: Date.now(),
        requestedAction: undefined,
        state: "running"
      },
      { schedule: false }
    );

    const runStartedAt = Date.now();
    let updatedTask = this.tasksById.get(taskId) ?? task;
    let updatedSession: SessionRecord | undefined;

    try {
      const session = await this.options.sessionStore.loadSession(updatedTask.sessionId);

      if (!session) {
        throw new Error(`Session "${updatedTask.sessionId}" was not found.`);
      }

      const execution = await this.runTaskCycle(updatedTask, session, runStartedAt);
      updatedTask = execution.task;
      updatedSession = execution.session;
    } catch (error) {
      if (error instanceof AgentControlError) {
        updatedTask = await this.options.taskStore.saveTask({
          ...updatedTask,
          blockedReason: error.message,
          currentStep: undefined,
          lastEventAt: Date.now(),
          requestedAction: undefined,
          state: error.state === "paused" ? "paused" : "cancelled"
        });
      } else {
        const message =
          error instanceof Error ? error.message : "Scheduled task failed.";

        updatedTask = await this.options.taskStore.saveTask({
          ...updatedTask,
          blockedReason: undefined,
          currentStep: undefined,
          lastError: message,
          lastEventAt: Date.now(),
          lastRunAt: Date.now(),
          nextRunAt: runStartedAt + minutesToMilliseconds(updatedTask.intervalMinutes),
          requestedAction: undefined,
          runCount: updatedTask.runCount + 1,
          state: "failed",
          validationStatus: "failed"
        });

        const session = await this.options.sessionStore
          .loadSession(updatedTask.sessionId)
          .catch(() => undefined);

        if (session) {
          updatedSession = await this.options.sessionStore.saveSession({
            ...session,
            transcript: filterPersistedTranscript(
              appendTranscriptEntry(
                session.transcript,
                createSystemEntry(
                  `${createTaskFailurePrefix(updatedTask)} ${message}`,
                  true
                )
              )
            )
          });
        }

        if (updatedTask.kind === "auto") {
          await appendAutoModeLog({
            changedFiles: [],
            cycleNumber: updatedTask.runCount + 1,
            error: message,
            intervalMinutes: updatedTask.intervalMinutes,
            sessionId: updatedTask.sessionId,
            summary: "Auto mode cycle failed.",
            taskId: updatedTask.id,
            timestamp: Date.now(),
            workspaceRoot: this.options.workspaceRoot
          }).catch(() => undefined);
        }
      }
    } finally {
      if (this.removedTaskIds.has(updatedTask.id)) {
        this.runtimesById.delete(updatedTask.id);
        return;
      }

      this.tasksById.set(updatedTask.id, updatedTask);
      runtime.isRunning = false;

      if (this.shouldSchedule(updatedTask)) {
        this.scheduleNextRun(updatedTask);
      }

      this.emit({
        session: updatedSession,
        task: this.toTaskView(updatedTask),
        type: "task_updated"
      });
    }
  }

  private async runTaskCycle(
    task: BackgroundTaskRecord,
    session: SessionRecord,
    runStartedAt: number
  ): Promise<{
    session: SessionRecord;
    task: BackgroundTaskRecord;
  }> {
    const cycleNumber = task.runCount + 1;
    const taskPrompt =
      task.kind === "auto"
        ? buildAutoModeCyclePrompt({
            session,
            task
          })
        : task.prompt;
    const displayPrompt =
      task.kind === "auto"
        ? `Auto mode cycle ${cycleNumber}: inspect the project and apply one meaningful improvement.`
        : task.prompt;
    const triggerMessage =
      task.kind === "auto"
        ? `Auto mode cycle ${cycleNumber} triggered.`
        : `Scheduled task ${task.id} triggered.`;
    const promptContext = await this.loadPromptContext(session, taskPrompt);
    const changedFiles = new Set<string>();
    const approvalRequestIds = new Set<string>();
    const watcherIds = new Set<string>(task.watcherIds);
    let transcript = appendTranscriptEntry(
      session.transcript,
      createSystemEntry(triggerMessage, true)
    );
    transcript = appendTranscriptEntry(transcript, createUserEntry(displayPrompt));
    const baseTranscript = [...transcript];

    const result = await runWithRateLimitRecovery({
      onRetry: async ({ attempt, delayMs, error }) => {
        transcript = appendTranscriptEntry(
          [...baseTranscript],
          createSystemEntry(
            `Provider rate limited this background run. Retrying in ${formatRetryDelay(
              delayMs
            )} (attempt ${attempt}/3).`,
            true
          )
        );
        changedFiles.clear();
        void error;
        await this.persistTask(
          {
            ...(this.tasksById.get(task.id) ?? task),
            currentStep: `Rate limited, retry ${attempt}/3 in ${formatRetryDelay(delayMs)}.`,
            lastEventAt: Date.now(),
            state: "rate_limited"
          },
          { schedule: false }
        );
      },
      run: () =>
        runAgentTurn({
          contextMessages: promptContext.contextMessages,
          executionMode: "build",
          history: promptContext.recentHistory,
          maxSteps:
            task.kind === "auto" ? AUTO_MODE_MAX_AGENT_STEPS : undefined,
          prompt: taskPrompt,
          model: this.options.modelRuntime.getClient(),
          shouldContinue: () => this.readControlDecision(task.id),
          toolRegistry:
            task.kind === "auto"
              ? createAutoModeToolRegistry(this.options.toolRegistry, {
                  maxActions: AUTO_MODE_MAX_TOOL_ACTIONS
                })
              : this.options.toolRegistry,
          onEvent: async (event) => {
            transcript = reduceTranscriptEntries(transcript, event, task.id);

            if (task.kind === "auto") {
              recordAutoModeToolEffects(changedFiles, event);
            }

            if (event.type === "tool_finished") {
              for (const approvalId of extractApprovalIds(event.result.content)) {
                approvalRequestIds.add(approvalId);
              }

              for (const watcherId of extractWatcherIds(event.result.content)) {
                watcherIds.add(watcherId);
              }
            }

            await this.persistTask(
              {
                ...(this.tasksById.get(task.id) ?? task),
                approvalRequestIds: [...approvalRequestIds],
                currentStep: describeTaskStep(event),
                lastEventAt: Date.now(),
                state: "running",
                watcherIds: [...watcherIds]
              },
              { schedule: false }
            );
          }
        })
    });

    const nextHistory = mergeAgentTurnHistory(
      session.history,
      promptContext.recentHistory,
      result.messages
    );
    const nextSession = await this.options.sessionStore.saveSession({
      ...session,
      history: nextHistory,
      transcript: filterPersistedTranscript(transcript)
    });

    if (task.kind === "scheduled") {
      await this.options.memoryStore.rememberFromUserMessage(task.prompt, {
        sessionId: task.sessionId
      });

      const nextTask = await this.options.taskStore.saveTask({
        ...(this.tasksById.get(task.id) ?? task),
        approvalRequestIds: [...approvalRequestIds],
        blockedReason:
          approvalRequestIds.size > 0
            ? "Waiting for approval before the next run."
            : undefined,
        currentStep:
          approvalRequestIds.size > 0 ? "Awaiting approval." : "Waiting for the next run.",
        lastError: undefined,
        lastEventAt: Date.now(),
        lastResultSummary: summarizePreview(result.content),
        lastRunAt: Date.now(),
        nextRunAt: runStartedAt + minutesToMilliseconds(task.intervalMinutes),
        requestedAction: undefined,
        runCount: cycleNumber,
        state: approvalRequestIds.size > 0 ? "waiting_approval" : "complete",
        title: task.title,
        validationStatus: "passed",
        watcherIds: [...watcherIds]
      });

      return {
        session: nextSession,
        task: nextTask
      };
    }

    const nextAutoState = updateAutoModeState(task.autoState, {
      assistantContent: result.content,
      changedFiles: [...changedFiles],
      cycleNumber,
      timestamp: Date.now()
    });
    const nextTask = await this.options.taskStore.saveTask({
      ...(this.tasksById.get(task.id) ?? task),
      approvalRequestIds: [...approvalRequestIds],
      autoState: nextAutoState,
      blockedReason:
        approvalRequestIds.size > 0
          ? "Waiting for approval before the next autonomous cycle."
          : undefined,
      currentStep:
        approvalRequestIds.size > 0 ? "Awaiting approval." : "Waiting for the next autonomous cycle.",
      lastError: undefined,
      lastEventAt: Date.now(),
      lastResultSummary: summarizePreview(result.content),
      lastRunAt: Date.now(),
      nextRunAt: runStartedAt + minutesToMilliseconds(task.intervalMinutes),
      requestedAction: undefined,
      runCount: cycleNumber,
      state: approvalRequestIds.size > 0 ? "waiting_approval" : "complete",
      validationStatus: "passed",
      watcherIds: [...watcherIds]
    });

    await appendAutoModeLog({
      changedFiles: [...changedFiles],
      cycleNumber,
      intervalMinutes: task.intervalMinutes,
      sessionId: task.sessionId,
      summary: nextAutoState.lastAction ?? summarizePreview(result.content),
      taskId: task.id,
      timestamp: Date.now(),
      workspaceRoot: this.options.workspaceRoot
    }).catch(() => undefined);

    return {
      session: nextSession,
      task: nextTask
    };
  }

  private async loadPromptContext(
    session: SessionRecord,
    prompt: string
  ) {
    try {
      return await buildAgentPromptContext({
        history: session.history,
        memoryStore: this.options.memoryStore,
        prompt,
        sessionSummary: session.summary
      });
    } catch {
      return {
        contextMessages: buildPromptContextMessages({
          memories: [],
          sessionSummary: session.summary
        }),
        memories: [],
        recentHistory: getRecentSessionHistory(session.history)
      };
    }
  }

  private findAutoTask(): BackgroundTaskRecord | undefined {
    return [...this.tasksById.values()].find((task) => task.kind === "auto");
  }

  private ensureRuntime(taskId: string): TaskRuntimeState {
    const existing = this.runtimesById.get(taskId);

    if (existing) {
      return existing;
    }

    const runtime: TaskRuntimeState = {
      isRunning: false
    };

    this.runtimesById.set(taskId, runtime);
    return runtime;
  }

  private readControlDecision(
    taskId: string
  ):
    | { ok: true }
    | { ok: false; reason?: string; state: "cancelled" | "paused" } {
    const task = this.tasksById.get(taskId);
    const action = task?.requestedAction;

    if (action === "pause") {
      return {
        ok: false,
        reason: "Paused by user.",
        state: "paused"
      };
    }

    if (action === "stop" || action === "cancel") {
      return {
        ok: false,
        reason: "Stopped by user.",
        state: "cancelled"
      };
    }

    return {
      ok: true
    };
  }

  private async persistTask(
    task: BackgroundTaskRecord,
    options?: {
      emit?: boolean;
      schedule?: boolean;
    }
  ): Promise<BackgroundTaskRecord> {
    const saved = await this.options.taskStore.saveTask(task);
    this.tasksById.set(saved.id, saved);
    this.removedTaskIds.delete(saved.id);

    if (options?.schedule !== false && this.shouldSchedule(saved)) {
      this.scheduleNextRun(saved);
    }

    if (options?.emit !== false) {
      this.emit({
        task: this.toTaskView(saved),
        type: "task_updated"
      });
    }

    return saved;
  }

  private emit(event: BackgroundTaskEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private toTaskView(task: BackgroundTaskRecord): BackgroundTaskView {
    return {
      ...task,
      isRunning: this.ensureRuntime(task.id).isRunning
    };
  }

  private toAutoModeView(task: BackgroundTaskRecord): AutoModeView {
    return {
      intervalMinutes: task.intervalMinutes,
      isRunning: this.ensureRuntime(task.id).isRunning,
      lastAction:
        task.autoState?.lastAction ??
        task.lastResultSummary ??
        "Waiting for the first autonomous cycle.",
      lastError: task.lastError,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
      runCount: task.runCount,
      sessionId: task.sessionId,
      taskId: task.id
    };
  }
}

function summarizePreview(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= DEFAULT_TASK_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, DEFAULT_TASK_PREVIEW_LENGTH - 1)}…`;
}

function minutesToMilliseconds(minutes: number): number {
  return minutes * 60_000;
}

function createTaskFailurePrefix(task: BackgroundTaskRecord): string {
  return task.kind === "auto"
    ? `Auto mode cycle ${task.runCount + 1} failed:`
    : `Background task ${task.id} failed:`;
}

function recordAutoModeToolEffects(
  changedFiles: Set<string>,
  event: AgentTurnEvent
): void {
  if (event.type !== "tool_started" && event.type !== "tool_finished") {
    return;
  }

  for (const filePath of collectChangedFilesFromToolCall(event.toolCall)) {
    changedFiles.add(filePath);
  }
}

function describeTaskStep(event: AgentTurnEvent): string {
  switch (event.type) {
    case "status":
      return event.phase === "thinking"
        ? "Thinking."
        : event.phase === "running_tool"
          ? "Running tool."
          : event.phase === "streaming"
            ? "Streaming response."
            : "Ready.";
    case "tool_started":
      return `Running ${event.toolCall.name}.`;
    case "tool_finished":
      return `${event.toolCall.name} ${event.result.isError ? "failed" : "completed"}.`;
    case "assistant_stream_started":
      return "Streaming response.";
    case "assistant_stream_delta":
      return "Streaming response.";
    case "assistant_stream_completed":
      return "Finalizing response.";
    default:
      return "Running.";
  }
}

function extractApprovalIds(value: string): string[] {
  return [...value.matchAll(TASK_APPROVAL_ID_PATTERN)].map((match) => match[1]);
}

function extractWatcherIds(value: string): string[] {
  return [...value.matchAll(TASK_WATCHER_ID_PATTERN)].map((match) => match[1]);
}
