import type { RegisteredTool } from "../../tools/tool-registry.js";
import type { ActiveToolEntry } from "../types.js";
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
export declare function Sidebar({ activeTools, agentModeLabel, autoModeLabel, autoModeLastAction, autoModeNextRunLabel, currentWorkflowLabel, executionModeLabel, height, lastToolSummary, phaseLabel, responseModeLabel, sessionLabel, step, taskLabel, tools, workflowProgressLabel, width }: SidebarProps): React.JSX.Element;
//# sourceMappingURL=sidebar.d.ts.map