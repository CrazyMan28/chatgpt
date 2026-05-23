import * as React from "react";

import { Box, Spacer, Text } from "ink";
import type { DesktopStatus } from "@chatgpt-code/desktop-control-mcp";

import type { ManagedMcpServer } from "../../mcp/mcp-manager.js";
import { listMarketplaceEntries } from "../../mcp/mcp-marketplace.js";
import { formatExecutionModeLabel, type ExecutionMode } from "../../modes/execution-mode.js";
import type { ApprovalManagerStatus } from "../../platform/approval-manager.js";
import type {
  ApprovalRequest,
  ExecutionContext,
  FleetAgentRecord
} from "../../platform/types.js";
import type { BackgroundTaskView } from "../../tasks/background-task-runner.js";
import type { RegisteredTool } from "../../tools/tool-registry.js";
import { readScopeLabel } from "../../tools/workspace-safety.js";
import { useAppRuntimeState } from "../runtime-state.js";
import { getTuiThemeColors } from "../theme.js";
import type {
  ActiveToolEntry,
  InspectorPanel as InspectorPanelMode,
  TuiThemeName,
  TuiVerbosity
} from "../types.js";
import {
  ApprovalRow,
  DataRow,
  EmptyState,
  FleetRow,
  InspectorSection,
  InspectorTabs,
  McpRow,
  TaskRow,
  shortenPath,
  truncate
} from "./chrome.js";
import { Panel } from "./panel.js";

const INSPECTOR_TABS: readonly InspectorPanelMode[] = [
  "overview",
  "tasks",
  "approvals",
  "tools",
  "mcp",
  "fleet",
  "memory",
  "session",
  "logs"
];

export interface InspectorPanelProps {
  activeTools: readonly ActiveToolEntry[];
  activityLog: readonly string[];
  approvals: readonly ApprovalRequest[];
  approvalStatus: ApprovalManagerStatus;
  autoModeLabel: string;
  autoModeLastAction: string;
  autoModeNextRunLabel: string;
  currentWorkflowLabel: string;
  desktopStatus?: DesktopStatus;
  executionContext: ExecutionContext;
  executionMode: ExecutionMode;
  fleetAgents: readonly FleetAgentRecord[];
  goalsCount: number;
  height: number;
  lastToolSummary: string;
  mcpServers: readonly ManagedMcpServer[];
  memoryCount: number;
  panel: InspectorPanelMode;
  phaseLabel: string;
  responseModeLabel: string;
  runningTaskCount: number;
  sessionId: string;
  sessionTitle: string;
  taskCount: number;
  tasks: readonly BackgroundTaskView[];
  themeName: TuiThemeName;
  tools: readonly RegisteredTool[];
  verbosity: TuiVerbosity;
  width: number;
  workflowProgressLabel: string;
}

