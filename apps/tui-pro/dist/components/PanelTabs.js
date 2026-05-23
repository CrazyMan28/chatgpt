import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
export const PANEL_ORDER = [
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
export function PanelTabs({ active, theme, width }) {
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Text, { color: theme.accent, bold: true, children: ["INSPECTOR / ", active.toUpperCase()] }), _jsx(Text, { color: theme.muted, children: width < 38 ? "Tab cycle | /panel <name>" : "overview tasks approvals tools mcp fleet memory session logs" })] }));
}
//# sourceMappingURL=PanelTabs.js.map