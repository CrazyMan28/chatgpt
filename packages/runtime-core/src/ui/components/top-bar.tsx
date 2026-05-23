import * as React from "react";

import { Box, Spacer, Text } from "ink";

import { useAppRuntimeState } from "../runtime-state.js";
import { getTuiTheme } from "../theme.js";
import type { TuiThemeName } from "../types.js";
import {
  BadgeStrip,
  StatusBadge,
  shortenPath,
  truncate,
  type StatusBadgeDescriptor
} from "./chrome.js";

export interface TopBarProps {
  activeToolCount: number;
  approvalCount: number;
  autopilotLabel: string;
  cwd: string;
  executionModeLabel: string;
  failedTaskCount: number;
  fleetCount: number;
  isWide: boolean;
  projectLabel: string;
  queuedTaskCount: number;
  runningTaskCount: number;
  scopeLabel: string;
  statusLabel: string;
  statusTone: "busy" | "ready";
  taskCount: number;
  themeName: TuiThemeName;
  width: number;
}

export function TopBar({
  activeToolCount,
  approvalCount,
  autopilotLabel,
  cwd,
  executionModeLabel,
  failedTaskCount,
  fleetCount,
  isWide,
  projectLabel,
  queuedTaskCount,
  runningTaskCount,
  scopeLabel,
  statusLabel,
  statusTone,
  taskCount,
  themeName,
  width
}: TopBarProps): React.JSX.Element {
  const appState = useAppRuntimeState();
  const theme = getTuiTheme(themeName);
  const colors = theme.colors;
  const innerWidth = Math.max(20, width - 4);
  const statusToneName = statusTone === "busy" ? "warning" : "success";
  const providerModel = compactProviderModel(appState.providerLabel, appState.model);
  const primaryBadges: StatusBadgeDescriptor[] = [
    {
      active: true,
      label: compactStatusLabel(statusLabel).toUpperCase(),
      tone: statusToneName
    },
    {
      active: true,
      label: executionModeLabel.toUpperCase(),
      tone: "accent"
    },
    {
      active: !autopilotLabel.toLowerCase().includes("off"),
      label: compactAutopilotLabel(autopilotLabel).toUpperCase(),
      tone: autopilotLabel.toLowerCase().includes("off") ? "muted" : "warning"
    },
    {
      active: true,
      label: providerModel,
      tone: "secondary"
    }
  ];
  const workBadges: StatusBadgeDescriptor[] = [
    {
      active: true,
      label: `project ${compactProjectLabel(projectLabel)}`,
      tone: "text"
    },
    {
      active: true,
      label: `scope ${scopeLabel}`,
      tone: "secondary"
    },
    {
      active: isWide,
      label: `cwd ${shortenPath(cwd, 32)}`,
      tone: "muted"
    }
  ];
  const queueBadges: StatusBadgeDescriptor[] = [
    {
      active: runningTaskCount > 0 || activeToolCount > 0,
      label: `tasks ${runningTaskCount} run ${queuedTaskCount} wait ${failedTaskCount} fail`,
      tone: runningTaskCount > 0 ? "accent" : failedTaskCount > 0 ? "error" : "muted"
    },
    {
      active: approvalCount > 0,
      label: `approvals ${approvalCount}`,
      tone: approvalCount > 0 ? "warning" : "muted"
    },
    {
      active: activeToolCount > 0,
      label: `tools ${activeToolCount} active`,
      tone: activeToolCount > 0 ? "accent" : "muted"
    },
    {
      active: fleetCount > 0,
      label: `fleet ${fleetCount}`,
      tone: fleetCount > 0 ? "secondary" : "muted"
    },
    {
      active: taskCount > 0,
      label: `queue ${taskCount}`,
      tone: taskCount > 0 ? "text" : "muted"
    }
  ];

  return (
    <Box
      borderColor={statusTone === "busy" ? colors.warning : colors.border}
      borderStyle={theme.borderStyle}
      flexDirection="column"
      paddingX={theme.panelPaddingX}
      width={width}
    >
      <Box>
        <Text bold color={colors.accent}>
          {width < 62 ? "CODE" : "CHATGPT CODE"}
        </Text>
        <Text color={colors.borderDim}> :: </Text>
        <Text color={colors.text}>{truncate(appState.loginLabel, Math.max(8, Math.floor(innerWidth * 0.22)))}</Text>
        <Spacer />
        <StatusBadge
          active
          label={statusTone === "busy" ? "LIVE" : "READY"}
          themeName={themeName}
          tone={statusToneName}
        />
      </Box>
      <BadgeStrip
        badges={primaryBadges}
        themeName={themeName}
        width={innerWidth}
      />
      <BadgeStrip
        badges={isWide ? [...workBadges, ...queueBadges] : [...workBadges.slice(0, 2), ...queueBadges.slice(0, 2)]}
        themeName={themeName}
        width={innerWidth}
      />
    </Box>
  );
}

function compactProviderModel(providerLabel: string, model: string): string {
  const provider = providerLabel.replace(/\s+provider$/i, "").trim();

  return truncate(`${provider} ${model}`.trim(), 32);
}

function compactProjectLabel(projectLabel: string): string {
  return truncate(projectLabel.replace(/\s+/g, "_"), 20);
}

function compactStatusLabel(statusLabel: string): string {
  return truncate(statusLabel.replace(/\s+·\s+/g, " "), 18);
}

function compactAutopilotLabel(label: string): string {
  return label.toLowerCase().includes("off") ? "pilot off" : "pilot on";
}
