import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Spacer, Text } from "ink";
import { useAppRuntimeState } from "../runtime-state.js";
import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";
export function Sidebar({ activeTools, agentModeLabel, autoModeLabel, autoModeLastAction, autoModeNextRunLabel, currentWorkflowLabel, executionModeLabel, height, lastToolSummary, phaseLabel, responseModeLabel, sessionLabel, step, taskLabel, tools, workflowProgressLabel, width }) {
    const appState = useAppRuntimeState();
    const innerWidth = Math.max(12, width - 4);
    const runningToolCount = activeTools.filter((tool) => tool.status === "running").length;
    const staticRows = activeTools.length > 0 ? 18 : 17;
    const maxActiveRows = Math.max(1, Math.min(3, activeTools.length));
    const visibleActiveTools = activeTools.slice(0, maxActiveRows);
    const hiddenActiveToolCount = Math.max(0, activeTools.length - visibleActiveTools.length);
    const maxToolRows = Math.max(1, height - staticRows - maxActiveRows);
    const visibleTools = tools.slice(0, maxToolRows);
    const hiddenToolCount = Math.max(0, tools.length - visibleTools.length);
    const coreToolCount = tools.filter((tool) => tool.source === "core").length;
    const mcpToolCount = tools.length - coreToolCount;
    return (_jsx(Panel, { height: height, subtitle: `${tools.length} loaded`, title: "Inspector", width: width, children: _jsxs(Box, { flexDirection: "column", children: [_jsx(InspectorRow, { label: "State", value: phaseLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Session", value: sessionLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Mode", value: executionModeLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Style", value: responseModeLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Plan", value: workflowProgressLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Agent", value: agentModeLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Current", value: currentWorkflowLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Tasks", value: taskLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Auto", value: autoModeLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Next", value: autoModeNextRunLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Step", value: `${step || 0}`, width: innerWidth }), _jsx(InspectorRow, { label: "Provider", value: appState.providerLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Model", value: appState.model, width: innerWidth }), _jsx(InspectorRow, { label: "Login", value: appState.loginLabel, width: innerWidth }), _jsx(InspectorRow, { label: "Loaded", value: `${tools.length} total • ${coreToolCount} core • ${mcpToolCount} MCP`, width: innerWidth }), _jsx(InspectorRow, { label: "Active", value: `${runningToolCount} running`, width: innerWidth }), _jsx(InspectorRow, { label: "Recent", value: lastToolSummary, width: innerWidth }), _jsx(InspectorRow, { label: "Last auto", value: autoModeLastAction, width: innerWidth }), visibleActiveTools.length > 0 ? (visibleActiveTools.map((tool) => (_jsxs(Box, { children: [_jsx(Text, { color: tool.isError ? uiTheme.colors.warning : uiTheme.colors.text, children: truncate(tool.name, Math.max(8, innerWidth - 10)) }), _jsx(Spacer, {}), _jsx(Text, { color: uiTheme.colors.muted, children: tool.status })] }, tool.id)))) : (_jsx(Text, { color: uiTheme.colors.muted, children: "No active tools." })), hiddenActiveToolCount > 0 ? (_jsx(Text, { color: uiTheme.colors.muted, children: `+${hiddenActiveToolCount} more active` })) : null, visibleTools.length > 0 ? (visibleTools.map((tool) => (_jsxs(Box, { children: [_jsx(Text, { color: uiTheme.colors.text, children: truncate(tool.name, Math.max(8, innerWidth - 6)) }), _jsx(Spacer, {}), _jsx(Text, { color: uiTheme.colors.muted, children: tool.source })] }, tool.id)))) : (_jsx(Text, { color: uiTheme.colors.muted, children: "No tools registered." })), hiddenToolCount > 0 ? (_jsx(Text, { color: uiTheme.colors.muted, children: `+${hiddenToolCount} more` })) : null] }) }));
}
function InspectorRow({ label, value, width }) {
    const labelWidth = 8;
    const valueWidth = Math.max(4, width - labelWidth - 1);
    return (_jsxs(Box, { children: [_jsx(Text, { color: uiTheme.colors.muted, children: truncate(label.padEnd(labelWidth, " "), labelWidth) }), _jsx(Text, { color: uiTheme.colors.text, children: truncate(value, valueWidth) })] }));
}
function truncate(value, width) {
    if (value.length <= width) {
        return value;
    }
    return `${value.slice(0, Math.max(0, width - 1))}…`;
}
//# sourceMappingURL=sidebar.js.map