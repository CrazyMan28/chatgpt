import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import type { AgentMode } from "@chatgpt-code/runtime-core";

import type { ProTheme } from "../types.js";
import { FooterHints } from "./FooterHints.js";

export function InputBar({
  disabled,
  hiddenInspector,
  mode,
  onChange,
  onSubmit,
  theme,
  value,
  width
}: {
  disabled: boolean;
  hiddenInspector: boolean;
  mode: AgentMode;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  theme: ProTheme;
  value: string;
  width: number;
}): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor={disabled ? theme.warning : theme.border} flexDirection="column" paddingX={1} width={width}>
      <Box>
        <Text color={theme.accent} bold>{mode.toUpperCase()}</Text>
        <Text color={theme.borderDim}>  </Text>
        <Text color={theme.text}>{"> "}</Text>
        <TextInput
          focus={!disabled}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Send a prompt or slash command"
          value={value}
        />
      </Box>
      <FooterHints hiddenInspector={hiddenInspector} theme={theme} />
    </Box>
  );
}

