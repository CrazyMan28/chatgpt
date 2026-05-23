import * as React from "react";

import { useEffect, useMemo, useState } from "react";

import { Box, Text, useInput } from "ink";

import { getTuiThemeColors } from "../theme.js";
import type {
  TranscriptEntry,
  TuiThemeName,
  TuiVerbosity
} from "../types.js";
import { EmptyState, truncate } from "./chrome.js";
import { Panel } from "./panel.js";

interface RenderLine {
  bold?: boolean;
  color: string;
  dim?: boolean;
  key: string;
  text: string;
}

interface CardBodyLine {
  bold?: boolean;
  color: string;
  dim?: boolean;
  text: string;
}

export interface TranscriptPanelProps {
  entries: readonly TranscriptEntry[];
  height: number;
  isStreaming: boolean;
  themeName: TuiThemeName;
  verbosity: TuiVerbosity;
  width: number;
}

export function TranscriptPanel({
  entries,
  height,
  isStreaming,
  themeName,
  verbosity,
  width
}: TranscriptPanelProps): React.JSX.Element {
  const viewportWidth = Math.max(18, width - 4);
  const viewportHeight = Math.max(3, height - 4);
  const colors = getTuiThemeColors(themeName);
  const lines = useMemo(
    () => formatTranscript(entries, viewportWidth, verbosity, themeName),
    [entries, viewportWidth, verbosity, themeName]
  );
  const maxScrollOffset = Math.max(0, lines.length - viewportHeight);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setScrollOffset((current) => Math.min(current, maxScrollOffset));
  }, [maxScrollOffset]);

  useInput((_, key) => {
    if (key.pageUp) {
      setScrollOffset((current) =>
        Math.min(maxScrollOffset, current + Math.max(1, viewportHeight - 1))
      );
    }

    if (key.pageDown) {
      setScrollOffset((current) =>
        Math.max(0, current - Math.max(1, viewportHeight - 1))
      );
    }

    if (key.home) {
      setScrollOffset(maxScrollOffset);
    }

    if (key.end) {
      setScrollOffset(0);
    }
  });

  const startIndex = Math.max(0, lines.length - viewportHeight - scrollOffset);
  const visibleLines = lines.slice(startIndex, startIndex + viewportHeight);
  const footer =
    scrollOffset === 0
      ? isStreaming
        ? "Live stream | Ctrl+O details"
        : `${lines.length} rendered lines | Ctrl+O details`
      : `Scrolled ${scrollOffset} lines from bottom | End returns live`;

  return (
    <Panel
      emphasis={isStreaming ? "strong" : "normal"}
      footer={footer}
      height={height}
      subtitle={verbosity === "verbose" ? "verbose cards" : "focused cards"}
      themeName={themeName}
      title="Transcript"
      width={width}
    >
      <Box flexDirection="column">
        {visibleLines.length > 0 ? (
          visibleLines.map((line) => (
            <Text
              key={line.key}
              bold={line.bold}
              color={line.color}
              dimColor={line.dim}
            >
              {line.text}
            </Text>
          ))
        ) : (
          <EmptyState
            detail="Type a request, open /palette, or switch panels with Tab."
            themeName={themeName}
            title="Ready"
            width={Math.max(12, width - 6)}
          />
        )}
      </Box>
      {lines.length === 0 ? <Text color={colors.muted}> </Text> : null}
    </Panel>
  );
}

export function MessageCard({
  bodyLines,
  borderColor,
  id,
  title,
  titleColor,
  width
}: {
  bodyLines: readonly CardBodyLine[];
  borderColor: string;
  id: string;
  title: string;
  titleColor: string;
  width: number;
}): RenderLine[] {
  const safeWidth = Math.max(12, width);
  const bodyWidth = Math.max(8, safeWidth - 4);
  const output: RenderLine[] = [
    {
      bold: true,
      color: titleColor,
      key: `${id}:card:top`,
      text: createCardTop(title, safeWidth)
    }
  ];

  bodyLines.forEach((line, index) => {
    output.push({
      bold: line.bold,
      color: line.color,
      dim: line.dim,
      key: `${id}:card:body:${index}`,
      text: createCardBodyLine(line.text, bodyWidth)
    });
  });

  output.push({
    color: borderColor,
    dim: true,
    key: `${id}:card:bottom`,
    text: createCardBottom(safeWidth)
  });
  output.push({
    color: borderColor,
    dim: true,
    key: `${id}:spacer`,
    text: ""
  });

  return output;
}

