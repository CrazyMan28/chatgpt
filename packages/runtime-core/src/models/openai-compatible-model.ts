import type {
  ModelClient,
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelToolDefinition,
  ModelToolCall,
  OpenAIModelConfig
} from "./model-client.js";
import { createModelResponse } from "./model-client.js";
import { requestJson } from "./provider-request.js";

interface OpenAIChatCompletionsResponse {
  choices?: OpenAIChatChoice[];
}

interface OpenAIChatChoice {
  message?: OpenAIChatMessage | null;
}

interface OpenAIChatMessage {
  role?: string;
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIChatToolCall[] | null;
}

interface OpenAIContentPart {
  type?: string;
  text?: string;
}

interface OpenAIChatToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export class OpenAICompatibleModelClient implements ModelClient {
  constructor(
    private readonly config: OpenAIModelConfig,
    private readonly fetchFn: typeof fetch = globalThis.fetch
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const data = await requestJson<OpenAIChatCompletionsResponse>({
      body: buildRequestBody(this.config, request),
      fetchFn: this.fetchFn,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      provider: "OpenAI-compatible",
      url: buildChatCompletionsUrl(this.config.baseUrl)
    });
    const message = data.choices?.[0]?.message;
    const content = extractAssistantText(message);
    const toolCalls = parseToolCalls(message?.tool_calls);

    if (content === undefined && toolCalls.length === 0) {
      throw new Error(
        "OpenAI-compatible response did not include assistant text or tool calls."
      );
    }

    return createModelResponse(content ?? "", toolCalls);
  }
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL("chat/completions", normalizedBaseUrl).toString();
}

function buildRequestBody(
  config: OpenAIModelConfig,
  request: ModelRequest
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: request.messages.map((message) => toOpenAIMessage(message))
  };

  if (request.tools.length > 0) {
    body.tools = request.tools.map((tool) => toOpenAITool(tool));
    body.tool_choice = "auto";
  }

  return body;
}

function toOpenAIMessage(message: ModelMessage): Record<string, unknown> {
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
        content:
          message.toolCalls && message.toolCalls.length > 0 && message.content.length === 0
            ? null
            : message.content,
        ...(message.toolCalls && message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((toolCall) =>
                toOpenAIToolCall(toolCall)
              )
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

function toOpenAITool(tool: ModelToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  };
}

function toOpenAIToolCall(toolCall: ModelToolCall): Record<string, unknown> {
  return {
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments)
    }
  };
}

function extractAssistantText(
  message: OpenAIChatMessage | null | undefined
): string | undefined {
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

function parseToolCalls(
  toolCalls: OpenAIChatToolCall[] | null | undefined
): ModelToolCall[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls
    .map((toolCall, index) => parseToolCall(toolCall, index))
    .filter((toolCall): toolCall is ModelToolCall => toolCall !== undefined);
}

function parseToolCall(
  toolCall: OpenAIChatToolCall,
  index: number
): ModelToolCall | undefined {
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

function parseToolArguments(
  value: string | undefined
): Record<string, unknown> {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("OpenAI-compatible tool arguments must decode to an object.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported model message: ${JSON.stringify(value)}`);
}
