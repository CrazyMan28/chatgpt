import { CopilotCliModelClient } from "./copilot-client.js";
import { assertCopilotLoginAvailable, getCopilotProviderStatus, resolveCopilotAuthMode } from "./copilot-auth.js";
import { COPILOT_CAPABILITIES, DEFAULT_COPILOT_MODEL, STATIC_COPILOT_MODELS, createManualCopilotModel } from "./copilot-models.js";
export function createCopilotConfig(settings) {
    return {
        provider: "copilot",
        model: normalizeOptionalValue(settings?.model) ?? DEFAULT_COPILOT_MODEL,
        authMode: resolveCopilotAuthMode(settings)
    };
}
export function createCopilotClient(config) {
    return new CopilotCliModelClient(config);
}
export async function listCopilotModels(settings) {
    const selectedModel = normalizeOptionalValue(settings?.model);
    const knownModels = [...STATIC_COPILOT_MODELS];
    if (selectedModel &&
        !knownModels.some((model) => model.id.toLowerCase() === selectedModel.toLowerCase())) {
        knownModels.unshift(createManualCopilotModel(selectedModel));
    }
    return knownModels;
}
export function getCopilotCapabilities() {
    return COPILOT_CAPABILITIES;
}
export async function getCopilotStatus(settings) {
    return getCopilotProviderStatus(settings);
}
export async function assertCopilotProviderUsable(settings) {
    await assertCopilotLoginAvailable(settings);
}
function normalizeOptionalValue(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}
//# sourceMappingURL=copilot-provider.js.map