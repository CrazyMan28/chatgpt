import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Box, Spacer, Text } from "ink";
import { listMarketplaceEntries } from "../../mcp/mcp-marketplace.js";
import { formatExecutionModeLabel } from "../../modes/execution-mode.js";
import { readScopeLabel } from "../../tools/workspace-safety.js";
import { useAppRuntimeState } from "../runtime-state.js";
import { getTuiThemeColors } from "../theme.js";
import { ApprovalRow, DataRow, EmptyState, FleetRow, InspectorSection, InspectorTabs, McpRow, TaskRow, shortenPath, truncate } from "./chrome.js";
import { Panel } from "./panel.js";
const INSPECTOR_TABS = [
    "overview",
    "tasks",
    "approvals",
    "tools",
    "mcp",
    "fleet",
    "memory",
    "session",
    "logs"
];
export function InspectorPanel({ activeTools, activityLog, approvals, approvalStatus, autoModeLabel, autoModeLastAction, autoModeNextRunLabel, currentWorkflowLabel, desktopStatus, executionContext, executionMode, fleetAgents, goalsCount, height, lastToolSummary, mcpServers, memoryCount, panel, phaseLabel, responseModeLabel, runningTaskCount, sessionId, sessionTitle, taskCount, tasks, themeName, tools, verbosity, width, workflowProgressLabel }) {
    const colors = getTuiThemeColors(themeName);
    const appState = useAppRuntimeState();
    const innerWidth = Math.max(12, width - 4);
    const pendingApprovals = approvals.filter((approval) => approval.state === "pending");
    const coreToolCount = tools.filter((tool) => tool.source === "core").length;
    const mcpToolCount = tools.length - coreToolCount;
    const enabledMcpCount = mcpServers.filter((server) => server.status === "ENABLED").length;
    return (_jsx(Panel, { height: height, subtitle: `${panel} | Tab cycles`, themeName: themeName, title: "Inspector", width: width, children: _jsxs(Box, { flexDirection: "column", children: [_jsx(InspectorTabs, { active: panel, tabs: INSPECTOR_TABS, themeName: themeName, width: innerWidth }), panel === "overview" ? (_jsx(OverviewView, { activeTools: activeTools, approvalCount: pendingApprovals.length, appLogin: appState.loginLabel, appModel: appState.model, appProject: appState.projectLabel, appProvider: appState.providerLabel, autoModeLabel: autoModeLabel, coreToolCount: coreToolCount, currentWorkflowLabel: currentWorkflowLabel, desktopStatus: desktopStatus, enabledMcpCount: enabledMcpCount, executionContext: executionContext, executionMode: executionMode, fleetAgents: fleetAgents, innerWidth: innerWidth, lastToolSummary: lastToolSummary, mcpToolCount: mcpToolCount, memoryCount: memoryCount, phaseLabel: phaseLabel, runningTaskCount: runningTaskCount, sessionId: sessionId, sessionTitle: sessionTitle, taskCount: taskCount, tasks: tasks, themeName: themeName, workflowProgressLabel: workflowProgressLabel })) : null, panel === "tasks" ? (_jsx(TaskList, { tasks: tasks, themeName: themeName, width: innerWidth })) : null, panel === "approvals" ? (_jsx(ApprovalList, { approvals: approvals, approvalStatus: approvalStatus, themeName: themeName, width: innerWidth })) : null, panel === "tools" ? (_jsx(ToolsView, { activeTools: activeTools, desktopStatus: desktopStatus, executionMode: executionMode, themeName: themeName, tools: tools, width: innerWidth })) : null, panel === "mcp" ? (_jsx(McpList, { mcpServers: mcpServers, projectLabel: appState.projectLabel, themeName: themeName, width: innerWidth })) : null, panel === "fleet" ? (_jsx(FleetList, { fleetAgents: fleetAgents, themeName: themeName, width: innerWidth })) : null, panel === "memory" ? (_jsx(MemorySummary, { goalsCount: goalsCount, memoryCount: memoryCount, themeName: themeName, width: innerWidth })) : null, panel === "session" ? (_jsx(SessionView, { executionContext: executionContext, executionMode: executionMode, projectLabel: appState.projectLabel, responseModeLabel: responseModeLabel, sessionId: sessionId, sessionTitle: sessionTitle, themeName: themeName, verbosity: verbosity, width: innerWidth })) : null, panel === "logs" ? (_jsx(LogsView, { activeTools: activeTools, activityLog: activityLog, autoModeLastAction: autoModeLastAction, autoModeNextRunLabel: autoModeNextRunLabel, colors: colors, lastToolSummary: lastToolSummary, themeName: themeName, width: innerWidth })) : null] }) }));
}
function OverviewView({ activeTools, approvalCount, appModel, appProject, appProvider, appLogin, autoModeLabel, coreToolCount, currentWorkflowLabel, desktopStatus, enabledMcpCount, executionContext, executionMode, fleetAgents, innerWidth, lastToolSummary, mcpToolCount, memoryCount, phaseLabel, runningTaskCount, sessionId, sessionTitle, taskCount, tasks, themeName, workflowProgressLabel }) {
    const queuedTasks = tasks.filter((task) => task.state === "queued").length;
    const failedTasks = tasks.filter((task) => task.state === "failed").length;
    const blockedTasks = tasks.filter((task) => /approval|blocked|waiting/i.test(task.state)).length;
    const runningTools = activeTools.filter((tool) => tool.status === "running");
    const runningAgents = fleetAgents.filter((agent) => agent.state === "running").length;
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Session", children: [_jsx(DataRow, { label: "id", themeName: themeName, value: shortId(sessionId), width: innerWidth }), _jsx(DataRow, { label: "title", themeName: themeName, value: sessionTitle, width: innerWidth }), _jsx(DataRow, { label: "project", themeName: themeName, value: appProject, width: innerWidth }), _jsx(DataRow, { label: "cwd", themeName: themeName, value: shortenPath(executionContext.cwd, innerWidth - 8), width: innerWidth })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Runtime", children: [_jsx(DataRow, { label: "state", themeName: themeName, tone: phaseLabel === "Ready" ? "success" : "accent", value: phaseLabel, width: innerWidth }), _jsx(DataRow, { label: "mode", themeName: themeName, tone: "accent", value: formatExecutionModeLabel(executionMode), width: innerWidth }), _jsx(DataRow, { label: "pilot", themeName: themeName, value: autoModeLabel, width: innerWidth }), _jsx(DataRow, { label: "provider", themeName: themeName, value: appProvider, width: innerWidth }), _jsx(DataRow, { label: "model", themeName: themeName, value: appModel, width: innerWidth }), _jsx(DataRow, { label: "login", themeName: themeName, value: appLogin, width: innerWidth }), _jsx(DataRow, { label: "scope", themeName: themeName, value: readScopeLabel(executionContext.scope), width: innerWidth })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Work Queue", children: [_jsx(DataRow, { label: "tasks", themeName: themeName, value: `${taskCount} total`, width: innerWidth }), _jsx(DataRow, { label: "running", themeName: themeName, tone: runningTaskCount > 0 ? "accent" : "muted", value: `${runningTaskCount}`, width: innerWidth }), _jsx(DataRow, { label: "queued", themeName: themeName, value: `${queuedTasks}`, width: innerWidth }), _jsx(DataRow, { label: "blocked", themeName: themeName, tone: blockedTasks > 0 ? "warning" : "muted", value: `${blockedTasks}`, width: innerWidth }), _jsx(DataRow, { label: "failed", themeName: themeName, tone: failedTasks > 0 ? "error" : "muted", value: `${failedTasks}`, width: innerWidth })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Systems", children: [_jsx(DataRow, { label: "tools", themeName: themeName, value: `${coreToolCount} core, ${mcpToolCount} mcp`, width: innerWidth }), _jsx(DataRow, { label: "active", themeName: themeName, value: runningTools.length === 0 ? "none" : runningTools.map((tool) => tool.name).join(", "), width: innerWidth }), _jsx(DataRow, { label: "mcp", themeName: themeName, value: `${enabledMcpCount} enabled`, width: innerWidth }), _jsx(DataRow, { label: "desktop", themeName: themeName, tone: desktopStatus?.coreEnabled ? "success" : "muted", value: desktopStatus?.coreEnabled ? "core enabled" : "unknown", width: innerWidth }), _jsx(DataRow, { label: "vision", themeName: themeName, value: formatVisionLabel(desktopStatus), width: innerWidth }), _jsx(DataRow, { label: "fleet", themeName: themeName, value: `${runningAgents}/${fleetAgents.length} running`, width: innerWidth }), _jsx(DataRow, { label: "memory", themeName: themeName, value: `${memoryCount} facts`, width: innerWidth }), _jsx(DataRow, { label: "approvals", themeName: themeName, tone: approvalCount > 0 ? "warning" : "muted", value: `${approvalCount} pending`, width: innerWidth })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Current Step", children: [_jsx(DataRow, { label: "flow", themeName: themeName, value: currentWorkflowLabel, width: innerWidth }), _jsx(DataRow, { label: "progress", themeName: themeName, value: workflowProgressLabel, width: innerWidth }), _jsx(Text, { color: getTuiThemeColors(themeName).muted, children: truncate(lastToolSummary, innerWidth) })] })] }));
}
export function TaskList({ tasks, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const running = tasks.filter((task) => task.isRunning).length;
    const queued = tasks.filter((task) => task.state === "queued").length;
    const failed = tasks.filter((task) => task.state === "failed").length;
    if (tasks.length === 0) {
        return (_jsx(EmptyState, { detail: "New interactive and scheduled work will appear here.", themeName: themeName, title: "No tracked tasks", width: width }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Queue", children: [_jsx(DataRow, { label: "running", themeName: themeName, tone: running > 0 ? "accent" : "muted", value: `${running}`, width: width }), _jsx(DataRow, { label: "queued", themeName: themeName, value: `${queued}`, width: width }), _jsx(DataRow, { label: "failed", themeName: themeName, tone: failed > 0 ? "error" : "muted", value: `${failed}`, width: width })] }), _jsx(InspectorSection, { themeName: themeName, title: "Tasks", children: tasks.slice(0, 10).map((task) => (_jsx(TaskRow, { currentStep: task.currentStep ?? task.blockedReason ?? task.validationStatus, id: shortId(task.id), state: formatTaskState(task), themeName: themeName, title: task.title, width: width }, task.id))) }), tasks.length > 10 ? (_jsx(Text, { color: colors.muted, children: `+${tasks.length - 10} more | /task show <id>` })) : null] }));
}
export function ApprovalList({ approvals, approvalStatus, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const pending = approvals.filter((approval) => approval.state === "pending");
    const recentApproved = approvals
        .filter((approval) => approval.state === "approved")
        .slice(0, 6);
    const retryPending = recentApproved.filter((approval) => ["approved_retry_pending", "retrying"].includes(String(approval.metadata.retryState ?? "")));
    const blocked = approvals.filter((approval) => approval.state === "pending" ||
        approval.metadata.retryState === "blocked" ||
        approval.metadata.retryState === "failed");
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Policy", children: [_jsx(DataRow, { label: "preset", themeName: themeName, value: approvalStatus.policy.preset ?? "strict", width: width }), _jsx(DataRow, { label: "grant", themeName: themeName, value: formatGrantLabel(approvalStatus), width: width })] }), _jsx(InspectorSection, { themeName: themeName, title: "Pending Approval", children: pending.length === 0 ? (_jsx(Text, { color: colors.muted, children: "none" })) : (pending.slice(0, 8).map((approval) => (_jsx(ApprovalRow, { action: approval.summary, id: shortId(approval.id), scope: approval.scope ?? approval.kind, task: readMetadataString(approval.metadata, "taskId"), themeName: themeName, width: width }, approval.id)))) }), _jsx(InspectorSection, { themeName: themeName, title: "Recent Approved", children: recentApproved.length === 0 ? (_jsx(Text, { color: colors.muted, children: "none" })) : (recentApproved.map((approval) => (_jsx(ApprovalRow, { action: `${approval.summary} ${String(approval.metadata.retryState ?? "approved")}`, id: shortId(approval.id), scope: approval.scope ?? approval.kind, task: readMetadataString(approval.metadata, "taskId"), themeName: themeName, width: width }, approval.id)))) }), _jsx(InspectorSection, { themeName: themeName, title: "Retry Pending Actions", children: retryPending.length === 0 ? (_jsx(Text, { color: colors.muted, children: "none" })) : (retryPending.map((approval) => (_jsx(Text, { color: colors.warning, children: truncate(`${shortId(approval.id)} ${readMetadataString(approval.metadata, "toolName") ?? approval.summary}`, width) }, approval.id)))) }), _jsx(InspectorSection, { themeName: themeName, title: "Blocked Actions", children: blocked.length === 0 ? (_jsx(Text, { color: colors.muted, children: "none" })) : (blocked.slice(0, 6).map((approval) => (_jsx(Text, { color: approval.state === "pending" ? colors.warning : colors.error, children: truncate(`${shortId(approval.id)} ${approval.state} ${approval.summary}`, width) }, approval.id)))) }), _jsx(Text, { color: colors.muted, children: "/approve all  /retry last  Ctrl+O details" })] }));
}
function ToolsView({ activeTools, desktopStatus, executionMode, themeName, tools, width }) {
    const colors = getTuiThemeColors(themeName);
    const recentTools = activeTools.slice(0, 6);
    const coreDesktopEnabled = tools.some((tool) => tool.name === "desktop_status");
    if (tools.length === 0) {
        return (_jsx(EmptyState, { detail: "Core and MCP tools will appear after registry load.", themeName: themeName, title: "No tools loaded", width: width }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Safety", children: [_jsx(DataRow, { label: "mode", themeName: themeName, tone: "accent", value: formatExecutionModeLabel(executionMode), width: width }), _jsx(DataRow, { label: "level", themeName: themeName, value: executionMode === "plan" ? "read-only" : "approval gated", width: width })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Desktop", children: [_jsx(DataRow, { label: "core", themeName: themeName, tone: coreDesktopEnabled ? "success" : "muted", value: coreDesktopEnabled ? "enabled" : "disabled", width: width }), _jsx(DataRow, { label: "mode", themeName: themeName, value: desktopStatus?.config.mode ?? "unknown", width: width }), _jsx(DataRow, { label: "access", themeName: themeName, value: formatCapabilityLabel(desktopStatus?.capabilities?.accessibility), width: width }), _jsx(DataRow, { label: "screen", themeName: themeName, value: formatCapabilityLabel(desktopStatus?.capabilities?.screenshot), width: width }), _jsx(DataRow, { label: "vision", themeName: themeName, value: formatVisionLabel(desktopStatus), width: width }), _jsx(DataRow, { label: "window", themeName: themeName, value: desktopStatus?.lastObservation?.activeWindow?.title ?? "-", width: width }), _jsx(DataRow, { label: "shot at", themeName: themeName, value: formatOptionalTime(desktopStatus?.lastScreenshotAt), width: width }), _jsx(DataRow, { label: "action", themeName: themeName, value: desktopStatus?.lastAction?.action?.type ?? "-", width: width })] }), _jsx(InspectorSection, { themeName: themeName, title: "Recent", children: recentTools.length === 0 ? (_jsx(Text, { color: colors.muted, children: "No recent tool activity." })) : (recentTools.map((tool) => (_jsxs(Box, { children: [_jsx(Text, { color: tool.status === "running" ? colors.accent : tool.isError ? colors.error : colors.text, children: truncate(tool.name, Math.max(8, width - 12)) }), _jsx(Spacer, {}), _jsx(Text, { color: tool.status === "running" ? colors.accent : colors.muted, children: tool.status })] }, tool.id)))) }), _jsx(InspectorSection, { themeName: themeName, title: "Allowed Tools", children: tools.slice(0, 14).map((tool) => (_jsxs(Box, { children: [_jsx(Text, { color: colors.text, children: truncate(tool.name, Math.max(8, width - 9)) }), _jsx(Spacer, {}), _jsx(Text, { color: tool.source === "mcp" ? colors.accent : colors.muted, children: tool.source })] }, tool.id))) }), tools.length > 14 ? (_jsx(Text, { color: colors.muted, children: `+${tools.length - 14} more` })) : null] }));
}
export function McpList({ mcpServers, projectLabel, themeName, width }) {
    const enabled = mcpServers.filter((server) => server.status === "ENABLED").length;
    const marketplaceEntries = listMarketplaceEntries();
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Runtime", children: [_jsx(DataRow, { label: "project", themeName: themeName, value: projectLabel, width: width }), _jsx(DataRow, { label: "installed", themeName: themeName, value: `${mcpServers.length}`, width: width }), _jsx(DataRow, { label: "enabled", themeName: themeName, tone: enabled > 0 ? "success" : "muted", value: `${enabled}`, width: width }), _jsx(DataRow, { label: "active set", themeName: themeName, value: enabled > 0 ? "loaded" : "idle", width: width })] }), _jsx(InspectorSection, { themeName: themeName, title: "Servers", children: mcpServers.length === 0 ? (_jsx(EmptyState, { detail: "Use /mcp marketplace or /mcp add to configure servers.", themeName: themeName, title: "No MCP servers", width: width })) : (mcpServers.slice(0, 8).map((server) => (_jsx(McpRow, { health: "healthy", name: server.name, status: server.status === "ENABLED" ? "enabled" : "disabled", themeName: themeName, transport: server.definition.transport, width: width }, server.name)))) }), _jsx(InspectorSection, { themeName: themeName, title: "Marketplace", children: marketplaceEntries.slice(0, 5).map((entry) => (_jsx(McpRow, { health: "healthy", name: entry.name, status: entry.name === "desktop-control" ? "optional" : "available", themeName: themeName, transport: entry.draft.transport, width: width }, entry.name))) })] }));
}
export function FleetList({ fleetAgents, themeName, width }) {
    if (fleetAgents.length === 0) {
        return (_jsx(EmptyState, { detail: "Assigned sub-agents and blockers will appear here.", themeName: themeName, title: "No fleet agents", width: width }));
    }
    return (_jsx(InspectorSection, { themeName: themeName, title: "Agents", children: fleetAgents.slice(0, 8).map((agent) => (_jsx(FleetRow, { blockerCount: agent.blockers?.length ?? 0, id: shortId(agent.id), role: agent.role, state: agent.state, task: agent.task, themeName: themeName, width: width }, agent.id))) }));
}
export function MemorySummary({ goalsCount, memoryCount, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Durable Facts", children: [_jsx(DataRow, { label: "project", themeName: themeName, value: `${memoryCount} entries`, width: width }), _jsx(DataRow, { label: "goals", themeName: themeName, value: `${goalsCount} tracked`, width: width })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Commands", children: [_jsx(Text, { color: colors.text, children: "/memory show" }), _jsx(Text, { color: colors.text, children: "/memory compact" }), _jsx(Text, { color: colors.text, children: "/memory search keyword" })] })] }));
}
function SessionView({ executionContext, executionMode, projectLabel, responseModeLabel, sessionId, sessionTitle, themeName, verbosity, width }) {
    const colors = getTuiThemeColors(themeName);
    return (_jsxs(_Fragment, { children: [_jsxs(InspectorSection, { themeName: themeName, title: "Metadata", children: [_jsx(DataRow, { label: "id", themeName: themeName, value: sessionId, width: width }), _jsx(DataRow, { label: "title", themeName: themeName, value: sessionTitle, width: width }), _jsx(DataRow, { label: "project", themeName: themeName, value: projectLabel, width: width })] }), _jsxs(InspectorSection, { themeName: themeName, title: "Workspace", children: [_jsx(DataRow, { label: "cwd", themeName: themeName, value: shortenPath(executionContext.cwd, width - 8), width: width }), _jsx(DataRow, { label: "scope", themeName: themeName, value: readScopeLabel(executionContext.scope), width: width }), _jsx(DataRow, { label: "root", themeName: themeName, value: shortenPath(executionContext.projectRoot, width - 8), width: width })] }), _jsxs(InspectorSection, { themeName: themeName, title: "UI", children: [_jsx(DataRow, { label: "mode", themeName: themeName, value: formatExecutionModeLabel(executionMode), width: width }), _jsx(DataRow, { label: "style", themeName: themeName, value: responseModeLabel, width: width }), _jsx(DataRow, { label: "theme", themeName: themeName, value: themeName, width: width }), _jsx(DataRow, { label: "density", themeName: themeName, value: verbosity, width: width })] }), _jsx(Text, { color: colors.muted, children: "/session info  /session rename title" })] }));
}
function LogsView({ activeTools, activityLog, autoModeLastAction, autoModeNextRunLabel, colors, lastToolSummary, themeName, width }) {
    return (_jsxs(_Fragment, { children: [_jsx(InspectorSection, { themeName: themeName, title: "Debug Stream", children: activeTools.filter((tool) => tool.status === "running").length === 0 ? (_jsx(Text, { color: colors.muted, children: "No running tools." })) : (activeTools
                    .filter((tool) => tool.status === "running")
                    .map((tool) => (_jsx(Text, { color: colors.accent, children: truncate(`${tool.name} active ${formatAge(tool.startedAt)}`, width) }, tool.id)))) }), _jsxs(InspectorSection, { themeName: themeName, title: "Recent", children: [_jsx(Text, { color: colors.text, children: truncate(lastToolSummary, width) }), activityLog.slice(0, 7).map((line, index) => (_jsx(Text, { color: colors.muted, children: truncate(line, width) }, `${line}-${index}`)))] }), _jsxs(InspectorSection, { themeName: themeName, title: "Autonomous", children: [_jsx(DataRow, { label: "next", themeName: themeName, value: autoModeNextRunLabel, width: width }), _jsx(Text, { color: colors.muted, children: truncate(autoModeLastAction, width) })] })] }));
}
function formatTaskState(task) {
    if (task.isRunning) {
        return "RUN";
    }
    if (task.state === "queued") {
        return "WAIT";
    }
    if (/approval|blocked|waiting/i.test(task.state)) {
        return "BLOCK";
    }
    if (/complete|done|passed/i.test(task.state)) {
        return "DONE";
    }
    if (task.state === "failed") {
        return "FAIL";
    }
    if (task.state === "paused") {
        return "PAUSE";
    }
    return task.state.toUpperCase();
}
function formatCapabilityLabel(capability) {
    if (!capability) {
        return "unknown";
    }
    return capability.available ? "available" : "unavailable";
}
function formatVisionLabel(status) {
    if (!status) {
        return "unknown";
    }
    return `${status.vision.provider}/${status.vision.model ?? "-"} ${status.vision.configured ? "ready" : "not configured"}`;
}
function formatOptionalTime(value) {
    return value ? new Date(value).toLocaleTimeString() : "-";
}
function formatGrantLabel(status) {
    const grant = status.blanketGrant ?? status.policy.blanketGrant;
    if (!grant) {
        return "none";
    }
    const coverage = grant.maxSafety === "medium" ? "all" : grant.maxSafety;
    return `${grant.scope}/${coverage}`;
}
function shortId(value) {
    if (value.length <= 12) {
        return value;
    }
    return value.slice(-12);
}
function readMetadataString(metadata, key) {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
}
function formatAge(value) {
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1_000));
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m`;
    }
    return `${Math.floor(minutes / 60)}h`;
}
//# sourceMappingURL=inspector-panel.js.map