export function InspectorPanel({
  activeTools,
  activityLog,
  approvals,
  approvalStatus,
  autoModeLabel,
  autoModeLastAction,
  autoModeNextRunLabel,
  currentWorkflowLabel,
  desktopStatus,
  executionContext,
  executionMode,
  fleetAgents,
  goalsCount,
  height,
  lastToolSummary,
  mcpServers,
  memoryCount,
  panel,
  phaseLabel,
  responseModeLabel,
  runningTaskCount,
  sessionId,
  sessionTitle,
  taskCount,
  tasks,
  themeName,
  tools,
  verbosity,
  width,
  workflowProgressLabel
}: InspectorPanelProps): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const appState = useAppRuntimeState();
  const innerWidth = Math.max(12, width - 4);
  const pendingApprovals = approvals.filter(
    (approval) => approval.state === "pending"
  );
  const coreToolCount = tools.filter((tool) => tool.source === "core").length;
  const mcpToolCount = tools.length - coreToolCount;
  const enabledMcpCount = mcpServers.filter(
    (server) => server.status === "ENABLED"
  ).length;

  return (
    <Panel
      height={height}
      subtitle={`${panel} | Tab cycles`}
      themeName={themeName}
      title="Inspector"
      width={width}
    >
      <Box flexDirection="column">
        <InspectorTabs
          active={panel}
          tabs={INSPECTOR_TABS}
          themeName={themeName}
          width={innerWidth}
        />
        {panel === "overview" ? (
          <OverviewView
            activeTools={activeTools}
            approvalCount={pendingApprovals.length}
            appLogin={appState.loginLabel}
            appModel={appState.model}
            appProject={appState.projectLabel}
            appProvider={appState.providerLabel}
            autoModeLabel={autoModeLabel}
            coreToolCount={coreToolCount}
            currentWorkflowLabel={currentWorkflowLabel}
            desktopStatus={desktopStatus}
            enabledMcpCount={enabledMcpCount}
            executionContext={executionContext}
            executionMode={executionMode}
            fleetAgents={fleetAgents}
            innerWidth={innerWidth}
            lastToolSummary={lastToolSummary}
            mcpToolCount={mcpToolCount}
            memoryCount={memoryCount}
            phaseLabel={phaseLabel}
            runningTaskCount={runningTaskCount}
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            taskCount={taskCount}
            tasks={tasks}
            themeName={themeName}
            workflowProgressLabel={workflowProgressLabel}
          />
        ) : null}
        {panel === "tasks" ? (
          <TaskList tasks={tasks} themeName={themeName} width={innerWidth} />
        ) : null}
        {panel === "approvals" ? (
          <ApprovalList
            approvals={approvals}
            approvalStatus={approvalStatus}
            themeName={themeName}
            width={innerWidth}
          />
        ) : null}
        {panel === "tools" ? (
          <ToolsView
            activeTools={activeTools}
            desktopStatus={desktopStatus}
            executionMode={executionMode}
            themeName={themeName}
            tools={tools}
            width={innerWidth}
          />
        ) : null}
        {panel === "mcp" ? (
          <McpList
            mcpServers={mcpServers}
            projectLabel={appState.projectLabel}
            themeName={themeName}
            width={innerWidth}
          />
        ) : null}
        {panel === "fleet" ? (
          <FleetList
            fleetAgents={fleetAgents}
            themeName={themeName}
            width={innerWidth}
          />
        ) : null}
        {panel === "memory" ? (
          <MemorySummary
            goalsCount={goalsCount}
            memoryCount={memoryCount}
            themeName={themeName}
            width={innerWidth}
          />
        ) : null}
        {panel === "session" ? (
          <SessionView
            executionContext={executionContext}
            executionMode={executionMode}
            projectLabel={appState.projectLabel}
            responseModeLabel={responseModeLabel}
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            themeName={themeName}
            verbosity={verbosity}
            width={innerWidth}
          />
        ) : null}
        {panel === "logs" ? (
          <LogsView
            activeTools={activeTools}
            activityLog={activityLog}
            autoModeLastAction={autoModeLastAction}
            autoModeNextRunLabel={autoModeNextRunLabel}
            colors={colors}
            lastToolSummary={lastToolSummary}
            themeName={themeName}
            width={innerWidth}
          />
        ) : null}
      </Box>
    </Panel>
  );
}

