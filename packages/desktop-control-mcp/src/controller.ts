import type {
  AccessibilityResult,
  DesktopAction,
  DesktopActionResult,
  DesktopApprovalDecision,
  DesktopApprovalRequest,
  DesktopCapabilityStatus,
  DesktopConfig,
  DesktopControllerOptions,
  DesktopElement,
  DesktopMode,
  DesktopObservation,
  DesktopRisk,
  DesktopStatus,
  DesktopWatcherRecord,
  ScreenshotResult,
  VisionObservation,
  VisionProviderName,
  WindowInfo
} from "./types.js";
import {
  createDefaultDesktopState,
  loadDesktopState,
  parseMode,
  parseVisionProvider,
  saveDesktopState
} from "./state.js";
import { LinuxDesktopDriver } from "./linux.js";
import { createVisionProvider } from "./vision.js";
import {
  delay,
  hashFile,
  isRecord,
  readBoolean,
  readNumber,
  readOptionalString,
  readString,
  readStringArray,
  truncate
} from "./utils.js";

const WATCH_INTERVAL_MS = 5_000;

export class DesktopController {
  private readonly driver = new LinuxDesktopDriver();
  private readonly now: () => number;
  private readonly statePath?: string;
  private lastAction?: DesktopActionResult;
  private lastObservation?: DesktopObservation;
  private pendingApproval?: DesktopStatus["pendingApproval"];
  private readonly watcherHashes = new Map<string, string | undefined>();
  private readonly watcherTimers = new Map<string, NodeJS.Timeout>();
  private readonly watchers = new Map<string, DesktopWatcherRecord>();

  constructor(private readonly options: DesktopControllerOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.statePath = options.statePath;
  }

  async getConfig(): Promise<DesktopConfig> {
    return (await this.loadState()).config;
  }

  async setMode(mode: DesktopMode): Promise<DesktopConfig> {
    const state = await this.loadState();
    state.config.mode = mode;
    await this.saveState(state);
    return state.config;
  }

  async allowApp(app: string): Promise<DesktopConfig> {
    const state = await this.loadState();
    state.config.allowedApps = addUnique(state.config.allowedApps, app);
    state.config.blockedApps = removeValue(state.config.blockedApps, app);
    await this.saveState(state);
    return state.config;
  }

  async blockApp(app: string): Promise<DesktopConfig> {
    const state = await this.loadState();
    state.config.blockedApps = addUnique(state.config.blockedApps, app);
    state.config.allowedApps = removeValue(state.config.allowedApps, app);
    await this.saveState(state);
    return state.config;
  }

  async listAllowed(): Promise<Pick<DesktopConfig, "allowedApps" | "blockedApps">> {
    const config = await this.getConfig();

    return {
      allowedApps: config.allowedApps,
      blockedApps: config.blockedApps
    };
  }

  async setVisionProvider(provider: VisionProviderName): Promise<DesktopConfig> {
    const state = await this.loadState();
    state.config.visionProvider = provider;
    await this.saveState(state);
    return state.config;
  }

  async setVisionModel(model: string): Promise<DesktopConfig> {
    const state = await this.loadState();
    state.config.visionModel = model;
    await this.saveState(state);
    return state.config;
  }

  async visionStatus(): Promise<DesktopStatus["vision"]> {
    const config = await this.getConfig();

    return createVisionProvider(config, this.options.getVisionAuth?.()).status();
  }

  async status(): Promise<DesktopStatus> {
    const config = await this.getConfig();
    const environment = await this.driver.getEnvironment();
    const accessibility = await this.driver.accessibilityTree({
      maxChildren: 5,
      maxDepth: 1
    }).catch((error: unknown) => ({
      available: false,
      error: error instanceof Error ? error.message : String(error),
      generatedAt: this.now(),
      summary: "Accessibility unavailable."
    }));

    return {
      activeWatcher: [...this.watchers.values()].find((watcher) =>
        ["active", "healthy", "stalled"].includes(watcher.state)
      ),
      capabilities: createCapabilities(environment, accessibility),
      config,
      coreEnabled: true,
      environment,
      lastAction: this.lastAction,
      lastObservation: this.lastObservation,
      lastScreenshotAt: this.lastObservation?.screenshot?.capturedAt,
      pendingApproval: this.pendingApproval,
      vision: createVisionProvider(config, this.options.getVisionAuth?.()).status()
    };
  }

  async screenshot(): Promise<ScreenshotResult> {
    return this.driver.screenshot();
  }

  async describeScreen(input: {
    context?: Record<string, unknown>;
    prompt?: string;
  } = {}): Promise<VisionObservation> {
    const config = await this.getConfig();
    const screenshot = await this.screenshot();

    return createVisionProvider(config, this.options.getVisionAuth?.()).describeScreen(
      screenshot,
      input.prompt,
      input.context
    );
  }

