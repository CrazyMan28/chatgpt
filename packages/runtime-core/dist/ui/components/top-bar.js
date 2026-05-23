import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Box, Spacer, Text } from "ink";
import { useAppRuntimeState } from "../runtime-state.js";
import { getTuiTheme } from "../theme.js";
import { BadgeStrip, StatusBadge, shortenPath, truncate } from "./chrome.js";
export function TopBar({ activeToolCount, approvalCount, autopilotLabel, cwd, executionModeLabel, failedTaskCount, fleetCount, isWide, projectLabel, queuedTaskCount, runningTaskCount, scopeLabel, statusLabel, statusTone, taskCount, themeName, width }) {
    const appState = useAppRuntimeState();
    const theme = getTuiTheme(themeName);
    const colors = theme.colors;
    const innerWidth = Math.max(20, width - 4);
    const statusToneName = statusTone === "busy" ? "warning" : "success";
    const providerModel = compactProviderModel(appState.providerLabel, appState.model);
    const primaryBadges = [
        {
            active: true,
            label: compactStatusLabel(statusLabel).toUpperCase(),
            tone: statusToneName
        },
        {
            active: true,
            label: executionModeLabel.toUpperCase(),
            tone: "accent"
        },
        {
            active: !autopilotLabel.toLowerCase().includes("off"),
            label: compactAutopilotLabel(autopilotLabel).toUpperCase(),
            tone: autopilotLabel.toLowerCase().includes("off") ? "muted" : "warning"
        },
        {
            active: true,
            label: providerModel,
            tone: "secondary"
        }
    ];
    const workBadges = [
        {
            active: true,
            label: `project ${compactProjectLabel(projectLabel)}`,
            tone: "text"
        },
        {
            active: true,
            label: `scope ${scopeLabel}`,
            tone: "secondary"
        },
        {
            active: isWide,
            label: `cwd ${shortenPath(cwd, 32)}`,
            tone: "muted"
        }
    ];
    const queueBadges = [
        {
            active: runningTaskCount > 0 || activeToolCount > 0,
            label: `tasks ${runningTaskCount} run ${queuedTaskCount} wait ${failedTaskCount} fail`,
            tone: runningTaskCount > 0 ? "accent" : failedTaskCount > 0 ? "error" : "muted"
        },
        {
            active: approvalCount > 0,
            label: `approvals ${approvalCount}`,
            tone: approvalCount > 0 ? "warning" : "muted"
        },
        {
            active: activeToolCount > 0,
            label: `tools ${activeToolCount} active`,
            tone: activeToolCount > 0 ? "accent" : "muted"
        },
        {
            active: fleetCount > 0,
            label: `fleet ${fleetCount}`,
            tone: fleetCount > 0 ? "secondary" : "muted"
        },
        {
            active: taskCount > 0,
            label: `queue ${taskCount}`,
            tone: taskCount > 0 ? "text" : "muted"
        }
    ];
    return (_jsxs(Box, { borderColor: statusTone === "busy" ? colors.warning : colors.border, borderStyle: theme.borderStyle, flexDirection: "column", paddingX: theme.panelPaddingX, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: colors.accent, children: width < 62 ? "CODE" : "CHATGPT CODE" }), _jsx(Text, { color: colors.borderDim, children: " :: " }), _jsx(Text, { color: colors.text, children: truncate(appState.loginLabel, Math.max(8, Math.floor(innerWidth * 0.22))) }), _jsx(Spacer, {}), _jsx(StatusBadge, { active: true, label: statusTone === "busy" ? "LIVE" : "READY", themeName: themeName, tone: statusToneName })] }), _jsx(BadgeStrip, { badges: primaryBadges, themeName: themeName, width: innerWidth }), _jsx(BadgeStrip, { badges: isWide ? [...workBadges, ...queueBadges] : [...workBadges.slice(0, 2), ...queueBadges.slice(0, 2)], themeName: themeName, width: innerWidth })] }));
}
function compactProviderModel(providerLabel, model) {
    const provider = providerLabel.replace(/\s+provider$/i, "").trim();
    return truncate(`${provider} ${model}`.trim(), 32);
}
function compactProjectLabel(projectLabel) {
    return truncate(projectLabel.replace(/\s+/g, "_"), 20);
}
function compactStatusLabel(statusLabel) {
    return truncate(statusLabel.replace(/\s+·\s+/g, " "), 18);
}
function compactAutopilotLabel(label) {
    return label.toLowerCase().includes("off") ? "pilot off" : "pilot on";
}
//# sourceMappingURL=top-bar.js.map