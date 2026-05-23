import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { homedir } from "node:os";
import * as React from "react";
import { Box, Spacer, Text } from "ink";
import { getTuiTheme, getTuiThemeColors } from "../theme.js";
export function StatusBadge({ active = true, label, themeName, tone = "muted" }) {
    const theme = getTuiTheme(themeName);
    const color = toneToColor(theme.colors, tone);
    const text = theme.badgeStyle === "plain"
        ? label
        : theme.badgeStyle === "filled"
            ? ` ${label} `
            : `[${label}]`;
    return (_jsx(Text, { bold: active || theme.glow, color: color, dimColor: !active, children: text }));
}
export const Badge = StatusBadge;
export function BadgeStrip({ badges, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const fitted = fitBadgeLabels(badges, width);
    return (_jsx(Box, { children: fitted.map((badge, index) => (_jsxs(Box, { children: [index > 0 ? _jsx(Text, { color: colors.borderDim, children: " " }) : null, _jsx(StatusBadge, { active: badge.active, label: badge.label, themeName: themeName, tone: badge.tone })] }, `${badge.label}-${index}`))) }));
}
export function StatusBar({ badges, themeName }) {
    return _jsx(BadgeStrip, { badges: badges, themeName: themeName, width: 999 });
}
export function Divider({ themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    return (_jsx(Text, { color: colors.borderDim, dimColor: true, children: truncate("─".repeat(Math.max(0, width)), width) }));
}
export function InspectorSection({ children, title, themeName }) {
    const theme = getTuiTheme(themeName);
    return (_jsxs(Box, { flexDirection: "column", marginBottom: theme.sectionGap, children: [_jsx(Text, { bold: true, color: theme.colors.panelTitle, children: title.toUpperCase() }), _jsx(Box, { flexDirection: "column", children: children })] }));
}
export function InspectorTabs({ active, tabs, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const labels = fitLabels(tabs.map((tab) => (tab === active ? `/${tab}` : tab)), width);
    return (_jsx(Box, { children: labels.map((label, index) => {
            const normalized = label.replace(/^\//, "");
            const selected = normalized === active;
            return (_jsxs(Box, { children: [index > 0 ? _jsx(Text, { color: colors.borderDim, children: " " }) : null, _jsx(Text, { bold: selected, color: selected ? colors.accent : colors.muted, children: label })] }, `${label}-${index}`));
        }) }));
}
export const PanelTabs = InspectorTabs;
export function DataRow({ label, tone = "text", value, width, themeName }) {
    const colors = getTuiThemeColors(themeName);
    const labelWidth = Math.min(12, Math.max(6, Math.floor(width * 0.32)));
    const valueWidth = Math.max(4, width - labelWidth - 1);
    return (_jsxs(Box, { children: [_jsx(Text, { color: colors.muted, children: truncate(label.padEnd(labelWidth, " "), labelWidth) }), _jsx(Text, { color: toneToColor(colors, tone), children: truncate(value, valueWidth) })] }));
}
export const ProgressRow = DataRow;
export function KeyHintBar({ hints, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const visibleHints = fitLabels(hints, width);
    return (_jsxs(Box, { children: [visibleHints.map((hint, index) => {
                const [key, ...rest] = hint.split(/\s+/, 2);
                const detail = rest.join(" ");
                return (_jsxs(Box, { children: [index > 0 ? _jsx(Text, { color: colors.borderDim, children: "  " }) : null, _jsx(Text, { bold: true, color: key.startsWith("/") || key.includes("Ctrl") ? colors.accent : colors.text, children: key }), detail ? _jsx(Text, { color: colors.muted, children: ` ${detail}` }) : null] }, `${hint}-${index}`));
            }), _jsx(Spacer, {})] }));
}
export const FooterHints = KeyHintBar;
export function EmptyState({ detail, title, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: colors.text, children: truncate(title, width) }), detail ? (_jsx(Text, { color: colors.muted, children: truncate(detail, width) })) : null] }));
}
export function TaskRow({ currentStep, id, state, themeName, title, width }) {
    const colors = getTuiThemeColors(themeName);
    const tone = taskStateTone(state);
    const stateWidth = 6;
    const idWidth = Math.min(11, Math.max(7, Math.floor(width * 0.24)));
    const stepWidth = Math.min(14, Math.max(6, Math.floor(width * 0.24)));
    const titleWidth = Math.max(6, width - stateWidth - idWidth - stepWidth - 3);
    return (_jsxs(Box, { children: [_jsx(Text, { bold: true, color: toneToColor(colors, tone), children: truncate(state.toUpperCase().padEnd(stateWidth), stateWidth) }), _jsx(Text, { color: colors.muted, children: truncate(id.padEnd(idWidth), idWidth) }), _jsx(Text, { color: colors.text, children: truncate(title.padEnd(titleWidth), titleWidth) }), _jsx(Text, { color: colors.muted, children: truncate(currentStep ?? "-", stepWidth) })] }));
}
export function TaskSummary({ age, id, state, themeName, title, width }) {
    return (_jsx(TaskRow, { currentStep: age, id: id, state: state, themeName: themeName, title: title, width: width }));
}
export function ApprovalRow({ action, id, scope, task, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const idWidth = Math.min(11, Math.max(7, Math.floor(width * 0.28)));
    const scopeWidth = Math.min(12, Math.max(7, Math.floor(width * 0.26)));
    const actionWidth = Math.max(6, width - idWidth - scopeWidth - 2);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: colors.warning, children: truncate(id.padEnd(idWidth), idWidth) }), _jsx(Text, { color: colors.muted, children: truncate(scope.padEnd(scopeWidth), scopeWidth) }), _jsx(Text, { color: colors.text, children: truncate(action, actionWidth) })] }), task ? (_jsx(Text, { color: colors.muted, children: truncate(`task ${task}`, width) })) : null] }));
}
export function ApprovalSummary({ id, scope, summary, themeName, width }) {
    return (_jsx(ApprovalRow, { action: summary, id: id, scope: scope, themeName: themeName, width: width }));
}
export function FleetRow({ blockerCount, id, role, state, task, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const stateTone = taskStateTone(state);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: toneToColor(colors, stateTone), children: truncate(state.toUpperCase(), 8) }), _jsx(Text, { color: colors.borderDim, children: " " }), _jsx(Text, { color: colors.text, children: truncate(`${id} ${role}`, Math.max(8, width - 16)) }), _jsx(Spacer, {}), _jsx(Text, { color: blockerCount > 0 ? colors.warning : colors.muted, children: blockerCount > 0 ? `block ${blockerCount}` : "clear" })] }), _jsx(Text, { color: colors.muted, children: truncate(task, width) })] }));
}
export function McpRow({ health, name, status, themeName, transport, width }) {
    const colors = getTuiThemeColors(themeName);
    const nameWidth = Math.max(8, width - 22);
    return (_jsxs(Box, { children: [_jsx(Text, { color: status === "enabled" ? colors.accent : colors.text, children: truncate(name.padEnd(nameWidth), nameWidth) }), _jsx(Text, { color: status === "enabled" ? colors.success : colors.muted, children: truncate(status.padEnd(9), 9) }), _jsx(Text, { color: colors.muted, children: truncate(transport.padEnd(7), 7) }), _jsx(Text, { color: health === "healthy" ? colors.success : colors.warning, children: truncate(health, 7) })] }));
}
export function shortenPath(value, width = 40) {
    const home = homedir();
    const homeRelative = value.startsWith(home)
        ? `~${value.slice(home.length)}`
        : value;
    if (homeRelative.length <= width) {
        return homeRelative;
    }
    const parts = homeRelative.split(/[\\/]+/).filter(Boolean);
    if (parts.length <= 2) {
        return truncate(homeRelative, width);
    }
    const prefix = homeRelative.startsWith("~") ? "~/" : ".../";
    const tail = parts.slice(-2).join("/");
    return truncate(`${prefix}${tail}`, width);
}
export function truncate(value, width) {
    if (width <= 0) {
        return "";
    }
    if (value.length <= width) {
        return value;
    }
    if (width === 1) {
        return value.slice(0, 1);
    }
    return `${value.slice(0, Math.max(0, width - 1))}…`;
}
export function toneToColor(colors, tone) {
    switch (tone) {
        case "accent":
            return colors.accent;
        case "secondary":
            return colors.accentSecondary;
        case "success":
            return colors.success;
        case "warning":
            return colors.warning;
        case "error":
            return colors.error;
        case "text":
            return colors.text;
        case "muted":
        default:
            return colors.muted;
    }
}
function fitBadgeLabels(badges, width) {
    const output = [];
    let used = 0;
    for (const badge of badges) {
        const label = width < 70 ? truncate(badge.label, 14) : badge.label;
        const nextWidth = label.length + (output.length > 0 ? 1 : 0) + 2;
        if (used + nextWidth > width) {
            continue;
        }
        output.push({
            ...badge,
            label
        });
        used += nextWidth;
    }
    return output;
}
function fitLabels(labels, width) {
    const output = [];
    let used = 0;
    for (const label of labels) {
        const nextWidth = label.length + (output.length > 0 ? 2 : 0);
        if (used + nextWidth > width) {
            break;
        }
        output.push(label);
        used += nextWidth;
    }
    return output.length > 0
        ? output
        : labels.slice(0, 1).map((label) => truncate(label, width));
}
function taskStateTone(state) {
    if (/fail|error/i.test(state)) {
        return "error";
    }
    if (/block|wait|approval|pause/i.test(state)) {
        return "warning";
    }
    if (/run|active|stream|think|build/i.test(state)) {
        return "accent";
    }
    if (/complete|done|pass|ready|clear|ok/i.test(state)) {
        return "success";
    }
    return "muted";
}
//# sourceMappingURL=chrome.js.map