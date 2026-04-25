import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Spacer, Text } from "ink";
import { uiTheme } from "../theme.js";
export function Panel({ children, footer, height, subtitle, title, width }) {
    return (_jsxs(Box, { borderColor: uiTheme.colors.border, borderStyle: "round", flexDirection: "column", height: height, paddingX: 1, width: width, children: [_jsxs(Box, { children: [_jsx(Text, { color: uiTheme.colors.muted, children: title }), _jsx(Spacer, {}), subtitle ? _jsx(Text, { color: uiTheme.colors.muted, children: subtitle }) : null] }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: children }), footer ? (_jsx(Box, { children: _jsx(Text, { color: uiTheme.colors.muted, children: footer }) })) : null] }));
}
