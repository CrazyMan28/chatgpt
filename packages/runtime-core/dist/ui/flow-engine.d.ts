export type FlowInputType = "confirm" | "select" | "text";
export interface FlowOption {
    description?: string;
    label: string;
    value: string;
}
export interface FlowStep {
    condition?: (state: Record<string, unknown>) => boolean;
    description: string | ((state: Record<string, unknown>) => string);
    inputType: FlowInputType;
    key: string;
    mask?: string;
    options?: readonly FlowOption[] | ((state: Record<string, unknown>) => readonly FlowOption[]);
    placeholder?: string | ((state: Record<string, unknown>) => string);
    title: string | ((state: Record<string, unknown>) => string);
}
export interface FlowState {
    id: string;
    state: Record<string, unknown>;
    stepIndex: number;
    steps: readonly FlowStep[];
    value: string;
}
export declare function createFlow(id: string, steps: readonly FlowStep[], state?: Record<string, unknown>): FlowState;
export declare function getVisibleFlowSteps(flow: FlowState): FlowStep[];
export declare function getActiveFlowStep(flow: FlowState): FlowStep;
export declare function getFlowOptions(flow: FlowState): readonly FlowOption[];
export declare function resolveFlowTitle(flow: FlowState): string;
export declare function resolveFlowDescription(flow: FlowState): string;
export declare function resolveFlowPlaceholder(flow: FlowState): string | undefined;
export declare function moveFlowSelection(flow: FlowState, direction: "next" | "previous"): FlowState;
export declare function primeFlow(flow: FlowState): FlowState;
export declare function advanceFlow(flow: FlowState, rawValue: string): FlowState | undefined;
export declare function formatFlowStepLabel(flow: FlowState): string;
export declare function snapshotFlowState(flow: FlowState): Record<string, unknown>;
//# sourceMappingURL=flow-engine.d.ts.map