import { createModelResponse } from "./model-client.js";
export class OpenAICompatibleModelClient {
    config;
    fetchFn;
    constructor(config, fetchFn = globalThis.fetch) {
        this.config = config;
        this.fetchFn = fetchFn;
    }
    async generate(request) {
        const response = await this.fetchFn(buildChatCompletionsUrl(this.config.baseUrl), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(buildRequestBody(this.config, request)),
            signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) {
            const detail = await readResponseDetail(response);
            throw new Error(`OpenAI-compatible request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
        }
        const data = (await response.json());
        const message = data.choices?.[0]?.message;
        const content = extractAssistantText(message);
        const toolCalls = parseToolCalls(message?.tool_calls);
        if (content === undefined && toolCalls.length === 0) {
            throw new Error("OpenAI-compatible response did not include assistant text or tool calls.");
        }
        return createModelResponse(content ?? "", toolCalls);
    }
}
function buildChatCompletionsUrl(baseUrl) {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("chat/completions", normalizedBaseUrl).toString();
}
function buildRequestBody(config, request) {
    const body = {
        model: config.model,
        messages: request.messages.map((message) => toOpenAIMessage(message))
    };
    if (request.tools.length > 0) {
        body.tools = request.tools.map((tool) => toOpenAITool(tool));
        body.tool_choice = "auto";
    }
    return body;
}
function toOpenAIMessage(message) {
    switch (message.role) {
        case "system":
            return {
                role: "system",
                content: message.content
            };
        case "user":
            return {
                role: "user",
                content: message.content
            };
        case "assistant":
            return {
                role: "assistant",
                content: message.toolCalls && message.toolCalls.length > 0 && message.content.length === 0
                    ? null
                    : message.content,
                ...(message.toolCalls && message.toolCalls.length > 0
                    ? {
                        tool_calls: message.toolCalls.map((toolCall) => toOpenAIToolCall(toolCall))
                    }
                    : {})
            };
        case "tool":
            return {
                role: "tool",
                tool_call_id: message.toolCallId,
                content: message.content
            };
        default:
            return assertNever(message);
    }
}
function toOpenAITool(tool) {
    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    };
}
function toOpenAIToolCall(toolCall) {
    return {
        id: toolCall.id,
        type: "function",
        function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments)
        }
    };
}
function extractAssistantText(message) {
    const content = message?.content;
    if (typeof content === "string") {
        const normalized = content.trim();
        return normalized.length > 0 ? normalized : undefined;
    }
    if (!Array.isArray(content)) {
        return undefined;
    }
    const normalized = content
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
    if (normalized.length > 0) {
        return normalized;
    }
    return undefined;
}
function parseToolCalls(toolCalls) {
    if (!Array.isArray(toolCalls)) {
        return [];
    }
    return toolCalls
        .map((toolCall, index) => parseToolCall(toolCall, index))
        .filter((toolCall) => toolCall !== undefined);
}
function parseToolCall(toolCall, index) {
    if (toolCall.type !== "function") {
        return undefined;
    }
    const name = toolCall.function?.name?.trim();
    if (!name) {
        return undefined;
    }
    return {
        id: toolCall.id?.trim() || `tool_call_${index + 1}`,
        name,
        arguments: parseToolArguments(toolCall.function?.arguments)
    };
}
function parseToolArguments(value) {
    if (value === undefined || value.trim().length === 0) {
        return {};
    }
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
        throw new Error("OpenAI-compatible tool arguments must decode to an object.");
    }
    return parsed;
}
async function readResponseDetail(response) {
    const detail = (await response.text()).trim().replace(/\s+/g, " ");
    if (detail.length === 0) {
        return "";
    }
    return detail.slice(0, 200);
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function assertNever(value) {
    throw new Error(`Unsupported model message: ${JSON.stringify(value)}`);
}
