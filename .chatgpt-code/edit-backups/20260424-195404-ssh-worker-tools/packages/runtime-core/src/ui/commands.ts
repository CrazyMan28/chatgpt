import {
  formatExecutionModeLabel,
  type ExecutionMode
} from "../modes/execution-mode.js";
import {
  formatResponseModeLabel,
  isResponseMode,
  type ResponseMode
} from "../modes/response-mode.js";
import type {
  ApprovalPolicyPreset,
  FleetAgentRecord,
  FilesystemScope,
  WatcherRecord
} from "../platform/types.js";
import type { ModelRuntimeSnapshot, ProviderModelDefinition } from "../providers/provider-types.js";
import type { SessionSummary } from "../storage/session-store.js";
import type { BackgroundTaskView } from "../tasks/background-task-runner.js";

export type AppCommand =
  | { type: "help" }
  | { type: "login" }
  | { type: "models" }
  | { model: string; type: "model" }
  | { type: "goals" }
  | { goalId: string; type: "goal_show" }
  | { goalId: string; type: "goal_adopt" }
  | { goalId: string; type: "goal_dismiss" }
  | { type: "fleet_start" }
  | { type: "fleet_stop" }
  | { type: "fleet_status" }
  | { role: "general" | "frontend" | "backend" | "tester" | "docs"; task: string; type: "fleet_assign" }
  | { type: "orchestrator_status" }
  | { type: "orchestrator_queue" }
  | { type: "orchestrator_health" }
  | { type: "remote_list" }
  | { id: string; type: "remote_status" }
  | { id: string; type: "remote_connect" }
  | { id: string; type: "remote_disconnect" }
  | { id: string; type: "remote_remove" }
  | { host: string; id: string; port?: number; type: "remote_add"; username?: string }
  | { type: "ssh_list" }
  | { name: string; type: "ssh_test" }
  | { command: string; name: string; type: "ssh_run" }
  | { name: string; type: "ssh_remove" }
  | { type: "ssh_add" }
  | { host: string; name: string; port?: number; type: "ssh_add_inline"; username?: string }
  | { type: "mcp_add" }
  | { type: "mcp_list" }
  | { type: "mcp_marketplace" }
  | { type: "mcp_refresh" }
  | { name: string; type: "mcp_install" }
  | { name: string; type: "mcp_info" }
  | { name: string; type: "mcp_enable" }
  | { name: string; type: "mcp_disable" }
  | { name: string; type: "mcp_remove" }
  | { name: string; type: "mcp_edit" }
  | { prompt?: string; type: "plan" }
  | { type: "build" }
  | { type: "resume" }
  | { intervalMinutes: number; type: "auto" }
  | { type: "auto_stop" }
  | { type: "new" }
  | { type: "list" }
  | { id: string; type: "open" }
  | { type: "cwd" }
  | { path: string; type: "cd" }
  | { type: "scope" }
  | { grantScope: FilesystemScope; hostId?: string; type: "scope_grant" }
  | { grantIdOrScope: string; type: "scope_revoke" }
  | { type: "approvals" }
  | { id: string; type: "approve" }
  | { policy: ApprovalPolicyPreset; type: "approve_policy" }
  | { scope: "once" | "task" | "session" | "all"; type: "approve_scope" }
  | { policy?: ApprovalPolicyPreset; type: "autopilot_on" }
  | { type: "autopilot_off" }
  | { type: "autopilot_status" }
  | { id: string; type: "reject" }
  | { type: "memory_show" }
  | { type: "memory_clear" }
  | { type: "memory_compact" }
  | { type: "memory_global_show" }
  | { text: string; type: "memory_global_remember" }
  | { key: string; type: "memory_global_forget" }
  | { keyword: string; type: "memory_search" }
  | { type: "timeline" }
  | { type: "timeline_recent" }
  | { filterType: string; type: "timeline_filter" }
  | { mode: ExecutionMode; type: "mode" }
  | { style: ResponseMode; type: "style" }
  | { type: "agents" }
  | { id: string; type: "agent_show" }
  | { id: string; type: "agent_pause" }
  | { id: string; type: "agent_resume" }
  | { id: string; type: "agent_stop" }
  | { id: string; type: "agent_restart" }
  | { type: "tasks" }
  | { id: string; type: "task_show" }
  | { id: string; type: "task_pause" }
  | { id: string; type: "task_resume" }
  | { id: string; type: "task_stop" }
  | { id: string; type: "task_cancel" }
  | { id: string; type: "task_retry" }
  | { target: string; type: "task_start" }
  | { type: "watchers" }
  | { id: string; type: "watcher_show" }
  | { id: string; type: "watcher_cancel" }
  | { intervalMinutes: number; prompt: string; type: "schedule" }
  | { message: string; type: "invalid" };