function OverviewView({
  activeTools,
  approvalCount,
  appModel,
  appProject,
  appProvider,
  appLogin,
  autoModeLabel,
  coreToolCount,
  currentWorkflowLabel,
  desktopStatus,
  enabledMcpCount,
  executionContext,
  executionMode,
  fleetAgents,
  innerWidth,
  lastToolSummary,
  mcpToolCount,
  memoryCount,
  phaseLabel,
  runningTaskCount,
  sessionId,
  sessionTitle,
  taskCount,
  tasks,
  themeName,
  workflowProgressLabel
}: {
  activeTools: readonly ActiveToolEntry[];
  approvalCount: number;
  appModel: string;
  appProject: string;
  appProvider: string;
  appLogin: string;
  autoModeLabel: string;
  coreToolCount: number;
  currentWorkflowLabel: string;
  desktopStatus?: DesktopStatus;
  enabledMcpCount: number;
  executionContext: ExecutionContext;
  executionMode: ExecutionMode;
  fleetAgents: readonly FleetAgentRecord[];
  innerWidth: number;
  lastToolSummary: string;
  mcpToolCount: number;
  memoryCount: number;
  phaseLabel: string;
  runningTaskCount: number;
  sessionId: string;
  sessionTitle: string;
  taskCount: number;
  tasks: readonly BackgroundTaskView[];
  themeName: TuiThemeName;
  workflowProgressLabel: string;
}): React.JSX.Element {
  const queuedTasks = tasks.filter((task) => task.state === "queued").length;
  const failedTasks = tasks.filter((task) => task.state === "failed").length;
  const blockedTasks = tasks.filter((task) =>
    /approval|blocked|waiting/i.test(task.state)
  ).length;
  const runningTools = activeTools.filter((tool) => tool.status === "running");
  const runningAgents = fleetAgents.filter((agent) => agent.state === "running").length;

  return (
    <>
      <InspectorSection themeName={themeName} title="Session">
        <DataRow label="id" themeName={themeName} value={shortId(sessionId)} width={innerWidth} />
        <DataRow label="title" themeName={themeName} value={sessionTitle} width={innerWidth} />
        <DataRow label="project" themeName={themeName} value={appProject} width={innerWidth} />
        <DataRow label="cwd" themeName={themeName} value={shortenPath(executionContext.cwd, innerWidth - 8)} width={innerWidth} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Runtime">
        <DataRow label="state" themeName={themeName} tone={phaseLabel === "Ready" ? "success" : "accent"} value={phaseLabel} width={innerWidth} />
        <DataRow label="mode" themeName={themeName} tone="accent" value={formatExecutionModeLabel(executionMode)} width={innerWidth} />
        <DataRow label="pilot" themeName={themeName} value={autoModeLabel} width={innerWidth} />
        <DataRow label="provider" themeName={themeName} value={appProvider} width={innerWidth} />
        <DataRow label="model" themeName={themeName} value={appModel} width={innerWidth} />
        <DataRow label="login" themeName={themeName} value={appLogin} width={innerWidth} />
        <DataRow label="scope" themeName={themeName} value={readScopeLabel(executionContext.scope)} width={innerWidth} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Work Queue">
        <DataRow label="tasks" themeName={themeName} value={`${taskCount} total`} width={innerWidth} />
        <DataRow label="running" themeName={themeName} tone={runningTaskCount > 0 ? "accent" : "muted"} value={`${runningTaskCount}`} width={innerWidth} />
        <DataRow label="queued" themeName={themeName} value={`${queuedTasks}`} width={innerWidth} />
        <DataRow label="blocked" themeName={themeName} tone={blockedTasks > 0 ? "warning" : "muted"} value={`${blockedTasks}`} width={innerWidth} />
        <DataRow label="failed" themeName={themeName} tone={failedTasks > 0 ? "error" : "muted"} value={`${failedTasks}`} width={innerWidth} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Systems">
        <DataRow label="tools" themeName={themeName} value={`${coreToolCount} core, ${mcpToolCount} mcp`} width={innerWidth} />
        <DataRow label="active" themeName={themeName} value={runningTools.length === 0 ? "none" : runningTools.map((tool) => tool.name).join(", ")} width={innerWidth} />
        <DataRow label="mcp" themeName={themeName} value={`${enabledMcpCount} enabled`} width={innerWidth} />
        <DataRow label="desktop" themeName={themeName} tone={desktopStatus?.coreEnabled ? "success" : "muted"} value={desktopStatus?.coreEnabled ? "core enabled" : "unknown"} width={innerWidth} />
        <DataRow label="vision" themeName={themeName} value={formatVisionLabel(desktopStatus)} width={innerWidth} />
        <DataRow label="fleet" themeName={themeName} value={`${runningAgents}/${fleetAgents.length} running`} width={innerWidth} />
        <DataRow label="memory" themeName={themeName} value={`${memoryCount} facts`} width={innerWidth} />
        <DataRow label="approvals" themeName={themeName} tone={approvalCount > 0 ? "warning" : "muted"} value={`${approvalCount} pending`} width={innerWidth} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Current Step">
        <DataRow label="flow" themeName={themeName} value={currentWorkflowLabel} width={innerWidth} />
        <DataRow label="progress" themeName={themeName} value={workflowProgressLabel} width={innerWidth} />
        <Text color={getTuiThemeColors(themeName).muted}>{truncate(lastToolSummary, innerWidth)}</Text>
      </InspectorSection>
    </>
  );
}

