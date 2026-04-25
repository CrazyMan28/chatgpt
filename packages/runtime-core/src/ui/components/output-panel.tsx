import { useEffect, useMemo, useState } from "react";

import { Box, Text, useInput } from "ink";

import type { TranscriptEntry } from "../types.js";
import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";

interface RenderLine {
  bold?: boolean;
  color: string;
  dim?: boolean;
  key: string;
  text: string;
}

export interface OutputPanelProps {
  entries: readonly TranscriptEntry[];
  height: number;
  isStreaming: boolean;
  width: number;
}

export function OutputPanel({
  entries,
  height,
  isStreaming,
  width
}: OutputPanelProps): React.JSX.Element {
  const viewportWidth = Math.max(16, width - 4);
  const viewportHeight = Math.max(3, height - 4);
  const lines = useMemo(
    () => formatTranscript(entries, viewportWidth),
    [entries, viewportWidth]
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
      setScrollOffset((current) => Math.max(0, current - Math.max(1, viewportHeight - 1)));
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
        ? "Following live agent output"
        : `${lines.length} rendered lines`
      : `Scrolled ${scrollOffset} lines from the bottom`;

  return (
    <Panel
      footer={footer}
      height={height}
      subtitle={isStreaming ? "Streaming" : "Idle"}
      title="Output"
      width={width}
    >
      <Box flexDirection="column">
        {visibleLines.map((line) => (
          <Text
            key={line.key}
            bold={line.bold}
            color={line.color}
            dimColor={line.dim}
          >
            {line.text}
          </Text>
        ))}
      </Box>
    </Panel>
  );
}

function formatTranscript(
  entries: readonly TranscriptEntry[],
  width: number
): RenderLine[] {
  if (entries.length === 0) {
    return [
      {
        color: uiTheme.colors.system,
        dim: true,
        key: "empty",
        text: "No activity yet. Compose a message below to start an agent turn."
      }
    ];
  }

  const lines: RenderLine[] = [];

  for (const entry of entries) {
    const header = `${labelForRole(entry.role)} · ${formatTimestamp(entry.createdAt)}${entry.status === "streaming" ? " · streaming" : ""}`;

    lines.push({
      bold: entry.role !== "system",
      color: colorForRole(entry.role),
      dim: entry.role === "system",
      key: `${entry.id}:header`,
      text: truncateText(header, width)
    });

    const contentLines = wrapMultiline(
      entry.content.length > 0 ? entry.content : "…",
      Math.max(8, width - 2)
    );

    contentLines.forEach((line, index) => {
      lines.push({
        color: colorForRole(entry.role),
        dim: entry.role === "system",
        key: `${entry.id}:line:${index}`,
        text: `  ${line}`
      });
    });

    lines.push({
      color: uiTheme.colors.system,
      dim: true,
      key: `${entry.id}:spacer`,
      text: ""
    });
  }

  return lines;
}

function wrapMultiline(text: string, width: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.trim().split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length === 0) {
        if (word.length <= width) {
          currentLine = word;
          continue;
        }

        lines.push(...sliceWord(word, width));
        continue;
      }

      if (currentLine.length + 1 + word.length <= width) {
        currentLine = `${currentLine} ${word}`;
        continue;
      }

      lines.push(currentLine);

      if (word.length <= width) {
        currentLine = word;
      } else {
        const sliced = sliceWord(word, width);
        currentLine = sliced.pop() ?? "";
        lines.push(...sliced);
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function sliceWord(word: string, width: number): string[] {
  const slices: string[] = [];

  for (let index = 0; index < word.length; index += width) {
    slices.push(word.slice(index, index + width));
  }

  return slices;
}

function truncateText(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function labelForRole(role: TranscriptEntry["role"]): string {
  switch (role) {
    case "assistant":
      return "assistant";
    case "system":
      return "status";
    case "tool":
      return "tool";
    case "user":
      return "you";
    default:
      return role;
  }
}

function colorForRole(role: TranscriptEntry["role"]): string {
  switch (role) {
    case "assistant":
      return uiTheme.colors.assistant;
    case "system":
      return uiTheme.colors.system;
    case "tool":
      return uiTheme.colors.warning;
    case "user":
      return uiTheme.colors.user;
    default:
      return uiTheme.colors.text;
  }
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
