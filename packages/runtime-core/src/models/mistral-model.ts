import type {
  MistralModelConfig,
  ModelClient,
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelToolCall,
  ModelToolDefinition
} from "./model-client.js";
import { createModelResponse } from "./model-client.js";
import { requestJson } from "./provider-request.js";

interface MistralChatCompletionsResponse {
  choices?: MistralChoice[] | null;
  outputs?: MistralOutput[] | null;
}

interface MistralChoice {
  message?: MistralMessage | null;
}

interface MistralMessage {
  content?: string | MistralContentPart[] | null;
  tool_calls?: MistralToolCall[] | null;
}

interface MistralOutput {
  text?: string | null;
  content?: string | MistralContentPart[] | null;
  tool_calls?: MistralToolCall[] | null;
}

interface MistralContentPart {
  type?: string;
  text?: string;
  content?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  tool_calls?: MistralToolCall[] | null;
  function?: {
    name?: string;
    arguments?: unknown;
  };
}

interface MistralToolCall {
  id?: string;
  type?: string;
  name?: string;
  arguments?: unknown;
  function?: {
    name?: string;
    arguments?: unknown;
  };
}

export class MistralModelClient implements ModelClient {
  constructor(
    private readonly config: MistralModelConfig,
    private readonly fetchFn: typeof fetch = globalThis.fetch
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const data = await requestJson<MistralChatCompletionsResponse>({
      body: buildRequestBody(this.config, request),
      fetchFn: this.fetchFn,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      provider: "Mistral",
      url: buildChatCompletionsUrl(this.config.baseUrl)
    });
    if (process.env.CHATGPT_CODE_DEBUG === "1") {
      process.stderr.write(`Mistral raw response: ${JSON.stringify(data)}\n`);
    }

    const message = data.choices?.[0]?.message;
    const output = data.outputs?.[0];
    const text =
      extractText(message?.content) ??
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

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL("chat/completions", normalizedBaseUrl).toString();
}

function buildRequestBody(
  config: MistralModelConfig,
  request: ModelRequest
): Record<string, unknown> {
  validateRawMistralMessageOrder(request.messages);
  const normalizedMessages = normalizeMistralMessages(request.messages);
  validateMistralMessageOrder(normalizedMessages);
  emitMistralDebugLog(
    `outbound roles: ${normalizedMessages.map((message) => message.role).join(" -> ")}`
  );

  const body: Record<string, unknown> = {
    model: config.model,
    messages: normalizedMessages.map((message) => toMistralMessage(message))
  };

  if (request.tools.length > 0) {
    body.tools = request.tools.map((tool) => toMistralTool(tool));
    body.tool_choice = "auto";
  }

  emitMistralDebugLog(`normalized payload: ${JSON.stringify(body)}`);

  return body;
}

function validateRawMistralMessageOrder(
  messages: readonly ModelMessage[]
): void {
  let sawNonSystem = false;
  let pendingToolCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === "system") {
      if (sawNonSystem) {
        throwInvalidMistralSequence(
          messages,
          "system message appeared after non-system content"
        );
      }

      continue;
    }

    sawNonSystem = true;

    switch (message.role) {
      case "user":
        pendingToolCallIds = new Set<string>();
        break;
      case "assistant":
        pendingToolCallIds = new Set(
          (message.toolCalls ?? []).map((toolCall) => toolCall.id)
        );
        break;
      case "tool":
        if (!pendingToolCallIds.has(message.toolCallId)) {
          throwInvalidMistralSequence(
            messages,
            `tool message ${message.toolCallId} did not follow a matching assistant tool call`
          );
        }

        pendingToolCallIds.delete(message.toolCallId);
        break;
      default:
        assertNever(message);
    }
  }
}

function normalizeMistralMessages(
  messages: readonly ModelMessage[]
): ModelMessage[] {
  const systemContents = messages
    .filter((message): message is Extract<ModelMessage, { role: "system" }> => {
      return message.role === "system" && message.content.trim().length > 0;
    })
    .map((message) => message.content.trim());
  const normalized: ModelMessage[] = [];
  let pendingToolCallIds = new Set<string>();

  if (systemContents.length > 0) {
    normalized.push({
      role: "system",
      content: systemContents.join("\n\n")
    });
  }

  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }

    switch (message.role) {
      case "user":
        normalized.push({ ...message });
        pendingToolCallIds = new Set<string>();
        break;
      case "assistant":
        normalized.push({
          ...message,
          ...(message.toolCalls
            ? {
                toolCalls: message.toolCalls.map((toolCall) => ({ ...toolCall }))
              }
            : {})
        });
        pendingToolCallIds = new Set(
          (message.toolCalls ?? []).map((toolCall) => toolCall.id)
        );
        break;
      case "tool":
        if (!pendingToolCallIds.has(message.toolCallId)) {
          emitMistralDebugLog(
            `dropping orphan tool message ${message.toolCallId} (${message.toolName})`
          );
          break;
        }

        normalized.push({ ...message });
        pendingToolCallIds.delete(message.toolCallId);
        break;
      default:
        assertNever(message);
    }
  }

  return normalized;
}

