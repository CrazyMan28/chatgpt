import React from "react";
import { Box, Text } from "ink";

import type { ApprovalRequest, BackgroundTaskView, FleetAgentRecord, MarketplaceEntry, SessionSummary } from "@chatgpt-code/runtime-core";

import type { MemorySnapshot, ProData, ProTheme } from "../types.js";
import { compact, compactPath, shortId, stateTone, timeLabel, wrapText } from "../utils.js";
import { toneColor } from "./Badge.js";

export function TaskPanel({
  tasks,
  theme,
  width
}: {
  tasks: readonly BackgroundTaskView[];
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  if (tasks.length === 0) {
    return <EmptyLine theme={theme} text="No tasks reported by daemon." />;
  }

  return (
    <Box flexDirection="column">
      {tasks.slice(0, 8).map((task) => (
        <Box key={task.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color={theme.accent}>{shortId(task.id)}</Text>
            <Text color={theme.borderDim}>  </Text>
            <Text color={toneColor(theme, stateTone(task.state))}>{task.state}</Text>
          </Text>
          <Text color={theme.text}>{compact(task.title || task.prompt, width - 2)}</Text>
          {task.currentStep || task.blockedReason || task.lastError ? (
            <Text color={theme.muted}>{compact(task.currentStep ?? task.blockedReason ?? task.lastError, width - 2)}</Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function ApprovalPanel({
  approvals,
  theme,
  width
}: {
  approvals: readonly ApprovalRequest[];
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const pending = approvals.filter((approval) => approval.state === "pending");
  const list = pending.length > 0 ? pending : approvals.slice(0, 8);

  if (list.length === 0) {
    return <EmptyLine theme={theme} text="No approvals requested." />;
  }

  return (
    <Box flexDirection="column">
      <Text color={pending.length > 0 ? theme.warning : theme.muted}>
        {pending.length} pending / {approvals.length} total
      </Text>
      {list.slice(0, 8).map((approval) => (
        <Box key={approval.id} flexDirection="column" marginTop={1}>
          <Text>
            <Text color={theme.warning}>{shortId(approval.id)}</Text>
            <Text color={theme.borderDim}>  </Text>
            <Text color={toneColor(theme, stateTone(approval.state))}>{approval.state}</Text>
          </Text>
          <Text color={theme.text}>{compact(approval.summary, width - 2)}</Text>
          <Text color={theme.muted}>{compact(approval.detail, width - 2)}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function McpPanel({
  marketplace,
  theme,
  width
}: {
  marketplace: readonly MarketplaceEntry[];
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  if (marketplace.length === 0) {
    return <EmptyLine theme={theme} text="Marketplace unavailable or empty." />;
  }

  const installed = marketplace.filter((entry) => entry.installStatus === "installed").length;

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>entries:{marketplace.length} installed:{installed}</Text>
      {marketplace.slice(0, 8).map((entry) => (
        <Box key={entry.name} flexDirection="column" marginTop={1}>
          <Text>
            <Text color={entry.favorite ? theme.warning : theme.accent}>{compact(entry.name, 22)}</Text>
            <Text color={theme.borderDim}>  </Text>
            <Text color={toneColor(theme, stateTone(entry.enabledStatus))}>{entry.enabledStatus}</Text>
          </Text>
          <Text color={theme.muted}>{compact(entry.description, width - 2)}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function FleetPanel({
  agents,
  enabled,
  theme,
  width
}: {
  agents: readonly FleetAgentRecord[];
  enabled: boolean;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text color={enabled ? theme.success : theme.muted}>fleet {enabled ? "enabled" : "disabled"} / agents:{agents.length}</Text>
      {agents.length === 0 ? <EmptyLine theme={theme} text="No fleet agents active." /> : null}
      {agents.slice(0, 8).map((agent) => (
        <Box key={agent.id} flexDirection="column" marginTop={1}>
          <Text>
            <Text color={theme.accent}>{shortId(agent.id)}</Text>
            <Text color={theme.borderDim}>  </Text>
            <Text color={toneColor(theme, stateTone(agent.state))}>{agent.state}</Text>
            <Text color={theme.borderDim}>  {agent.role}</Text>
          </Text>
          <Text color={theme.text}>{compact(agent.task, width - 2)}</Text>
          {agent.summary || agent.error ? (
            <Text color={agent.error ? theme.error : theme.muted}>{compact(agent.summary ?? agent.error, width - 2)}</Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function MemoryPanel({
  memory,
  theme,
  width
}: {
  memory: MemorySnapshot;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const summary = memory.project?.summary ?? memory.project?.purpose ?? memory.user?.importantPreferences?.join(" ");

  return (
    <Box flexDirection="column">
      <Text color={theme.accent} bold>Memory summary</Text>
      {summary ? (
        wrapText(summary, width - 2, 5).map((line, index) => <Text key={index} color={theme.text}>{line}</Text>)
      ) : (
        <Text color={theme.muted}>No dossier summary exposed yet.</Text>
      )}
      {memory.results.length > 0 ? <Text color={theme.borderDim}>search results</Text> : null}
      {memory.results.slice(0, 6).map((entry, index) => (
        <Text key={index} color={theme.muted}>{compact(memoryResultText(entry), width - 2)}</Text>
      ))}
    </Box>
  );
}

export function SessionPanel({
  activeSessionId,
  sessions,
  theme,
  width
}: {
  activeSessionId?: string;
  sessions: readonly SessionSummary[];
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  if (sessions.length === 0) {
    return <EmptyLine theme={theme} text="No sessions yet. Send a prompt to create one." />;
  }

  return (
    <Box flexDirection="column">
      {sessions.slice(0, 9).map((session) => (
        <Box key={session.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color={session.id === activeSessionId ? theme.accent : theme.muted}>
              {session.id === activeSessionId ? ">" : " "}
            </Text>
            <Text color={theme.accent}> {shortId(session.id, 16)}</Text>
            <Text color={theme.borderDim}>  {timeLabel(session.updatedAt)}</Text>
          </Text>
          <Text color={theme.text}>{compact(session.title, width - 2)}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function LogsPanel({
  data,
  theme,
  width
}: {
  data: ProData;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      {data.lastDetails ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.warning} bold>Last details</Text>
          {wrapText(data.lastDetails, width - 2, 5).map((line, index) => <Text key={index}>{line}</Text>)}
        </Box>
      ) : null}
      {data.logs.length === 0 ? <EmptyLine theme={theme} text="No visible logs yet." /> : null}
      {data.logs.slice(-10).map((line, index) => (
        <Text key={index} color={theme.muted}>{compact(line, width - 2)}</Text>
      ))}
    </Box>
  );
}

export function OverviewPanel({
  data,
  theme,
  width
}: {
  data: ProData;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const project = data.status?.project;
  const watchers = data.status?.watchers;

  return (
    <Box flexDirection="column">
      <Metric label="connection" theme={theme} value={data.connectionDetail} />
      <Metric label="session" theme={theme} value={shortId(data.currentSession?.id, 18)} />
      <Metric label="provider" theme={theme} value={`${data.provider?.providerLabel ?? "-"} / ${data.provider?.model ?? "-"}`} />
      <Metric label="project" theme={theme} value={project?.displayName ?? project?.name ?? "-"} />
      <Metric label="cwd" theme={theme} value={compactPath(project?.lastCwd ?? project?.path, width - 14)} />
      <Metric label="watchers" theme={theme} value={`${watchers?.active ?? 0}/${watchers?.total ?? 0}`} />
      <Metric label="tools" theme={theme} value={String(data.status?.toolCount ?? "-")} />
      <Metric label="sessions" theme={theme} value={String(data.sessions.length)} />
    </Box>
  );
}

export function ToolsPanel({
  data,
  theme,
  width
}: {
  data: ProData;
  theme: ProTheme;
  width: number;
}): React.JSX.Element {
  const queue = data.status?.queue ?? [];
  const toolish = queue.filter((item) => item.type === "task" || item.type === "watcher");

  return (
    <Box flexDirection="column">
      <Metric label="registered" theme={theme} value={String(data.status?.toolCount ?? "-")} />
      <Metric label="watchers" theme={theme} value={String(data.watchers.length)} />
      {toolish.slice(0, 8).map((item) => (
        <Box key={item.id} flexDirection="column" marginTop={1}>
          <Text>
            <Text color={theme.accent}>{item.type}</Text>
            <Text color={theme.borderDim}>  </Text>
            <Text color={toneColor(theme, stateTone(item.state))}>{item.state}</Text>
          </Text>
          <Text color={theme.muted}>{compact(item.summary, width - 2)}</Text>
        </Box>
      ))}
    </Box>
  );
}

function Metric({
  label,
  theme,
  value
}: {
  label: string;
  theme: ProTheme;
  value: string;
}): React.JSX.Element {
  return (
    <Text>
      <Text color={theme.muted}>{label.padEnd(11)}</Text>
      <Text color={theme.text}>{value}</Text>
    </Text>
  );
}

function EmptyLine({
  text,
  theme
}: {
  text: string;
  theme: ProTheme;
}): React.JSX.Element {
  return <Text color={theme.muted}>{text}</Text>;
}

function memoryResultText(value: unknown): string {
  if (typeof value === "object" && value !== null && "text" in value) {
    return String(value.text);
  }

  return String(value);
}

