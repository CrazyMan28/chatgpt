import * as React from "react";

import { Box, Text } from "ink";

import { getTuiThemeColors } from "../theme.js";
import type { TuiThemeName } from "../types.js";
import { StatusBadge, truncate } from "./chrome.js";
import { Modal } from "./panel.js";

export interface CommandPaletteItem {
  category: string;
  command: string;
  description: string;
  insertOnly?: boolean;
}

export interface CommandPaletteProps {
  height: number;
  items: readonly CommandPaletteItem[];
  query: string;
  selectedIndex: number;
  themeName: TuiThemeName;
  width: number;
}

export function CommandPalette({
  height,
  items,
  query,
  selectedIndex,
  themeName,
  width
}: CommandPaletteProps): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const innerWidth = Math.max(12, width - 4);
  const visibleItems = items.slice(0, Math.max(1, height - 7));

  return (
    <Modal
      footer="Enter runs selected | arrows select | Esc closes"
      height={height}
      subtitle={`${items.length} match${items.length === 1 ? "" : "es"}`}
      themeName={themeName}
      title="Command Palette"
      width={width}
    >
      <Box flexDirection="column">
        <Box>
          <Text color={colors.muted}>Search: </Text>
          <Text color={query.length > 0 ? colors.text : colors.muted}>
            {truncate(query.length > 0 ? query : "all commands", innerWidth - 8)}
          </Text>
        </Box>
        <Text color={colors.borderDim}>
          {truncate("─".repeat(innerWidth), innerWidth)}
        </Text>
        {visibleItems.length === 0 ? (
          <Text color={colors.muted}>No commands match.</Text>
        ) : (
          visibleItems.map((item, index) => {
            const selected = index === selectedIndex;

            return (
              <Box key={`${item.command}-${index}`}>
                <Text color={selected ? colors.accent : colors.muted}>
                  {selected ? "> " : "  "}
                </Text>
                <Box width={Math.min(12, Math.max(8, Math.floor(innerWidth * 0.26)))}>
                <StatusBadge
                  active={selected}
                  label={truncate(item.category, 9)}
                  themeName={themeName}
                    tone={selected ? "accent" : "muted"}
                  />
                </Box>
                <Text bold={selected} color={selected ? colors.accent : colors.text}>
                  {truncate(
                    item.command,
                    Math.max(6, Math.floor(innerWidth * 0.34))
                  )}
                </Text>
                <Text color={colors.muted}>
                  {truncate(
                    ` ${item.description}`,
                    Math.max(6, innerWidth - Math.floor(innerWidth * 0.34) - 16)
                  )}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
    </Modal>
  );
}
