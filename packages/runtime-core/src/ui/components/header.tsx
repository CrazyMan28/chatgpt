import { Box, Spacer, Text } from "ink";

import { useAppRuntimeState } from "../runtime-state.js";
import { uiTheme } from "../theme.js";

export interface HeaderProps {
  activeToolCount: number;
  agentModeLabel: string;
  approvalLabel: string;
  autoModeLabel: string;
  autopilotLabel: string;
  cwdLabel: string;
  executionModeLabel: string;
  projectLabel: string;
  scopeLabel: string;
  statusLabel: string;
  statusTone: "busy" | "ready";
  taskCount: number;
  toolCount: number;
  workflowProgressLabel: string;
  width: number;
}

export function Header({
  activeToolCount,
  agentModeLabel,
  approvalLabel,
  autoModeLabel,
  autopilotLabel,
  cwdLabel,
  executionModeLabel,
  projectLabel,
  scopeLabel,
  statusLabel,
  statusTone,
  taskCount,
  toolCount,
  workflowProgressLabel,
  width
}: HeaderProps): React.JSX.Element {
  const appState = useAppRuntimeState();
  const statusColor =
    statusTone === "busy" ? uiTheme.colors.warning : uiTheme.colors.success;
  const loginColor = appState.isLoggedIn
    ? uiTheme.colors.success
    : uiTheme.colors.warning;

  return (
    <Box
      borderColor={uiTheme.colors.border}
      borderStyle="round"
      paddingX={1}
      width={width}
    >
      <Text bold color={uiTheme.colors.accent}>
        CHATGPT CODE
      </Text>
      <Text color={uiTheme.colors.muted}>  Interactive agent console</Text>
      <Spacer />
      <Text color={statusColor}>
        {statusLabel}
      </Text>
      <Text color={uiTheme.colors.accent}>{`  ${executionModeLabel}`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${workflowProgressLabel}`}</Text>
      <Text color={agentModeLabel === "AGENT MODE" ? uiTheme.colors.warning : uiTheme.colors.muted}>
        {`  ${agentModeLabel}`}
      </Text>
      <Text color={autoModeLabel === "AUTO MODE RUNNING" ? uiTheme.colors.warning : uiTheme.colors.muted}>
        {`  ${autoModeLabel}`}
      </Text>
      <Text
        color={
          autopilotLabel.includes("ACTIVE")
            ? uiTheme.colors.warning
            : autopilotLabel.includes("ON")
              ? uiTheme.colors.accent
              : uiTheme.colors.muted
        }
      >
        {`  ${autopilotLabel}`}
      </Text>
      <Text color={uiTheme.colors.muted}>
        {"  "}
        {appState.providerLabel}
      </Text>
      <Text bold color={uiTheme.colors.text}>
        {` / ${appState.model}`}
      </Text>
      <Text color={loginColor}>{`  ${appState.loginLabel}`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${toolCount} tools`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${taskCount} tasks`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${activeToolCount} active`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${projectLabel}`}</Text>
      <Text color={uiTheme.colors.warning}>{`  ${scopeLabel}`}</Text>
      <Text color={uiTheme.colors.accent}>{`  ${approvalLabel}`}</Text>
      <Text color={uiTheme.colors.muted}>{`  ${cwdLabel}`}</Text>
    </Box>
  );
}