const COMMAND_REFERENCE: ReadonlyArray<{
  command: string;
  usage: string;
  description: string;
}> = [
  {
    command: "/help",
    usage: "/help",
    description: "Show the available commands."
  },
  {
    command: "/login",
    usage: "/login",
    description: "Start the provider login flow."
  },
  {
    command: "/models",
    usage: "/models",
    description: "List models for the active provider."
  },
  {
    command: "/goals",
    usage: "/goals",
    description: "List tracked goals."
  },
  {
    command: "/goal",
    usage: "/goal show <id> | /goal adopt <id> | /goal dismiss <id>",
    description: "Inspect and manage tracked goals."
  },
  {
    command: "/fleet",
    usage: "/fleet start|stop|status|assign <role> <task>",
    description: "Run and inspect local sub-agents."
  },
  {
    command: "/agents",
    usage: "/agents | /agent show <id> | /agent pause <id> | /agent resume <id> | /agent stop <id> | /agent restart <id>",
    description: "Inspect and control individual fleet agents."
  },
  {
    command: "/remote",
    usage: "/remote add <id> <host> [username] [port] | list | status <id> | connect <id> | disconnect <id> | remove <id>",
    description: "Manage remote workers."
  },
  {
    command: "/ssh",
    usage: "/ssh add [name host [username] [port]] | list | test <name> | run <name> <command> | remove <name>",
    description: "Manage SSH workers and run remote commands."
  },
  {
    command: "/orchestrator",
    usage: "/orchestrator status | /orchestrator queue | /orchestrator health",
    description: "Inspect orchestrator state."
  },
  {
    command: "/model",
    usage: "/model <name>",
    description: "Switch the active model."
  },
  {
    command: "/mcp",
    usage: "/mcp add|list|refresh|enable <name>|disable <name>|remove <name>|edit <name>|marketplace|install <name>|info <name>",
    description: "Manage MCP servers and reload tools without restarting."
  },
  {
    command: "/plan",
    usage: "/plan [task]",
    description: "Enter PLAN mode, ask clarifying questions if needed, and generate TODO + plan.md."
  },
  {
    command: "/build",
    usage: "/build",
    description: "Review and execute plan.md after confirmation."
  },
  {
    command: "/resume",
    usage: "/resume",
    description: "Resume the last incomplete BUILD step from plan.md."
  },
  {
    command: "/auto",
    usage: "/auto <minutes>|stop",
    description: "Enable or stop autonomous improvement mode."
  },
  {
    command: "/new",
    usage: "/new",
    description: "Start a fresh session."
  },
  {
    command: "/list",
    usage: "/list",
    description: "List saved sessions."
  },
  {
    command: "/open",
    usage: "/open <id>",
    description: "Resume a saved session."
  },
  {
    command: "/cwd",
    usage: "/cwd | /cd <path>",
    description: "Inspect or change the current working directory."
  },
  {
    command: "/scope",
    usage: "/scope | /scope grant <workspace|home|full-machine|remote-host> [host] | /scope revoke <scope|id>",
    description: "Inspect or change the current filesystem permission scope."
  },
  {
    command: "/approvals",
    usage: "/approvals | /approve <id> | /approve once|task|session|all|ask-every-time|auto-safe|auto-safe-medium|full|strict | /reject <id>",
    description: "Review pending approvals, grant blanket approval, or change approval policy."
  },
  {
    command: "/autopilot",
    usage: "/autopilot on [full|auto-safe|auto-safe-medium|strict] | /autopilot off | /autopilot status",
    description: "Toggle or inspect autonomous execution for the active session."
  },
  {
    command: "/memory",
    usage: "/memory show|clear|compact|global show|global remember <text>|global forget <key>|search <keyword>",
    description: "Inspect, compact, search, and manage persistent memory."
  },
  {
    command: "/timeline",
    usage: "/timeline | /timeline recent | /timeline filter <type>",
    description: "Inspect recent runtime events and failure history."
  },
  {
    command: "/mode",
    usage: "/mode <normal|plan|build>",
    description: "Change strict execution mode."
  },
  {
    command: "/style",
    usage: "/style <normal|plan|ultra>",
    description: "Change response style."
  },
  {
    command: "/tasks",
    usage: "/tasks | /task show <id> | /task pause <id> | /task resume <id> | /task stop <id> | /task cancel <id> | /task retry <id> | /task start <id|goal>",
    description: "List and control tracked tasks."
  },
  {
    command: "/watchers",
    usage: "/watchers | /watcher show <id> | /watcher cancel <id>",
    description: "Inspect and control long-running command watchers."
  },
  {
    command: "/schedule",
    usage: "/schedule <minutes> <prompt>",
    description: "Create a scheduled background task."
  }
];

