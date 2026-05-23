import type { AgentMode, BackgroundTaskView, SessionRecord } from "@chatgpt-code/runtime-core";
import type { ConnectionState, ProTranscriptEntry } from "./types.js";
export declare function compact(value: string | undefined, maxLength: number): string;
export declare function compactPath(value: string | undefined, maxLength: number): string;
export declare function wrapText(value: string, width: number, maxLines?: number): string[];
export declare function timeLabel(value: number | undefined): string;
export declare function statusFromTasks(tasks: readonly BackgroundTaskView[], offline: boolean): ConnectionState;
export declare function transcriptFromSession(session: SessionRecord | undefined): ProTranscriptEntry[];
export declare function isAgentMode(value: string): value is AgentMode;
export declare function activeTaskCount(tasks: readonly BackgroundTaskView[]): number;
export declare function stateTone(state: string): "success" | "warning" | "error" | "muted" | "accent";
export declare function shortId(value: string | undefined, length?: number): string;
//# sourceMappingURL=utils.d.ts.map