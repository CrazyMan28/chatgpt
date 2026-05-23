import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import { ErrorCard, MessageCard, PlanCard, ProgressCard, ToolCard } from "./TranscriptCards.js";
export function TranscriptPanel({ entries, height, theme, width }) {
    const visible = entries.slice(-Math.max(3, Math.floor((height - 3) / 4)));
    return (_jsxs(Box, { borderStyle: "round", borderColor: theme.border, flexDirection: "column", height: height, paddingX: 1, width: width, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: theme.accent, bold: true, children: "TRANSCRIPT" }), _jsx(Text, { color: theme.borderDim, children: "  cards are summary-first; tools stay collapsed" })] }), visible.length === 0 ? (_jsxs(Box, { borderStyle: "single", borderColor: theme.borderDim, paddingX: 1, flexDirection: "column", children: [_jsx(Text, { color: theme.text, children: "Ready." }), _jsx(Text, { color: theme.muted, children: "Send a prompt, open /palette, or switch /panel views." })] })) : (visible.map((entry) => {
                if (entry.kind === "tool") {
                    return _jsx(ToolCard, { entry: entry, theme: theme, width: Math.max(20, width - 4) }, entry.id);
                }
                if (entry.kind === "error") {
                    return _jsx(ErrorCard, { entry: entry, theme: theme, width: Math.max(20, width - 4) }, entry.id);
                }
                if (entry.kind === "plan") {
                    return _jsx(PlanCard, { entry: entry, theme: theme, width: Math.max(20, width - 4) }, entry.id);
                }
                if (entry.kind === "progress") {
                    return _jsx(ProgressCard, { entry: entry, theme: theme, width: Math.max(20, width - 4) }, entry.id);
                }
                return _jsx(MessageCard, { entry: entry, theme: theme, width: Math.max(20, width - 4) }, entry.id);
            }))] }));
}
//# sourceMappingURL=TranscriptPanel.js.map