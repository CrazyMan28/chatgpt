import {
  formatResponseModeLabel,
  readResponseModeFromMessages,
  type ResponseMode
} from "../modes/response-mode.js";
import type {
  ModelClient,
  ModelMessage,
  ModelRequest,
  ModelResponse
} from "./model-client.js";
import { createModelResponse } from "./model-client.js";

export class MockModelClient implements ModelClient {
  constructor(private readonly _modelName = "mock-local") {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const lastMessage = request.messages[request.messages.length - 1];
    const responseMode = readResponseModeFromMessages(request.messages) ?? "normal";
    const memoryFacts = extractMemoryFactsFromContext(request.messages);
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === "user");
    const normalizedPrompt = lastUserMessage?.content
      .trim()
      .replace(/\s+/g, " ");

    if (lastMessage?.role === "tool") {
      return createModelResponse(buildToolSummary(lastMessage, responseMode));
    }

    const toolCall = createMockToolCall(normalizedPrompt ?? "");

    if (toolCall) {
      return createModelResponse("", [toolCall]);
    }

    const memoryResponse = createMemoryResponse(normalizedPrompt ?? "", memoryFacts);

    if (memoryResponse) {
      return createModelResponse(
        applyResponseMode(memoryResponse, normalizedPrompt ?? "", responseMode)
      );
    }

    return createModelResponse(
      applyResponseMode(
        `Mock response: ${normalizedPrompt ?? ""}`,
        normalizedPrompt ?? "",
        responseMode
      )
    );
  }
}

function createMockToolCall(prompt: string) {
  if (prompt.length === 0) {
    return undefined;
  }

  const taskPrompt = prompt.match(/Task:\s*(.+)$/im)?.[1]?.trim();
  const trimmedPrompt = (taskPrompt ?? prompt).trim();
  const listMatch = trimmedPrompt.match(
    /^(?:list|show|see|scan)\s+(?:all\s+)?files(?:\s+in\s+(.+))?$/i
  );

  if (listMatch) {
    const path = listMatch[1]?.trim();

    return {
      id: "mock-list-files",
      name: "list_files",
      arguments: path ? { path } : {}
    };
  }

  const readMatch = trimmedPrompt.match(/^(?:read|show|open|cat)\s+(.+)$/i);

  if (readMatch) {
    return {
      id: "mock-read-file",
      name: "read_file",
      arguments: {
        path: readMatch[1].trim()
      }
    };
  }

  const writeToFileMatch = trimmedPrompt.match(/^write\s+(.+?)\s+to\s+(\S+)$/i);

  if (writeToFileMatch) {
    return {
      id: "mock-write-file",
      name: "write_file",
      arguments: {
        content: writeToFileMatch[1].trim(),
        path: writeToFileMatch[2].trim()
      }
    };
  }

  const writeMatch = trimmedPrompt.match(/^write\s+(\S+)\s*:\s*(.+)$/i);

  if (writeMatch) {
    return {
      id: "mock-write-file",
      name: "write_file",
      arguments: {
        path: writeMatch[1].trim(),
        content: writeMatch[2]
      }
    };
  }

  const runMatch = trimmedPrompt.match(/^(?:run|do|execute)\s+(.+)$/i);

  if (runMatch) {
    const [command, ...args] = runMatch[1].trim().split(/\s+/);

    if (!command) {
      return undefined;
    }

    return {
      id: "mock-run-command",
      name: "run_command",
      arguments: {
        command,
        args
      }
    };
  }

  return undefined;
}

function buildToolSummary(
  message: Extract<ModelMessage, { role: "tool" }>,
  mode: ResponseMode
): string {
  if (message.isError) {
    return applyResponseMode(
      `Tool ${message.toolName} failed.\n\n${message.content}`,
      message.content,
      mode
    );
  }

  return applyResponseMode(
    `Tool ${message.toolName} completed.\n\n${message.content}`,
    message.content,
    mode
  );
}

function extractMemoryFactsFromContext(
  messages: readonly ModelMessage[]
): string[] {
  const systemMessage = messages.find(
    (message) =>
      message.role === "system" &&
      message.content.startsWith("Persistent user memory:")
  );

  if (!systemMessage || systemMessage.role !== "system") {
    return [];
  }

  return systemMessage.content
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}

function createMemoryResponse(
  prompt: string,
  memoryFacts: readonly string[]
): string | undefined {
  if (memoryFacts.length === 0) {
    return undefined;
  }

  const normalizedPrompt = prompt.toLowerCase();
  const matchingFact =
    (/\b(name|who am i)\b/.test(normalizedPrompt)
      ? memoryFacts.find((fact) => /\bname\b/i.test(fact))
      : undefined) ??
    (/\b(prefer|preferred|like|favorite|favourite)\b/.test(normalizedPrompt)
      ? memoryFacts.find((fact) => /\b(prefer|like|favorite|favourite)\b/i.test(fact))
      : undefined) ??
    (/\b(project|working on|building)\b/.test(normalizedPrompt)
      ? memoryFacts.find((fact) => /\b(project|building|working on)\b/i.test(fact))
      : undefined);

  if (!matchingFact) {
    return undefined;
  }

  return `From memory: ${matchingFact}`;
}

function applyResponseMode(
  baseResponse: string,
  prompt: string,
  mode: ResponseMode
): string {
  switch (mode) {
    case "normal":
      return baseResponse;
    case "plan":
      return [
        `${formatResponseModeLabel(mode)} mode response`,
        `1. Goal: address "${prompt || "the current request"}".`,
        `2. Response: ${baseResponse}`
      ].join("\n");
    case "ultra":
      return [
        `${formatResponseModeLabel(mode)} mode response`,
        `Prompt: ${prompt || "none"}`,
        `Detailed answer: ${baseResponse}`,
        "Additional detail: this mock mode increases verbosity and explanation depth only."
      ].join("\n");
    default:
      return baseResponse;
  }
}
