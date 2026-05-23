import type { AccessibilityResult, DesktopAction, DesktopActionResult, DesktopConfig, DesktopControllerOptions, DesktopElement, DesktopMode, DesktopObservation, DesktopStatus, DesktopWatcherRecord, ScreenshotResult, VisionObservation, VisionProviderName, WindowInfo } from "./types.js";
export declare class DesktopController {
    private readonly options;
    private readonly driver;
    private readonly now;
    private readonly statePath?;
    private lastAction?;
    private lastObservation?;
    private pendingApproval?;
    private readonly watcherHashes;
    private readonly watcherTimers;
    private readonly watchers;
    constructor(options?: DesktopControllerOptions);
    getConfig(): Promise<DesktopConfig>;
    setMode(mode: DesktopMode): Promise<DesktopConfig>;
    allowApp(app: string): Promise<DesktopConfig>;
    blockApp(app: string): Promise<DesktopConfig>;
    listAllowed(): Promise<Pick<DesktopConfig, "allowedApps" | "blockedApps">>;
    setVisionProvider(provider: VisionProviderName): Promise<DesktopConfig>;
    setVisionModel(model: string): Promise<DesktopConfig>;
    visionStatus(): Promise<DesktopStatus["vision"]>;
    status(): Promise<DesktopStatus>;
    screenshot(): Promise<ScreenshotResult>;
    describeScreen(input?: {
        context?: Record<string, unknown>;
        prompt?: string;
    }): Promise<VisionObservation>;
    locateOnScreen(input: {
        context?: Record<string, unknown>;
        target: string;
    }): Promise<VisionObservation>;
    compareScreens(input: {
        afterPath: string;
        beforePath: string;
        prompt?: string;
    }): Promise<VisionObservation>;
    observe(input?: {
        accessibility?: boolean;
        maxDepth?: number;
        screenshot?: boolean;
    }): Promise<DesktopObservation>;
    listWindows(): Promise<WindowInfo[]>;
    activeWindow(): Promise<WindowInfo | undefined>;
    focusWindow(windowId: string): Promise<DesktopActionResult>;
    closeWindow(windowId: string): Promise<DesktopActionResult>;
    listApps(): Promise<string[]>;
    openApp(app: string): Promise<DesktopActionResult>;
    closeApp(app: string): Promise<DesktopActionResult>;
    mouseMove(x: number, y: number): Promise<DesktopActionResult>;
    clipboardRead(): Promise<DesktopActionResult>;
    clipboardWrite(text: string): Promise<DesktopActionResult>;
    accessibilityTree(input?: {
        maxDepth?: number;
    }): Promise<AccessibilityResult>;
    accessibilityFocused(): Promise<AccessibilityResult>;
    accessibilityFind(input: {
        app?: string;
        focused?: boolean;
        name?: string;
        role?: string;
        text?: string;
        window?: string;
    }): Promise<{
        matches: DesktopElement[];
        tree: AccessibilityResult;
    }>;
    accessibilityClick(elementId: string): Promise<DesktopActionResult>;
    accessibilityFocus(elementId: string): Promise<DesktopActionResult>;
    accessibilityType(elementId: string, text: string): Promise<DesktopActionResult>;
    act(action: DesktopAction): Promise<DesktopActionResult>;
    runTask(task: string): Promise<{
        actions: DesktopActionResult[];
        done: boolean;
        observation?: DesktopObservation;
        watcher: DesktopWatcherRecord;
    }>;
    startWatch(input?: {
        intervalMs?: number;
        taskId?: string;
        taskSummary?: string;
    }): Promise<DesktopWatcherRecord>;
    stop(): Promise<DesktopWatcherRecord[]>;
    browserOpen(url: string): Promise<DesktopActionResult>;
    browserScreenshot(): Promise<ScreenshotResult>;
    mouseDoubleClick(x: number, y: number): Promise<DesktopActionResult>;
    browserUnavailable(tool: string): Promise<{
        ok: false;
        reason: string;
    }>;
    private authorizedPrimitive;
    private executeAction;
    private authorizeAction;
    private checkAppPolicy;
    private tickWatcher;
    private finishWatch;
    private loadState;
    private saveState;
}
export declare function createDesktopController(options?: DesktopControllerOptions): DesktopController;
export declare function parseAction(input: unknown): DesktopAction;
export declare function readDesktopMode(value: unknown): DesktopMode;
export declare function readVisionProvider(value: unknown): VisionProviderName;
export declare function formatDesktopStatus(status: DesktopStatus): string;
export declare function summarizeObservation(observation: DesktopObservation): string;
export declare function summarizeAccessibilityTree(tree: AccessibilityResult, full?: boolean): string;
export declare function formatActionResult(result: DesktopActionResult): string;
export declare function readToolBoolean(input: Record<string, unknown>, key: string, fallback: boolean): boolean;
export declare function readToolNumber(input: Record<string, unknown>, key: string, fallback: number): number;
//# sourceMappingURL=controller.d.ts.map