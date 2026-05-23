import React from "react";
import { Box } from "ink";

import type { ProData, ProTheme } from "../types.js";
import {
  ApprovalPanel,
  FleetPanel,
  LogsPanel,
  McpPanel,
  MemoryPanel,
  OverviewPanel,
  SessionPanel,
  TaskPanel,
  ToolsPanel
} from "./InspectorPanels.js";
import { PanelTabs } from "./PanelTabs.js";

export function InspectorPanel({
  data,
  height,
  theme,
  width
}: {
  data: ProData;
  height: number;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor={theme.secondary} flexDirection="column" height={height} paddingX={1} width={width}>
      <PanelTabs active={data.panel} theme={theme} width={width - 2} />
      {data.panel === "overview" ? <OverviewPanel data={data} theme={theme} width={width - 2} /> : null}
      {data.panel === "tasks" ? <TaskPanel tasks={data.tasks} theme={theme} width={width - 2} /> : null}
      {data.panel === "approvals" ? <ApprovalPanel approvals={data.approvals} theme={theme} width={width - 2} /> : null}
      {data.panel === "tools" ? <ToolsPanel data={data} theme={theme} width={width - 2} /> : null}
      {data.panel === "mcp" ? <McpPanel marketplace={data.marketplace} theme={theme} width={width - 2} /> : null}
      {data.panel === "fleet" ? <FleetPanel agents={data.fleetAgents} enabled={data.fleetEnabled} theme={theme} width={width - 2} /> : null}
      {data.panel === "memory" ? <MemoryPanel memory={data.memory} theme={theme} width={width - 2} /> : null}
      {data.panel === "session" ? <SessionPanel activeSessionId={data.currentSession?.id} sessions={data.sessions} theme={theme} width={width - 2} /> : null}
      {data.panel === "logs" ? <LogsPanel data={data} theme={theme} width={width - 2} /> : null}
    </Box>
  );
}

