import * as React from "react";
import type { DesktopStatus } from "@chatgpt-code/desktop-control-mcp";
import type { ManagedMcpServer } from "../../mcp/mcp-manager.js";
import { type ExecutionMode } from "../../modes/execution-mode.js";
import type { ApprovalManagerStatus } from "../../platform/approval-manager.js";
import type { ApprovalRequest, ExecutionContext, FleetAgentRecord } from "../../platform/types.js";
import type { BackgroundTaskView } from "../../tasks/background-task-runner.js";
import type { RegisteredTool } from "../../tools/tool-registry.js";
import type { ActiveToolEntry, InspectorPanel as InspectorPanelMode, TuiThemeName, TuiVerbosity } from "../types.js";
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
export declare function InspectorPanel({ activeTools, activityLog, approvals, approvalStatus, autoModeLabel, autoModeLastAction, autoModeNextRunLabel, currentWorkflowLabel, desktopStatus, executionContext, executionMode, fleetAgents, goalsCount, height, lastToolSummary, mcpServers, memoryCount, panel, phaseLabel, responseModeLabel, runningTaskCount, sessionId, sessionTitle, taskCount, tasks, themeName, tools, verbosity, width, workflowProgressLabel }: InspectorPanelProps): React.JSX.Element;
export declare function TaskList({ tasks, themeName, width }: {
    tasks: readonly BackgroundTaskView[];
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function ApprovalList({ approvals, approvalStatus, themeName, width }: {
    approvals: readonly ApprovalRequest[];
    approvalStatus: ApprovalManagerStatus;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function McpList({ mcpServers, projectLabel, themeName, width }: {
    mcpServers: readonly ManagedMcpServer[];
    projectLabel: string;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function FleetList({ fleetAgents, themeName, width }: {
    fleetAgents: readonly FleetAgentRecord[];
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
export declare function MemorySummary({ goalsCount, memoryCount, themeName, width }: {
    goalsCount: number;
    memoryCount: number;
    themeName: TuiThemeName;
    width: number;
}): React.JSX.Element;
//# sourceMappingURL=inspector-panel.d.ts.map