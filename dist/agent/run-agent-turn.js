const DEFAULT_MAX_AGENT_STEPS = 8;
const ASSISTANT_STREAM_DELAY_MS = 12;
const ASSISTANT_STREAM_CHUNK_SIZE = 18;
export async function runAgentTurn({ contextMessages = [], history = [], prompt, model, toolRegistry, maxSteps = DEFAULT_MAX_AGENT_STEPS, onEvent }) {
    const messages = [
        ...history.map((message) => ({ ...message })),
        { role: "user", content: prompt }
    ];
    const availableTools = toolRegistry?.listModelTools() ?? [];
    for (let step = 0; step < maxSteps; step += 1) {
        await emitEvent(onEvent, {
            type: "status",
            phase: "thinking",
            step: step + 1
        });
        const response = await model.generate({
            messages: [...contextMessages, ...messages],
            tools: availableTools
        });
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
        for (const toolCall of response.toolCalls) {
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
        }
    }
    throw new Error(`Agent stopped after ${maxSteps} steps without producing a final response.`);
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
