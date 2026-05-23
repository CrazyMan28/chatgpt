import type { CopilotModelConfig } from "./model-client.js";
import { CopilotCliModelClient } from "./copilot-client.js";
import {
  assertCopilotLoginAvailable,
  getCopilotProviderStatus,
  resolveCopilotAuthMode
} from "./copilot-auth.js";
import {
  COPILOT_CAPABILITIES,
  DEFAULT_COPILOT_MODEL,
  STATIC_COPILOT_MODELS,
  createManualCopilotModel
} from "./copilot-models.js";
import type { ModelClient } from "./model-client.js";
import type {
  ProviderModelDefinition,
  ProviderRuntimeStatus,
  StoredProviderSettings
} from "../providers/provider-types.js";

export function createCopilotConfig(
  settings?: StoredProviderSettings
): CopilotModelConfig {
  return {
    provider: "copilot",
    model: normalizeOptionalValue(settings?.model) ?? DEFAULT_COPILOT_MODEL,
    authMode: resolveCopilotAuthMode(settings)
  };
}

export function createCopilotClient(config: CopilotModelConfig): ModelClient {
  return new CopilotCliModelClient(config);
}

export async function listCopilotModels(
  settings?: StoredProviderSettings
): Promise<readonly ProviderModelDefinition[]> {
  const selectedModel = normalizeOptionalValue(settings?.model);
  const knownModels = [...STATIC_COPILOT_MODELS];

  if (
    selectedModel &&
    !knownModels.some(
      (model) => model.id.toLowerCase() === selectedModel.toLowerCase()
    )
  ) {
    knownModels.unshift(createManualCopilotModel(selectedModel));
  }

  return knownModels;
}

export function getCopilotCapabilities() {
  return COPILOT_CAPABILITIES;
}

export async function getCopilotStatus(
  settings?: StoredProviderSettings
): Promise<ProviderRuntimeStatus> {
  return getCopilotProviderStatus(settings);
}

export async function assertCopilotProviderUsable(
  settings?: StoredProviderSettings
): Promise<void> {
  await assertCopilotLoginAvailable(settings);
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : undefined;
}
