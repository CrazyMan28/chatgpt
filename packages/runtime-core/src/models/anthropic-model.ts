import type {
  AnthropicModelConfig,
  ModelClient,
  ModelMessage,
  ModelResponse,
  ModelToolDefinition,
  ModelToolCall
} from "./model-client.js";
import { createModelResponse } from "./model-client.js";
import { requestJson } from "./provider-request.js";

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[] | null;
}

interface AnthropicInputJsonSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicMessagePayload {
  content: AnthropicRequestContentBlock[];
  role: "assistant" | "user";
}

type AnthropicRequestContentBlock =
  | {
      text: string;
      type: "text";
    }
  | {
      id: string;
      input: Record<string, unknown>;
      name: string;
      type: "tool_use";
    }
  | {
      content: string;
      is_error?: boolean;
      tool_use_id: string;
      type: "tool_result";
    };

export class AnthropicModelClient implements ModelClient {
  constructor(
    private readonly config: AnthropicModelConfig,
    private readonly fetchFn: typeof fetch = globalThis.fetch
  ) {}

  async generate(request: Parameters<ModelClient["generate"]>[0]): Promise<ModelResponse> {
    const payload = buildRequestBody(this.config, request);
    const data = await requestJson<AnthropicMessagesResponse>({
      body: payload,
      fetchFn: this.fetchFn,
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": this.config.apiKey
      },
      provider: "Anthropic",
      url: buildMessagesUrl(this.config.baseUrl)
    });
    const contentBlocks = Array.isArray(data.content) ? data.content : [];
    const content = contentBlocks
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
    const toolCalls = contentBlocks
      .map((block, index) => parseToolCall(block, index))
      .filter((toolCall): toolCall is ModelToolCall => toolCall !== undefined);

    if (content.length === 0 && toolCalls.length === 0) {
      throw new Error(
        "Anthropic response did not include assistant text or tool calls."
      );
    }

    return createModelResponse(content, toolCalls);
  }
}

function buildMessagesUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL("messages", normalizedBaseUrl).toString();
}

function buildRequestBody(
  config: AnthropicModelConfig,
  request: Parameters<ModelClient["generate"]>[0]
): Record<string, unknown> {
  const { messages, system } = toAnthropicMessages(request.messages);
  const body: Record<string, unknown> = {
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

function toAnthropicMessages(
  messages: readonly ModelMessage[]
): {
  messages: AnthropicMessagePayload[];
  system: string;
} {
  const systemBlocks: string[] = [];
  const anthropicMessages: AnthropicMessagePayload[] = [];

  const pushMessage = (message: AnthropicMessagePayload): void => {
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
        const content: AnthropicRequestContentBlock[] = [];

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

function toAnthropicTool(tool: ModelToolDefinition): Record<string, unknown> {
  return {
    description: tool.description,
    input_schema: tool.inputSchema as AnthropicInputJsonSchema,
    name: tool.name
  };
}

function parseToolCall(
  block: AnthropicContentBlock,
  index: number
): ModelToolCall | undefined {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Anthropic message: ${JSON.stringify(value)}`);
}
