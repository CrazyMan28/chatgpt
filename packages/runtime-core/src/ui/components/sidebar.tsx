import { Box, Spacer, Text } from "ink";

import type { RegisteredTool } from "../../tools/tool-registry.js";
import { useAppRuntimeState } from "../runtime-state.js";
import { uiTheme } from "../theme.js";
import type { ActiveToolEntry } from "../types.js";
import { Panel } from "./panel.js";

export interface SidebarProps {
  activeTools: readonly ActiveToolEntry[];
  agentModeLabel: string;
  autoModeLabel: string;
  autoModeLastAction: string;
  autoModeNextRunLabel: string;
  currentWorkflowLabel: string;
  executionModeLabel: string;
  height: number;
  lastToolSummary: string;
  phaseLabel: string;
  responseModeLabel: string;
  sessionLabel: string;
  step: number;
  taskLabel: string;
  tools: readonly RegisteredTool[];
  workflowProgressLabel: string;
  width: number;
}

export function Sidebar({
  activeTools,
  agentModeLabel,
  autoModeLabel,
  autoModeLastAction,
  autoModeNextRunLabel,
  currentWorkflowLabel,
  executionModeLabel,
  height,
  lastToolSummary,
  phaseLabel,
  responseModeLabel,
  sessionLabel,
  step,
  taskLabel,
  tools,
  workflowProgressLabel,
  width
}: SidebarProps): React.JSX.Element {
  const appState = useAppRuntimeState();
  const innerWidth = Math.max(12, width - 4);
  const runningToolCount = activeTools.filter(
    (tool) => tool.status === "running"
  ).length;
  const staticRows = activeTools.length > 0 ? 18 : 17;
  const maxActiveRows = Math.max(1, Math.min(3, activeTools.length));
  const visibleActiveTools = activeTools.slice(0, maxActiveRows);
  const hiddenActiveToolCount = Math.max(
    0,
    activeTools.length - visibleActiveTools.length
  );
  const maxToolRows = Math.max(1, height - staticRows - maxActiveRows);
  const visibleTools = tools.slice(0, maxToolRows);
  const hiddenToolCount = Math.max(0, tools.length - visibleTools.length);
  const coreToolCount = tools.filter((tool) => tool.source === "core").length;
  const mcpToolCount = tools.length - coreToolCount;

  return (
    <Panel
      height={height}
      subtitle={`${tools.length} loaded`}
      title="Inspector"
      width={width}
    >
      <Box flexDirection="column">
        <InspectorRow
          label="State"
          value={phaseLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Session"
          value={sessionLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Mode"
          value={executionModeLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Style"
          value={responseModeLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Plan"
          value={workflowProgressLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Agent"
          value={agentModeLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Current"
          value={currentWorkflowLabel}
          width={innerWidth}
        />
        <InspectorRow label="Tasks" value={taskLabel} width={innerWidth} />
        <InspectorRow
          label="Auto"
          value={autoModeLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Next"
          value={autoModeNextRunLabel}
          width={innerWidth}
        />
        <InspectorRow label="Step" value={`${step || 0}`} width={innerWidth} />
        <InspectorRow
          label="Provider"
          value={appState.providerLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Model"
          value={appState.model}
          width={innerWidth}
        />
        <InspectorRow
          label="Login"
          value={appState.loginLabel}
          width={innerWidth}
        />
        <InspectorRow
          label="Loaded"
          value={`${tools.length} total • ${coreToolCount} core • ${mcpToolCount} MCP`}
          width={innerWidth}
        />
        <InspectorRow
          label="Active"
          value={`${runningToolCount} running`}
          width={innerWidth}
        />
        <InspectorRow
          label="Recent"
          value={lastToolSummary}
          width={innerWidth}
        />
        <InspectorRow
          label="Last auto"
          value={autoModeLastAction}
          width={innerWidth}
        />
        {visibleActiveTools.length > 0 ? (
          visibleActiveTools.map((tool) => (
            <Box key={tool.id}>
              <Text color={tool.isError ? uiTheme.colors.warning : uiTheme.colors.text}>
                {truncate(tool.name, Math.max(8, innerWidth - 10))}
              </Text>
              <Spacer />
              <Text color={uiTheme.colors.muted}>{tool.status}</Text>
            </Box>
          ))
        ) : (
          <Text color={uiTheme.colors.muted}>No active tools.</Text>
        )}
        {hiddenActiveToolCount > 0 ? (
          <Text color={uiTheme.colors.muted}>{`+${hiddenActiveToolCount} more active`}</Text>
        ) : null}
        {visibleTools.length > 0 ? (
          visibleTools.map((tool) => (
            <Box key={tool.id}>
              <Text color={uiTheme.colors.text}>
                {truncate(tool.name, Math.max(8, innerWidth - 6))}
              </Text>
              <Spacer />
              <Text color={uiTheme.colors.muted}>{tool.source}</Text>
            </Box>
          ))
        ) : (
          <Text color={uiTheme.colors.muted}>No tools registered.</Text>
        )}
        {hiddenToolCount > 0 ? (
          <Text color={uiTheme.colors.muted}>{`+${hiddenToolCount} more`}</Text>
        ) : null}
      </Box>
    </Panel>
  );
}

interface InspectorRowProps {
  label: string;
  value: string;
  width: number;
}

function InspectorRow({
  label,
  value,
  width
}: InspectorRowProps): React.JSX.Element {
  const labelWidth = 8;
  const valueWidth = Math.max(4, width - labelWidth - 1);

  return (
    <Box>
      <Text color={uiTheme.colors.muted}>
        {truncate(label.padEnd(labelWidth, " "), labelWidth)}
      </Text>
      <Text color={uiTheme.colors.text}>{truncate(value, valueWidth)}</Text>
    </Box>
  );
}

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}
