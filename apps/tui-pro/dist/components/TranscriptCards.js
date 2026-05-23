import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import { compact, timeLabel, wrapText } from "../utils.js";
export function MessageCard({ entry, theme, width }) {
    const tone = entry.kind === "user" ? theme.accent : entry.kind === "assistant" ? theme.secondary : theme.borderDim;
    const title = entry.title ?? (entry.kind === "user" ? "USER" : entry.kind === "assistant" ? "ASSISTANT" : "SYSTEM");
    return (_jsxs(Box, { borderStyle: "single", borderColor: tone, flexDirection: "column", paddingX: 1, marginBottom: 1, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { color: tone, bold: true, children: title }), _jsxs(Text, { color: theme.borderDim, children: ["  ", timeLabel(entry.createdAt)] })] }), wrapText(entry.content || "...", Math.max(12, width - 4), 7).map((line, index) => (_jsx(Text, { color: entry.kind === "assistant" ? theme.text : undefined, children: line }, `${entry.id}-${index}`)))] }));
}
export function ToolCard({ entry, theme, width }) {
    const firstLine = compact(entry.content.split(/\r?\n/)[0], Math.max(16, width - 12));
    return (_jsxs(Box, { borderStyle: "single", borderColor: theme.accent, flexDirection: "column", paddingX: 1, marginBottom: 1, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.accent, bold: true, children: "TOOL" }), _jsx(Text, { color: theme.borderDim, children: "  collapsed" })] }), _jsx(Text, { color: theme.text, children: firstLine })] }));
}
export function ErrorCard({ entry, theme, width }) {
    return (_jsxs(Box, { borderStyle: "single", borderColor: theme.error, flexDirection: "column", paddingX: 1, marginBottom: 1, width: width, children: [_jsx(Text, { color: theme.error, bold: true, children: entry.title ?? "BLOCKER" }), wrapText(entry.content, Math.max(12, width - 4), 5).map((line, index) => (_jsx(Text, { color: theme.text, children: line }, `${entry.id}-${index}`)))] }));
}
export function PlanCard({ entry, theme, width }) {
    return (_jsxs(Box, { borderStyle: "single", borderColor: theme.secondary, flexDirection: "column", paddingX: 1, marginBottom: 1, width: width, children: [_jsx(Text, { color: theme.secondary, bold: true, children: entry.title ?? "PLAN" }), wrapText(entry.content, Math.max(12, width - 4), 7).map((line, index) => (_jsx(Text, { color: theme.text, children: line }, `${entry.id}-${index}`)))] }));
}
export function ProgressCard({ entry, theme, width }) {
    return (_jsxs(Box, { borderStyle: "single", borderColor: theme.warning, flexDirection: "column", paddingX: 1, marginBottom: 1, width: width, children: [_jsx(Text, { color: theme.warning, bold: true, children: entry.title ?? "PROGRESS" }), wrapText(entry.content, Math.max(12, width - 4), 4).map((line, index) => (_jsx(Text, { color: theme.text, children: line }, `${entry.id}-${index}`)))] }));
}
//# sourceMappingURL=TranscriptCards.js.map