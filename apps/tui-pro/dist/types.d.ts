import type { AgentMode, ApprovalRequest, BackgroundTaskView, FleetAgentRecord, MarketplaceEntry, ModelRuntimeSnapshot, ProjectDossier, QueueItem, SessionRecord, SessionRegistryEntry, SessionSummary, TimelineEvent, UserDossier, WatcherRecord, WorkerSpec } from "@chatgpt-code/runtime-core";
export type ProPanel = "overview" | "tasks" | "approvals" | "tools" | "mcp" | "fleet" | "memory" | "session" | "logs";
export type ProThemeName = "cyber" | "minimal" | "compact";
export type ConnectionState = "offline" | "ready" | "running" | "blocked";
export interface ProTheme {
    accent: string;
    background: string;
    border: string;
    borderDim: string;
    error: string;
    muted: string;
    secondary: string;
    success: string;
    text: string;
    warning: string;
}
export interface ProStatus {
    approvals?: {
        pending: number;
        total: number;
    };
    fleet?: {
        agents: readonly FleetAgentRecord[];
        enabled: boolean;
    };
    goals?: unknown[];
    mode?: AgentMode;
    models?: unknown[];
    project?: {
        displayName?: string;
        lastCwd?: string;
        lastScope?: string;
        name?: string;
        path?: string;
    };
    provider?: ModelRuntimeSnapshot;
    queue?: QueueItem[];
    sessions?: SessionRegistryEntry[];
    tasks?: readonly BackgroundTaskView[];
    toolCount?: number;
    watchers?: {
        active: number;
        total: number;
    };
    workers?: WorkerSpec[];
}
export type TranscriptKind = "user" | "assistant" | "tool" | "error" | "plan" | "progress" | "system";
export interface ProTranscriptEntry {
    content: string;
    createdAt: number;
    id: string;
    kind: TranscriptKind;
    status?: "complete" | "streaming";
    title?: string;
}
export interface MemorySnapshot {
    project?: ProjectDossier;
    results: unknown[];
    user?: UserDossier;
}
export interface ProData {
    approvals: ApprovalRequest[];
    autopilot: "off" | "on" | "unknown";
    connectionDetail: string;
    connectionState: ConnectionState;
    currentSession?: SessionRecord;
    fleetAgents: readonly FleetAgentRecord[];
    fleetEnabled: boolean;
    lastDetails?: string;
    logs: string[];
    marketplace: MarketplaceEntry[];
    memory: MemorySnapshot;
    mode: AgentMode;
    panel: ProPanel;
    provider?: ModelRuntimeSnapshot;
    sessionRegistry: SessionRegistryEntry[];
    sessions: SessionSummary[];
    status?: ProStatus;
    tasks: readonly BackgroundTaskView[];
    themeName: ProThemeName;
    timeline: TimelineEvent[];
    transcript: ProTranscriptEntry[];
    watchers: WatcherRecord[];
}
export interface ProCommand {
    command: string;
    description: string;
    title: string;
}
//# sourceMappingURL=types.d.ts.map