export function parseAppCommand(input: string): AppCommand | undefined {
  const normalized = input.trim();

  if (!normalized.startsWith("/")) {
    return undefined;
  }

  if (normalized === "/help") {
    return { type: "help" };
  }

  if (normalized === "/login") {
    return { type: "login" };
  }

  if (normalized === "/models") {
    return { type: "models" };
  }

  if (normalized === "/goals") {
    return { type: "goals" };
  }

  if (normalized === "/new") {
    return { type: "new" };
  }

  if (normalized === "/cwd") {
    return { type: "cwd" };
  }

  if (normalized.startsWith("/cd")) {
    return parseCdCommand(normalized);
  }

  if (normalized.startsWith("/plan")) {
    return parsePlanCommand(normalized);
  }

  if (normalized === "/build") {
    return { type: "build" };
  }

  if (normalized === "/resume") {
    return { type: "resume" };
  }

  if (normalized === "/list") {
    return { type: "list" };
  }

  if (normalized === "/tasks") {
    return { type: "tasks" };
  }

  if (normalized === "/watchers") {
    return { type: "watchers" };
  }

  if (normalized === "/agents") {
    return { type: "agents" };
  }

  if (normalized.startsWith("/mcp")) {
    return parseMcpCommand(normalized);
  }

  if (normalized.startsWith("/goal")) {
    return parseGoalCommand(normalized);
  }

  if (normalized.startsWith("/fleet")) {
    return parseFleetCommand(normalized);
  }

  if (normalized.startsWith("/orchestrator")) {
    return parseOrchestratorCommand(normalized);
  }

  if (normalized.startsWith("/remote")) {
    return parseRemoteCommand(normalized);
  }

  if (normalized.startsWith("/ssh")) {
    return parseSshCommand(normalized);
  }

  if (normalized.startsWith("/memory")) {
    return parseMemoryCommand(normalized);
  }

  if (normalized.startsWith("/timeline")) {
    return parseTimelineCommand(normalized);
  }

  if (normalized.startsWith("/task")) {
    return parseTaskCommand(normalized);
  }

  if (normalized.startsWith("/watcher")) {
    return parseWatcherCommand(normalized);
  }

  if (normalized.startsWith("/agent")) {
    return parseAgentCommand(normalized);
  }

  if (normalized === "/approvals") {
    return { type: "approvals" };
  }

  if (normalized.startsWith("/approve")) {
    return parseApprovalAction(normalized, "approve");
  }

  if (normalized.startsWith("/reject")) {
    return parseApprovalAction(normalized, "reject");
  }

  if (normalized.startsWith("/autopilot")) {
    return parseAutopilotCommand(normalized);
  }

  if (normalized.startsWith("/auto")) {
    return parseAutoCommand(normalized);
  }

  if (normalized.startsWith("/model")) {
    return parseModelCommand(normalized);
  }

  if (normalized.startsWith("/mode")) {
    return parseModeCommand(normalized);
  }

  if (normalized.startsWith("/style")) {
    return parseStyleCommand(normalized);
  }

  if (normalized.startsWith("/scope")) {
    return parseScopeCommand(normalized);
  }

  if (normalized.startsWith("/open")) {
    const [, ...rest] = normalized.split(/\s+/);
    const id = rest.join(" ").trim();

    if (id.length === 0) {
      return {
        type: "invalid",
        message: "Usage: /open <id>"
      };
    }

    return {
      id,
      type: "open"
    };
  }

  if (normalized.startsWith("/schedule")) {
    return parseScheduleCommand(normalized);
  }

  return buildUnknownCommand(normalized);
}

export function formatSessionList(
  sessions: readonly SessionSummary[],
  currentSessionId: string
): string {
  if (sessions.length === 0) {
    return "No saved sessions yet.";
  }

  const lines = ["Saved sessions"];

  for (const session of sessions) {
    const marker = session.id === currentSessionId ? "*" : " ";
    const updatedAt = formatTimestamp(session.updatedAt);
    const turns = session.turnCount === 1 ? "1 turn" : `${session.turnCount} turns`;

    lines.push(
      `${marker} ${session.id}  ${updatedAt}  ${turns}  ${session.title}`
    );
  }

  lines.push("");
  lines.push("Use /open <id> to resume a session.");

  return lines.join("\n");
}

export function formatTaskList(
  tasks: readonly BackgroundTaskView[],
  currentSessionId: string
): string {
  if (tasks.length === 0) {
    return "No tracked tasks yet.";
  }

  const lines = ["Tasks"];

  for (const task of tasks) {
    const marker = task.sessionId === currentSessionId ? "*" : " ";
    const taskLabel =
      task.kind === "auto"
        ? "[auto]"
        : task.kind === "interactive"
          ? "[interactive]"
          : "[task]";
    const interval =
      task.kind === "interactive" ? "manual" : `every ${formatInterval(task.intervalMinutes)}`;
    const nextRun = formatTimestamp(task.nextRunAt);
    const lastRun = task.lastRunAt ? formatTimestamp(task.lastRunAt) : "never";
    const summary =
      task.lastError ??
      task.autoState?.lastAction ??
      task.lastResultSummary ??
      task.title;

    lines.push(
      `${marker} ${taskLabel} ${task.id}  ${task.state}${task.isRunning ? " (active)" : ""}  ${interval}  next ${nextRun}  last ${lastRun}`
    );
    lines.push(
      `  ${task.title}  step=${task.currentStep ?? "-"}  agent=${task.assignedAgentId ?? "-"}  approvals=${task.approvalRequestIds.length}  watchers=${task.watcherIds.length}  retries=${task.retries}`
    );

    if (summary.trim().length > 0) {
      lines.push(`  ${summary}`);
    }
  }

  lines.push("");
  lines.push("Use /task show <id> for detail, /task pause|resume|stop|cancel|retry <id> for control, /task start <goal> for a manual run, /schedule <minutes> <prompt> for recurring tasks, or /auto <minutes> for autonomous mode.");

  return lines.join("\n");
}

export function formatTaskDetail(task: BackgroundTaskView): string {
  const lines = [
    `Task ${task.id}`,
    `Title: ${task.title}`,
    `Kind: ${task.kind}`,
    `State: ${task.state}${task.isRunning ? " (active)" : ""}`,
    `Session: ${task.sessionId}`,
    `Assigned agent: ${task.assignedAgentId ?? "-"}`,
    `Current step: ${task.currentStep ?? "-"}`,
    `Blocked reason: ${task.blockedReason ?? "-"}`,
    `Approvals needed: ${task.approvalRequestIds.length > 0 ? task.approvalRequestIds.join(", ") : "-"}`,
    `Watchers: ${task.watcherIds.length > 0 ? task.watcherIds.join(", ") : "-"}`,
    `Validation: ${task.validationStatus}`,
    `Retries: ${task.retries}`,
    `Last error: ${task.lastError ?? "-"}`,
    `Last result: ${task.lastResultSummary ?? "-"}`,
    `Last run: ${task.lastRunAt ? formatTimestamp(task.lastRunAt) : "never"}`,
    `Next run: ${formatTimestamp(task.nextRunAt)}`,
    `Prompt: ${task.prompt}`
  ];

  if (task.resumePrompt) {
    lines.push(`Resume prompt: ${task.resumePrompt}`);
  }

  return lines.join("\n");
}

