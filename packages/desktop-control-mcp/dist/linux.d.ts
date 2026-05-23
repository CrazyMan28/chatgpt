import type { AccessibilityResult, Bounds, DesktopEnvironment, ScreenshotResult, WindowInfo } from "./types.js";
export declare class LinuxDesktopDriver {
    getEnvironment(): Promise<DesktopEnvironment>;
    screenshot(): Promise<ScreenshotResult>;
    listWindows(): Promise<WindowInfo[]>;
    private listWindowsFromAccessibility;
    activeWindow(): Promise<WindowInfo | undefined>;
    focusWindow(windowId: string): Promise<void>;
    closeWindow(windowId: string): Promise<void>;
    listApps(): Promise<string[]>;
    openApp(app: string): Promise<{
        command: string;
        app: string;
    }>;
    openUrl(url: string): Promise<{
        command: string;
        url: string;
    }>;
    closeApp(app: string): Promise<void>;
    accessibilityTree(input?: {
        maxChildren?: number;
        maxDepth?: number;
    }): Promise<AccessibilityResult>;
    accessibilityFocused(): Promise<AccessibilityResult>;
    accessibilityClick(elementId: string): Promise<{
        bounds?: Bounds;
        message?: string;
        ok: boolean;
    }>;
    accessibilityFocus(elementId: string): Promise<{
        bounds?: Bounds;
        message?: string;
        ok: boolean;
    }>;
    mouseMove(x: number, y: number): Promise<void>;
    mouseClick(x: number, y: number, button?: number): Promise<void>;
    mouseDoubleClick(x: number, y: number): Promise<void>;
    mouseDrag(x1: number, y1: number, x2: number, y2: number): Promise<void>;
    mouseScroll(clicks: number): Promise<void>;
    keyboardType(text: string): Promise<void>;
    keyboardPress(key: string): Promise<void>;
    keyboardHotkey(keys: readonly string[]): Promise<void>;
    clipboardRead(): Promise<string>;
    clipboardWrite(text: string): Promise<void>;
}
//# sourceMappingURL=linux.d.ts.map