import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import type { ProCommand, ProTheme } from "../types.js";
import { compact } from "../utils.js";

export const COMMANDS: readonly ProCommand[] = [
  { command: "/panel overview", description: "Open system overview.", title: "Panel: overview" },
  { command: "/panel tasks", description: "Inspect background and interactive tasks.", title: "Panel: tasks" },
  { command: "/panel approvals", description: "Review pending approvals.", title: "Panel: approvals" },
  { command: "/panel tools", description: "Show tool and watcher activity.", title: "Panel: tools" },
  { command: "/panel mcp", description: "Browse MCP marketplace/status.", title: "Panel: MCP" },
  { command: "/panel fleet", description: "Show fleet agents.", title: "Panel: fleet" },
  { command: "/panel memory", description: "Show memory summary and search results.", title: "Panel: memory" },
  { command: "/panel session", description: "Show sessions.", title: "Panel: session" },
  { command: "/panel logs", description: "Show hidden client logs.", title: "Panel: logs" },
  { command: "/theme cyber", description: "Use cyber-minimal theme.", title: "Theme: cyber" },
  { command: "/theme minimal", description: "Use quiet minimal theme.", title: "Theme: minimal" },
  { command: "/theme compact", description: "Use denser panel theme.", title: "Theme: compact" },
  { command: "/details last", description: "Open details for latest event/error.", title: "Details: last" },
  { command: "/tasks", description: "Refresh task status.", title: "Tasks" },
  { command: "/approve all", description: "Approve all currently pending requests.", title: "Approve all" },
  { command: "/mcp marketplace", description: "Refresh MCP marketplace.", title: "MCP marketplace" },
  { command: "/fleet status", description: "Refresh fleet status.", title: "Fleet status" },
  { command: "/memory show", description: "Refresh memory summary.", title: "Memory show" },
  { command: "/plan", description: "Switch next prompt to plan mode.", title: "Plan mode" },
  { command: "/build", description: "Switch next prompt to build mode.", title: "Build mode" }
];

export function CommandPalette({
  onQueryChange,
  onSubmit,
  query,
  theme,
  width
}: {
  onQueryChange: (value: string) => void;
  onSubmit: (command: string) => void;
  query: string;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const filtered = filterCommands(query);

  return (
    <Box borderStyle="round" borderColor={theme.accent} flexDirection="column" paddingX={1} marginBottom={1} width={width}>
      <Text color={theme.accent} bold>COMMAND PALETTE</Text>
      <Box>
        <Text color={theme.text}>search </Text>
        <TextInput
          focus
          onChange={onQueryChange}
          onSubmit={() => onSubmit(filtered[0]?.command ?? "/help")}
          placeholder="panel, theme, tasks..."
          value={query}
        />
      </Box>
      {filtered.slice(0, 6).map((item) => (
        <Box key={item.command} flexDirection="column">
          <Text>
            <Text color={theme.accent}>{compact(item.title, 24)}</Text>
            <Text color={theme.borderDim}>  {item.command}</Text>
          </Text>
          <Text color={theme.muted}>{compact(item.description, Math.max(20, width - 4))}</Text>
        </Box>
      ))}
    </Box>
  );
}

function filterCommands(query: string): readonly ProCommand[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return COMMANDS;
  }

  return COMMANDS.filter((item) =>
    item.command.toLowerCase().includes(normalized) ||
    item.description.toLowerCase().includes(normalized) ||
    item.title.toLowerCase().includes(normalized)
  );
}