export function formatWatcherList(
  watchers: readonly WatcherRecord[]
): string {
  if (watchers.length === 0) {
    return "No watchers are running.";
  }

  const lines = ["Watchers"];

  for (const watcher of watchers) {
    lines.push(
      `${watcher.id}  ${watcher.status}  ${watcher.type}  ${watcher.summary}`
    );
    lines.push(
      `  target=${watcher.target ?? "-"}  scope=${watcher.scope ?? "-"}  task=${watcher.taskId ?? "-"}  retries=${watcher.retryCount ?? 0}`
    );
  }

  return lines.join("\n");
}

export function formatWatcherDetail(
  watcher: WatcherRecord
): string {
  return [
    `Watcher ${watcher.id}`,
    `Status: ${watcher.status}`,
    `Type: ${watcher.type}`,
    `Summary: ${watcher.summary}`,
    `Detail: ${watcher.detail ?? "-"}`,
    `Target: ${watcher.target ?? "-"}`,
    `Scope: ${watcher.scope ?? "-"}`,
    `Session: ${watcher.sessionId ?? "-"}`,
    `Task: ${watcher.taskId ?? "-"}`,
    `Project: ${watcher.projectId ?? "-"}`,
    `Activity: ${watcher.activityAt ? formatTimestamp(watcher.activityAt) : "never"}`,
    `Retry count: ${watcher.retryCount ?? 0}`
  ].join("\n");
}

export function formatAgentList(
  agents: readonly FleetAgentRecord[],
  enabled: boolean
): string {
  if (agents.length === 0) {
    return `Fleet ${enabled ? "enabled" : "disabled"}.\n\nNo agents yet.`;
  }

  const lines = [`Fleet ${enabled ? "enabled" : "disabled"}`, ""];

  for (const agent of agents) {
    lines.push(
      `${agent.id}  ${agent.state}  ${agent.role}  task=${agent.task}`
    );
    lines.push(
      `  cwd=${agent.currentCwd ?? "-"}  scope=${agent.currentScope ?? "-"}  blockers=${agent.blockers?.length ?? 0}  changed=${agent.changedFiles.length}`
    );

    if (agent.summary) {
      lines.push(`  ${agent.summary}`);
    }
  }

  return lines.join("\n");
}

export function formatAgentDetail(agent: FleetAgentRecord): string {
  const lines = [
    `Agent ${agent.id}`,
    `Role: ${agent.role}`,
    `State: ${agent.state}`,
    `Task: ${agent.task}`,
    `Parent session: ${agent.parentSessionId}`,
    `Worker session: ${agent.workerSessionId ?? "-"}`,
    `Current cwd: ${agent.currentCwd ?? "-"}`,
    `Current scope: ${agent.currentScope ?? "-"}`,
    `Allowed tools: ${agent.allowedToolNames?.join(", ") ?? "-"}`,
    `Locks: ${agent.lockKeys.length > 0 ? agent.lockKeys.join(", ") : "-"}`,
    `Changed files: ${agent.changedFiles.length > 0 ? agent.changedFiles.join(", ") : "-"}`,
    `Blockers: ${agent.blockers && agent.blockers.length > 0 ? agent.blockers.join(" | ") : "-"}`,
    `Error: ${agent.error ?? "-"}`,
    `Summary: ${agent.summary ?? "-"}`,
    `Requested action: ${agent.requestedAction ?? "-"}`
  ];

  if (agent.recentOutput && agent.recentOutput.length > 0) {
    lines.push("Recent output:");

    for (const line of agent.recentOutput) {
      lines.push(`- ${line}`);
    }
  }

  return lines.join("\n");
}

export function formatModeMessage(mode: ExecutionMode): string {
  return `Execution mode set to ${formatExecutionModeLabel(mode)}.`;
}

export function formatStyleMessage(style: ResponseMode): string {
  return `Response style set to ${formatResponseModeLabel(style)}.`;
}

export function formatHelpMessage(): string {
  const lines = ["Commands"];

  for (const command of COMMAND_REFERENCE) {
    lines.push(`${command.usage}  ${command.description}`);
  }

  return lines.join("\n");
}

export function formatModelList(
  models: readonly ProviderModelDefinition[],
  snapshot: ModelRuntimeSnapshot
): string {
  if (models.length === 0) {
    return `No models are available for ${snapshot.providerLabel}.`;
  }

  const lines = [`${snapshot.providerLabel} models`];

  for (const model of models) {
    const marker = model.id === snapshot.model ? "*" : " ";
    lines.push(`${marker} ${model.id}  ${model.label}`);
  }

  lines.push("");
  lines.push("Use /model <name> to switch models.");

  return lines.join("\n");
}