  async locateOnScreen(input: {
    context?: Record<string, unknown>;
    target: string;
  }): Promise<VisionObservation> {
    const config = await this.getConfig();
    const screenshot = await this.screenshot();

    return createVisionProvider(config, this.options.getVisionAuth?.()).locateElement(
      screenshot,
      input.target,
      input.context
    );
  }

  async compareScreens(input: {
    afterPath: string;
    beforePath: string;
    prompt?: string;
  }): Promise<VisionObservation> {
    const config = await this.getConfig();

    return createVisionProvider(config, this.options.getVisionAuth?.()).compareScreens(
      input.beforePath,
      input.afterPath,
      input.prompt
    );
  }

  async observe(input: {
    accessibility?: boolean;
    maxDepth?: number;
    screenshot?: boolean;
  } = {}): Promise<DesktopObservation> {
    const environment = await this.driver.getEnvironment();
    const windows = await this.driver.listWindows().catch(() => []);
    const activeWindow =
      windows.find((window) => window.isActive) ??
      (await this.driver.activeWindow().catch(() => undefined));
    const includeAccessibility = input.accessibility !== false;
    const accessibility = includeAccessibility
      ? await this.driver.accessibilityTree({
          maxDepth: input.maxDepth ?? 4
        })
      : undefined;
    const screenshot =
      input.screenshot === false
        ? undefined
        : await this.driver.screenshot().catch(() => undefined);
    const summaryParts = [
      activeWindow
        ? `Active window: ${activeWindow.title}`
        : "Active window unavailable",
      `${windows.length} window${windows.length === 1 ? "" : "s"} listed`,
      accessibility
        ? accessibility.available
          ? accessibility.summary
          : accessibility.summary
        : "Accessibility skipped",
      screenshot
        ? `Screenshot: ${screenshot.width ?? "?"}x${screenshot.height ?? "?"} ${screenshot.path}`
        : "Screenshot unavailable or skipped"
    ];
    const observation: DesktopObservation = {
      accessibility,
      activeWindow,
      environment,
      screenshot,
      summary: summaryParts.join(" | "),
      timestamp: this.now(),
      windows
    };
    this.lastObservation = observation;

    return observation;
  }

  async listWindows(): Promise<WindowInfo[]> {
    return this.driver.listWindows();
  }

  async activeWindow(): Promise<WindowInfo | undefined> {
    return this.driver.activeWindow();
  }

  async focusWindow(windowId: string): Promise<DesktopActionResult> {
    return this.act({
      target: {
        kind: "window",
        windowId
      },
      type: "focus"
    });
  }

