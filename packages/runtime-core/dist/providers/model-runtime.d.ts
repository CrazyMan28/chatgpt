import type { AuthStore } from "../auth/auth-store.js";
import type { ModelClient, ModelConfig, ModelProvider } from "../models/model-client.js";
import type { ModelRuntimeSnapshot, ProviderModelDefinition, ProviderSummary } from "./provider-types.js";
export interface LoginInput {
    apiKey?: string;
    provider: ModelProvider;
}
export interface ModelRuntimeManager {
    getClient(): ModelClient;
    getConfig(): ModelConfig;
    getSnapshot(): ModelRuntimeSnapshot;
    listModels(): Promise<readonly ProviderModelDefinition[]>;
    listProviders(): readonly ProviderSummary[];
    login(input: LoginInput): Promise<ModelRuntimeSnapshot>;
    setModel(model: string): Promise<ModelRuntimeSnapshot>;
    subscribe(listener: (snapshot: ModelRuntimeSnapshot) => void): () => void;
}
export interface CreateModelRuntimeManagerOptions {
    authStore: AuthStore;
    bootstrapModelConfig?: ModelConfig;
}
export declare function createModelRuntimeManager({ authStore, bootstrapModelConfig }: CreateModelRuntimeManagerOptions): Promise<ModelRuntimeManager>;
//# sourceMappingURL=model-runtime.d.ts.map