function parseModeCommand(input: string): AppCommand {
  const [, rawMode] = input.split(/\s+/, 2);
  const normalizedMode = rawMode?.trim().toLowerCase();

  if (!normalizedMode) {
    return {
      type: "invalid",
      message: "Usage: /mode <normal|plan|build>"
    };
  }

  if (
    normalizedMode === "normal" ||
    normalizedMode === "plan" ||
    normalizedMode === "build"
  ) {
    return {
      mode: normalizedMode,
      type: "mode"
    };
  }

  if (normalizedMode === "ultra") {
    return {
      style: "ultra",
      type: "style"
    };
  }

  return {
    type: "invalid",
    message: "Usage: /mode <normal|plan|build>"
  };
}

function parsePlanCommand(input: string): AppCommand {
  const prompt = input.replace(/^\/plan\s*/i, "").trim();

  return prompt.length > 0
    ? {
        prompt,
        type: "plan"
      }
    : {
        type: "plan"
      };
}

function parseCdCommand(input: string): AppCommand {
  const path = input.replace(/^\/cd\s*/i, "").trim();

  return path.length > 0
    ? {
        path,
        type: "cd"
      }
    : {
        type: "invalid",
        message: "Usage: /cd <path>"
      };
}

function parseStyleCommand(input: string): AppCommand {
  const [, rawStyle] = input.split(/\s+/, 2);
  const normalizedStyle = rawStyle?.trim().toLowerCase();

  if (!normalizedStyle || !isResponseMode(normalizedStyle)) {
    return {
      type: "invalid",
      message: "Usage: /style <normal|plan|ultra>"
    };
  }

  return {
    style: normalizedStyle,
    type: "style"
  };
}

function parseGoalCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const goalId = rest.join(" ").trim();

  switch (subcommand.toLowerCase()) {
    case "show":
      return goalId.length > 0
        ? { goalId, type: "goal_show" }
        : { type: "invalid", message: "Usage: /goal show <id>" };
    case "adopt":
      return goalId.length > 0
        ? { goalId, type: "goal_adopt" }
        : { type: "invalid", message: "Usage: /goal adopt <id>" };
    case "dismiss":
      return goalId.length > 0
        ? { goalId, type: "goal_dismiss" }
        : { type: "invalid", message: "Usage: /goal dismiss <id>" };
    default:
      return {
        type: "invalid",
        message: "Usage: /goal show <id> | /goal adopt <id> | /goal dismiss <id>"
      };
  }
}

function parseFleetCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();
  const payload = rest.join(" ").trim();

  switch (normalizedSubcommand) {
    case "start":
      return { type: "fleet_start" };
    case "stop":
      return { type: "fleet_stop" };
    case "status":
      return { type: "fleet_status" };
    case "assign": {
      if (payload.length === 0) {
        return {
          type: "invalid",
          message: "Usage: /fleet assign <role> <task>"
        };
      }

      const [rawRole, ...taskParts] = payload.split(/\s+/);
      const normalizedRole = rawRole.toLowerCase();
      const role =
        normalizedRole === "frontend" ||
        normalizedRole === "backend" ||
        normalizedRole === "tester" ||
        normalizedRole === "docs"
          ? normalizedRole
          : "general";
      const task =
        role === "general" ? payload : taskParts.join(" ").trim();

      if (task.length === 0) {
        return {
          type: "invalid",
          message: "Usage: /fleet assign <role> <task>"
        };
      }

      return {
        role,
        task,
        type: "fleet_assign"
      };
    }
    default:
      return {
        type: "invalid",
        message: "Usage: /fleet start | /fleet stop | /fleet status | /fleet assign <role> <task>"
      };
  }
}

function parseTaskCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();
  const value = rest.join(" ").trim();

  switch (normalizedSubcommand) {
    case "show":
      return value.length > 0
        ? { id: value, type: "task_show" }
        : { type: "invalid", message: "Usage: /task show <id>" };
    case "pause":
      return value.length > 0
        ? { id: value, type: "task_pause" }
        : { type: "invalid", message: "Usage: /task pause <id>" };
    case "resume":
      return value.length > 0
        ? { id: value, type: "task_resume" }
        : { type: "invalid", message: "Usage: /task resume <id>" };
    case "stop":
      return value.length > 0
        ? { id: value, type: "task_stop" }
        : { type: "invalid", message: "Usage: /task stop <id>" };
    case "cancel":
      return value.length > 0
        ? { id: value, type: "task_cancel" }
        : { type: "invalid", message: "Usage: /task cancel <id>" };
    case "retry":
      return value.length > 0
        ? { id: value, type: "task_retry" }
        : { type: "invalid", message: "Usage: /task retry <id>" };
    case "start":
      return value.length > 0
        ? { target: value, type: "task_start" }
        : { type: "invalid", message: "Usage: /task start <id|goal>" };
    default:
      return {
        type: "invalid",
        message:
          "Usage: /task show <id> | /task pause <id> | /task resume <id> | /task stop <id> | /task cancel <id> | /task retry <id> | /task start <id|goal>"
      };
  }
}

function parseWatcherCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();
  const value = rest.join(" ").trim();

  switch (normalizedSubcommand) {
    case "show":
      return value.length > 0
        ? { id: value, type: "watcher_show" }
        : { type: "invalid", message: "Usage: /watcher show <id>" };
    case "cancel":
      return value.length > 0
        ? { id: value, type: "watcher_cancel" }
        : { type: "invalid", message: "Usage: /watcher cancel <id>" };
    default:
      return {
        type: "invalid",
        message: "Usage: /watchers | /watcher show <id> | /watcher cancel <id>"
      };
  }
}

function parseAgentCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();
  const value = rest.join(" ").trim();

  switch (normalizedSubcommand) {
    case "show":
      return value.length > 0
        ? { id: value, type: "agent_show" }
        : { type: "invalid", message: "Usage: /agent show <id>" };
    case "pause":
      return value.length > 0
        ? { id: value, type: "agent_pause" }
        : { type: "invalid", message: "Usage: /agent pause <id>" };
    case "resume":
      return value.length > 0
        ? { id: value, type: "agent_resume" }
        : { type: "invalid", message: "Usage: /agent resume <id>" };
    case "stop":
      return value.length > 0
        ? { id: value, type: "agent_stop" }
        : { type: "invalid", message: "Usage: /agent stop <id>" };
    case "restart":
      return value.length > 0
        ? { id: value, type: "agent_restart" }
        : { type: "invalid", message: "Usage: /agent restart <id>" };
    default:
      return {
        type: "invalid",
        message:
          "Usage: /agent show <id> | /agent pause <id> | /agent resume <id> | /agent stop <id> | /agent restart <id>"
      };
  }
}

function parseScopeCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();

  if (normalizedSubcommand.length === 0) {
    return { type: "scope" };
  }

  if (normalizedSubcommand === "grant") {
    const [rawScope = "", hostId] = rest;
    const grantScope = rawScope.trim().toLowerCase();

    if (
      grantScope === "workspace" ||
      grantScope === "home" ||
      grantScope === "full-machine" ||
      grantScope === "remote-host"
    ) {
      if (grantScope === "remote-host" && (!hostId || hostId.trim().length === 0)) {
        return {
          type: "invalid",
          message: "Usage: /scope grant remote-host <host>"
        };
      }

      return {
        grantScope,
        hostId: hostId?.trim() || undefined,
        type: "scope_grant"
      };
    }

    return {
      type: "invalid",
      message: "Usage: /scope grant <workspace|home|full-machine|remote-host> [host]"
    };
  }

  if (normalizedSubcommand === "revoke") {
    const grantIdOrScope = rest.join(" ").trim();

    return grantIdOrScope.length > 0
      ? {
          grantIdOrScope,
          type: "scope_revoke"
        }
      : {
          type: "invalid",
          message: "Usage: /scope revoke <scope|id>"
        };
  }

  return {
    type: "invalid",
    message:
      "Usage: /scope | /scope grant <workspace|home|full-machine|remote-host> [host] | /scope revoke <scope|id>"
  };
}

function parseOrchestratorCommand(input: string): AppCommand {
  const [, subcommand = ""] = input.split(/\s+/, 2);

  switch (subcommand.toLowerCase()) {
    case "status":
      return { type: "orchestrator_status" };
    case "queue":
      return { type: "orchestrator_queue" };
    case "health":
      return { type: "orchestrator_health" };
    default:
      return {
        type: "invalid",
        message: "Usage: /orchestrator status | /orchestrator queue | /orchestrator health"
      };
  }
}

function parseRemoteCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();

  switch (normalizedSubcommand) {
    case "list":
      return { type: "remote_list" };
    case "status":
      return rest[0]
        ? { id: rest[0], type: "remote_status" }
        : { type: "invalid", message: "Usage: /remote status <id>" };
    case "connect":
      return rest[0]
        ? { id: rest[0], type: "remote_connect" }
        : { type: "invalid", message: "Usage: /remote connect <id>" };
    case "disconnect":
      return rest[0]
        ? { id: rest[0], type: "remote_disconnect" }
        : { type: "invalid", message: "Usage: /remote disconnect <id>" };
    case "remove":
      return rest[0]
        ? { id: rest[0], type: "remote_remove" }
        : { type: "invalid", message: "Usage: /remote remove <id>" };
    case "add": {
      const [id, host, username, rawPort] = rest;

      if (!id || !host) {
        return {
          type: "invalid",
          message: "Usage: /remote add <id> <host> [username] [port]"
        };
      }

      return {
        host,
        id,
        port: rawPort && Number.isFinite(Number(rawPort)) ? Number(rawPort) : undefined,
        type: "remote_add",
        username
      };
    }
    default:
      return {
        type: "invalid",
        message:
          "Usage: /remote add <id> <host> [username] [port] | list | status <id> | connect <id> | disconnect <id> | remove <id>"
      };
  }
}

function parseSshCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.toLowerCase();

  switch (normalizedSubcommand) {
    case "":
    case "list":
      return { type: "ssh_list" };
    case "add": {
      const [name, host, username, rawPort] = rest;

      if (!name && !host) {
        return { type: "ssh_add" };
      }

      if (!name || !host) {
        return {
          type: "invalid",
          message: "Usage: /ssh add [name host [username] [port]]"
        };
      }

      return {
        host,
        name,
        port: rawPort && Number.isFinite(Number(rawPort)) ? Number(rawPort) : undefined,
        type: "ssh_add_inline",
        username
      };
    }
    case "test":
      return rest[0]
        ? { name: rest[0], type: "ssh_test" }
        : { type: "invalid", message: "Usage: /ssh test <name>" };
    case "run": {
      const [name, ...commandParts] = rest;
      const command = commandParts.join(" ").trim();

      if (!name || command.length === 0) {
        return {
          type: "invalid",
          message: "Usage: /ssh run <name> <command>"
        };
      }

      return {
        command,
        name,
        type: "ssh_run"
      };
    }
    case "remove":
      return rest[0]
        ? { name: rest[0], type: "ssh_remove" }
        : { type: "invalid", message: "Usage: /ssh remove <name>" };
    default:
      return {
        type: "invalid",
        message:
          "Usage: /ssh add [name host [username] [port]] | list | test <name> | run <name> <command> | remove <name>"
      };
  }
}

