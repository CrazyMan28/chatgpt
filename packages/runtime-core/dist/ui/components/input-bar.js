import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";
export function InputBar({ footer, focusInput = true, isBusy, isStreaming, mask, onChange, onSubmit, placeholder, subtitle, title, value, width }) {
    return (_jsx(Panel, { footer: footer ?? "Enter submit • PgUp/PgDn scroll • Home/End jump • Ctrl+C exit", subtitle: subtitle ??
            (isStreaming ? "Agent streaming" : isBusy ? "Agent active" : "Ready"), title: title ?? "Composer", width: width, children: _jsxs(Box, { children: [_jsx(Text, { color: uiTheme.colors.accent, children: "\u203A " }), _jsx(Box, { flexGrow: 1, children: _jsx(TextInput, { focus: !isBusy && focusInput, mask: mask, placeholder: placeholder ??
                            (isBusy
                                ? "Agent is working…"
                                : isStreaming
                                    ? "Streaming response…"
                                    : "Type a message"), showCursor: true, value: value, onChange: onChange, onSubmit: onSubmit }) })] }) }));
}
//# sourceMappingURL=input-bar.js.map