import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import { compact, compactPath, shortId, stateTone, timeLabel, wrapText } from "../utils.js";
import { toneColor } from "./Badge.js";
export function TaskPanel({ tasks, theme, width }) {
    if (tasks.length === 0) {
        return _jsx(EmptyLine, { theme: theme, text: "No tasks reported by daemon." });
    }
    return (_jsx(Box, { flexDirection: "column", children: tasks.slice(0, 8).map((task) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: theme.accent, children: shortId(task.id) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: toneColor(theme, stateTone(task.state)), children: task.state })] }), _jsx(Text, { color: theme.text, children: compact(task.title || task.prompt, width - 2) }), task.currentStep || task.blockedReason || task.lastError ? (_jsx(Text, { color: theme.muted, children: compact(task.currentStep ?? task.blockedReason ?? task.lastError, width - 2) })) : null] }, task.id))) }));
}
export function ApprovalPanel({ approvals, theme, width }) {
    const pending = approvals.filter((approval) => approval.state === "pending");
    const list = pending.length > 0 ? pending : approvals.slice(0, 8);
    if (list.length === 0) {
        return _jsx(EmptyLine, { theme: theme, text: "No approvals requested." });
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: pending.length > 0 ? theme.warning : theme.muted, children: [pending.length, " pending / ", approvals.length, " total"] }), list.slice(0, 8).map((approval) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: theme.warning, children: shortId(approval.id) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: toneColor(theme, stateTone(approval.state)), children: approval.state })] }), _jsx(Text, { color: theme.text, children: compact(approval.summary, width - 2) }), _jsx(Text, { color: theme.muted, children: compact(approval.detail, width - 2) })] }, approval.id)))] }));
}
export function McpPanel({ marketplace, theme, width }) {
    if (marketplace.length === 0) {
        return _jsx(EmptyLine, { theme: theme, text: "Marketplace unavailable or empty." });
    }
    const installed = marketplace.filter((entry) => entry.installStatus === "installed").length;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: theme.muted, children: ["entries:", marketplace.length, " installed:", installed] }), marketplace.slice(0, 8).map((entry) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: entry.favorite ? theme.warning : theme.accent, children: compact(entry.name, 22) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: toneColor(theme, stateTone(entry.enabledStatus)), children: entry.enabledStatus })] }), _jsx(Text, { color: theme.muted, children: compact(entry.description, width - 2) })] }, entry.name)))] }));
}
export function FleetPanel({ agents, enabled, theme, width }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: enabled ? theme.success : theme.muted, children: ["fleet ", enabled ? "enabled" : "disabled", " / agents:", agents.length] }), agents.length === 0 ? _jsx(EmptyLine, { theme: theme, text: "No fleet agents active." }) : null, agents.slice(0, 8).map((agent) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: theme.accent, children: shortId(agent.id) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: toneColor(theme, stateTone(agent.state)), children: agent.state }), _jsxs(Text, { color: theme.borderDim, children: ["  ", agent.role] })] }), _jsx(Text, { color: theme.text, children: compact(agent.task, width - 2) }), agent.summary || agent.error ? (_jsx(Text, { color: agent.error ? theme.error : theme.muted, children: compact(agent.summary ?? agent.error, width - 2) })) : null] }, agent.id)))] }));
}
export function MemoryPanel({ memory, theme, width }) {
    const summary = memory.project?.summary ?? memory.project?.purpose ?? memory.user?.importantPreferences?.join(" ");
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: theme.accent, bold: true, children: "Memory summary" }), summary ? (wrapText(summary, width - 2, 5).map((line, index) => _jsx(Text, { color: theme.text, children: line }, index))) : (_jsx(Text, { color: theme.muted, children: "No dossier summary exposed yet." })), memory.results.length > 0 ? _jsx(Text, { color: theme.borderDim, children: "search results" }) : null, memory.results.slice(0, 6).map((entry, index) => (_jsx(Text, { color: theme.muted, children: compact(memoryResultText(entry), width - 2) }, index)))] }));
}
export function SessionPanel({ activeSessionId, sessions, theme, width }) {
    if (sessions.length === 0) {
        return _jsx(EmptyLine, { theme: theme, text: "No sessions yet. Send a prompt to create one." });
    }
    return (_jsx(Box, { flexDirection: "column", children: sessions.slice(0, 9).map((session) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: session.id === activeSessionId ? theme.accent : theme.muted, children: session.id === activeSessionId ? ">" : " " }), _jsxs(Text, { color: theme.accent, children: [" ", shortId(session.id, 16)] }), _jsxs(Text, { color: theme.borderDim, children: ["  ", timeLabel(session.updatedAt)] })] }), _jsx(Text, { color: theme.text, children: compact(session.title, width - 2) })] }, session.id))) }));
}
export function LogsPanel({ data, theme, width }) {
    return (_jsxs(Box, { flexDirection: "column", children: [data.lastDetails ? (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: theme.warning, bold: true, children: "Last details" }), wrapText(data.lastDetails, width - 2, 5).map((line, index) => _jsx(Text, { children: line }, index))] })) : null, data.logs.length === 0 ? _jsx(EmptyLine, { theme: theme, text: "No visible logs yet." }) : null, data.logs.slice(-10).map((line, index) => (_jsx(Text, { color: theme.muted, children: compact(line, width - 2) }, index)))] }));
}
export function OverviewPanel({ data, theme, width }) {
    const project = data.status?.project;
    const watchers = data.status?.watchers;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Metric, { label: "connection", theme: theme, value: data.connectionDetail }), _jsx(Metric, { label: "session", theme: theme, value: shortId(data.currentSession?.id, 18) }), _jsx(Metric, { label: "provider", theme: theme, value: `${data.provider?.providerLabel ?? "-"} / ${data.provider?.model ?? "-"}` }), _jsx(Metric, { label: "project", theme: theme, value: project?.displayName ?? project?.name ?? "-" }), _jsx(Metric, { label: "cwd", theme: theme, value: compactPath(project?.lastCwd ?? project?.path, width - 14) }), _jsx(Metric, { label: "watchers", theme: theme, value: `${watchers?.active ?? 0}/${watchers?.total ?? 0}` }), _jsx(Metric, { label: "tools", theme: theme, value: String(data.status?.toolCount ?? "-") }), _jsx(Metric, { label: "sessions", theme: theme, value: String(data.sessions.length) })] }));
}
export function ToolsPanel({ data, theme, width }) {
    const queue = data.status?.queue ?? [];
    const toolish = queue.filter((item) => item.type === "task" || item.type === "watcher");
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Metric, { label: "registered", theme: theme, value: String(data.status?.toolCount ?? "-") }), _jsx(Metric, { label: "watchers", theme: theme, value: String(data.watchers.length) }), toolish.slice(0, 8).map((item) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: [_jsx(Text, { color: theme.accent, children: item.type }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: toneColor(theme, stateTone(item.state)), children: item.state })] }), _jsx(Text, { color: theme.muted, children: compact(item.summary, width - 2) })] }, item.id)))] }));
}
function Metric({ label, theme, value }) {
    return (_jsxs(Text, { children: [_jsx(Text, { color: theme.muted, children: label.padEnd(11) }), _jsx(Text, { color: theme.text, children: value })] }));
}
function EmptyLine({ text, theme }) {
    return _jsx(Text, { color: theme.muted, children: text });
}
function memoryResultText(value) {
    if (typeof value === "object" && value !== null && "text" in value) {
        return String(value.text);
    }
    return String(value);
}
//# sourceMappingURL=InspectorPanels.js.map