import React from "react";
import { Box, Text } from "ink";

import type { ProData, ProTheme } from "../types.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { ProTopBar } from "./ProTopBar.js";
import { TranscriptPanel } from "./TranscriptPanel.js";

export function ProAppShell({
  data,
  input,
  palette,
  theme,
  terminalHeight,
  terminalWidth
}: {
  data: ProData;
  input: React.ReactNode;
  palette?: React.ReactNode;
  terminalHeight: number;
  terminalWidth: number;
  theme: ProTheme;
}): React.JSX.Element {
  const showInspector = terminalWidth >= 96;
  const inspectorWidth = terminalWidth >= 128 ? 44 : 34;
  const transcriptWidth = showInspector ? terminalWidth - inspectorWidth - 1 : terminalWidth;
  const bodyHeight = Math.max(12, terminalHeight - 8 - (palette ? 10 : 0));

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <ProTopBar data={data} theme={theme} width={terminalWidth} />
      {palette}
      <Box height={bodyHeight} marginTop={1}>
        <TranscriptPanel entries={data.transcript} height={bodyHeight} theme={theme} width={transcriptWidth} />
        {showInspector ? (
          <Box marginLeft={1}>
            <InspectorPanel data={data} height={bodyHeight} theme={theme} width={inspectorWidth} />
          </Box>
        ) : null}
      </Box>
      {!showInspector ? (
        <Text color={theme.muted}>Inspector hidden. Use /panel overview|tasks|approvals|mcp|fleet|memory|session|logs.</Text>
      ) : null}
      {input}
    </Box>
  );
}