export function UserMessageCard(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>
): RenderLine[] {
  return MessageCard({
    bodyLines: wrapMultiline(entry.content, Math.max(8, width - 4)).map(
      (line) => ({
        color: colors.text,
        text: line
      })
    ),
    borderColor: colors.border,
    id: entry.id,
    title: `YOU ${formatTime(entry.createdAt)}`,
    titleColor: colors.user,
    width
  });
}

export function AssistantMessageCard(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>
): RenderLine[] {
  const bodyLines: CardBodyLine[] = [];
  let inCodeBlock = false;

  wrapPreservingLines(entry.content.length > 0 ? entry.content : "...", width - 4)
    .forEach((line) => {
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        bodyLines.push({
          color: colors.muted,
          dim: true,
          text: truncate(line, Math.max(8, width - 4))
        });
        return;
      }

      bodyLines.push({
        color: inCodeBlock ? colors.accent : colors.assistant,
        dim: inCodeBlock,
        text: inCodeBlock ? `| ${line}` : line
      });
    });

  return MessageCard({
    bodyLines,
    borderColor:
      entry.status === "streaming" ? colors.accentSecondary : colors.borderDim,
    id: entry.id,
    title: `AGENT${entry.status === "streaming" ? " STREAMING" : ""}`,
    titleColor: entry.status === "streaming" ? colors.accent : colors.assistant,
    width
  });
}

export function ToolCard(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>,
  verbosity: TuiVerbosity
): RenderLine[] {
  const parsed = parseToolContent(entry.content);
  const status = parsed.isError
    ? "error"
    : entry.status === "streaming"
      ? "running"
      : "success";
  const tone = parsed.isError
    ? colors.error
    : entry.status === "streaming"
      ? colors.accent
      : colors.success;
  const detailLines = parsed.detail
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const outputSummary =
    detailLines.length === 0
      ? parsed.summary
      : `${detailLines.length} output line${detailLines.length === 1 ? "" : "s"} hidden`;
  const approvalId = readDetailField(parsed.detail, "approval") ??
    /\b(approval-[a-z0-9-]+)\b/i.exec(parsed.detail)?.[1];
  const riskLevel = readDetailField(parsed.detail, "risk");
  const target = readDetailField(parsed.detail, "target");
  const bodyLines: CardBodyLine[] = [
    {
      color: colors.text,
      text: target ? `target ${target}` : parsed.command ? `command ${parsed.command}` : parsed.name
    },
    ...(riskLevel
      ? [
          {
            color: colors.muted,
            text: `Risk: ${riskLevel}`
          }
        ]
      : []),
    ...(approvalId
      ? [
          {
            color: colors.warning,
            text: `Approval: ${approvalId}`
          }
        ]
      : []),
    {
      color: parsed.isError ? colors.error : colors.muted,
      text:
        verbosity === "verbose"
          ? firstUsefulLine(parsed.detail) ?? parsed.summary
          : `Result summary: ${summarizeToolResult(parsed, detailLines)}`
    },
    {
      color: colors.muted,
      dim: true,
      text:
        verbosity === "verbose"
          ? outputSummary
          : `Ctrl+O details | /details tool ${shortId(entry.id)}`
    }
  ];

  if (verbosity === "verbose") {
    detailLines.slice(0, 7).forEach((line) => {
      bodyLines.push({
        color: parsed.isError ? colors.warning : colors.text,
        dim: !parsed.isError,
        text: truncate(line, Math.max(8, width - 4))
      });
    });
  }

  return MessageCard({
    bodyLines,
    borderColor: tone,
    id: entry.id,
    title: `TOOL · ${parsed.name} · ${status}`,
    titleColor: tone,
    width
  });
}

export function ErrorCard({
  bodyLines,
  colors,
  id,
  title,
  width
}: {
  bodyLines: readonly CardBodyLine[];
  colors: ReturnType<typeof getTuiThemeColors>;
  id: string;
  title: string;
  width: number;
}): RenderLine[] {
  return MessageCard({
    bodyLines,
    borderColor: colors.error,
    id,
    title,
    titleColor: colors.error,
    width
  });
}

