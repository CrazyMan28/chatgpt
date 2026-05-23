import * as React from "react";
import type { TuiThemeName } from "../types.js";
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
export declare function TopBar({ activeToolCount, approvalCount, autopilotLabel, cwd, executionModeLabel, failedTaskCount, fleetCount, isWide, projectLabel, queuedTaskCount, runningTaskCount, scopeLabel, statusLabel, statusTone, taskCount, themeName, width }: TopBarProps): React.JSX.Element;
//# sourceMappingURL=top-bar.d.ts.map