import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
export function Badge({ label, tone = "muted", value, theme }) {
    const color = toneColor(theme, tone);
    const text = value === undefined ? label : `${label}:${value}`;
    return (_jsx(Box, { borderStyle: "single", borderColor: color, paddingX: 1, marginRight: 1, children: _jsx(Text, { color: color, bold: tone !== "muted", children: text }) }));
}
export function toneColor(theme, tone) {
    switch (tone) {
        case "accent":
            return theme.accent;
        case "secondary":
            return theme.secondary;
        case "success":
            return theme.success;
        case "warning":
            return theme.warning;
        case "error":
            return theme.error;
        case "muted":
        default:
            return theme.muted;
    }
}
//# sourceMappingURL=Badge.js.map