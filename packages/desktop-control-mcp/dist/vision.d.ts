import type { DesktopConfig, DesktopVisionAuth, ScreenshotResult, VisionObservation, VisionStatus } from "./types.js";
export interface VisionProvider {
    compareScreens(before: ScreenshotResult | string, after: ScreenshotResult | string, prompt?: string): Promise<VisionObservation>;
    describeScreen(image: ScreenshotResult | string, prompt?: string, context?: Record<string, unknown>): Promise<VisionObservation>;
    extractText(image: ScreenshotResult | string, prompt?: string): Promise<VisionObservation>;
    locateElement(image: ScreenshotResult | string, target: string, context?: Record<string, unknown>): Promise<VisionObservation>;
    status(): VisionStatus;
}
export declare function createVisionProvider(config: DesktopConfig, auth?: DesktopVisionAuth): VisionProvider;
//# sourceMappingURL=vision.d.ts.map