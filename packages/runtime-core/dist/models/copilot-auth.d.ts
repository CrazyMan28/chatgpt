import type { CopilotAuthMode } from "./model-client.js";
import type { ProviderConnectionStatus, ProviderRuntimeStatus, StoredProviderSettings } from "../providers/provider-types.js";
export interface CopilotAuthAvailability {
    authMode: CopilotAuthMode;
    cliAvailable: boolean;
    cliVersion?: string;
    envTokenAvailable: boolean;
    message: string;
    status: ProviderConnectionStatus;
}
export declare function getCopilotProviderStatus(settings: StoredProviderSettings | undefined): Promise<ProviderRuntimeStatus>;
export declare function assertCopilotLoginAvailable(settings: StoredProviderSettings | undefined): Promise<void>;
export declare function detectCopilotAuthAvailability(settings: StoredProviderSettings | undefined, env?: NodeJS.ProcessEnv): Promise<CopilotAuthAvailability>;
export declare function resolveCopilotAuthMode(settings: StoredProviderSettings | undefined, env?: NodeJS.ProcessEnv): CopilotAuthMode;
export declare function hasCopilotEnvironmentToken(env?: NodeJS.ProcessEnv): boolean;
export declare function getCopilotLimitations(): readonly string[];
//# sourceMappingURL=copilot-auth.d.ts.map