import type { ModelMessage } from "../models/model-client.js";

export type ResponseMode = "normal" | "plan" | "ultra";

const MODE_CONTEXT_PREFIX = "Response mode:";

export function buildResponseModeContextMessage(
  mode: ResponseMode
): Extract<ModelMessage, { role: "system" }> {
  return {
    role: "system",
    content: [MODE_CONTEXT_PREFIX, describeMode(mode)].join(" ")
  };
}

export function describeMode(mode: ResponseMode): string {
  switch (mode) {
    case "normal":
      return "normal. Respond directly and concisely. Keep structure light unless it adds clarity.";
    case "plan":
      return "plan. Respond with clearer structure, explicit steps, and more deliberate planning language. Change style only, not tool behavior.";
    case "ultra":
      return "ultra. Respond with substantially more detail, stronger explicit reasoning, and fuller tradeoff discussion. Change style only, not tool behavior.";
    default:
      return assertNever(mode);
  }
}

export function formatResponseModeLabel(mode: ResponseMode): string {
  switch (mode) {
    case "normal":
      return "Normal";
    case "plan":
      return "Plan";
    case "ultra":
      return "Ultra";
    default:
      return assertNever(mode);
  }
}

export function isResponseMode(value: string): value is ResponseMode {
  return value === "normal" || value === "plan" || value === "ultra";
}

export function readResponseModeFromMessages(
  messages: readonly ModelMessage[]
): ResponseMode | undefined {
  const modeMessage = messages.find(
    (message) =>
      message.role === "system" &&
      message.content.startsWith(MODE_CONTEXT_PREFIX)
  );

  if (!modeMessage || modeMessage.role !== "system") {
    return undefined;
  }

  const match = modeMessage.content.match(
    /^Response mode:\s+(normal|plan|ultra)\b/i
  );

  if (!match) {
    return undefined;
  }

  const value = match[1].toLowerCase();

  return isResponseMode(value) ? value : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled response mode: ${JSON.stringify(value)}`);
}