  async closeWindow(windowId: string): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        target: {
          kind: "window",
          windowId
        },
        type: "keypress"
      },
      "medium",
      async () => {
        await this.driver.closeWindow(windowId);
        return {
          windowId
        };
      },
      "Close desktop window"
    );
  }

  async listApps(): Promise<string[]> {
    return this.driver.listApps();
  }

  async openApp(app: string): Promise<DesktopActionResult> {
    return this.act({
      target: {
        app,
        kind: "app"
      },
      type: "open_app"
    });
  }

  async closeApp(app: string): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        target: {
          app,
          kind: "app"
        },
        type: "keypress"
      },
      "dangerous",
      async () => {
        await this.driver.closeApp(app);
        return {
          app
        };
      },
      `Close app ${app}`
    );
  }

  async mouseMove(x: number, y: number): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        target: {
          kind: "coordinate",
          x,
          y
        },
        type: "focus"
      },
      "medium",
      async () => {
        await this.driver.mouseMove(x, y);
        return {
          x,
          y
        };
      },
      `Move mouse to ${x},${y}`
    );
  }

  async clipboardRead(): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        type: "screenshot"
      },
      "medium",
      async () => ({
        text: await this.driver.clipboardRead()
      }),
      "Read desktop clipboard"
    );
  }

  async clipboardWrite(text: string): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        text,
        type: "type"
      },
      "medium",
      async () => {
        await this.driver.clipboardWrite(text);
        return {
          writtenChars: text.length
        };
      },
      "Write desktop clipboard"
    );
  }

  async accessibilityTree(input: {
    maxDepth?: number;
  } = {}): Promise<AccessibilityResult> {
    return this.driver.accessibilityTree({
      maxDepth: input.maxDepth ?? 5
    });
  }

  async accessibilityFocused(): Promise<AccessibilityResult> {
    return this.driver.accessibilityFocused();
  }

  async accessibilityFind(input: {
    app?: string;
    focused?: boolean;
    name?: string;
    role?: string;
    text?: string;
    window?: string;
  }): Promise<{
    matches: DesktopElement[];
    tree: AccessibilityResult;
  }> {
    const tree = await this.accessibilityTree({ maxDepth: 7 });
    const matches = tree.root
      ? flattenElements(tree.root).filter((element) => matchesElement(element, input))
      : [];

    return {
      matches: matches.slice(0, 50),
      tree
    };
  }

  async accessibilityClick(elementId: string): Promise<DesktopActionResult> {
    return this.act({
      target: {
        elementId,
        kind: "accessibility"
      },
      type: "click"
    });
  }

  async accessibilityFocus(elementId: string): Promise<DesktopActionResult> {
    return this.act({
      target: {
        elementId,
        kind: "accessibility"
      },
      type: "focus"
    });
  }

  async accessibilityType(
    elementId: string,
    text: string
  ): Promise<DesktopActionResult> {
    return this.act({
      target: {
        elementId,
        kind: "accessibility"
      },
      text,
      type: "type"
    });
  }

  async act(action: DesktopAction): Promise<DesktopActionResult> {
    const risk = classifyActionRisk(action);
    const decision = await this.authorizeAction(action, risk);

    if (!decision.approved) {
      const result: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: false,
        method: "none",
        ok: false,
        reason: decision.reason ?? "Desktop action was blocked by policy.",
        risk
      };
      this.pendingApproval = {
        action,
        id: decision.id,
        reason: result.reason ?? "approval required",
        risk
      };
      this.lastAction = result;
      return result;
    }

    try {
      const executed = await this.executeAction(action);
      const result: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: true,
        method: executed.method,
        ok: true,
        result: executed.result,
        risk
      };
      this.pendingApproval = undefined;
      this.lastAction = result;
      return result;
    } catch (error) {
      const result: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: false,
        method: "none",
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        risk
      };
      this.lastAction = result;
      return result;
    }
  }

  async runTask(task: string): Promise<{
    actions: DesktopActionResult[];
    done: boolean;
    observation?: DesktopObservation;
    watcher: DesktopWatcherRecord;
  }> {
    const watcher = await this.startWatch({
      taskSummary: task
    });
    const actions: DesktopActionResult[] = [];
    const normalized = task.toLowerCase();

    try {
      if (/open .*text editor|text editor/.test(normalized)) {
        actions.push(await this.openApp("text editor"));

        if (!actions[actions.length - 1]?.ok) {
          await this.finishWatch(
            watcher.id,
            "stalled",
            actions[actions.length - 1]?.reason
          );
          return {
            actions,
            done: false,
            observation: await this.observe().catch(() => undefined),
            watcher: this.watchers.get(watcher.id) ?? watcher
          };
        }

        await delay(1_500);

        const text = extractTextToType(task) ?? "hello";

        if (text.length > 0) {
          actions.push(
            await this.act({
              text,
              type: "type"
            })
          );
        }

        const observation = await this.observe();
        await this.finishWatch(watcher.id, actions.every((action) => action.ok) ? "completed" : "stalled");

        return {
          actions,
          done: actions.every((action) => action.ok),
          observation,
          watcher: this.watchers.get(watcher.id) ?? watcher
        };
      }

      const openMatch = /\bopen\s+([a-z0-9_. -]+)/i.exec(task);

      if (openMatch) {
        actions.push(await this.openApp(openMatch[1].trim()));
        const observation = await this.observe();
        await this.finishWatch(watcher.id, actions.every((action) => action.ok) ? "completed" : "stalled");

        return {
          actions,
          done: actions.every((action) => action.ok),
          observation,
          watcher: this.watchers.get(watcher.id) ?? watcher
        };
      }

      const observation = await this.observe();
      await this.finishWatch(watcher.id, "stalled", "Task needs main-agent planning.");

      return {
        actions,
        done: false,
        observation,
        watcher: this.watchers.get(watcher.id) ?? watcher
      };
    } catch (error) {
      await this.finishWatch(
        watcher.id,
        "failed",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async startWatch(input: {
    intervalMs?: number;
    taskId?: string;
    taskSummary?: string;
  } = {}): Promise<DesktopWatcherRecord> {
    const id = `desktop-watch-${Math.random().toString(36).slice(2, 10)}`;
    const now = this.now();
    const watcher: DesktopWatcherRecord = {
      id,
      lastProgressTime: now,
      state: "active",
      taskId: input.taskId,
      taskSummary: input.taskSummary ?? "Desktop watch"
    };
    this.watchers.set(id, watcher);

    const interval = Math.max(1_000, input.intervalMs ?? WATCH_INTERVAL_MS);
    const timer = setInterval(() => {
      void this.tickWatcher(id).catch(() => undefined);
    }, interval);
    this.watcherTimers.set(id, timer);
    void this.tickWatcher(id).catch(() => undefined);

    return watcher;
  }

  async stop(): Promise<DesktopWatcherRecord[]> {
    const stopped: DesktopWatcherRecord[] = [];

    for (const watcher of this.watchers.values()) {
      if (["active", "healthy", "stalled"].includes(watcher.state)) {
        await this.finishWatch(watcher.id, "cancelled", "Stopped by user.");
        const next = this.watchers.get(watcher.id);

        if (next) {
          stopped.push(next);
        }
      }
    }

    return stopped;
  }

  async browserOpen(url: string): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        target: {
          kind: "browser"
        },
        text: url,
        type: "open_app"
      },
      "medium",
      async () => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
          return this.driver.openUrl(url);
        }

        return this.driver.openApp(url);
      },
      `Open browser target ${url}`
    );
  }

  async browserScreenshot(): Promise<ScreenshotResult> {
    return this.screenshot();
  }

  async mouseDoubleClick(x: number, y: number): Promise<DesktopActionResult> {
    return this.authorizedPrimitive(
      {
        target: {
          kind: "coordinate",
          x,
          y
        },
        type: "click"
      },
      "medium",
      async () => {
        await this.driver.mouseDoubleClick(x, y);
        return {
          x,
          y
        };
      },
      `Double click ${x},${y}`
    );
  }

  async browserUnavailable(tool: string): Promise<{
    ok: false;
    reason: string;
  }> {
    return {
      ok: false,
      reason: `${tool} requires a browser-specific adapter such as Playwright MCP or Chrome DevTools. Enable the Playwright MCP entry for selector-level browser control.`
    };
  }

  private async authorizedPrimitive(
    action: DesktopAction,
    risk: DesktopRisk,
    operation: () => Promise<unknown>,
    summary: string
  ): Promise<DesktopActionResult> {
    const decision = await this.authorizeAction(action, risk, summary);

    if (!decision.approved) {
      const result: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: false,
        method: "none",
        ok: false,
        reason: decision.reason ?? "Desktop action was blocked by policy.",
        risk
      };
      this.lastAction = result;
      return result;
    }

    try {
      const result = await operation();
      const actionResult: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: true,
        method: "app",
        ok: true,
        result,
        risk
      };
      this.lastAction = actionResult;
      return actionResult;
    } catch (error) {
      const actionResult: DesktopActionResult = {
        action,
        approvalId: decision.id,
        executed: false,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        risk
      };
      this.lastAction = actionResult;
      return actionResult;
    }
  }

  private async executeAction(action: DesktopAction): Promise<{
    method: DesktopActionResult["method"];
    result?: unknown;
  }> {
    switch (action.type) {
      case "open_app": {
        const app = action.target?.app ?? action.text;

        if (!app) {
          throw new Error("open_app requires target.app or text.");
        }

        return {
          method: "app",
          result: await this.driver.openApp(app)
        };
      }
      case "focus":
        if (action.target?.kind === "accessibility" && action.target.elementId) {
          const result = await this.driver.accessibilityFocus(action.target.elementId);

          if (result.ok) {
            return {
              method: "accessibility",
              result
            };
          }

          throw new Error(result.message || "Accessibility focus failed.");
        }

        if (action.target?.kind === "window" && action.target.windowId) {
          await this.driver.focusWindow(action.target.windowId);
          return {
            method: "app",
            result: {
              windowId: action.target.windowId
            }
          };
        }

        if (action.target?.kind === "app" && action.target.app) {
          const windows = await this.driver.listWindows();
          const match = windows.find((window) =>
            window.title.toLowerCase().includes(action.target?.app?.toLowerCase() ?? "")
          );

          if (!match) {
            throw new Error(`No window found for app "${action.target.app}".`);
          }

          await this.driver.focusWindow(match.id);
          return {
            method: "app",
            result: match
          };
        }

        throw new Error("focus requires an accessibility element, window, or app target.");
      case "click":
        if (action.target?.kind === "accessibility" && action.target.elementId) {
          const result = await this.driver.accessibilityClick(action.target.elementId);

          if (result.ok) {
            return {
              method: "accessibility",
              result
            };
          }

          if (result.bounds) {
            await this.driver.mouseClick(
              Math.round(result.bounds.x + result.bounds.width / 2),
              Math.round(result.bounds.y + result.bounds.height / 2)
            );
            return {
              method: "mouse_keyboard",
              result: {
                fallback: "accessibility-bounds",
                message: result.message
              }
            };
          }

          throw new Error(result.message || "Accessibility click failed.");
        }

        if (
          action.target?.kind === "coordinate" &&
          typeof action.target.x === "number" &&
          typeof action.target.y === "number"
        ) {
          await this.driver.mouseClick(action.target.x, action.target.y);
          return {
            method: "mouse_keyboard",
            result: {
              x: action.target.x,
              y: action.target.y
            }
          };
        }

        throw new Error("click requires an accessibility element or coordinate target.");
      case "type":
        if (!action.text) {
          throw new Error("type requires text.");
        }

        if (action.target?.kind === "accessibility" && action.target.elementId) {
          const focus = await this.driver.accessibilityFocus(action.target.elementId);

          if (!focus.ok) {
            throw new Error(focus.message || "Could not focus accessibility element before typing.");
          }
        }

        await this.driver.keyboardType(action.text);
        return {
          method: action.target?.kind === "accessibility" ? "accessibility" : "mouse_keyboard",
          result: {
            typedChars: action.text.length
          }
        };
      case "keypress":
        if (action.keys && action.keys.length > 0) {
          await this.driver.keyboardHotkey(action.keys);
          return {
            method: "mouse_keyboard",
            result: {
              keys: action.keys
            }
          };
        }

        if (action.text) {
          await this.driver.keyboardPress(action.text);
          return {
            method: "mouse_keyboard",
            result: {
              key: action.text
            }
          };
        }

        throw new Error("keypress requires keys or text.");
      case "scroll": {
        const clicks = action.target?.y ?? Number(action.text ?? -3);
        await this.driver.mouseScroll(Number.isFinite(clicks) ? clicks : -3);
        return {
          method: "mouse_keyboard",
          result: {
            clicks
          }
        };
      }
      case "drag":
        if (
          action.target?.kind !== "coordinate" ||
          typeof action.target.x !== "number" ||
          typeof action.target.y !== "number" ||
          typeof action.x2 !== "number" ||
          typeof action.y2 !== "number"
        ) {
          throw new Error("drag requires coordinate target plus x2/y2.");
        }

        await this.driver.mouseDrag(action.target.x, action.target.y, action.x2, action.y2);
        return {
          method: "mouse_keyboard",
          result: {
            x1: action.target.x,
            x2: action.x2,
            y1: action.target.y,
            y2: action.y2
          }
        };
      case "wait":
        await delay(Math.max(250, Math.min(60_000, Number(action.text ?? 1000))));
        return {
          method: "none",
          result: {
            waitedMs: Number(action.text ?? 1000)
          }
        };
      case "screenshot":
        return {
          method: "none",
          result: await this.screenshot()
        };
      default:
        return assertNever(action.type);
    }
  }

  private async authorizeAction(
    action: DesktopAction,
    risk: DesktopRisk,
    summary = summarizeAction(action)
  ): Promise<DesktopApprovalDecision> {
    if (risk === "safe") {
      return {
        approved: true
      };
    }

    const config = await this.getConfig();
    const appDecision = await this.checkAppPolicy(config, action);

    if (!appDecision.approved) {
      return appDecision;
    }

    if (config.mode === "readonly") {
      return {
        approved: false,
        reason: "Desktop mode is readonly. Only screenshots, window lists, and accessibility inspection are allowed."
      };
    }

    if (config.mode === "assistive") {
      return {
        approved: false,
        reason: "Desktop mode is assistive. Actions are suggested but not executed."
      };
    }

    if (risk === "dangerous" || config.mode === "approve") {
      const request: DesktopApprovalRequest = {
        action,
        detail: `${summary}\nAction JSON: ${JSON.stringify(action)}`,
        resource: action.target?.app ?? action.target?.windowId ?? action.target?.elementId,
        risk,
        summary
      };

      if (this.options.approvalHandler) {
        return this.options.approvalHandler(request);
      }

      return {
        approved: false,
        reason:
          risk === "dangerous"
            ? "Dangerous desktop action requires explicit approval."
            : "Approval is required, but no approval handler is attached to this desktop-control server."
      };
    }

    return {
      approved: true
    };
  }

  private async checkAppPolicy(
    config: DesktopConfig,
    action: DesktopAction
  ): Promise<DesktopApprovalDecision> {
    const targetApp = action.target?.app ?? (await this.driver.activeWindow().catch(() => undefined))?.title;

    if (targetApp && matchesAny(targetApp, config.blockedApps)) {
      return {
        approved: false,
        reason: `Desktop action blocked because "${targetApp}" matches the desktop blocklist.`
      };
    }

    if (config.allowedApps.length > 0 && action.type !== "open_app") {
      if (!targetApp) {
        return {
          approved: false,
          reason:
            "Desktop app allowlist is active, but the active app/window could not be identified."
        };
      }

      if (!matchesAny(targetApp, config.allowedApps)) {
        return {
          approved: false,
          reason: `Desktop action blocked because "${targetApp}" is not in the desktop allowlist.`
        };
      }
    }

    return {
      approved: true
    };
  }

  private async tickWatcher(id: string): Promise<void> {
    const watcher = this.watchers.get(id);

    if (!watcher || !["active", "healthy", "stalled"].includes(watcher.state)) {
      return;
    }

    const observation = await this.observe({
      accessibility: false,
      screenshot: true
    }).catch(() => undefined);

    if (!observation) {
      this.watchers.set(id, {
        ...watcher,
        state: "stalled",
        stopReason: "Observe failed.",
        lastObservationSummary: "Observe failed."
      });
      return;
    }

    const nextHash = observation.screenshot
      ? await hashFile(observation.screenshot.path)
      : undefined;
    const previousHash = this.watcherHashes.get(id);
    const progressed = nextHash !== undefined && nextHash !== previousHash;
    const now = this.now();
    this.watcherHashes.set(id, nextHash);
    this.watchers.set(id, {
      ...watcher,
      currentApp: observation.activeWindow?.app,
      currentWindow: observation.activeWindow?.title,
      lastObservationSummary: observation.summary,
      lastProgressTime: progressed ? now : watcher.lastProgressTime,
      lastScreenshotTimestamp: observation.screenshot?.capturedAt,
      state:
        now - (progressed ? now : watcher.lastProgressTime) > 60_000
          ? "stalled"
          : "healthy"
    });
  }

  private async finishWatch(
    id: string,
    state: DesktopWatcherRecord["state"],
    stopReason?: string
  ): Promise<void> {
    const timer = this.watcherTimers.get(id);

    if (timer) {
      clearInterval(timer);
      this.watcherTimers.delete(id);
    }

    const watcher = this.watchers.get(id);

    if (watcher) {
      this.watchers.set(id, {
        ...watcher,
        state,
        stopReason
      });
    }
  }

  private async loadState() {
    return loadDesktopState(this.statePath);
  }

  private async saveState(state: Awaited<ReturnType<typeof loadDesktopState>>) {
    await saveDesktopState(state, this.statePath);
  }
}