function parseMcpCommand(input: string): AppCommand {
  const [, subcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = subcommand.trim().toLowerCase();
  const name = rest.join(" ").trim();

  switch (normalizedSubcommand) {
    case "add":
      return { type: "mcp_add" };
    case "list":
      return { type: "mcp_list" };
    case "marketplace":
      return { type: "mcp_marketplace" };
    case "refresh":
      return { type: "mcp_refresh" };
    case "install":
      return name.length > 0
        ? { name, type: "mcp_install" }
        : {
            type: "invalid",
            message: "Usage: /mcp install <name>"
          };
    case "info":
      return name.length > 0
        ? { name, type: "mcp_info" }
        : {
            type: "invalid",
            message: "Usage: /mcp info <name>"
          };
    case "enable":
      return name.length > 0
        ? { name, type: "mcp_enable" }
        : {
            type: "invalid",
            message: "Usage: /mcp enable <name>"
          };
    case "disable":
      return name.length > 0
        ? { name, type: "mcp_disable" }
        : {
            type: "invalid",
            message: "Usage: /mcp disable <name>"
          };
    case "remove":
      return name.length > 0
        ? { name, type: "mcp_remove" }
        : {
            type: "invalid",
            message: "Usage: /mcp remove <name>"
          };
    case "edit":
      return name.length > 0
        ? { name, type: "mcp_edit" }
        : {
            type: "invalid",
            message: "Usage: /mcp edit <name>"
          };
    default:
      return {
        type: "invalid",
        message:
          "Usage: /mcp add | /mcp list | /mcp refresh | /mcp marketplace | /mcp info <name> | /mcp install <name> | /mcp enable <name> | /mcp disable <name> | /mcp remove <name> | /mcp edit <name>"
      };
  }
}

function parseModelCommand(input: string): AppCommand {
  if (input === "/models") {
    return { type: "models" };
  }

  const [, ...rest] = input.split(/\s+/);
  const model = rest.join(" ").trim();

  if (model.length === 0) {
    return {
      type: "invalid",
      message: "Usage: /model <name>"
    };
  }

  return {
    model,
    type: "model"
  };
}

function parseScheduleCommand(input: string): AppCommand {
  const trimmed = input.replace(/^\/schedule\s+/i, "").trim();
  const normalized = trimmed.startsWith("every ")
    ? trimmed.replace(/^every\s+/i, "")
    : trimmed;
  const [intervalToken, ...promptParts] = normalized.split(/\s+/);
  const intervalMinutes = Number(intervalToken);
  const prompt = promptParts.join(" ").trim();

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return {
      type: "invalid",
      message: "Usage: /schedule <minutes> <prompt>"
    };
  }

  if (prompt.length === 0) {
    return {
      type: "invalid",
      message: "Usage: /schedule <minutes> <prompt>"
    };
  }

  return {
    intervalMinutes,
    prompt,
    type: "schedule"
  };
}

function parseAutoCommand(input: string): AppCommand {
  const trimmed = input.replace(/^\/auto\s*/i, "").trim();

  if (trimmed.length === 0) {
    return {
      type: "invalid",
      message: "Usage: /auto <minutes> or /auto stop"
    };
  }

  if (trimmed.toLowerCase() === "stop") {
    return {
      type: "auto_stop"
    };
  }

  const intervalMinutes = Number(trimmed);

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return {
      type: "invalid",
      message: "Usage: /auto <minutes> or /auto stop"
    };
  }

  return {
    intervalMinutes,
    type: "auto"
  };
}

function parseMemoryCommand(input: string): AppCommand {
  const trimmed = input.replace(/^\/memory\s*/i, "").trim();

  if (trimmed.length === 0) {
    return { type: "memory_show" };
  }

  if (trimmed.toLowerCase() === "show") {
    return { type: "memory_show" };
  }

  if (trimmed.toLowerCase() === "clear") {
    return { type: "memory_clear" };
  }

  if (trimmed.toLowerCase() === "compact") {
    return { type: "memory_compact" };
  }

  if (trimmed.toLowerCase() === "global") {
    return { type: "memory_global_show" };
  }

  if (trimmed.toLowerCase() === "global show") {
    return { type: "memory_global_show" };
  }

  const globalRememberMatch = trimmed.match(/^global\s+remember\s+(.+)$/i);

  if (globalRememberMatch) {
    const text = globalRememberMatch[1]?.trim() ?? "";
    return text.length > 0
      ? { text, type: "memory_global_remember" }
      : {
          type: "invalid",
          message: "Usage: /memory global remember <text>"
        };
  }

  const globalForgetMatch = trimmed.match(/^global\s+forget\s+(.+)$/i);

  if (globalForgetMatch) {
    const key = globalForgetMatch[1]?.trim() ?? "";
    return key.length > 0
      ? { key, type: "memory_global_forget" }
      : {
          type: "invalid",
          message: "Usage: /memory global forget <key>"
        };
  }

  const searchMatch = trimmed.match(/^search\s+(.+)$/i);

  if (searchMatch) {
    const keyword = searchMatch[1]?.trim() ?? "";
    return keyword.length > 0
      ? { keyword, type: "memory_search" }
      : {
          type: "invalid",
          message: "Usage: /memory search <keyword>"
        };
  }

  return {
    type: "invalid",
    message:
      "Usage: /memory show | /memory clear | /memory compact | /memory global show | /memory global remember <text> | /memory global forget <key> | /memory search <keyword>"
  };
}

