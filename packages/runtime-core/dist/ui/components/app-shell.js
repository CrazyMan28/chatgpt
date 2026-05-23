import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Box } from "ink";
export function AppShell({ footer, height, inspector, inspectorWidth, isWide, main, mainHeight, mainWidth, topBar }) {
    return (_jsxs(Box, { flexDirection: "column", height: height, paddingX: 1, children: [topBar, _jsxs(Box, { flexDirection: isWide ? "row" : "column", height: mainHeight, children: [_jsx(Box, { width: mainWidth, children: main }), inspector ? (_jsx(Box, { marginLeft: isWide ? 1 : 0, marginTop: isWide ? 0 : 1, width: inspectorWidth, children: inspector })) : null] }), footer] }));
}
//# sourceMappingURL=app-shell.js.map