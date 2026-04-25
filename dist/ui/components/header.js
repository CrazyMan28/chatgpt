import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Spacer, Text } from "ink";
import { useAppRuntimeState } from "../runtime-state.js";
import { uiTheme } from "../theme.js";
export function Header({ activeToolCount, autoModeLabel, executionModeLabel, statusLabel, statusTone, taskCount, toolCount, workflowProgressLabel, width }) {
    const appState = useAppRuntimeState();
    const statusColor = statusTone === "busy" ? uiTheme.colors.warning : uiTheme.colors.success;
    const loginColor = appState.isLoggedIn
        ? uiTheme.colors.success
        : uiTheme.colors.warning;
    return (_jsxs(Box, { borderColor: uiTheme.colors.border, borderStyle: "round", paddingX: 1, width: width, children: [_jsx(Text, { bold: true, color: uiTheme.colors.accent, children: "CHATGPT CODE" }), _jsx(Text, { color: uiTheme.colors.muted, children: "  Interactive agent console" }), _jsx(Spacer, {}), _jsx(Text, { color: statusColor, children: statusLabel }), _jsx(Text, { color: uiTheme.colors.accent, children: `  ${executionModeLabel}` }), _jsx(Text, { color: uiTheme.colors.muted, children: `  ${workflowProgressLabel}` }), _jsx(Text, { color: autoModeLabel === "AUTO MODE RUNNING" ? uiTheme.colors.warning : uiTheme.colors.muted, children: `  ${autoModeLabel}` }), _jsxs(Text, { color: uiTheme.colors.muted, children: ["  ", appState.providerLabel] }), _jsx(Text, { bold: true, color: uiTheme.colors.text, children: ` / ${appState.model}` }), _jsx(Text, { color: loginColor, children: `  ${appState.loginLabel}` }), _jsx(Text, { color: uiTheme.colors.muted, children: `  ${toolCount} tools` }), _jsx(Text, { color: uiTheme.colors.muted, children: `  ${taskCount} tasks` }), _jsx(Text, { color: uiTheme.colors.muted, children: `  ${activeToolCount} active` })] }));
}
