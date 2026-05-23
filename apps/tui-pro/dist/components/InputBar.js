import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { FooterHints } from "./FooterHints.js";
export function InputBar({ disabled, hiddenInspector, mode, onChange, onSubmit, theme, value, width }) {
    return (_jsxs(Box, { borderStyle: "round", borderColor: disabled ? theme.warning : theme.border, flexDirection: "column", paddingX: 1, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.accent, bold: true, children: mode.toUpperCase() }), _jsx(Text, { color: theme.borderDim, children: "  " }), _jsx(Text, { color: theme.text, children: "> " }), _jsx(TextInput, { focus: !disabled, onChange: onChange, onSubmit: onSubmit, placeholder: "Send a prompt or slash command", value: value })] }), _jsx(FooterHints, { hiddenInspector: hiddenInspector, theme: theme })] }));
}
//# sourceMappingURL=InputBar.js.map