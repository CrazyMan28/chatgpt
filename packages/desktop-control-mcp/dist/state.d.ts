import type { DesktopConfig, DesktopMode, DesktopStatus, VisionProviderName } from "./types.js";
export interface DesktopState {
    config: DesktopConfig;
    lastStatus?: Partial<DesktopStatus>;
}
export declare function defaultStatePath(): string;
export declare function loadDesktopState(path?: string): Promise<DesktopState>;
export declare function saveDesktopState(state: DesktopState, path?: string): Promise<void>;
export declare function createDefaultDesktopState(): DesktopState;
export declare function parseMode(value: unknown): DesktopMode | undefined;
export declare function parseVisionProvider(value: unknown): VisionProviderName | undefined;
//# sourceMappingURL=state.d.ts.map