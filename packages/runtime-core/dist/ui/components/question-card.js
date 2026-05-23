import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Component } from "react";
import { Box, Spacer, Text } from "ink";
import { getQuestionRows, shortQuestionId } from "../questions.js";
import { getTuiThemeColors } from "../theme.js";
import { KeyHintBar, truncate } from "./chrome.js";
import { Panel } from "./panel.js";
export class QuestionCardBoundary extends Component {
    state = {
        failed: false
    };
    static getDerivedStateFromError() {
        return {
            failed: true
        };
    }
    componentDidCatch(error) {
        this.props.onError?.(error);
    }
    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey &&
            this.state.failed) {
            this.setState({
                failed: false
            });
        }
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}
export function QuestionQueue({ children, height, themeName, width }) {
    return (_jsx(Panel, { emphasis: "strong", footer: _jsx(QuestionInput, { themeName: themeName, width: Math.max(10, width - 4) }), height: height, subtitle: "waiting for answer", themeName: themeName, title: "Question", width: width, children: children }));
}
export function QuestionCard({ customValue, error, height, progressLabel, question, selectedIndex, selectedOptionIds, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const innerWidth = Math.max(10, width - 4);
    const rows = getQuestionRows(question);
    const selectedRowIndex = rows.length > 0
        ? Math.min(Math.max(0, selectedIndex), rows.length - 1)
        : -1;
    const selectedIds = Array.isArray(selectedOptionIds)
        ? selectedOptionIds
        : [];
    return (_jsx(Panel, { emphasis: "strong", footer: _jsx(QuestionInput, { themeName: themeName, width: innerWidth }), height: height, subtitle: progressLabel ?? shortQuestionId(question.id), themeName: themeName, title: "Question", width: width, children: _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: colors.text, children: truncate(question.title, innerWidth) }), question.description ? (_jsx(Text, { color: colors.muted, children: truncate(question.description, innerWidth) })) : null, question.recommendedOption ? (_jsx(Text, { color: colors.info, children: truncate(`Recommended: ${question.recommendedOption.value ?? question.recommendedOption.optionId ?? "default"} - ${question.recommendedOption.reason}`, innerWidth) })) : null, _jsx(Text, { color: colors.muted, children: " " }), rows.map((row, index) => (_jsx(QuestionOption, { customValue: customValue, index: index, isSelected: index === selectedRowIndex, isToggled: row.type === "option" && selectedIds.includes(row.option.id), row: row, themeName: themeName, width: innerWidth }, rowKey(question, row, index)))), error ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: colors.muted, children: " " }), _jsx(Text, { color: colors.error, children: truncate(error, innerWidth) })] })) : null] }) }));
}
export function QuestionOption({ customValue, index, isSelected, isToggled, row, themeName, width }) {
    const colors = getTuiThemeColors(themeName);
    const prefix = isSelected ? ">" : " ";
    const color = isSelected ? colors.accent : colors.text;
    if (row.type === "option") {
        const marker = isToggled ? "[x]" : "   ";
        const number = `${index + 1}`;
        const left = `${prefix} ${marker} ${number.padStart(2, " ")}  ${row.option.label}`;
        const right = row.option.description ?? "";
        return (_jsxs(Box, { children: [_jsx(Text, { bold: isSelected, color: color, children: truncate(left, Math.max(8, width - Math.min(26, Math.floor(width * 0.4)))) }), _jsx(Spacer, {}), right.length > 0 ? (_jsx(Text, { color: colors.muted, children: truncate(right, Math.min(26, Math.floor(width * 0.4))) })) : null] }));
    }
    if (row.type === "done") {
        return (_jsx(Box, { children: _jsx(Text, { bold: isSelected, color: color, children: truncate(`${prefix}  ✓  ${row.label}`, width) }) }));
    }
    if (row.type === "custom") {
        const suffix = customValue.trim().length > 0 ? `: ${customValue.trim()}` : "";
        return (_jsx(Box, { children: _jsx(Text, { bold: isSelected, color: color, children: truncate(`${prefix}  ✎  ${row.label}${suffix}`, width) }) }));
    }
    return (_jsxs(Box, { children: [_jsx(Spacer, {}), _jsx(Text, { bold: isSelected, color: color, children: truncate(`${prefix} [${row.label}]`, Math.max(8, width)) })] }));
}
export function QuestionInput({ themeName, width }) {
    return (_jsx(KeyHintBar, { hints: [
            "↑/↓ select",
            "Enter choose",
            "1-9 quick select",
            "Tab custom",
            "Esc cancel"
        ], themeName: themeName, width: width }));
}
function rowKey(question, row, index) {
    if (row.type === "option") {
        return `${question.id}:${row.option.id}`;
    }
    return `${question.id}:${row.type}:${index}`;
}
//# sourceMappingURL=question-card.js.map