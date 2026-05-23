import type { ModelCapabilities } from "./model-client.js";
import type { ProviderModelDefinition } from "../providers/provider-types.js";
export declare const DEFAULT_COPILOT_MODEL = "claude-sonnet-4.5";
export declare const COPILOT_CAPABILITIES: ModelCapabilities;
export declare const STATIC_COPILOT_MODELS: readonly ProviderModelDefinition[];
export declare function createManualCopilotModel(model: string): ProviderModelDefinition;
//# sourceMappingURL=copilot-models.d.ts.map