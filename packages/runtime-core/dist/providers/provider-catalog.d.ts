import type { ModelClient, ModelConfig, ModelProvider } from "../models/model-client.js";
import type { ProviderModelDefinition, ProviderSummary, StoredProviderSettings } from "./provider-types.js";
export interface ProviderDefinition {
    createClient(config: ModelConfig): ModelClient;
    createConfig(settings?: StoredProviderSettings): ModelConfig;
    defaultModel: string;
    label: string;
    listModels(settings?: StoredProviderSettings): Promise<readonly ProviderModelDefinition[]>;
    name: ModelProvider;
    requiresApiKey: boolean;
}
export declare function getProviderDefinition(provider: ModelProvider): ProviderDefinition;
export declare function listProviderDefinitions(): readonly ProviderSummary[];
//# sourceMappingURL=provider-catalog.d.ts.map