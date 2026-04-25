import { createModelResponse } from "./model-client.js";
export class OllamaModelClient {
    config;
    fetchFn;
    constructor(config, fetchFn = globalThis.fetch) {
        this.config = config;
        this.fetchFn = fetchFn;
    }
    async generate(request) {
        const response = await this.fetchFn(buildChatUrl(this.config.baseUrl), {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(buildRequestBody(this.config, request)),
            signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) {
            const detail = await readResponseDetail(response);
            throw new Error(`Ollama request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
        }
        const data = (await response.json());
        const message = data.message;
        const content = message?.content?.trim() ?? "";
        const toolCalls = parseToolCalls(message?.tool_calls);
        if (content.length === 0 && toolCalls.length === 0) {
            throw new Error("Ollama response did not include assistant text or tool calls.");
        }
        return createModelResponse(content, toolCalls);
    }
}
function buildChatUrl(baseUrl) {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("api/chat", normalizedBaseUrl).toString();
}
function buildRequestBody(config, request) {
    const body = {
        messages: request.messages.map((message) => toOllamaMessage(message)),
        model: config.model,
        stream: false
    };
    if (request.tools.length > 0) {
        body.tools = request.tools.map((tool) => toOllamaTool(tool));
    }
    return body;
}
function toOllamaMessage(message) {
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
                content: message.content,
                ...(message.toolCalls && message.toolCalls.length > 0
                    ? {
                        tool_calls: message.toolCalls.map((toolCall) => ({
                            function: {
                                arguments: toolCall.arguments,
                                name: toolCall.name
                            }
                        }))
                    }
                    : {})
            };
        case "tool":
            return {
                role: "tool",
                content: message.content
            };
        default:
            return assertNever(message);
    }
}
function toOllamaTool(tool) {
    return {
        function: {
            description: tool.description,
            name: tool.name,
            parameters: tool.inputSchema
        },
        type: "function"
    };
}
function parseToolCalls(toolCalls) {
    if (!Array.isArray(toolCalls)) {
        return [];
    }
    return toolCalls
        .map((toolCall, index) => {
        const name = toolCall.function?.name?.trim();
        if (!name) {
            return undefined;
        }
        return {
            id: `ollama-tool-${index + 1}`,
            name,
            arguments: parseToolArguments(toolCall.function?.arguments)
        };
    })
        .filter((toolCall) => toolCall !== undefined);
}
function parseToolArguments(value) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return {};
        }
        const parsed = JSON.parse(trimmed);
        return isRecord(parsed) ? parsed : {};
    }
    return isRecord(value) ? value : {};
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
    throw new Error(`Unhandled Ollama message: ${JSON.stringify(value)}`);
}
