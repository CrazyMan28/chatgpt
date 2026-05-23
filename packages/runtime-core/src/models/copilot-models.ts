import type { ModelCapabilities } from "./model-client.js";
import type { ProviderModelDefinition } from "../providers/provider-types.js";

export const DEFAULT_COPILOT_MODEL = "claude-sonnet-4.5";

export const COPILOT_CAPABILITIES: ModelCapabilities = {
  providerKind: "copilot",
  supportsModelList: false,
  supportsStreaming: false,
  supportsSystemPrompt: true,
  supportsTools: false,
  supportsVision: "unknown"
};

const STATIC_COPILOT_NOTE =
  "Static/manual entry. Availability depends on your GitHub Copilot plan and organization policy.";

export const STATIC_COPILOT_MODELS: readonly ProviderModelDefinition[] = [
  {
    id: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    capabilities: COPILOT_CAPABILITIES,
    note: STATIC_COPILOT_NOTE,
    source: "static"
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    capabilities: COPILOT_CAPABILITIES,
    note: STATIC_COPILOT_NOTE,
    source: "static"
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    capabilities: COPILOT_CAPABILITIES,
    note: STATIC_COPILOT_NOTE,
    source: "static"
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    capabilities: COPILOT_CAPABILITIES,
    note: STATIC_COPILOT_NOTE,
    source: "static"
  }
];

export function createManualCopilotModel(model: string): ProviderModelDefinition {
  return {
    id: model,
    label: model,
    capabilities: COPILOT_CAPABILITIES,
    note: "Manual model name. The Copilot CLI will report whether your account can use it.",
    source: "manual"
  };
}
