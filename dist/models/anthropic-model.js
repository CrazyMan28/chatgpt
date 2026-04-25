import { createModelResponse } from "./model-client.js";
export class AnthropicModelClient {
    config;
    fetchFn;
    constructor(config, fetchFn = globalThis.fetch) {
        this.config = config;
        this.fetchFn = fetchFn;
    }
    async generate(request) {
        const payload = buildRequestBody(this.config, request);
        const response = await this.fetchFn(buildMessagesUrl(this.config.baseUrl), {
            method: "POST",
            headers: {
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "x-api-key": this.config.apiKey
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) {
            const detail = await readResponseDetail(response);
            throw new Error(`Anthropic request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
        }
        const data = (await response.json());
        const contentBlocks = Array.isArray(data.content) ? data.content : [];
        const content = contentBlocks
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text ?? "")
            .join("")
            .trim();
        const toolCalls = contentBlocks
            .map((block, index) => parseToolCall(block, index))
            .filter((toolCall) => toolCall !== undefined);
        if (content.length === 0 && toolCalls.length === 0) {
            throw new Error("Anthropic response did not include assistant text or tool calls.");
        }
        return createModelResponse(content, toolCalls);
    }
}
function buildMessagesUrl(baseUrl) {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("messages", normalizedBaseUrl).toString();
}
function buildRequestBody(config, request) {
    const { messages, system } = toAnthropicMessages(request.messages);
    const body = {
        max_tokens: 2_048,
        messages,
        model: config.model
    };
    if (system.length > 0) {
        body.system = system;
    }
    if (request.tools.length > 0) {
        body.tools = request.tools.map((tool) => toAnthropicTool(tool));
    }
    return body;
}
function toAnthropicMessages(messages) {
    const systemBlocks = [];
    const anthropicMessages = [];
    const pushMessage = (message) => {
        const previous = anthropicMessages[anthropicMessages.length - 1];
        if (previous && previous.role === message.role) {
            previous.content.push(...message.content);
            return;
        }
        anthropicMessages.push(message);
    };
    for (const message of messages) {
        switch (message.role) {
            case "system":
                if (message.content.trim().length > 0) {
                    systemBlocks.push(message.content.trim());
                }
                break;
            case "user":
                pushMessage({
                    role: "user",
                    content: [{ text: message.content, type: "text" }]
                });
                break;
            case "assistant": {
                const content = [];
                if (message.content.trim().length > 0) {
                    content.push({
                        text: message.content,
                        type: "text"
                    });
                }
                for (const toolCall of message.toolCalls ?? []) {
                    content.push({
                        id: toolCall.id,
                        input: toolCall.arguments,
                        name: toolCall.name,
                        type: "tool_use"
                    });
                }
                pushMessage({
                    role: "assistant",
                    content
                });
                break;
            }
            case "tool":
                pushMessage({
                    role: "user",
                    content: [
                        {
                            content: message.content,
                            is_error: message.isError,
                            tool_use_id: message.toolCallId,
                            type: "tool_result"
                        }
                    ]
                });
                break;
            default:
                assertNever(message);
        }
    }
    return {
        messages: anthropicMessages,
        system: systemBlocks.join("\n\n")
    };
}
function toAnthropicTool(tool) {
    return {
        description: tool.description,
        input_schema: tool.inputSchema,
        name: tool.name
    };
}
function parseToolCall(block, index) {
    if (block.type !== "tool_use") {
        return undefined;
    }
    const name = block.name?.trim();
    if (!name) {
        return undefined;
    }
    return {
        id: block.id?.trim() || `anthropic-tool-${index + 1}`,
        name,
        arguments: isRecord(block.input) ? block.input : {}
    };
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
    throw new Error(`Unhandled Anthropic message: ${JSON.stringify(value)}`);
}
