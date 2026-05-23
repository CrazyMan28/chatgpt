import type { CopilotModelConfig } from "./model-client.js";
import type { ModelClient } from "./model-client.js";
import type { ProviderModelDefinition, ProviderRuntimeStatus, StoredProviderSettings } from "../providers/provider-types.js";
export declare function createCopilotConfig(settings?: StoredProviderSettings): CopilotModelConfig;
export declare function createCopilotClient(config: CopilotModelConfig): ModelClient;
export declare function listCopilotModels(settings?: StoredProviderSettings): Promise<readonly ProviderModelDefinition[]>;
export declare function getCopilotCapabilities(): import("./model-client.js").ModelCapabilities;
export declare function getCopilotStatus(settings?: StoredProviderSettings): Promise<ProviderRuntimeStatus>;
export declare function assertCopilotProviderUsable(settings?: StoredProviderSettings): Promise<void>;
//# sourceMappingURL=copilot-provider.d.ts.map