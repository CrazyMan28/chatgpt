import { type FlowState } from "../flow-engine.js";
export interface FlowPanelProps {
    flow: FlowState;
    height: number;
    width: number;
    onCancel: () => void;
    onMoveSelection: (direction: "next" | "previous") => void;
    onSubmitSelection: () => void;
}
export declare function FlowPanel({ flow, height, width, onCancel, onMoveSelection, onSubmitSelection }: FlowPanelProps): React.JSX.Element;
//# sourceMappingURL=flow-panel.d.ts.map