function validateMistralMessageOrder(messages: readonly ModelMessage[]): void {
  let sawNonSystem = false;
  let pendingToolCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === "system") {
      if (sawNonSystem) {
        throwInvalidMistralSequence(messages, "system message appeared after non-system content");
      }

      continue;
    }

    sawNonSystem = true;

    switch (message.role) {
      case "user":
        pendingToolCallIds = new Set<string>();
        break;
      case "assistant":
        pendingToolCallIds = new Set(
          (message.toolCalls ?? []).map((toolCall) => toolCall.id)
        );
        break;
      case "tool":
        if (!pendingToolCallIds.has(message.toolCallId)) {
          throwInvalidMistralSequence(
            messages,
            `tool message ${message.toolCallId} did not follow a matching assistant tool call`
          );
        }

        pendingToolCallIds.delete(message.toolCallId);
        break;
      default:
        assertNever(message);
    }
  }
}

function throwInvalidMistralSequence(
  messages: readonly ModelMessage[],
  reason: string
): never {
  const sequence = messages.map((message) => message.role).join(" -> ");
  emitMistralDebugLog(`invalid sequence: ${sequence} (${reason})`);
  throw new Error(
    `Invalid Mistral message order: ${reason}. Sequence: ${sequence}.`
  );
}

function toMistralMessage(message: ModelMessage): Record<string, unknown> {
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
                toMistralToolCall(toolCall)
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

function toMistralTool(tool: ModelToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  };
}

function toMistralToolCall(toolCall: ModelToolCall): Record<string, unknown> {
  return {
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments)
    }
  };
}

function extractText(
  value: string | MistralContentPart[] | null | undefined
): string | undefined {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value
    .map((part) => extractTextFromPart(part))
    .filter((part): part is string => typeof part === "string")
    .join("");

  return normalizeText(text);
}

function extractTextFromPart(part: MistralContentPart): string | undefined {
  if (part.type && !isTextLikePart(part.type)) {
    return undefined;
  }

  return normalizeText(part.text) ?? normalizeText(part.content);
}

function parseContentToolCalls(
  value: string | MistralContentPart[] | null | undefined,
  prefix: string
): ModelToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((part, index) => {
    const nestedToolCalls = parseToolCalls(
      part.tool_calls,
      `${prefix}-${index + 1}-nested`
    );

    if (nestedToolCalls.length > 0) {
      return nestedToolCalls;
    }

    const toolCall = parseToolCall(part, `${prefix}-${index + 1}`);
    return toolCall ? [toolCall] : [];
  });
}

function parseToolCalls(
  toolCalls: MistralToolCall[] | null | undefined,
  prefix: string
): ModelToolCall[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls
    .map((toolCall, index) => parseToolCall(toolCall, `${prefix}-${index + 1}`))
    .filter((toolCall): toolCall is ModelToolCall => toolCall !== undefined);
}

function parseToolCall(
  value: MistralToolCall | MistralContentPart,
  fallbackId: string
): ModelToolCall | undefined {
  const name =
    normalizeText(value.function?.name) ?? normalizeText(value.name);

  if (!name) {
    return undefined;
  }

  return {
    id: normalizeText(value.id) ?? fallbackId,
    name,
    arguments: parseToolArguments(value.function?.arguments ?? value.arguments)
  };
}

function parseToolArguments(value: unknown): Record<string, unknown> {
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

function normalizeText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isTextLikePart(type: string): boolean {
  return type === "text" || type === "output_text";
}

function dedupeToolCalls(toolCalls: readonly ModelToolCall[]): ModelToolCall[] {
  const seen = new Set<string>();
  const deduped: ModelToolCall[] = [];

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

async function readResponseDetail(response: Response): Promise<string> {
  const detail = (await response.text()).trim().replace(/\s+/g, " ");

  if (detail.length === 0) {
    return "";
  }

  return detail.slice(0, 200);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Mistral message: ${JSON.stringify(value)}`);
}

function emitMistralDebugLog(message: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[mistral] ${message}\n`);
}