export function createDesktopController(
  options?: DesktopControllerOptions
): DesktopController {
  return new DesktopController(options);
}

export function parseAction(input: unknown): DesktopAction {
  if (!isRecord(input)) {
    throw new Error("Action must be an object.");
  }

  const type = readString(input.type, "type") as DesktopAction["type"];
  const target = isRecord(input.target)
    ? {
        app: readOptionalString(input.target.app),
        elementId: readOptionalString(input.target.elementId),
        kind: readString(input.target.kind, "target.kind") as NonNullable<DesktopAction["target"]>["kind"],
        selector: readOptionalString(input.target.selector),
        windowId: readOptionalString(input.target.windowId),
        x: typeof input.target.x === "number" ? input.target.x : undefined,
        y: typeof input.target.y === "number" ? input.target.y : undefined
      }
    : undefined;

  return {
    confidence:
      typeof input.confidence === "number" ? input.confidence : undefined,
    keys: readStringArray(input.keys),
    reason: readOptionalString(input.reason),
    target,
    text: readOptionalString(input.text),
    type,
    x2: typeof input.x2 === "number" ? input.x2 : undefined,
    y2: typeof input.y2 === "number" ? input.y2 : undefined
  };
}

export function readDesktopMode(value: unknown): DesktopMode {
  const mode = parseMode(value);

  if (!mode) {
    throw new Error("mode must be readonly, assistive, approve, or autopilot.");
  }

  return mode;
}