export function PlanCard(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>,
  verbosity: TuiVerbosity
): RenderLine[] {
  const lines = wrapPreservingLines(entry.content, Math.max(8, width - 4));
  const maxLines = verbosity === "verbose" ? 12 : 7;
  const bodyLines: CardBodyLine[] = lines.slice(0, maxLines).map((line) => ({
    color: /done|complete|\[x\]/i.test(line)
      ? colors.success
      : /todo|step|plan|\[ \]/i.test(line)
        ? colors.accent
        : colors.text,
    text: line.replace(/^[-*]\s+/, "• ")
  }));

  if (lines.length > maxLines) {
    bodyLines.push({
      color: colors.muted,
      dim: true,
      text: `${lines.length - maxLines} more plan lines hidden | Ctrl+O details`
    });
  }

  return MessageCard({
    bodyLines,
    borderColor: colors.accent,
    id: entry.id,
    title: "PLAN",
    titleColor: colors.accent,
    width
  });
}

export function ProgressCard(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>
): RenderLine[] {
  const lines = wrapPreservingLines(entry.content, Math.max(8, width - 4));

  return MessageCard({
    bodyLines: lines.slice(0, 5).map((line) => ({
      color: colors.text,
      text: line
    })),
    borderColor: colors.accentSecondary,
    id: entry.id,
    title: "PROGRESS",
    titleColor: colors.accentSecondary,
    width
  });
}

function formatTranscript(
  entries: readonly TranscriptEntry[],
  width: number,
  verbosity: TuiVerbosity,
  themeName: TuiThemeName
): RenderLine[] {
  const colors = getTuiThemeColors(themeName);
  const visibleEntries = entries.filter((entry) =>
    shouldRenderEntry(entry, verbosity)
  );

  if (visibleEntries.length === 0) {
    return [];
  }

  const lines: RenderLine[] = [];

  for (const entry of visibleEntries) {
    if (entry.role === "tool") {
      lines.push(...ToolCard(entry, width, colors, verbosity));
      continue;
    }

    if (entry.role === "assistant") {
      lines.push(...AssistantMessageCard(entry, width, colors));
      continue;
    }

    if (entry.role === "user") {
      lines.push(...UserMessageCard(entry, width, colors));
      continue;
    }

    lines.push(...formatSystemEntry(entry, width, colors, verbosity));
  }

  return lines;
}

function formatSystemEntry(
  entry: TranscriptEntry,
  width: number,
  colors: ReturnType<typeof getTuiThemeColors>,
  verbosity: TuiVerbosity
): RenderLine[] {
  if (isPlanEntry(entry.content)) {
    return PlanCard(entry, width, colors, verbosity);
  }

  if (isProgressEntry(entry.content)) {
    return ProgressCard(entry, width, colors);
  }

  const important = isImportantSystemEntry(entry.content);
  const label = important ? systemLabel(entry.content) : "STATUS";
  const contentLines = wrapPreservingLines(
    entry.content.length > 0 ? entry.content : "...",
    Math.max(8, width - 4)
  );
  const maxLines =
    verbosity === "quiet" && !important
      ? 1
      : verbosity === "verbose"
        ? Math.min(12, contentLines.length)
        : verbosity === "compact"
          ? Math.min(4, contentLines.length)
          : Math.min(5, contentLines.length);
  const hiddenLineCount = Math.max(0, contentLines.length - maxLines);
  const bodyLines: CardBodyLine[] = contentLines
    .slice(0, maxLines)
    .map((line) => ({
      color: important ? colors.warning : colors.system,
      dim: !important,
      text: line
    }));

  if (hiddenLineCount > 0) {
    bodyLines.push({
      color: colors.muted,
      dim: true,
      text: `${hiddenLineCount} more lines hidden | Ctrl+O details`
    });
  }

  if (important) {
    return ErrorCard({
      bodyLines,
      colors,
      id: entry.id,
      title: label,
      width
    });
  }

  return MessageCard({
    bodyLines,
    borderColor: colors.borderDim,
    id: entry.id,
    title: `${label} ${formatTime(entry.createdAt)}`,
    titleColor: colors.system,
    width
  });
}

function shouldRenderEntry(
  entry: TranscriptEntry,
  verbosity: TuiVerbosity
): boolean {
  if (isStartupNoise(entry)) {
    return false;
  }

  if (verbosity === "verbose") {
    return true;
  }

  if (entry.role === "system") {
    if (isLowSignalStatusEntry(entry.content)) {
      return false;
    }

    return verbosity !== "quiet" || isImportantSystemEntry(entry.content);
  }

  if (verbosity === "quiet" && entry.role === "tool") {
    return entry.content.startsWith("Failed") || entry.status === "streaming";
  }

  return true;
}

