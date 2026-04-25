import type {
  LocalModelConfig,
  ModelClient,
  ModelMessage,
  ModelResponse,
  ModelToolCall,
  ModelToolDefinition
} from "./model-client.js";
import { createModelResponse } from "./model-client.js";
import { requestJson } from "./provider-request.js";

interface OllamaChatResponse {
  message?: {
    content?: string;
    tool_calls?: OllamaToolCall[];
  } | null;
}

interface OllamaToolCall {
  function?: {
    arguments?: Record<string, unknown> | string;
    name?: string;
  };
}

export class OllamaModelClient implements ModelClient {
  constructor(
    private readonly config: LocalModelConfig & { transport: "ollama"; baseUrl: string },
    private readonly fetchFn: typeof fetch = globalThis.fetch
  ) {}

  async generate(request: Parameters<ModelClient["generate"]>[0]): Promise<ModelResponse> {
    const data = await requestJson<OllamaChatResponse>({
      body: buildRequestBody(this.config, request),
      fetchFn: this.fetchFn,
      headers: {
        "content-type": "application/json"
      },
      provider: "Ollama",
      url: buildChatUrl(this.config.baseUrl)
    });
    const message = data.message;
    const content = message?.content?.trim() ?? "";
    const toolCalls = parseToolCalls(message?.tool_calls);

    if (content.length === 0 && toolCalls.length === 0) {
      throw new Error("Ollama response did not include assistant text or tool calls.");
    }

    return createModelResponse(content, toolCalls);
  }
}

function buildChatUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL("api/chat", normalizedBaseUrl).toString();
}

function buildRequestBody(
  config: LocalModelConfig & { transport: "ollama"; baseUrl: string },
  request: Parameters<ModelClient["generate"]>[0]
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages: request.messages.map((message) => toOllamaMessage(message)),
    model: config.model,
    stream: false
  };

  if (request.tools.length > 0) {
    body.tools = request.tools.map((tool) => toOllamaTool(tool));
  }

  return body;
}

function toOllamaMessage(message: ModelMessage): Record<string, unknown> {
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

function toOllamaTool(tool: ModelToolDefinition): Record<string, unknown> {
  return {
    function: {
      description: tool.description,
      name: tool.name,
      parameters: tool.inputSchema
    },
    type: "function"
  };
}

function parseToolCalls(toolCalls: OllamaToolCall[] | undefined): ModelToolCall[] {
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
    .filter((toolCall): toolCall is ModelToolCall => toolCall !== undefined);
}

function parseToolArguments(
  value: Record<string, unknown> | string | undefined
): Record<string, unknown> {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return {};
    }

    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : {};
  }

  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Ollama message: ${JSON.stringify(value)}`);
}
