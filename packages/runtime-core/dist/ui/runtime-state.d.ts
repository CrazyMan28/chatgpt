import type { FilesystemScope } from "../platform/types.js";
import type { ModelRuntimeSnapshot } from "../providers/provider-types.js";
export interface AppRuntimeState {
    cwd: string;
    isLoggedIn: boolean;
    loginLabel: string;
    model: string;
    projectLabel: string;
    provider: string;
    providerLabel: string;
    scope: FilesystemScope;
}
export declare const AppRuntimeStateProvider: import("react").Provider<AppRuntimeState | undefined>;
export declare function useAppRuntimeState(): AppRuntimeState;
export declare function toAppRuntimeState(snapshot: ModelRuntimeSnapshot, options?: {
    cwd?: string;
    projectLabel?: string;
    scope?: FilesystemScope;
}): AppRuntimeState;
//# sourceMappingURL=runtime-state.d.ts.map