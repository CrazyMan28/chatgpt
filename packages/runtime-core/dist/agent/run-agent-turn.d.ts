import type { ModelClient, ModelMessage, ModelToolCall } from "../models/model-client.js";
import type { ToolExecutionResult, ToolRegistry } from "../tools/tool-registry.js";
import type { ExecutionMode } from "../modes/execution-mode.js";
export type AgentTurnPhase = "ready" | "thinking" | "running_tool" | "streaming";
export type AgentTurnEvent = {
    type: "status";
    phase: AgentTurnPhase;
    step: number;
} | {
    type: "tool_started";
    step: number;
    toolCall: ModelToolCall;
} | {
    type: "tool_finished";
    step: number;
    toolCall: ModelToolCall;
    result: ToolExecutionResult;
} | {
    type: "assistant_stream_started";
    step: number;
    entryId: string;
} | {
    type: "assistant_stream_delta";
    step: number;
    entryId: string;
    delta: string;
    content: string;
} | {
    type: "assistant_stream_completed";
    step: number;
    entryId: string;
    content: string;
};
export interface RunAgentTurnOptions {
    autopilot?: boolean;
    contextMessages?: readonly Extract<ModelMessage, {
        role: "system";
    }>[];
    executionMode?: ExecutionMode;
    history?: readonly ModelMessage[];
    prompt: string;
    model: ModelClient;
    toolRegistry?: ToolRegistry;
    maxSteps?: number;
    onEvent?: (event: AgentTurnEvent) => void | Promise<void>;
    shouldContinue?: () => {
        ok: true;
    } | {
        ok: false;
        reason?: string;
        state: "cancelled" | "paused";
    };
}
export interface AgentTurnResult {
    content: string;
    messages: ModelMessage[];
}
export declare class AgentControlError extends Error {
    readonly state: "cancelled" | "paused";
    constructor(state: "cancelled" | "paused", message?: string);
}
export declare function runAgentTurn({ autopilot, contextMessages, executionMode, history, prompt, model, toolRegistry, maxSteps, onEvent, shouldContinue }: RunAgentTurnOptions): Promise<AgentTurnResult>;
export declare function resolveAgentStepBudget(input: {
    autopilot?: boolean;
    executionMode?: ExecutionMode;
    maxSteps?: number;
}): number;
//# sourceMappingURL=run-agent-turn.d.ts.map