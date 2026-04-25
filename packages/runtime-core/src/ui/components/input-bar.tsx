import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { uiTheme } from "../theme.js";
import { Panel } from "./panel.js";

export interface InputBarProps {
  footer?: string;
  focusInput?: boolean;
  isBusy: boolean;
  isStreaming: boolean;
  mask?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  subtitle?: string;
  title?: string;
  value: string;
  width: number;
}

export function InputBar({
  footer,
  focusInput = true,
  isBusy,
  isStreaming,
  mask,
  onChange,
  onSubmit,
  placeholder,
  subtitle,
  title,
  value,
  width
}: InputBarProps): React.JSX.Element {
  return (
    <Panel
      footer={
        footer ?? "Enter submit • PgUp/PgDn scroll • Home/End jump • Ctrl+C exit"
      }
      subtitle={
        subtitle ??
        (isStreaming ? "Agent streaming" : isBusy ? "Agent active" : "Ready")
      }
      title={title ?? "Composer"}
      width={width}
    >
      <Box>
        <Text color={uiTheme.colors.accent}>› </Text>
        <Box flexGrow={1}>
          <TextInput
            focus={!isBusy && focusInput}
            mask={mask}
            placeholder={
              placeholder ??
              (isBusy
                ? "Agent is working…"
                : isStreaming
                  ? "Streaming response…"
                  : "Type a message")
            }
            showCursor
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
          />
        </Box>
      </Box>
    </Panel>
  );
}
