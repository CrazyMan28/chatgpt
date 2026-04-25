const DEFAULT_MAX_AGENT_STEPS = 24;
const BUILD_MAX_AGENT_STEPS = 48;
const AUTOPILOT_MAX_AGENT_STEPS = 96;
const MAX_CONSECUTIVE_DUPLICATE_TOOL_STEPS = 3;
const MAX_CONSECUTIVE_NO_PROGRESS_STEPS = 4;
const MAX_CONSECUTIVE_TOOL_FAILURE_STEPS = 3;
const ASSISTANT_STREAM_DELAY_MS = 12;
const ASSISTANT_STREAM_CHUNK_SIZE = 18;
export class AgentControlError extends Error {
    state;
    constructor(state, message) {
        super(message ??
            (state === "paused"
                ? "Agent paused before the next execution step."
                : "Agent stopped before the next execution step."));
        this.state = state;
    }
}
export async function runAgentTurn({ autopilot = false, contextMessages = [], executionMode = "normal", history = [], prompt, model, toolRegistry, maxSteps, onEvent, shouldContinue }) {
    const stepBudget = resolveAgentStepBudget({
        autopilot,
        executionMode,
        maxSteps
    });
    const messages = [
        ...history.map((message) => ({ ...message })),
        { role: "user", content: prompt }
    ];
    const availableTools = toolRegistry?.listModelTools() ?? [];
    let previousFingerprint = "";
    let previousToolFingerprint = "";
    let consecutiveNoProgressSteps = 0;
    let consecutiveDuplicateToolSteps = 0;
    let consecutiveToolFailureSteps = 0;
    for (let step = 0; step < stepBudget; step += 1) {
        assertCanContinue(shouldContinue);
        await emitEvent(onEvent, {
            type: "status",
            phase: "thinking",
            step: step + 1
        });
        const response = await model.generate({
            messages: [...contextMessages, ...messages],
            tools: availableTools
        });
        const responseFingerprint = createResponseFingerprint(response);
        const toolFingerprint = createToolFingerprint(response.toolCalls);
        if (responseFingerprint === previousFingerprint) {
            consecutiveNoProgressSteps += 1;
        }
        else {
            consecutiveNoProgressSteps = 0;
        }
        if (toolFingerprint.length > 0 && toolFingerprint === previousToolFingerprint) {
            consecutiveDuplicateToolSteps += 1;
        }
        else {
            consecutiveDuplicateToolSteps = 0;
        }
        previousFingerprint = responseFingerprint;
        previousToolFingerprint = toolFingerprint;
        if (consecutiveNoProgressSteps >= MAX_CONSECUTIVE_NO_PROGRESS_STEPS) {
            throw new Error("Agent paused because the model repeated the same step without making progress.");
        }
        if (consecutiveDuplicateToolSteps >= MAX_CONSECUTIVE_DUPLICATE_TOOL_STEPS) {
            throw new Error("Agent paused because it kept requesting the same tool actions without making progress.");
        }
        if (response.toolCalls.length === 0) {
            const content = await finalizeAssistantResponse(response, step + 1, onEvent);
            messages.push({
                role: "assistant",
                content
            });
            return {
                content,
                messages
            };
        }
        messages.push({
            role: "assistant",
            content: response.content,
            toolCalls: response.toolCalls
        });
        let allToolCallsFailed = response.toolCalls.length > 0;
        for (const toolCall of response.toolCalls) {
            assertCanContinue(shouldContinue);
            await emitEvent(onEvent, {
                type: "status",
                phase: "running_tool",
                step: step + 1
            });
            await emitEvent(onEvent, {
                type: "tool_started",
                step: step + 1,
                toolCall
            });
            const result = await executeToolCall(toolRegistry, toolCall);
            allToolCallsFailed &&= result.isError;
            await emitEvent(onEvent, {
                type: "tool_finished",
                step: step + 1,
                toolCall,
                result
            });
            messages.push({
                role: "tool",
                content: formatToolResult(result),
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                isError: result.isError
            });
            assertCanContinue(shouldContinue);
        }
        if (allToolCallsFailed) {
            consecutiveToolFailureSteps += 1;
        }
        else {
            consecutiveToolFailureSteps = 0;
        }
        if (consecutiveToolFailureSteps >= MAX_CONSECUTIVE_TOOL_FAILURE_STEPS) {
            throw new Error("Agent paused because repeated tool failures prevented meaningful progress.");
        }
    }
    throw new Error(`Agent stopped after ${stepBudget} steps without producing a final response.`);
}
export function resolveAgentStepBudget(input) {
    if (typeof input.maxSteps === "number" && Number.isFinite(input.maxSteps)) {
        return Math.max(1, Math.floor(input.maxSteps));
    }
    if (input.autopilot) {
        return AUTOPILOT_MAX_AGENT_STEPS;
    }
    if (input.executionMode === "build") {
        return BUILD_MAX_AGENT_STEPS;
    }
    return DEFAULT_MAX_AGENT_STEPS;
}
function createResponseFingerprint(response) {
    const normalizedContent = response.content.trim().replace(/\s+/g, " ");
    const toolFingerprint = createToolFingerprint(response.toolCalls);
    return `${normalizedContent}::${toolFingerprint}`;
}
function createToolFingerprint(toolCalls) {
    return toolCalls
        .map((toolCall) => `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`)
        .join("|");
}
async function finalizeAssistantResponse(response, step, onEvent) {
    const content = response.content.trim();
    const finalContent = content.length > 0 ? response.content : "No response generated.";
    const entryId = createAssistantEntryId(step);
    await emitEvent(onEvent, {
        type: "status",
        phase: "streaming",
        step
    });
    await emitEvent(onEvent, {
        type: "assistant_stream_started",
        step,
        entryId
    });
    if (onEvent) {
        let aggregated = "";
        for (const chunk of chunkAssistantContent(finalContent)) {
            aggregated += chunk;
            await emitEvent(onEvent, {
                type: "assistant_stream_delta",
                step,
                entryId,
                delta: chunk,
                content: aggregated
            });
            await delay(ASSISTANT_STREAM_DELAY_MS);
        }
    }
    await emitEvent(onEvent, {
        type: "assistant_stream_completed",
        step,
        entryId,
        content: finalContent
    });
    await emitEvent(onEvent, {
        type: "status",
        phase: "ready",
        step
    });
    return finalContent;
}
async function executeToolCall(toolRegistry, toolCall) {
    if (!toolRegistry) {
        return {
            content: `Tool "${toolCall.name}" is unavailable because no tool registry is loaded.`,
            isError: true
        };
    }
    try {
        return await toolRegistry.executeTool(toolCall.name, toolCall.arguments);
    }
    catch (error) {
        return {
            content: error instanceof Error
                ? error.message
                : `Unexpected failure while running tool "${toolCall.name}".`,
            isError: true
        };
    }
}
function assertCanContinue(shouldContinue) {
    const decision = shouldContinue?.();
    if (!decision || decision.ok) {
        return;
    }
    throw new AgentControlError(decision.state, decision.reason);
}
function formatToolResult(result) {
    return result.isError
        ? `Tool execution failed:\n${result.content}`
        : `Tool execution succeeded:\n${result.content}`;
}
async function emitEvent(onEvent, event) {
    if (!onEvent) {
        return;
    }
    await onEvent(event);
}
function chunkAssistantContent(content) {
    if (content.length <= ASSISTANT_STREAM_CHUNK_SIZE) {
        return [content];
    }
    const chunks = [];
    for (let index = 0; index < content.length; index += ASSISTANT_STREAM_CHUNK_SIZE) {
        chunks.push(content.slice(index, index + ASSISTANT_STREAM_CHUNK_SIZE));
    }
    return chunks;
}
function createAssistantEntryId(step) {
    return `assistant-step-${step}-${Date.now()}`;
}
async function delay(durationMs) {
    await new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });
}
//# sourceMappingURL=run-agent-turn.js.map