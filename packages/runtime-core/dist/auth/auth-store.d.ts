import type { ModelConfig, ModelProvider } from "../models/model-client.js";
import type { StoredProviderSettingsMap } from "../providers/provider-types.js";
export interface AuthConfigRecord {
    activeProvider: ModelProvider;
    providers: StoredProviderSettingsMap;
    version: number;
}
export interface AuthStore {
    load(fallback?: AuthConfigRecord): Promise<AuthConfigRecord>;
    save(config: AuthConfigRecord): Promise<AuthConfigRecord>;
}
export declare class JsonAuthStore implements AuthStore {
    private readonly filePath;
    constructor(workspaceRoot?: string);
    load(fallback?: AuthConfigRecord): Promise<AuthConfigRecord>;
    save(config: AuthConfigRecord): Promise<AuthConfigRecord>;
}
export declare function createAuthConfigFromModelConfig(modelConfig: ModelConfig): AuthConfigRecord;
export declare function createDefaultAuthConfig(env?: NodeJS.ProcessEnv): AuthConfigRecord;
//# sourceMappingURL=auth-store.d.ts.map