import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ModelToolCall } from "../models/model-client.js";
import type { SessionRecord } from "../storage/session-store.js";
import type {
  AutoModeActionRecord,
  AutoModeState,
  BackgroundTaskRecord
} from "../storage/task-store.js";
import type {
  ToolExecutionResult,
  ToolRegistry
} from "../tools/tool-registry.js";

const AUTO_MODE_LOG_PATH = ".chatgpt-code/auto-mode.log";
const AUTO_MODE_MAX_PREVIOUS_ACTIONS = 8;
const AUTO_MODE_MAX_COMPLETED_TASKS = 12;
export const AUTO_MODE_PROMPT_PLACEHOLDER =
  "Autonomous project improvement mode";
export const AUTO_MODE_MAX_AGENT_STEPS = 100;
export const AUTO_MODE_MAX_TOOL_ACTIONS = 100;

export function createEmptyAutoModeState(): AutoModeState {
  return {
    completedTasks: [],
    previousActions: []
  };
}

export function buildAutoModeCyclePrompt(input: {
  session: SessionRecord;
  task: BackgroundTaskRecord;
}): string {
  const autoState = input.task.autoState ?? createEmptyAutoModeState();
  const previousActions = autoState.previousActions
    .slice(0, AUTO_MODE_MAX_PREVIOUS_ACTIONS)
    .map((entry) => formatActionRecord(entry));
  const completedTasks = autoState.completedTasks.slice(
    0,
    AUTO_MODE_MAX_COMPLETED_TASKS
  );
  const sessionTitle = input.session.title.trim() || input.session.id;

  return [
    "Autonomous improvement mode is active for this repository.",
    `Session: ${sessionTitle}`,
    `Cycle: ${input.task.runCount + 1}`,
    "",
    "Run this loop exactly once:",
    "1. Analyze the current project using available tools such as run_command and read_file.",
    "2. Choose one meaningful improvement that is not a repeat of the completed tasks or previous actions below.",
    "3. Make the improvement safely with at most three tool executions total in this cycle.",
    "4. Prefer concrete improvements such as refactors, focused features, bug fixes, test coverage, or reliability fixes.",
    "5. If no safe meaningful improvement is available, explain that clearly and do not force a change.",
    "",
    completedTasks.length > 0
      ? `Completed tasks to avoid repeating:\n${completedTasks.map((task) => `- ${task}`).join("\n")}`
      : "Completed tasks to avoid repeating:\n- None yet.",
    "",
    previousActions.length > 0
      ? `Recent autonomous actions:\n${previousActions.map((action) => `- ${action}`).join("\n")}`
      : "Recent autonomous actions:\n- None yet.",
    "",
    "Finish with this exact structure:",
    "Improvement: <one-line summary>",
    "Changed files: <comma-separated files or none>",
    "Why it matters: <one-line explanation>"
  ].join("\n");
}

export function createAutoModeToolRegistry(
  toolRegistry: ToolRegistry | undefined,
  options?: {
    maxActions?: number;
  }
): ToolRegistry | undefined {
  if (!toolRegistry) {
    return undefined;
  }

  const maxActions = options?.maxActions ?? AUTO_MODE_MAX_TOOL_ACTIONS;
  let executionCount = 0;

  return {
    listTools() {
      return toolRegistry.listTools();
    },
    listModelTools() {
      return toolRegistry.listModelTools();
    },
    async executeTool(
      name: string,
      input: Record<string, unknown>
    ): Promise<ToolExecutionResult> {
      if (executionCount >= maxActions) {
        return {
          content: `Auto mode action limit reached for this cycle (${maxActions} tool executions).`,
          isError: true
        };
      }

      executionCount += 1;
      return toolRegistry.executeTool(name, input);
    }
  };
}

export function collectChangedFilesFromToolCall(
  toolCall: ModelToolCall
): string[] {
  if (toolCall.name !== "write_file") {
    return [];
  }

  const path = toolCall.arguments.path;

  if (typeof path !== "string") {
    return [];
  }

  const normalized = path.trim();
  return normalized.length > 0 ? [normalized] : [];
}

export function updateAutoModeState(
  currentState: AutoModeState | undefined,
  input: {
    assistantContent: string;
    changedFiles: readonly string[];
    cycleNumber: number;
    timestamp: number;
  }
): AutoModeState {
  const nextAction = createAutoModeActionRecord(input);
  const previousActions = [
    nextAction,
    ...(currentState?.previousActions ?? [])
  ].slice(0, AUTO_MODE_MAX_PREVIOUS_ACTIONS);
  const completedTasks = dedupeStrings([
    nextAction.summary,
    ...(currentState?.completedTasks ?? [])
  ]).slice(0, AUTO_MODE_MAX_COMPLETED_TASKS);

  return {
    completedTasks,
    lastAction: nextAction.summary,
    previousActions
  };
}

export async function appendAutoModeLog(input: {
  changedFiles: readonly string[];
  cycleNumber: number;
  error?: string;
  intervalMinutes: number;
  sessionId: string;
  summary: string;
  taskId: string;
  timestamp: number;
  workspaceRoot?: string;
}): Promise<void> {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const filePath = resolve(workspaceRoot, AUTO_MODE_LOG_PATH);
  const line = [
    `[${new Date(input.timestamp).toISOString()}]`,
    `task=${input.taskId}`,
    `session=${input.sessionId}`,
    `cycle=${input.cycleNumber}`,
    `interval=${input.intervalMinutes}m`,
    `summary=${JSON.stringify(input.summary)}`,
    `changed=${JSON.stringify([...input.changedFiles])}`,
    input.error ? `error=${JSON.stringify(input.error)}` : undefined
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ");

  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${line}\n`, "utf8");
}

function createAutoModeActionRecord(input: {
  assistantContent: string;
  changedFiles: readonly string[];
  cycleNumber: number;
  timestamp: number;
}): AutoModeActionRecord {
  return {
    changedFiles: dedupeStrings(
      input.changedFiles.map((file) => file.trim()).filter((file) => file.length > 0)
    ).slice(0, 12),
    cycleNumber: input.cycleNumber,
    summary: extractAutoModeSummary(input.assistantContent),
    timestamp: input.timestamp
  };
}

function extractAutoModeSummary(content: string): string {
  const improvementLine = content.match(/^Improvement:\s*(.+)$/im)?.[1]?.trim();

  if (improvementLine && improvementLine.length > 0) {
    return truncate(improvementLine, 140);
  }

  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstMeaningfulLine) {
    return truncate(firstMeaningfulLine, 140);
  }

  return "Autonomous cycle completed without a reported improvement.";
}

function formatActionRecord(entry: AutoModeActionRecord): string {
  const changedFiles =
    entry.changedFiles.length > 0 ? entry.changedFiles.join(", ") : "no file changes recorded";

  return `cycle ${entry.cycleNumber}: ${entry.summary} (${changedFiles})`;
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (normalized.length === 0) {
      continue;
    }

    const signature = normalized.toLowerCase();

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    results.push(normalized);
  }

  return results;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}…`;
}
