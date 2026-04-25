import { formatResponseModeLabel, readResponseModeFromMessages } from "../modes/response-mode.js";
import { createModelResponse } from "./model-client.js";
export class MockModelClient {
    _modelName;
    constructor(_modelName = "mock-local") {
        this._modelName = _modelName;
    }
    async generate(request) {
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
            return createModelResponse(applyResponseMode(memoryResponse, normalizedPrompt ?? "", responseMode));
        }
        return createModelResponse(applyResponseMode(`Mock response: ${normalizedPrompt ?? ""}`, normalizedPrompt ?? "", responseMode));
    }
}
function createMockToolCall(prompt) {
    if (prompt.length === 0) {
        return undefined;
    }
    const trimmedPrompt = prompt.trim();
    const readMatch = trimmedPrompt.match(/^(?:read|show)\s+(.+)$/i);
    if (readMatch) {
        return {
            id: "mock-read-file",
            name: "read_file",
            arguments: {
                path: readMatch[1].trim()
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
    const runMatch = trimmedPrompt.match(/^run\s+(.+)$/i);
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
function buildToolSummary(message, mode) {
    if (message.isError) {
        return applyResponseMode(`Tool ${message.toolName} failed.\n\n${message.content}`, message.content, mode);
    }
    return applyResponseMode(`Tool ${message.toolName} completed.\n\n${message.content}`, message.content, mode);
}
function extractMemoryFactsFromContext(messages) {
    const systemMessage = messages.find((message) => message.role === "system" &&
        message.content.startsWith("Persistent user memory:"));
    if (!systemMessage || systemMessage.role !== "system") {
        return [];
    }
    return systemMessage.content
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim())
        .filter((line) => line.length > 0);
}
function createMemoryResponse(prompt, memoryFacts) {
    if (memoryFacts.length === 0) {
        return undefined;
    }
    const normalizedPrompt = prompt.toLowerCase();
    const matchingFact = (/\b(name|who am i)\b/.test(normalizedPrompt)
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
function applyResponseMode(baseResponse, prompt, mode) {
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
