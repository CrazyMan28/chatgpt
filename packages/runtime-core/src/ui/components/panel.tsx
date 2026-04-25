import type { ReactNode } from "react";

import { Box, Spacer, Text } from "ink";

import { uiTheme } from "../theme.js";

export interface PanelProps {
  children: ReactNode;
  footer?: string;
  height?: number;
  subtitle?: string;
  title: string;
  width?: number;
}

export function Panel({
  children,
  footer,
  height,
  subtitle,
  title,
  width
}: PanelProps): React.JSX.Element {
  return (
    <Box
      borderColor={uiTheme.colors.border}
      borderStyle="round"
      flexDirection="column"
      height={height}
      paddingX={1}
      width={width}
    >
      <Box>
        <Text color={uiTheme.colors.muted}>{title}</Text>
        <Spacer />
        {subtitle ? <Text color={uiTheme.colors.muted}>{subtitle}</Text> : null}
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
      {footer ? (
        <Box>
          <Text color={uiTheme.colors.muted}>{footer}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
