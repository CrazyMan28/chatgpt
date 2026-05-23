import React from "react";
import { Box, Text } from "ink";

import type { ProPanel, ProTheme } from "../types.js";

export const PANEL_ORDER: readonly ProPanel[] = [
  "overview",
  "tasks",
  "approvals",
  "tools",
  "mcp",
  "fleet",
  "memory",
  "session",
  "logs"
];

export function PanelTabs({
  active,
  theme,
  width
}: {
  active: ProPanel;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.accent} bold>INSPECTOR / {active.toUpperCase()}</Text>
      <Text color={theme.muted}>{width < 38 ? "Tab cycle | /panel <name>" : "overview tasks approvals tools mcp fleet memory session logs"}</Text>
    </Box>
  );
}