export function readVisionProvider(value: unknown): VisionProviderName {
  const provider = parseVisionProvider(value);

  if (!provider) {
    throw new Error("provider must be mistral, ollama, or local.");
  }

  return provider;
}

function createCapabilities(
  environment: DesktopStatus["environment"],
  accessibility: Pick<AccessibilityResult, "available" | "error" | "summary">
): DesktopStatus["capabilities"] {
  const commands = new Set(environment?.availableCommands ?? []);
  const hasScreenshotBackend = [
    "spectacle",
    "grim",
    "gnome-screenshot",
    "import",
    "scrot"
  ].some((command) => commands.has(command));
  const hasWindowBackend = ["wmctrl", "xdotool", "qdbus"].some((command) =>
    commands.has(command)
  );
  const hasAppBackend = ["gtk-launch", "xdg-open"].some((command) =>
    commands.has(command)
  );
  const hasInputBackend = ["xdotool", "wtype"].some((command) =>
    commands.has(command)
  );

  return {
    accessibility: {
      available: accessibility.available,
      detail: accessibility.available
        ? accessibility.summary
        : accessibility.error ??
          "Install python3-pyatspi and enable the desktop accessibility bridge."
    },
    appControl: {
      available: hasAppBackend,
      detail: hasAppBackend
        ? "gtk-launch or xdg-open available"
        : "Install gtk-launch/gtk3 or xdg-utils."
    },
    inputControl: {
      available: hasInputBackend,
      detail: hasInputBackend
        ? "xdotool or wtype available"
        : "Install xdotool on X11 or wtype on Wayland."
    },
    screenshot: {
      available: hasScreenshotBackend,
      detail: hasScreenshotBackend
        ? "screenshot backend available"
        : "Install Spectacle on Fedora/KDE with: sudo dnf install spectacle."
    },
    windowControl: {
      available: hasWindowBackend,
      detail: hasWindowBackend
        ? "wmctrl, xdotool, or qdbus available"
        : "Install wmctrl or xdotool; KDE/Wayland support may require KWin DBus tooling."
    }
  };
}

