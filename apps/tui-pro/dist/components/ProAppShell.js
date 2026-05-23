import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import { InspectorPanel } from "./InspectorPanel.js";
import { ProTopBar } from "./ProTopBar.js";
import { TranscriptPanel } from "./TranscriptPanel.js";
export function ProAppShell({ data, input, palette, theme, terminalHeight, terminalWidth }) {
    const showInspector = terminalWidth >= 96;
    const inspectorWidth = terminalWidth >= 128 ? 44 : 34;
    const transcriptWidth = showInspector ? terminalWidth - inspectorWidth - 1 : terminalWidth;
    const bodyHeight = Math.max(12, terminalHeight - 8 - (palette ? 10 : 0));
    return (_jsxs(Box, { flexDirection: "column", width: terminalWidth, children: [_jsx(ProTopBar, { data: data, theme: theme, width: terminalWidth }), palette, _jsxs(Box, { height: bodyHeight, marginTop: 1, children: [_jsx(TranscriptPanel, { entries: data.transcript, height: bodyHeight, theme: theme, width: transcriptWidth }), showInspector ? (_jsx(Box, { marginLeft: 1, children: _jsx(InspectorPanel, { data: data, height: bodyHeight, theme: theme, width: inspectorWidth }) })) : null] }), !showInspector ? (_jsx(Text, { color: theme.muted, children: "Inspector hidden. Use /panel overview|tasks|approvals|mcp|fleet|memory|session|logs." })) : null, input] }));
}
//# sourceMappingURL=ProAppShell.js.map