function parseTimelineCommand(input: string): AppCommand {
  const trimmed = input.replace(/^\/timeline\s*/i, "").trim();

  if (trimmed.length === 0 || trimmed.toLowerCase() === "recent") {
    return trimmed.length === 0 ? { type: "timeline" } : { type: "timeline_recent" };
  }

  const filterMatch = trimmed.match(/^filter\s+(.+)$/i);

  if (filterMatch) {
    const filterType = filterMatch[1]?.trim() ?? "";

    return filterType.length > 0
      ? { filterType, type: "timeline_filter" }
      : {
          type: "invalid",
          message: "Usage: /timeline filter <type>"
        };
  }

  return {
    type: "invalid",
    message: "Usage: /timeline | /timeline recent | /timeline filter <type>"
  };
}

function parseApprovalAction(
  input: string,
  action: "approve" | "reject"
): AppCommand {
  const value = input.replace(new RegExp(`^\\/${action}\\s*`, "i"), "").trim();
  const normalizedValue = value.toLowerCase();

  if (action === "approve") {
    if (
      normalizedValue === "once" ||
      normalizedValue === "task" ||
      normalizedValue === "session" ||
      normalizedValue === "all"
    ) {
      return {
        scope: normalizedValue,
        type: "approve_scope"
      };
    }

    if (
      normalizedValue === "approve-all" ||
      normalizedValue === "approve-task" ||
      normalizedValue === "approve-session" ||
      normalizedValue === "ask-every-time" ||
      normalizedValue === "auto-safe" ||
      normalizedValue === "auto-safe-medium" ||
      normalizedValue === "full" ||
      normalizedValue === "strict"
    ) {
      return {
        policy:
          normalizedValue === "approve-all"
            ? "approve-all"
            : normalizedValue === "approve-task"
              ? "approve-task"
              : normalizedValue === "approve-session"
                ? "approve-session"
                : normalizedValue,
        type: "approve_policy"
      };
    }
  }

  if (value.length === 0) {
    return {
      type: "invalid",
      message:
        action === "approve"
          ? "Usage: /approve <id> | /approve once | /approve task | /approve session | /approve all | /approve ask-every-time | /approve auto-safe | /approve auto-safe-medium | /approve full | /approve strict"
          : "Usage: /reject <id>"
    };
  }

  return action === "approve"
    ? {
        id: value,
        type: "approve"
      }
    : {
        id: value,
        type: "reject"
      };
}

function parseAutopilotCommand(input: string): AppCommand {
  const [, rawSubcommand = "", ...rest] = input.split(/\s+/);
  const normalizedSubcommand = rawSubcommand.trim().toLowerCase();
  const normalizedPolicy = rest.join(" ").trim().toLowerCase();

  if (normalizedSubcommand.length === 0 || normalizedSubcommand === "status") {
    return { type: "autopilot_status" };
  }

  if (normalizedSubcommand === "off") {
    return { type: "autopilot_off" };
  }

  if (normalizedSubcommand === "full") {
    return {
      policy: "full",
      type: "autopilot_on"
    };
  }

  if (normalizedSubcommand === "on") {
    if (
      normalizedPolicy.length === 0 ||
      normalizedPolicy === "full" ||
      normalizedPolicy === "auto-safe" ||
      normalizedPolicy === "auto-safe-medium" ||
      normalizedPolicy === "strict"
    ) {
      return {
        policy:
          normalizedPolicy.length > 0
            ? (normalizedPolicy as ApprovalPolicyPreset)
            : undefined,
        type: "autopilot_on"
      };
    }

    return {
      type: "invalid",
      message:
        "Usage: /autopilot on [full|auto-safe|auto-safe-medium|strict] | /autopilot off | /autopilot status"
    };
  }

  return {
    type: "invalid",
    message:
      "Usage: /autopilot on [full|auto-safe|auto-safe-medium|strict] | /autopilot off | /autopilot status"
  };
}

function formatInterval(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}m`;
  }

  return `${value}m`;
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildUnknownCommand(input: string): AppCommand {
  const rawCommand = input.split(/\s+/, 1)[0] ?? input;
  const suggestions = suggestCommands(rawCommand);
  const suggestionText =
    suggestions.length > 0
      ? ` Did you mean ${formatCommandSuggestions(suggestions)}?`
      : "";

  return {
    type: "invalid",
    message: `Unknown command "${rawCommand}".${suggestionText} Use /help to see all commands.`
  };
}

function suggestCommands(command: string): string[] {
  return COMMAND_REFERENCE.map((entry) => entry.command)
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(command, candidate)
    }))
    .filter(({ candidate, distance }) => {
      if (candidate.startsWith(command) || command.startsWith(candidate)) {
        return true;
      }

      return distance <= 3;
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}

function formatCommandSuggestions(suggestions: readonly string[]): string {
  if (suggestions.length === 1) {
    return suggestions[0];
  }

  if (suggestions.length === 2) {
    return `${suggestions[0]} or ${suggestions[1]}`;
  }

  return `${suggestions[0]}, ${suggestions[1]}, or ${suggestions[2]}`;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0)
  );

  for (let row = 0; row <= left.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= right.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return matrix[left.length][right.length];
}
