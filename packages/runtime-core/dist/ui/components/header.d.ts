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
export declare function Header({ activeToolCount, agentModeLabel, approvalLabel, autoModeLabel, autopilotLabel, cwdLabel, executionModeLabel, projectLabel, scopeLabel, statusLabel, statusTone, taskCount, toolCount, workflowProgressLabel, width }: HeaderProps): React.JSX.Element;
//# sourceMappingURL=header.d.ts.map