function formatCapability(capability?: DesktopCapabilityStatus): string {
  if (!capability) {
    return "unknown";
  }

  return `${capability.available ? "available" : "unavailable"}${capability.detail ? ` (${capability.detail})` : ""}`;
}

export function formatDesktopStatus(status: DesktopStatus): string {
  const activeWindow =
    status.lastObservation?.activeWindow?.title ??
    status.lastObservation?.screenshot?.activeWindow?.title ??
    "-";
  const activeApp =
    status.lastObservation?.activeWindow?.app ??
    status.lastObservation?.screenshot?.activeWindow?.app ??
    "-";

  return [
    status.coreEnabled ? "Desktop Control: core enabled" : "Desktop Control: disabled",
    `mode: ${status.config.mode}`,
    `accessibility: ${formatCapability(status.capabilities?.accessibility)}`,
    `screenshot: ${formatCapability(status.capabilities?.screenshot)}`,
    `app control: ${formatCapability(status.capabilities?.appControl)}`,
    `window control: ${formatCapability(status.capabilities?.windowControl)}`,
    `input control: ${formatCapability(status.capabilities?.inputControl)}`,
    `accessibility first: ${status.config.useAccessibilityFirst ? "yes" : "no"}`,
    `vision provider: ${status.vision.provider}`,
    `vision model: ${status.vision.model ?? "-"}`,
    `vision: ${status.vision.configured ? "configured" : "not configured"} supports=${status.vision.supportsVision}`,
    status.vision.reason ? `vision detail: ${status.vision.reason}` : undefined,
    `allowed apps: ${status.config.allowedApps.length > 0 ? status.config.allowedApps.join(", ") : "all"}`,
    `blocked apps: ${status.config.blockedApps.length > 0 ? status.config.blockedApps.join(", ") : "none"}`,
    `last observe: ${status.lastObservation ? new Date(status.lastObservation.timestamp).toLocaleString() : "-"}`,
    `active app: ${activeApp}`,
    `active window: ${activeWindow}`,
    `last action: ${status.lastAction ? formatActionResult(status.lastAction) : "-"}`,
    `last screenshot: ${status.lastScreenshotAt ? new Date(status.lastScreenshotAt).toLocaleString() : "-"}`,
    `active watcher: ${status.activeWatcher?.id ?? "-"}`
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function summarizeObservation(observation: DesktopObservation): string {
  const lines = [
    observation.summary,
    `session: ${observation.environment.xdgSessionType ?? "unknown"} desktop=${observation.environment.xdgCurrentDesktop ?? "unknown"}`,
    `active: ${observation.activeWindow?.title ?? "-"}`,
    `windows: ${observation.windows.length}`,
    `accessibility: ${observation.accessibility?.summary ?? "skipped"}`,
    observation.screenshot
      ? `screenshot: ${observation.screenshot.path} (${observation.screenshot.width ?? "?"}x${observation.screenshot.height ?? "?"}, ${observation.screenshot.sizeBytes} bytes)`
      : "screenshot: unavailable"
  ];

  return lines.join("\n");
}

export function summarizeAccessibilityTree(
  tree: AccessibilityResult,
  full = false
): string {
  if (!tree.available) {
    return tree.summary;
  }

  if (!tree.root) {
    return "Accessibility tree is empty.";
  }

  if (full) {
    return JSON.stringify(tree.root, null, 2);
  }

  const nodes = flattenElements(tree.root)
    .filter((element) => element.role || element.name)
    .slice(0, 60)
    .map((element) => {
      const label = [element.id, element.role, element.name]
        .filter(Boolean)
        .join("  ");
      const actions =
        element.actions.length > 0 ? ` actions=${element.actions.join(",")}` : "";
      return `${label}${actions}`;
    });

  return [tree.summary, ...nodes].join("\n");
}

export function formatActionResult(result: DesktopActionResult): string {
  const state = result.ok ? "ok" : isApprovalBlock(result) ? "blocked" : "failed";
  const approval = result.approvalId ? ` approval=${result.approvalId}` : "";
  const target = result.action ? ` target=${formatActionTarget(result.action)}` : "";
  return `${state} ${result.action?.type ?? "action"}${target} risk=${result.risk} method=${result.method ?? "-"}${approval}${result.reason ? ` reason=${result.reason}` : ""}`;
}

function isApprovalBlock(result: DesktopActionResult): boolean {
  return (
    result.approvalId !== undefined &&
    result.executed === false &&
    result.method === "none" &&
    /approval|required|policy/i.test(result.reason ?? "")
  );
}

function formatActionTarget(action: DesktopAction): string {
  if (action.target?.app) {
    return action.target.app;
  }

  if (action.target?.windowId) {
    return action.target.windowId;
  }

  if (action.target?.elementId) {
    return action.target.elementId;
  }

  if (
    action.target?.kind === "coordinate" &&
    typeof action.target.x === "number" &&
    typeof action.target.y === "number"
  ) {
    return `${action.target.x},${action.target.y}`;
  }

  if (action.text) {
    return action.text.length > 24 ? `${action.text.slice(0, 24)}...` : action.text;
  }

  return "-";
}

export function readToolBoolean(input: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return readBoolean(input[key], fallback);
}

export function readToolNumber(input: Record<string, unknown>, key: string, fallback: number): number {
  return typeof input[key] === "number" ? readNumber(input[key], key) : fallback;
}

function classifyActionRisk(action: DesktopAction): DesktopRisk {
  if (action.type === "screenshot" || action.type === "wait") {
    return "safe";
  }

  const text = [
    action.reason,
    action.text,
    action.keys?.join(" "),
    action.target?.app,
    action.target?.selector
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(send|submit|purchase|buy|bank|wire|transfer|password|passwd|delete|remove|install|sudo|token|secret|credential|scan|attack|exploit|remote device)\b/.test(
      text
    )
  ) {
    return "dangerous";
  }

  return "medium";
}

function summarizeAction(action: DesktopAction): string {
  switch (action.type) {
    case "open_app":
      return `Open app ${action.target?.app ?? action.text ?? "unknown"}`;
    case "type":
      return `Type ${action.text?.length ?? 0} character${action.text?.length === 1 ? "" : "s"} into the active desktop UI`;
    case "click":
      return `Click desktop target ${action.target?.elementId ?? `${action.target?.x ?? "?"},${action.target?.y ?? "?"}`}`;
    case "keypress":
      return `Press desktop key${action.keys ? `s ${action.keys.join("+")}` : action.text ? ` ${action.text}` : ""}`;
    default:
      return `Run desktop action ${action.type}`;
  }
}

function flattenElements(root: DesktopElement): DesktopElement[] {
  return [root, ...(root.children ?? []).flatMap(flattenElements)];
}

function matchesElement(
  element: DesktopElement,
  input: {
    app?: string;
    focused?: boolean;
    name?: string;
    role?: string;
    text?: string;
    window?: string;
  }
): boolean {
  if (input.focused && !element.states.includes("focused")) {
    return false;
  }

  if (input.app && !contains(element.app, input.app)) {
    return false;
  }

  if (input.role && !contains(element.role, input.role)) {
    return false;
  }

  const label = [element.name, element.description, element.value].filter(Boolean).join(" ");

  if (input.name && !contains(label, input.name)) {
    return false;
  }

  if (input.text && !contains(label, input.text)) {
    return false;
  }

  if (input.window && !contains(element.app, input.window)) {
    return false;
  }

  return Boolean(input.focused || input.app || input.role || input.name || input.text || input.window);
}

function contains(value: string | undefined, target: string): boolean {
  return normalize(value).includes(normalize(target));
}

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => normalize(value).includes(normalize(pattern)));
}

function addUnique(values: readonly string[], value: string): string[] {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return [...values];
  }

  return [...new Set([...values, normalized])];
}

function removeValue(values: readonly string[], value: string): string[] {
  const normalized = normalize(value);

  return values.filter((entry) => normalize(entry) !== normalized);
}

function extractTextToType(task: string): string | undefined {
  const quoted = /["“](.+?)["”]/.exec(task);

  if (quoted) {
    return quoted[1];
  }

  const match = /\btype\s+(.+)$/i.exec(task);

  if (!match) {
    return undefined;
  }

  return match[1].trim();
}

function assertNever(value: never): never {
  throw new Error(`Unhandled desktop action type: ${String(value)}`);
}

void createDefaultDesktopState;
void truncate;
