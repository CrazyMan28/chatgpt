import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Box, Text } from "ink";
import { getTuiThemeColors } from "../theme.js";
import { StatusBadge, truncate } from "./chrome.js";
import { Modal } from "./panel.js";
export function CommandPalette({ height, items, query, selectedIndex, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const innerWidth = Math.max(12, width - 4);
    const visibleItems = items.slice(0, Math.max(1, height - 7));
    return (_jsx(Modal, { footer: "Enter runs selected | arrows select | Esc closes", height: height, subtitle: `${items.length} match${items.length === 1 ? "" : "es"}`, themeName: themeName, title: "Command Palette", width: width, children: _jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: colors.muted, children: "Search: " }), _jsx(Text, { color: query.length > 0 ? colors.text : colors.muted, children: truncate(query.length > 0 ? query : "all commands", innerWidth - 8) })] }), _jsx(Text, { color: colors.borderDim, children: truncate("─".repeat(innerWidth), innerWidth) }), visibleItems.length === 0 ? (_jsx(Text, { color: colors.muted, children: "No commands match." })) : (visibleItems.map((item, index) => {
                    const selected = index === selectedIndex;
                    return (_jsxs(Box, { children: [_jsx(Text, { color: selected ? colors.accent : colors.muted, children: selected ? "> " : "  " }), _jsx(Box, { width: Math.min(12, Math.max(8, Math.floor(innerWidth * 0.26))), children: _jsx(StatusBadge, { active: selected, label: truncate(item.category, 9), themeName: themeName, tone: selected ? "accent" : "muted" }) }), _jsx(Text, { bold: selected, color: selected ? colors.accent : colors.text, children: truncate(item.command, Math.max(6, Math.floor(innerWidth * 0.34))) }), _jsx(Text, { color: colors.muted, children: truncate(` ${item.description}`, Math.max(6, innerWidth - Math.floor(innerWidth * 0.34) - 16)) })] }, `${item.command}-${index}`));
                }))] }) }));
}
//# sourceMappingURL=command-palette.js.map