import React from "react";
import { Box, Text } from "ink";

import type { ProTheme, ProTranscriptEntry } from "../types.js";
import { compact, timeLabel, wrapText } from "../utils.js";

export function MessageCard({
  entry,
  theme,
  width
}: {
  entry: ProTranscriptEntry;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const tone = entry.kind === "user" ? theme.accent : entry.kind === "assistant" ? theme.secondary : theme.borderDim;
  const title = entry.title ?? (entry.kind === "user" ? "USER" : entry.kind === "assistant" ? "ASSISTANT" : "SYSTEM");

  return (
    <Box borderStyle="single" borderColor={tone} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Box>
        <Text color={tone} bold>{title}</Text>
        <Text color={theme.borderDim}>  {timeLabel(entry.createdAt)}</Text>
      </Box>
      {wrapText(entry.content || "...", Math.max(12, width - 4), 7).map((line, index) => (
        <Text key={`${entry.id}-${index}`} color={entry.kind === "assistant" ? theme.text : undefined}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

export function ToolCard({
  entry,
  theme,
  width
}: {
  entry: ProTranscriptEntry;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const firstLine = compact(entry.content.split(/\r?\n/)[0], Math.max(16, width - 12));

  return (
    <Box borderStyle="single" borderColor={theme.accent} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Box>
        <Text color={theme.accent} bold>TOOL</Text>
        <Text color={theme.borderDim}>  collapsed</Text>
      </Box>
      <Text color={theme.text}>{firstLine}</Text>
    </Box>
  );
}

export function ErrorCard({
  entry,
  theme,
  width
}: {
  entry: ProTranscriptEntry;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={theme.error} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Text color={theme.error} bold>{entry.title ?? "BLOCKER"}</Text>
      {wrapText(entry.content, Math.max(12, width - 4), 5).map((line, index) => (
        <Text key={`${entry.id}-${index}`} color={theme.text}>{line}</Text>
      ))}
    </Box>
  );
}

export function PlanCard({
  entry,
  theme,
  width
}: {
  entry: ProTranscriptEntry;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={theme.secondary} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Text color={theme.secondary} bold>{entry.title ?? "PLAN"}</Text>
      {wrapText(entry.content, Math.max(12, width - 4), 7).map((line, index) => (
        <Text key={`${entry.id}-${index}`} color={theme.text}>{line}</Text>
      ))}
    </Box>
  );
}

export function ProgressCard({
  entry,
  theme,
  width
}: {
  entry: ProTranscriptEntry;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={theme.warning} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Text color={theme.warning} bold>{entry.title ?? "PROGRESS"}</Text>
      {wrapText(entry.content, Math.max(12, width - 4), 4).map((line, index) => (
        <Text key={`${entry.id}-${index}`} color={theme.text}>{line}</Text>
      ))}
    </Box>
  );
}

