import React from "react";
import { Box, Text } from "ink";

import type { ProData, ProTheme } from "../types.js";
import { activeTaskCount, compact, compactPath } from "../utils.js";
import { Badge } from "./Badge.js";

export function ProTopBar({
  data,
  theme,
  width
}: {
  data: ProData;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const provider = data.provider;
  const project = data.status?.project;
  const pendingApprovals = data.approvals.filter((approval) => approval.state === "pending").length;
  const activeTasks = activeTaskCount(data.tasks);
  const statusTone =
    data.connectionState === "ready"
      ? "success"
      : data.connectionState === "running"
        ? "accent"
        : data.connectionState === "blocked"
          ? "warning"
          : "error";
  const modelLabel = compact(
    `${provider?.providerLabel ?? provider?.provider ?? "provider"}/${provider?.model ?? "model"}`,
    width < 96 ? 24 : 34
  ).toUpperCase();

  if (width < 96) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border}
        flexDirection="column"
        paddingX={1}
        width={width}
      >
        <Text>
          <Text color={theme.accent} bold>CHATGPT CODE PRO</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={theme.success}>{data.connectionState.toUpperCase()}</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={data.mode === "normal" ? theme.muted : theme.accent}>{data.mode.toUpperCase()}</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={theme.muted}>PILOT {data.autopilot.toUpperCase()}</Text>
        </Text>
        <Text color={theme.secondary}>{compact(modelLabel, Math.max(16, width - 8))}</Text>
        <Text>
          <Text color={theme.text}>{compact(project?.displayName ?? project?.name ?? "workspace", 18)}</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={theme.muted}>{project?.lastScope ?? "workspace"}</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={pendingApprovals > 0 ? theme.warning : theme.muted}>approvals:{pendingApprovals}</Text>
          <Text color={theme.borderDim}>  </Text>
          <Text color={activeTasks > 0 ? theme.accent : theme.muted}>tasks:{activeTasks}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      flexDirection="column"
      paddingX={1}
      width={width}
    >
      <Box>
        <Text color={theme.accent} bold>
          CHATGPT CODE PRO
        </Text>
        <Text color={theme.borderDim}>  </Text>
        <Badge label={data.connectionState.toUpperCase()} tone={statusTone} theme={theme} />
        <Badge label={data.mode.toUpperCase()} tone={data.mode === "normal" ? "muted" : "accent"} theme={theme} />
        <Badge label={`PILOT ${data.autopilot.toUpperCase()}`} tone={data.autopilot === "on" ? "warning" : "muted"} theme={theme} />
        <Badge label={modelLabel} tone="secondary" theme={theme} />
      </Box>
      <Box>
        <Text color={theme.text}>
          {compact(project?.displayName ?? project?.name ?? "workspace", 24)}
        </Text>
        <Text color={theme.borderDim}>  </Text>
        <Text color={theme.muted}>{project?.lastScope ?? "workspace"}</Text>
        <Text color={theme.borderDim}>  </Text>
        <Text color={theme.muted}>{compactPath(project?.lastCwd ?? project?.path, width < 96 ? 32 : 48)}</Text>
        <Text color={theme.borderDim}>  </Text>
        <Text color={pendingApprovals > 0 ? theme.warning : theme.muted}>approvals:{pendingApprovals}</Text>
        <Text color={theme.borderDim}>  </Text>
        <Text color={activeTasks > 0 ? theme.accent : theme.muted}>tasks:{activeTasks}</Text>
      </Box>
    </Box>
  );
}
