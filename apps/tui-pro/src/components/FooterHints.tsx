import React from "react";
import { Box, Text } from "ink";

import type { ProTheme } from "../types.js";

export function FooterHints({
  hiddenInspector,
  theme
}: {
  hiddenInspector: boolean;
  theme: ProTheme;
}): React.JSX.Element {
  return (
    <Box>
      <Text color={theme.muted}>
        Enter send  /palette  /panel tasks  /theme cyber  /details last  Ctrl+K palette  Tab panel
        {hiddenInspector ? "  inspector hidden on narrow terminal" : ""}
      </Text>
    </Box>
  );
}

