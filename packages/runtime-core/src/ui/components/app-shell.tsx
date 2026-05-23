import * as React from "react";

import type { ReactNode } from "react";

import { Box } from "ink";

import type { TuiThemeName } from "../types.js";

export interface AppShellProps {
  footer: ReactNode;
  height: number;
  inspector?: ReactNode;
  inspectorWidth: number;
  isWide: boolean;
  main: ReactNode;
  mainHeight: number;
  mainWidth: number;
  themeName: TuiThemeName;
  topBar: ReactNode;
}

export function AppShell({
  footer,
  height,
  inspector,
  inspectorWidth,
  isWide,
  main,
  mainHeight,
  mainWidth,
  topBar
}: AppShellProps): React.JSX.Element {
  return (
    <Box flexDirection="column" height={height} paddingX={1}>
      {topBar}
      <Box flexDirection={isWide ? "row" : "column"} height={mainHeight}>
        <Box width={mainWidth}>{main}</Box>
        {inspector ? (
          <Box
            marginLeft={isWide ? 1 : 0}
            marginTop={isWide ? 0 : 1}
            width={inspectorWidth}
          >
            {inspector}
          </Box>
        ) : null}
      </Box>
      {footer}
    </Box>
  );
}
