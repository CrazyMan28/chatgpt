import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import { activeTaskCount, compact, compactPath } from "../utils.js";
import { Badge } from "./Badge.js";
export function ProTopBar({ data, theme, width }) {
    const provider = data.provider;
    const project = data.status?.project;
    const pendingApprovals = data.approvals.filter((approval) => approval.state === "pending").length;
    const activeTasks = activeTaskCount(data.tasks);
    const statusTone = data.connectionState === "ready"
        ? "success"
        : data.connectionState === "running"
            ? "accent"
            : data.connectionState === "blocked"
                ? "warning"
                : "error";
    const modelLabel = compact(`${provider?.providerLabel ?? provider?.provider ?? "provider"}/${provider?.model ?? "model"}`, width < 96 ? 24 : 34).toUpperCase();
    if (width < 96) {
        return (_jsxs(Box, { borderStyle: "round", borderColor: theme.border, flexDirection: "column", paddingX: 1, width: width, children: [_jsxs(Text, { children: [_jsx(Text, { color: theme.accent, bold: true, children: "CHATGPT CODE PRO" }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: theme.success, children: data.connectionState.toUpperCase() }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: data.mode === "normal" ? theme.muted : theme.accent, children: data.mode.toUpperCase() }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsxs(Text, { color: theme.muted, children: ["PILOT ", data.autopilot.toUpperCase()] })] }), _jsx(Text, { color: theme.secondary, children: compact(modelLabel, Math.max(16, width - 8)) }), _jsxs(Text, { children: [_jsx(Text, { color: theme.text, children: compact(project?.displayName ?? project?.name ?? "workspace", 18) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: theme.muted, children: project?.lastScope ?? "workspace" }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsxs(Text, { color: pendingApprovals > 0 ? theme.warning : theme.muted, children: ["approvals:", pendingApprovals] }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsxs(Text, { color: activeTasks > 0 ? theme.accent : theme.muted, children: ["tasks:", activeTasks] })] })] }));
    }
    return (_jsxs(Box, { borderStyle: "round", borderColor: theme.border, flexDirection: "column", paddingX: 1, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.accent, bold: true, children: "CHATGPT CODE PRO" }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Badge, { label: data.connectionState.toUpperCase(), tone: statusTone, theme: theme }), _jsx(Badge, { label: data.mode.toUpperCase(), tone: data.mode === "normal" ? "muted" : "accent", theme: theme }), _jsx(Badge, { label: `PILOT ${data.autopilot.toUpperCase()}`, tone: data.autopilot === "on" ? "warning" : "muted", theme: theme }), _jsx(Badge, { label: modelLabel, tone: "secondary", theme: theme })] }), _jsxs(Box, { children: [_jsx(Text, { color: theme.text, children: compact(project?.displayName ?? project?.name ?? "workspace", 24) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: theme.muted, children: project?.lastScope ?? "workspace" }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: theme.muted, children: compactPath(project?.lastCwd ?? project?.path, width < 96 ? 32 : 48) }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsxs(Text, { color: pendingApprovals > 0 ? theme.warning : theme.muted, children: ["approvals:", pendingApprovals] }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsxs(Text, { color: activeTasks > 0 ? theme.accent : theme.muted, children: ["tasks:", activeTasks] })] })] }));
}
//# sourceMappingURL=ProTopBar.js.map