export function TaskList({
  tasks,
  themeName,
  width
}: {
  tasks: readonly BackgroundTaskView[];
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const running = tasks.filter((task) => task.isRunning).length;
  const queued = tasks.filter((task) => task.state === "queued").length;
  const failed = tasks.filter((task) => task.state === "failed").length;

  if (tasks.length === 0) {
    return (
      <EmptyState
        detail="New interactive and scheduled work will appear here."
        themeName={themeName}
        title="No tracked tasks"
        width={width}
      />
    );
  }

  return (
    <>
      <InspectorSection themeName={themeName} title="Queue">
        <DataRow label="running" themeName={themeName} tone={running > 0 ? "accent" : "muted"} value={`${running}`} width={width} />
        <DataRow label="queued" themeName={themeName} value={`${queued}`} width={width} />
        <DataRow label="failed" themeName={themeName} tone={failed > 0 ? "error" : "muted"} value={`${failed}`} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Tasks">
        {tasks.slice(0, 10).map((task) => (
          <TaskRow
            key={task.id}
            currentStep={task.currentStep ?? task.blockedReason ?? task.validationStatus}
            id={shortId(task.id)}
            state={formatTaskState(task)}
            themeName={themeName}
            title={task.title}
            width={width}
          />
        ))}
      </InspectorSection>
      {tasks.length > 10 ? (
        <Text color={colors.muted}>{`+${tasks.length - 10} more | /task show <id>`}</Text>
      ) : null}
    </>
  );
}

export function ApprovalList({
  approvals,
  approvalStatus,
  themeName,
  width
}: {
  approvals: readonly ApprovalRequest[];
  approvalStatus: ApprovalManagerStatus;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const pending = approvals.filter((approval) => approval.state === "pending");
  const recentApproved = approvals
    .filter((approval) => approval.state === "approved")
    .slice(0, 6);
  const retryPending = recentApproved.filter((approval) =>
    ["approved_retry_pending", "retrying"].includes(
      String(approval.metadata.retryState ?? "")
    )
  );
  const blocked = approvals.filter((approval) =>
    approval.state === "pending" ||
    approval.metadata.retryState === "blocked" ||
    approval.metadata.retryState === "failed"
  );

  return (
    <>
      <InspectorSection themeName={themeName} title="Policy">
        <DataRow label="preset" themeName={themeName} value={approvalStatus.policy.preset ?? "strict"} width={width} />
        <DataRow
          label="grant"
          themeName={themeName}
          value={formatGrantLabel(approvalStatus)}
          width={width}
        />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Pending Approval">
        {pending.length === 0 ? (
          <Text color={colors.muted}>none</Text>
        ) : (
          pending.slice(0, 8).map((approval) => (
            <ApprovalRow
              action={approval.summary}
              id={shortId(approval.id)}
              key={approval.id}
              scope={approval.scope ?? approval.kind}
              task={readMetadataString(approval.metadata, "taskId")}
              themeName={themeName}
              width={width}
            />
          ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Recent Approved">
        {recentApproved.length === 0 ? (
          <Text color={colors.muted}>none</Text>
        ) : (
          recentApproved.map((approval) => (
            <ApprovalRow
              action={`${approval.summary} ${String(approval.metadata.retryState ?? "approved")}`}
              id={shortId(approval.id)}
              key={approval.id}
              scope={approval.scope ?? approval.kind}
              task={readMetadataString(approval.metadata, "taskId")}
              themeName={themeName}
              width={width}
            />
          ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Retry Pending Actions">
        {retryPending.length === 0 ? (
          <Text color={colors.muted}>none</Text>
        ) : (
          retryPending.map((approval) => (
            <Text key={approval.id} color={colors.warning}>
              {truncate(`${shortId(approval.id)} ${readMetadataString(approval.metadata, "toolName") ?? approval.summary}`, width)}
            </Text>
          ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Blocked Actions">
        {blocked.length === 0 ? (
          <Text color={colors.muted}>none</Text>
        ) : (
          blocked.slice(0, 6).map((approval) => (
            <Text key={approval.id} color={approval.state === "pending" ? colors.warning : colors.error}>
              {truncate(`${shortId(approval.id)} ${approval.state} ${approval.summary}`, width)}
            </Text>
          ))
        )}
      </InspectorSection>
      <Text color={colors.muted}>/approve all  /retry last  Ctrl+O details</Text>
    </>
  );
}

function ToolsView({
  activeTools,
  desktopStatus,
  executionMode,
  themeName,
  tools,
  width
}: {
  activeTools: readonly ActiveToolEntry[];
  desktopStatus?: DesktopStatus;
  executionMode: ExecutionMode;
  themeName: TuiThemeName;
  tools: readonly RegisteredTool[];
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);
  const recentTools = activeTools.slice(0, 6);
  const coreDesktopEnabled = tools.some((tool) => tool.name === "desktop_status");

  if (tools.length === 0) {
    return (
      <EmptyState
        detail="Core and MCP tools will appear after registry load."
        themeName={themeName}
        title="No tools loaded"
        width={width}
      />
    );
  }

  return (
    <>
      <InspectorSection themeName={themeName} title="Safety">
        <DataRow label="mode" themeName={themeName} tone="accent" value={formatExecutionModeLabel(executionMode)} width={width} />
        <DataRow label="level" themeName={themeName} value={executionMode === "plan" ? "read-only" : "approval gated"} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Desktop">
        <DataRow
          label="core"
          themeName={themeName}
          tone={coreDesktopEnabled ? "success" : "muted"}
          value={coreDesktopEnabled ? "enabled" : "disabled"}
          width={width}
        />
        <DataRow label="mode" themeName={themeName} value={desktopStatus?.config.mode ?? "unknown"} width={width} />
        <DataRow label="access" themeName={themeName} value={formatCapabilityLabel(desktopStatus?.capabilities?.accessibility)} width={width} />
        <DataRow label="screen" themeName={themeName} value={formatCapabilityLabel(desktopStatus?.capabilities?.screenshot)} width={width} />
        <DataRow label="vision" themeName={themeName} value={formatVisionLabel(desktopStatus)} width={width} />
        <DataRow label="window" themeName={themeName} value={desktopStatus?.lastObservation?.activeWindow?.title ?? "-"} width={width} />
        <DataRow label="shot at" themeName={themeName} value={formatOptionalTime(desktopStatus?.lastScreenshotAt)} width={width} />
        <DataRow label="action" themeName={themeName} value={desktopStatus?.lastAction?.action?.type ?? "-"} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Recent">
        {recentTools.length === 0 ? (
          <Text color={colors.muted}>No recent tool activity.</Text>
        ) : (
          recentTools.map((tool) => (
            <Box key={tool.id}>
              <Text color={tool.status === "running" ? colors.accent : tool.isError ? colors.error : colors.text}>
                {truncate(tool.name, Math.max(8, width - 12))}
              </Text>
              <Spacer />
              <Text color={tool.status === "running" ? colors.accent : colors.muted}>
                {tool.status}
              </Text>
            </Box>
          ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Allowed Tools">
        {tools.slice(0, 14).map((tool) => (
          <Box key={tool.id}>
            <Text color={colors.text}>{truncate(tool.name, Math.max(8, width - 9))}</Text>
            <Spacer />
            <Text color={tool.source === "mcp" ? colors.accent : colors.muted}>
              {tool.source}
            </Text>
          </Box>
        ))}
      </InspectorSection>
      {tools.length > 14 ? (
        <Text color={colors.muted}>{`+${tools.length - 14} more`}</Text>
      ) : null}
    </>
  );
}

export function McpList({
  mcpServers,
  projectLabel,
  themeName,
  width
}: {
  mcpServers: readonly ManagedMcpServer[];
  projectLabel: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const enabled = mcpServers.filter((server) => server.status === "ENABLED").length;
  const marketplaceEntries = listMarketplaceEntries();

  return (
    <>
      <InspectorSection themeName={themeName} title="Runtime">
        <DataRow label="project" themeName={themeName} value={projectLabel} width={width} />
        <DataRow label="installed" themeName={themeName} value={`${mcpServers.length}`} width={width} />
        <DataRow label="enabled" themeName={themeName} tone={enabled > 0 ? "success" : "muted"} value={`${enabled}`} width={width} />
        <DataRow label="active set" themeName={themeName} value={enabled > 0 ? "loaded" : "idle"} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Servers">
        {mcpServers.length === 0 ? (
          <EmptyState
            detail="Use /mcp marketplace or /mcp add to configure servers."
            themeName={themeName}
            title="No MCP servers"
            width={width}
          />
        ) : (
          mcpServers.slice(0, 8).map((server) => (
            <McpRow
              health="healthy"
              key={server.name}
              name={server.name}
              status={server.status === "ENABLED" ? "enabled" : "disabled"}
              themeName={themeName}
              transport={server.definition.transport}
              width={width}
            />
          ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Marketplace">
        {marketplaceEntries.slice(0, 5).map((entry) => (
          <McpRow
            health="healthy"
            key={entry.name}
            name={entry.name}
            status={entry.name === "desktop-control" ? "optional" : "available"}
            themeName={themeName}
            transport={entry.draft.transport}
            width={width}
          />
        ))}
      </InspectorSection>
    </>
  );
}

export function FleetList({
  fleetAgents,
  themeName,
  width
}: {
  fleetAgents: readonly FleetAgentRecord[];
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  if (fleetAgents.length === 0) {
    return (
      <EmptyState
        detail="Assigned sub-agents and blockers will appear here."
        themeName={themeName}
        title="No fleet agents"
        width={width}
      />
    );
  }

  return (
    <InspectorSection themeName={themeName} title="Agents">
      {fleetAgents.slice(0, 8).map((agent) => (
        <FleetRow
          blockerCount={agent.blockers?.length ?? 0}
          id={shortId(agent.id)}
          key={agent.id}
          role={agent.role}
          state={agent.state}
          task={agent.task}
          themeName={themeName}
          width={width}
        />
      ))}
    </InspectorSection>
  );
}

export function MemorySummary({
  goalsCount,
  memoryCount,
  themeName,
  width
}: {
  goalsCount: number;
  memoryCount: number;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);

  return (
    <>
      <InspectorSection themeName={themeName} title="Durable Facts">
        <DataRow label="project" themeName={themeName} value={`${memoryCount} entries`} width={width} />
        <DataRow label="goals" themeName={themeName} value={`${goalsCount} tracked`} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Commands">
        <Text color={colors.text}>/memory show</Text>
        <Text color={colors.text}>/memory compact</Text>
        <Text color={colors.text}>/memory search keyword</Text>
      </InspectorSection>
    </>
  );
}

function SessionView({
  executionContext,
  executionMode,
  projectLabel,
  responseModeLabel,
  sessionId,
  sessionTitle,
  themeName,
  verbosity,
  width
}: {
  executionContext: ExecutionContext;
  executionMode: ExecutionMode;
  projectLabel: string;
  responseModeLabel: string;
  sessionId: string;
  sessionTitle: string;
  themeName: TuiThemeName;
  verbosity: TuiVerbosity;
  width: number;
}): React.JSX.Element {
  const colors = getTuiThemeColors(themeName);

  return (
    <>
      <InspectorSection themeName={themeName} title="Metadata">
        <DataRow label="id" themeName={themeName} value={sessionId} width={width} />
        <DataRow label="title" themeName={themeName} value={sessionTitle} width={width} />
        <DataRow label="project" themeName={themeName} value={projectLabel} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Workspace">
        <DataRow label="cwd" themeName={themeName} value={shortenPath(executionContext.cwd, width - 8)} width={width} />
        <DataRow label="scope" themeName={themeName} value={readScopeLabel(executionContext.scope)} width={width} />
        <DataRow label="root" themeName={themeName} value={shortenPath(executionContext.projectRoot, width - 8)} width={width} />
      </InspectorSection>
      <InspectorSection themeName={themeName} title="UI">
        <DataRow label="mode" themeName={themeName} value={formatExecutionModeLabel(executionMode)} width={width} />
        <DataRow label="style" themeName={themeName} value={responseModeLabel} width={width} />
        <DataRow label="theme" themeName={themeName} value={themeName} width={width} />
        <DataRow label="density" themeName={themeName} value={verbosity} width={width} />
      </InspectorSection>
      <Text color={colors.muted}>/session info  /session rename title</Text>
    </>
  );
}

function LogsView({
  activeTools,
  activityLog,
  autoModeLastAction,
  autoModeNextRunLabel,
  colors,
  lastToolSummary,
  themeName,
  width
}: {
  activeTools: readonly ActiveToolEntry[];
  activityLog: readonly string[];
  autoModeLastAction: string;
  autoModeNextRunLabel: string;
  colors: ReturnType<typeof getTuiThemeColors>;
  lastToolSummary: string;
  themeName: TuiThemeName;
  width: number;
}): React.JSX.Element {
  return (
    <>
      <InspectorSection themeName={themeName} title="Debug Stream">
        {activeTools.filter((tool) => tool.status === "running").length === 0 ? (
          <Text color={colors.muted}>No running tools.</Text>
        ) : (
          activeTools
            .filter((tool) => tool.status === "running")
            .map((tool) => (
              <Text key={tool.id} color={colors.accent}>
                {truncate(`${tool.name} active ${formatAge(tool.startedAt)}`, width)}
              </Text>
            ))
        )}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Recent">
        <Text color={colors.text}>{truncate(lastToolSummary, width)}</Text>
        {activityLog.slice(0, 7).map((line, index) => (
          <Text key={`${line}-${index}`} color={colors.muted}>
            {truncate(line, width)}
          </Text>
        ))}
      </InspectorSection>
      <InspectorSection themeName={themeName} title="Autonomous">
        <DataRow label="next" themeName={themeName} value={autoModeNextRunLabel} width={width} />
        <Text color={colors.muted}>{truncate(autoModeLastAction, width)}</Text>
      </InspectorSection>
    </>
  );
}

function formatTaskState(task: BackgroundTaskView): string {
  if (task.isRunning) {
    return "RUN";
  }

  if (task.state === "queued") {
    return "WAIT";
  }

  if (/approval|blocked|waiting/i.test(task.state)) {
    return "BLOCK";
  }

  if (/complete|done|passed/i.test(task.state)) {
    return "DONE";
  }

  if (task.state === "failed") {
    return "FAIL";
  }

  if (task.state === "paused") {
    return "PAUSE";
  }

  return task.state.toUpperCase();
}

function formatCapabilityLabel(capability?: { available: boolean }): string {
  if (!capability) {
    return "unknown";
  }

  return capability.available ? "available" : "unavailable";
}

function formatVisionLabel(status?: DesktopStatus): string {
  if (!status) {
    return "unknown";
  }

  return `${status.vision.provider}/${status.vision.model ?? "-"} ${status.vision.configured ? "ready" : "not configured"}`;
}

function formatOptionalTime(value?: number): string {
  return value ? new Date(value).toLocaleTimeString() : "-";
}

function formatGrantLabel(status: ApprovalManagerStatus): string {
  const grant = status.blanketGrant ?? status.policy.blanketGrant;

  if (!grant) {
    return "none";
  }

  const coverage = grant.maxSafety === "medium" ? "all" : grant.maxSafety;

  return `${grant.scope}/${coverage}`;
}

function shortId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return value.slice(-12);
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];

  return typeof value === "string" ? value : undefined;
}

function formatAge(value: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1_000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}
