import * as React from "react";
import { getTuiThemeColors } from "../theme.js";
import type { TranscriptEntry, TuiThemeName, TuiVerbosity } from "../types.js";
interface RenderLine {
    bold?: boolean;
    color: string;
    dim?: boolean;
    key: string;
    text: string;
}
interface CardBodyLine {
    bold?: boolean;
    color: string;
    dim?: boolean;
    text: string;
}
export interface TranscriptPanelProps {
    entries: readonly TranscriptEntry[];
    height: number;
    isStreaming: boolean;
    themeName: TuiThemeName;
    verbosity: TuiVerbosity;
    width: number;
}
export declare function TranscriptPanel({ entries, height, isStreaming, themeName, verbosity, width }: TranscriptPanelProps): React.JSX.Element;
export declare function MessageCard({ bodyLines, borderColor, id, title, titleColor, width }: {
    bodyLines: readonly CardBodyLine[];
    borderColor: string;
    id: string;
    title: string;
    titleColor: string;
    width: number;
}): RenderLine[];
export declare function UserMessageCard(entry: TranscriptEntry, width: number, colors: ReturnType<typeof getTuiThemeColors>): RenderLine[];
export declare function AssistantMessageCard(entry: TranscriptEntry, width: number, colors: ReturnType<typeof getTuiThemeColors>): RenderLine[];
export declare function ToolCard(entry: TranscriptEntry, width: number, colors: ReturnType<typeof getTuiThemeColors>, verbosity: TuiVerbosity): RenderLine[];
export declare function ErrorCard({ bodyLines, colors, id, title, width }: {
    bodyLines: readonly CardBodyLine[];
    colors: ReturnType<typeof getTuiThemeColors>;
    id: string;
    title: string;
    width: number;
}): RenderLine[];
export declare function PlanCard(entry: TranscriptEntry, width: number, colors: ReturnType<typeof getTuiThemeColors>, verbosity: TuiVerbosity): RenderLine[];
export declare function ProgressCard(entry: TranscriptEntry, width: number, colors: ReturnType<typeof getTuiThemeColors>): RenderLine[];
export {};
//# sourceMappingURL=transcript-panel.d.ts.map