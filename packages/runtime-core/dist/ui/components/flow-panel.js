import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { Box, Spacer, Text, useInput } from "ink";
import { formatFlowStepLabel, getActiveFlowStep, getFlowOptions, resolveFlowDescription, resolveFlowTitle } from "../flow-engine.js";
import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";
export function FlowPanel({ flow, height, width, onCancel, onMoveSelection, onSubmitSelection }) {
    const step = getActiveFlowStep(flow);
    const options = getFlowOptions(flow);
    const isSelectable = step.inputType !== "text";
    const cancelBufferRef = useRef("");
    useInput((input, key) => {
        if ((input === "c" && key.ctrl) || key.escape || input === "\u001b") {
            cancelBufferRef.current = "";
            onCancel();
            return;
        }
        if (input === "/" || cancelBufferRef.current.length > 0) {
            if (input === "/" && cancelBufferRef.current.length === 0) {
                cancelBufferRef.current = "/";
                return;
            }
            if (key.backspace || key.delete) {
                cancelBufferRef.current = cancelBufferRef.current.slice(0, -1);
                return;
            }
            if (key.return) {
                cancelBufferRef.current = "";
                return;
            }
            if (input.length === 1) {
                const nextValue = `${cancelBufferRef.current}${input}`;
                if ("/cancel".startsWith(nextValue)) {
                    cancelBufferRef.current = nextValue;
                    if (nextValue === "/cancel") {
                        cancelBufferRef.current = "";
                        onCancel();
                    }
                }
                else {
                    cancelBufferRef.current = "";
                }
            }
            return;
        }
        if (!isSelectable) {
            return;
        }
        if (key.upArrow || key.leftArrow) {
            onMoveSelection("previous");
            return;
        }
        if (key.downArrow || key.rightArrow || key.tab) {
            onMoveSelection("next");
            return;
        }
        if (key.return) {
            onSubmitSelection();
        }
    });
    return (_jsx(Panel, { footer: step.inputType === "text"
            ? "Type a value below and press Enter • /cancel exits this flow"
            : "Use arrows to choose • Enter confirms • /cancel exits this flow", height: height, subtitle: formatFlowStepLabel(flow), title: flow.id, width: width, children: _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: uiTheme.colors.accent, children: resolveFlowTitle(flow) }), _jsx(Text, { color: uiTheme.colors.muted, children: resolveFlowDescription(flow) }), _jsx(Text, { color: uiTheme.colors.muted, children: " " }), step.inputType === "text" ? (_jsx(Text, { color: uiTheme.colors.text, children: flow.value.trim().length > 0
                        ? formatTextValue(flow.value, step.mask)
                        : "Waiting for input..." })) : (options.map((option) => {
                    const isSelected = option.value === flow.value;
                    return (_jsxs(Box, { children: [_jsxs(Text, { color: isSelected ? uiTheme.colors.accent : uiTheme.colors.text, children: [isSelected ? "> " : "  ", option.label] }), _jsx(Spacer, {}), option.description ? (_jsx(Text, { color: uiTheme.colors.muted, children: option.description })) : null] }, `${flow.id}:${step.key}:${option.value}`));
                }))] }) }));
}
function formatTextValue(value, mask) {
    if (!mask) {
        return value;
    }
    return mask.repeat(Math.max(1, value.length));
}
//# sourceMappingURL=flow-panel.js.map