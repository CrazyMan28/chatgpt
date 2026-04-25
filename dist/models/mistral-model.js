import { createModelResponse } from "./model-client.js";
export class MistralModelClient {
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
            throw new Error(`Mistral request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
        }
        const data = (await response.json());
        if (process.env.CHATGPT_CODE_DEBUG === "1") {
            process.stderr.write(`Mistral raw response: ${JSON.stringify(data)}\n`);
        }
        const message = data.choices?.[0]?.message;
        const output = data.outputs?.[0];
        const text = extractText(message?.content) ??
            extractText(output?.content) ??
            normalizeText(output?.text);
        const toolCalls = dedupeToolCalls([
            ...parseToolCalls(message?.tool_calls, "mistral-choice-tool"),
            ...parseToolCalls(output?.tool_calls, "mistral-output-tool"),
            ...parseContentToolCalls(message?.content, "mistral-choice-content-tool"),
            ...parseContentToolCalls(output?.content, "mistral-output-content-tool")
        ]);
        if (text === undefined && toolCalls.length === 0) {
            throw new Error("Mistral response missing expected fields");
        }
        return createModelResponse(text ?? "", toolCalls);
    }
}
function buildChatCompletionsUrl(baseUrl) {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("chat/completions", normalizedBaseUrl).toString();
}
function buildRequestBody(config, request) {
    const body = {
        model: config.model,
        messages: request.messages.map((message) => toMistralMessage(message))
    };
    if (request.tools.length > 0) {
        body.tools = request.tools.map((tool) => toMistralTool(tool));
        body.tool_choice = "auto";
    }
    return body;
}
function toMistralMessage(message) {
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
                        tool_calls: message.toolCalls.map((toolCall) => toMistralToolCall(toolCall))
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
function toMistralTool(tool) {
    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    };
}
function toMistralToolCall(toolCall) {
    return {
        id: toolCall.id,
        type: "function",
        function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments)
        }
    };
}
function extractText(value) {
    if (typeof value === "string") {
        return normalizeText(value);
    }
    if (!Array.isArray(value)) {
        return undefined;
    }
    const text = value
        .map((part) => extractTextFromPart(part))
        .filter((part) => typeof part === "string")
        .join("");
    return normalizeText(text);
}
function extractTextFromPart(part) {
    if (part.type && !isTextLikePart(part.type)) {
        return undefined;
    }
    return normalizeText(part.text) ?? normalizeText(part.content);
}
function parseContentToolCalls(value, prefix) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((part, index) => {
        const nestedToolCalls = parseToolCalls(part.tool_calls, `${prefix}-${index + 1}-nested`);
        if (nestedToolCalls.length > 0) {
            return nestedToolCalls;
        }
        const toolCall = parseToolCall(part, `${prefix}-${index + 1}`);
        return toolCall ? [toolCall] : [];
    });
}
function parseToolCalls(toolCalls, prefix) {
    if (!Array.isArray(toolCalls)) {
        return [];
    }
    return toolCalls
        .map((toolCall, index) => parseToolCall(toolCall, `${prefix}-${index + 1}`))
        .filter((toolCall) => toolCall !== undefined);
}
function parseToolCall(value, fallbackId) {
    const name = normalizeText(value.function?.name) ?? normalizeText(value.name);
    if (!name) {
        return undefined;
    }
    return {
        id: normalizeText(value.id) ?? fallbackId,
        name,
        arguments: parseToolArguments(value.function?.arguments ?? value.arguments)
    };
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
function normalizeText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function isTextLikePart(type) {
    return type === "text" || type === "output_text";
}
function dedupeToolCalls(toolCalls) {
    const seen = new Set();
    const deduped = [];
    for (const toolCall of toolCalls) {
        const signature = `${toolCall.id}:${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
        if (seen.has(signature)) {
            continue;
        }
        seen.add(signature);
        deduped.push(toolCall);
    }
    return deduped;
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
    throw new Error(`Unhandled Mistral message: ${JSON.stringify(value)}`);
}