function isStartupNoise(entry: TranscriptEntry): boolean {
  return (
    entry.role === "system" &&
    (/^agent connected\./i.test(entry.content) ||
      /^use \/help for commands/i.test(entry.content) ||
      /^ready[.!]?$/i.test(entry.content))
  );
}

function isImportantSystemEntry(content: string): boolean {
  return /blocked|approval required|agent error|session error|failed|error|build stopped|rate limit/i.test(
    content
  );
}

function isLowSignalStatusEntry(content: string): boolean {
  return /^(execution mode set|response style set|ui status|theme:|panel:|command palette|inspector hidden|inspector shown)/i.test(
    content.trim()
  );
}

function isPlanEntry(content: string): boolean {
  return /(^|\n)(plan ready|plan confirmed|project plan|task plan|todo|[-*]\s+\[[ x]\])/i.test(
    content
  );
}

function isProgressEntry(content: string): boolean {
  return /build step|current step|progress|resumable build|completed step/i.test(
    content
  );
}

function systemLabel(content: string): string {
  if (/blocked|approval/i.test(content)) {
    return "BLOCKED";
  }

  if (/failed|error/i.test(content)) {
    return "ERROR";
  }

  return "STATUS";
}

function createCardTop(title: string, width: number): string {
  const safeTitle = truncate(title, Math.max(4, width - 6));
  const prefix = `╭─ ${safeTitle} `;
  const fill = Math.max(0, width - prefix.length - 1);

  return `${prefix}${"─".repeat(fill)}╮`;
}

function createCardBodyLine(value: string, width: number): string {
  const text = truncate(value, width);

  return `│ ${text.padEnd(width, " ")} │`;
}

function createCardBottom(width: number): string {
  return `╰${"─".repeat(Math.max(0, width - 2))}╯`;
}

function parseToolContent(content: string): {
  command?: string;
  detail: string;
  isError: boolean;
  name: string;
  summary: string;
} {
  const [firstLine = "", ...rest] = content.split("\n");
  const match = firstLine.match(/^(Running|Completed|Failed)\s+(.+?)(?:\.|…)?$/);
  const isError = firstLine.startsWith("Failed");
  const name = match?.[2]?.trim() ?? "tool";
  const detail = rest.join("\n").trim();
  const command = detail
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.length <= 80);

  return {
    command,
    detail,
    isError,
    name,
    summary: firstLine.trim()
  };
}

function summarizeToolResult(
  parsed: ReturnType<typeof parseToolContent>,
  detailLines: readonly string[]
): string {
  if (parsed.isError) {
    return firstUsefulLine(parsed.detail) ?? parsed.summary;
  }

  if (detailLines.length === 0) {
    return parsed.summary;
  }

  const filesMatch = parsed.detail.match(/\b(\d+)\s+files?\b/i);

  if (filesMatch) {
    return `${filesMatch[1]} files found`;
  }

  return `${detailLines.length} line${detailLines.length === 1 ? "" : "s"} captured`;
}

function readDetailField(detail: string, field: string): string | undefined {
  const match = new RegExp(`\\b${field}=([^\\s]+)`, "i").exec(detail);

  return match?.[1];
}

function firstUsefulLine(value: string): string | undefined {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function wrapPreservingLines(text: string, width: number): string[] {
  return text
    .split("\n")
    .flatMap((line) =>
      line.trim().length === 0 ? [""] : wrapLine(line.trimEnd(), width)
    );
}

function wrapMultiline(text: string, width: number): string[] {
  return text
    .split("\n")
    .flatMap((line) =>
      line.trim().length === 0 ? [""] : wrapLine(line.trim(), width)
    );
}

function wrapLine(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      if (word.length <= width) {
        currentLine = word;
      } else {
        lines.push(...sliceWord(word, width));
      }
      continue;
    }

    if (currentLine.length + 1 + word.length <= width) {
      currentLine = `${currentLine} ${word}`;
      continue;
    }

    lines.push(currentLine);
    currentLine = word.length <= width ? word : "";

    if (word.length > width) {
      lines.push(...sliceWord(word, width));
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function sliceWord(word: string, width: number): string[] {
  const slices: string[] = [];

  for (let index = 0; index < word.length; index += width) {
    slices.push(word.slice(index, index + width));
  }

  return slices;
}

function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }

  return value.slice(-8);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
