import type { TranscriptEntry } from "../types.js";
export interface OutputPanelProps {
    entries: readonly TranscriptEntry[];
    height: number;
    isStreaming: boolean;
    width: number;
}
export declare function OutputPanel({ entries, height, isStreaming, width }: OutputPanelProps): React.JSX.Element;
//# sourceMappingURL=output-panel.d.ts.map