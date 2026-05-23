import React from "react";
import { Box, Text } from "ink";

import type { ProTheme, ProTranscriptEntry } from "../types.js";
import { ErrorCard, MessageCard, PlanCard, ProgressCard, ToolCard } from "./TranscriptCards.js";

export function TranscriptPanel({
  entries,
  height,
  theme,
  width
}: {
  entries: readonly ProTranscriptEntry[];
  height: number;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const visible = entries.slice(-Math.max(3, Math.floor((height - 3) / 4)));

  return (
    <Box borderStyle="round" borderColor={theme.border} flexDirection="column" height={height} paddingX={1} width={width}>
      <Box marginBottom={1}>
        <Text color={theme.accent} bold>TRANSCRIPT</Text>
        <Text color={theme.borderDim}>  cards are summary-first; tools stay collapsed</Text>
      </Box>
      {visible.length === 0 ? (
        <Box borderStyle="single" borderColor={theme.borderDim} paddingX={1} flexDirection="column">
          <Text color={theme.text}>Ready.</Text>
          <Text color={theme.muted}>Send a prompt, open /palette, or switch /panel views.</Text>
        </Box>
      ) : (
        visible.map((entry) => {
          if (entry.kind === "tool") {
            return <ToolCard key={entry.id} entry={entry} theme={theme} width={Math.max(20, width - 4)} />;
          }

          if (entry.kind === "error") {
            return <ErrorCard key={entry.id} entry={entry} theme={theme} width={Math.max(20, width - 4)} />;
          }

          if (entry.kind === "plan") {
            return <PlanCard key={entry.id} entry={entry} theme={theme} width={Math.max(20, width - 4)} />;
          }

          if (entry.kind === "progress") {
            return <ProgressCard key={entry.id} entry={entry} theme={theme} width={Math.max(20, width - 4)} />;
          }

          return <MessageCard key={entry.id} entry={entry} theme={theme} width={Math.max(20, width - 4)} />;
        })
      )}
    </Box>
  );
}

