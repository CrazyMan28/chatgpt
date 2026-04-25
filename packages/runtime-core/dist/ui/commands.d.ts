import { type ExecutionMode } from "../modes/execution-mode.js";
import { type ResponseMode } from "../modes/response-mode.js";
import type { ApprovalPolicyPreset, FleetAgentRecord, FilesystemScope, WatcherRecord } from "../platform/types.js";
import type { ModelRuntimeSnapshot, ProviderModelDefinition } from "../providers/provider-types.js";
import type { SessionSummary } from "../storage/session-store.js";
import type { BackgroundTaskView } from "../tasks/background-task-runner.js";
export type AppCommand = {
    type: "help";
} | {
    type: "login";
} | {
    type: "models";
} | {
    model: string;
    type: "model";
} | {
    type: "goals";
} | {
    goalId: string;
    type: "goal_show";
} | {
    goalId: string;
    type: "goal_adopt";
} | {
    goalId: string;
    type: "goal_dismiss";
} | {
    type: "fleet_start";
} | {
    type: "fleet_stop";
} | {
    type: "fleet_status";
} | {
    role: "general" | "frontend" | "backend" | "tester" | "docs";
    task: string;
    type: "fleet_assign";
} | {
    type: "orchestrator_status";
} | {
    type: "orchestrator_queue";
} | {
    type: "orchestrator_health";
} | {
    type: "remote_list";
} | {
    id: string;
    type: "remote_status";
} | {
    id: string;
    type: "remote_connect";
} | {
    id: string;
    type: "remote_disconnect";
} | {
    id: string;
    type: "remote_remove";
} | {
    host: string;
    id: string;
    port?: number;
    type: "remote_add";
    username?: string;
} | {
    type: "ssh_list";
} | {
    name: string;
    type: "ssh_test";
} | {
    command: string;
    name: string;
    type: "ssh_run";
} | {
    name: string;
    type: "ssh_remove";
} | {
    type: "ssh_add";
} | {
    host: string;
    name: string;
    port?: number;
    type: "ssh_add_inline";
    username?: string;
} | {
    type: "mcp_add";
} | {
    type: "mcp_list";
} | {
    type: "mcp_marketplace";
} | {
    type: "mcp_refresh";
} | {
    name: string;
    type: "mcp_install";
} | {
    name: string;
    type: "mcp_info";
} | {
    name: string;
    type: "mcp_enable";
} | {
    name: string;
    type: "mcp_disable";
} | {
    name: string;
    type: "mcp_remove";
} | {
    name: string;
    type: "mcp_edit";
} | {
    prompt?: string;
    type: "plan";
} | {
    type: "build";
} | {
    type: "resume";
} | {
    intervalMinutes: number;
    type: "auto";
} | {
    type: "auto_stop";
} | {
    type: "new";
} | {
    type: "list";
} | {
    id: string;
    type: "open";
} | {
    type: "cwd";
} | {
    path: string;
    type: "cd";
} | {
    type: "scope";
} | {
    grantScope: FilesystemScope;
    hostId?: string;
    type: "scope_grant";
} | {
    grantIdOrScope: string;
    type: "scope_revoke";
} | {
    type: "approvals";
} | {
    id: string;
    type: "approve";
} | {
    policy: ApprovalPolicyPreset;
    type: "approve_policy";
} | {
    scope: "once" | "task" | "session" | "all";
    type: "approve_scope";
} | {
    policy?: ApprovalPolicyPreset;
    type: "autopilot_on";
} | {
    type: "autopilot_off";
} | {
    type: "autopilot_status";
} | {
    id: string;
    type: "reject";
} | {
    type: "memory_show";
} | {
    type: "memory_clear";
} | {
    type: "memory_compact";
} | {
    type: "memory_global_show";
} | {
    text: string;
    type: "memory_global_remember";
} | {
    key: string;
    type: "memory_global_forget";
} | {
    keyword: string;
    type: "memory_search";
} | {
    type: "timeline";
} | {
    type: "timeline_recent";
} | {
    filterType: string;
    type: "timeline_filter";
} | {
    mode: ExecutionMode;
    type: "mode";
} | {
    style: ResponseMode;
    type: "style";
} | {
    type: "agents";
} | {
    id: string;
    type: "agent_show";
} | {
    id: string;
    type: "agent_pause";
} | {
    id: string;
    type: "agent_resume";
} | {
    id: string;
    type: "agent_stop";
} | {
    id: string;
    type: "agent_restart";
} | {
    type: "tasks";
} | {
    id: string;
    type: "task_show";
} | {
    id: string;
    type: "task_pause";
} | {
    id: string;
    type: "task_resume";
} | {
    id: string;
    type: "task_stop";
} | {
    id: string;
    type: "task_cancel";
} | {
    id: string;
    type: "task_retry";
} | {
    target: string;
    type: "task_start";
} | {
    type: "watchers";
} | {
    id: string;
    type: "watcher_show";
} | {
    id: string;
    type: "watcher_cancel";
} | {
    intervalMinutes: number;
    prompt: string;
    type: "schedule";
} | {
    message: string;
    type: "invalid";
};
export declare function parseAppCommand(input: string): AppCommand | undefined;
export declare function formatSessionList(sessions: readonly SessionSummary[], currentSessionId: string): string;
export declare function formatTaskList(tasks: readonly BackgroundTaskView[], currentSessionId: string): string;
export declare function formatTaskDetail(task: BackgroundTaskView): string;
export declare function formatWatcherList(watchers: readonly WatcherRecord[]): string;
export declare function formatWatcherDetail(watcher: WatcherRecord): string;
export declare function formatAgentList(agents: readonly FleetAgentRecord[], enabled: boolean): string;
export declare function formatAgentDetail(agent: FleetAgentRecord): string;
export declare function formatModeMessage(mode: ExecutionMode): string;
export declare function formatStyleMessage(style: ResponseMode): string;
export declare function formatHelpMessage(): string;
export declare function formatModelList(models: readonly ProviderModelDefinition[], snapshot: ModelRuntimeSnapshot): string;
//# sourceMappingURL=commands.d.ts.map