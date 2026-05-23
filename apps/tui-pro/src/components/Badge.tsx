import React from "react";
import { Box, Text } from "ink";

import type { ProTheme } from "../types.js";

export function Badge({
  label,
  tone = "muted",
  value,
  theme
}: {
  label: string;
  theme: ProTheme;
  tone?: "accent" | "error" | "muted" | "secondary" | "success" | "warning";
  value?: string | number;
}): React.JSX.Element {
  const color = toneColor(theme, tone);
  const text = value === undefined ? label : `${label}:${value}`;

  return (
    <Box borderStyle="single" borderColor={color} paddingX={1} marginRight={1}>
      <Text color={color} bold={tone !== "muted"}>
        {text}
      </Text>
    </Box>
  );
}

export function toneColor(
  theme: ProTheme,
  tone: "accent" | "error" | "muted" | "secondary" | "success" | "warning"
): string {
  switch (tone) {
    case "accent":
      return theme.accent;
    case "secondary":
      return theme.secondary;
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "error":
      return theme.error;
    case "muted":
    default:
      return theme.muted;
  }
}

