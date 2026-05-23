import React from "react";
import type { ApprovalRequest, BackgroundTaskView, FleetAgentRecord, MarketplaceEntry, SessionSummary } from "@chatgpt-code/runtime-core";
import type { MemorySnapshot, ProData, ProTheme } from "../types.js";
export declare function TaskPanel({ tasks, theme, width }: {
    tasks: readonly BackgroundTaskView[];
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function ApprovalPanel({ approvals, theme, width }: {
    approvals: readonly ApprovalRequest[];
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function McpPanel({ marketplace, theme, width }: {
    marketplace: readonly MarketplaceEntry[];
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function FleetPanel({ agents, enabled, theme, width }: {
    agents: readonly FleetAgentRecord[];
    enabled: boolean;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function MemoryPanel({ memory, theme, width }: {
    memory: MemorySnapshot;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function SessionPanel({ activeSessionId, sessions, theme, width }: {
    activeSessionId?: string;
    sessions: readonly SessionSummary[];
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function LogsPanel({ data, theme, width }: {
    data: ProData;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function OverviewPanel({ data, theme, width }: {
    data: ProData;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
export declare function ToolsPanel({ data, theme, width }: {
    data: ProData;
    theme: ProTheme;
    width: number;
}): React.JSX.Element;
//# sourceMappingURL=InspectorPanels.d.ts.map