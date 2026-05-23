import * as React from "react";

import { Component, type ReactNode } from "react";

import { Box, Spacer, Text } from "ink";

import {
  getQuestionRows,
  type QuestionRow,
  shortQuestionId
} from "../questions.js";
import { getTuiThemeColors } from "../theme.js";
import type { Question, TuiThemeName } from "../types.js";
import { KeyHintBar, truncate } from "./chrome.js";
import { Panel } from "./panel.js";

export interface QuestionCardProps {
  customValue: string;
  error?: string;
  height: number;
  progressLabel?: string;
  question: Question;
  selectedIndex: number;
  selectedOptionIds: readonly string[];
  themeName: TuiThemeName;
  width: number;
}

export interface QuestionCardBoundaryProps {
  children: ReactNode;
  onError?: (error: unknown) => void;
  resetKey?: string;
}

interface QuestionCardBoundaryState {
  failed: boolean;
}

export class QuestionCardBoundary extends Component<
  QuestionCardBoundaryProps,
  QuestionCardBoundaryState
> {
  override state: QuestionCardBoundaryState = {
    failed: false
  };

  static getDerivedStateFromError(): QuestionCardBoundaryState {
    return {
      failed: true
    };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  override componentDidUpdate(previousProps: QuestionCardBoundaryProps): void {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.failed
    ) {
      this.setState({
        failed: false
      });
    }
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function QuestionQueue({
  children,
  height,
  themeName,
  width
}: {
  children: ReactNode;
  height: number;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  return (
    <Panel
      emphasis="strong"
      footer={
        <QuestionInput
          themeName={themeName}
          width={Math.max(10, width - 4)}
        />
      }
      height={height}
      subtitle="waiting for answer"
      themeName={themeName}
      title="Question"
      width={width}
    >
      {children}
    </Panel>
  );
}

export function QuestionCard({
  customValue,
  error,
  height,
  progressLabel,
  question,
  selectedIndex,
  selectedOptionIds,
  themeName,
  width
}: QuestionCardProps): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const innerWidth = Math.max(10, width - 4);
  const rows = getQuestionRows(question);
  const selectedRowIndex =
    rows.length > 0
      ? Math.min(Math.max(0, selectedIndex), rows.length - 1)
      : -1;
  const selectedIds = Array.isArray(selectedOptionIds)
    ? selectedOptionIds
    : [];

  return (
    <Panel
      emphasis="strong"
      footer={
        <QuestionInput
          themeName={themeName}
          width={innerWidth}
        />
      }
      height={height}
      subtitle={progressLabel ?? shortQuestionId(question.id)}
      themeName={themeName}
      title="Question"
      width={width}
    >
      <Box flexDirection="column">
        <Text bold color={colors.text}>
          {truncate(question.title, innerWidth)}
        </Text>
        {question.description ? (
          <Text color={colors.muted}>
            {truncate(question.description, innerWidth)}
          </Text>
        ) : null}
        {question.recommendedOption ? (
          <Text color={colors.info}>
            {truncate(
              `Recommended: ${question.recommendedOption.value ?? question.recommendedOption.optionId ?? "default"} - ${question.recommendedOption.reason}`,
              innerWidth
            )}
          </Text>
        ) : null}
        <Text color={colors.muted}> </Text>
        {rows.map((row, index) => (
          <QuestionOption
            customValue={customValue}
            index={index}
            isSelected={index === selectedRowIndex}
            isToggled={
              row.type === "option" && selectedIds.includes(row.option.id)
            }
            key={rowKey(question, row, index)}
            row={row}
            themeName={themeName}
            width={innerWidth}
          />
        ))}
        {error ? (
          <>
            <Text color={colors.muted}> </Text>
            <Text color={colors.error}>{truncate(error, innerWidth)}</Text>
          </>
        ) : null}
      </Box>
    </Panel>
  );
}

export function QuestionOption({
  customValue,
  index,
  isSelected,
  isToggled,
  row,
  themeName,
  width
}: {
  customValue: string;
  index: number;
  isSelected: boolean;
  isToggled: boolean;
  row: QuestionRow;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const prefix = isSelected ? ">" : " ";
  const color = isSelected ? colors.accent : colors.text;

  if (row.type === "option") {
    const marker = isToggled ? "[x]" : "   ";
    const number = `${index + 1}`;
    const left = `${prefix} ${marker} ${number.padStart(2, " ")}  ${row.option.label}`;
    const right = row.option.description ?? "";

    return (
      <Box>
        <Text bold={isSelected} color={color}>
          {truncate(left, Math.max(8, width - Math.min(26, Math.floor(width * 0.4))))}
        </Text>
        <Spacer />
        {right.length > 0 ? (
          <Text color={colors.muted}>
            {truncate(right, Math.min(26, Math.floor(width * 0.4)))}
          </Text>
        ) : null}
      </Box>
    );
  }

  if (row.type === "done") {
    return (
      <Box>
        <Text bold={isSelected} color={color}>
          {truncate(`${prefix}  ✓  ${row.label}`, width)}
        </Text>
      </Box>
    );
  }

  if (row.type === "custom") {
    const suffix = customValue.trim().length > 0 ? `: ${customValue.trim()}` : "";

    return (
      <Box>
        <Text bold={isSelected} color={color}>
          {truncate(`${prefix}  ✎  ${row.label}${suffix}`, width)}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Spacer />
      <Text bold={isSelected} color={color}>
        {truncate(`${prefix} [${row.label}]`, Math.max(8, width))}
      </Text>
    </Box>
  );
}

export function QuestionInput({
  themeName,
  width
}: {
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  return (
    <KeyHintBar
      hints={[
        "↑/↓ select",
        "Enter choose",
        "1-9 quick select",
        "Tab custom",
        "Esc cancel"
      ]}
      themeName={themeName}
      width={width}
    />
  );
}

function rowKey(question: Question, row: QuestionRow, index: number): string {
  if (row.type === "option") {
    return `${question.id}:${row.option.id}`;
  }

  return `${question.id}:${row.type}:${index}`;
}
