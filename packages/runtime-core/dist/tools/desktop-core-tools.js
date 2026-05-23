import { createDesktopController, formatActionResult, formatDesktopStatus, parseAction, readDesktopMode, readVisionProvider, summarizeAccessibilityTree, summarizeObservation } from "@chatgpt-code/desktop-control-mcp";
export function createDesktopCoreToolRegistrations(options) {
    const controller = createDesktopController({
        approvalHandler: options.approvalManager
            ? (request) => requestDesktopApproval(options.approvalManager, request)
            : undefined,
        getVisionAuth: () => readDesktopVisionAuth(options.getModelConfig)
    });
    return [
        tool("screen_screenshot", "Capture a real local desktop screenshot and return path, dimensions, timestamp, and active window metadata.", {}, () => runStructured(() => controller.screenshot())),
        tool("screen_describe", "Describe the current screenshot through the selected vision provider. Vision only observes and never executes actions.", {
            prompt: stringProp("Optional instruction for the vision provider.")
        }, (input) => runStructured(() => controller.describeScreen({
            prompt: readOptionalString(input.prompt)
        }))),
        tool("screen_watch", "Start a desktop watcher that periodically observes screenshots for progress.", {
            intervalMs: numberProp("Optional watch interval in milliseconds."),
            taskSummary: stringProp("Optional summary of what progress means.")
        }, (input) => runStructured(() => controller.startWatch({
            intervalMs: readOptionalNumber(input.intervalMs),
            taskSummary: readOptionalString(input.taskSummary)
        }))),
        tool("desktop_status", "Return core desktop-control status, safety mode, capabilities, active window, watcher state, and vision config.", {}, () => runStructured(() => controller.status(), (status) => formatDesktopStatus(status))),
        tool("desktop_observe", "Observe active window, accessibility summary, screenshot metadata, and desktop environment.", {
            accessibility: booleanProp("Include accessibility tree summary."),
            maxDepth: numberProp("Maximum accessibility tree depth."),
            screenshot: booleanProp("Capture screenshot metadata.")
        }, (input) => runStructured(() => controller.observe({
            accessibility: readOptionalBoolean(input.accessibility),
            maxDepth: readOptionalNumber(input.maxDepth),
            screenshot: readOptionalBoolean(input.screenshot)
        }), (observation) => summarizeObservation(observation))),
        tool("desktop_run", "Run a bounded desktop computer-use task loop: observe, act through safety policy, observe again, and stop when done or blocked.", {
            task: stringProp("Desktop task instruction.")
        }, (input) => runStructured(() => controller.runTask(readString(input.task, "task")), (result) => formatDesktopRunResult(controller, result))),
        tool("desktop_stop", "Stop active desktop watchers or task loops.", {}, () => runStructured(() => controller.stop())),
        tool("window_list", "List visible desktop windows where the Linux session exposes them.", {}, () => runStructured(() => controller.listWindows())),
        tool("window_active", "Return the active desktop window where supported.", {}, () => runStructured(async () => (await controller.activeWindow()) ?? null)),
        tool("window_focus", "Focus a desktop window by id through the safety policy.", {
            windowId: stringProp("Window id from window_list.")
        }, (input) => actionResult(() => controller.focusWindow(readString(input.windowId, "windowId")))),
        tool("app_open", "Open a local desktop app using gtk-launch, xdg-open, or command lookup through the safety policy.", {
            app: stringProp("App name, desktop id, alias, or command.")
        }, (input) => actionResult(() => controller.openApp(readString(input.app, "app")))),
        tool("app_close", "Close a local app process by exact process name after dangerous-action approval.", {
            app: stringProp("Exact process or app name.")
        }, (input) => actionResult(() => controller.closeApp(readString(input.app, "app")))),
        tool("app_list", "List installed desktop launchers and running app process names.", {}, () => runStructured(() => controller.listApps())),
        tool("app_focus", "Focus a visible app window by title match through the safety policy.", {
            app: stringProp("App or window title text.")
        }, (input) => actionResult(() => controller.act({
            target: {
                app: readString(input.app, "app"),
                kind: "app"
            },
            type: "focus"
        }))),
        tool("accessibility_tree", "Inspect the real AT-SPI accessibility tree. Returns unavailable state with dependency advice instead of fake output.", {
            full: booleanProp("Return full tree text instead of summary."),
            maxDepth: numberProp("Maximum tree depth.")
        }, (input) => runStructured(() => controller.accessibilityTree({
            maxDepth: readOptionalNumber(input.maxDepth) ?? 5
        }), (tree) => summarizeAccessibilityTree(tree, readOptionalBoolean(input.full) ?? false))),
        tool("accessibility_find", "Find real accessible elements by name, role, text, app/window, or focused state.", {
            app: stringProp("Optional app name."),
            focused: booleanProp("Only focused element."),
            name: stringProp("Name or label query."),
            role: stringProp("Role query."),
            text: stringProp("Visible text query."),
            window: stringProp("Window or app query.")
        }, (input) => runStructured(() => controller.accessibilityFind({
            app: readOptionalString(input.app),
            focused: readOptionalBoolean(input.focused),
            name: readOptionalString(input.name),
            role: readOptionalString(input.role),
            text: readOptionalString(input.text),
            window: readOptionalString(input.window)
        }))),
        tool("accessibility_click", "Click an accessible element using a real accessibility action when possible, with bounds fallback through safety policy.", {
            elementId: stringProp("Element id from accessibility_tree or accessibility_find.")
        }, (input) => actionResult(() => controller.accessibilityClick(readString(input.elementId, "elementId")))),
        tool("accessibility_focus", "Focus an accessible element through AT-SPI when possible.", {
            elementId: stringProp("Element id from accessibility_tree or accessibility_find.")
        }, (input) => actionResult(() => controller.accessibilityFocus(readString(input.elementId, "elementId")))),
        tool("accessibility_type", "Focus an accessible element and type text through the safety policy.", {
            elementId: stringProp("Element id from accessibility_tree or accessibility_find."),
            text: stringProp("Text to type.")
        }, (input) => actionResult(() => controller.accessibilityType(readString(input.elementId, "elementId"), readString(input.text, "text")))),
        tool("mouse_click", "Click raw screen coordinates through the desktop safety policy.", {
            button: numberProp("Mouse button, default 1."),
            x: numberProp("X coordinate."),
            y: numberProp("Y coordinate.")
        }, (input) => actionResult(() => controller.act({
            target: {
                kind: "coordinate",
                x: readNumber(input.x, "x"),
                y: readNumber(input.y, "y")
            },
            type: "click"
        }))),
        tool("mouse_move", "Move the mouse pointer through the desktop safety policy.", {
            x: numberProp("X coordinate."),
            y: numberProp("Y coordinate.")
        }, (input) => actionResult(() => controller.mouseMove(readNumber(input.x, "x"), readNumber(input.y, "y")))),
        tool("mouse_scroll", "Scroll the active desktop target through the desktop safety policy.", {
            clicks: numberProp("Positive scrolls up, negative scrolls down.")
        }, (input) => actionResult(() => controller.act({
            target: {
                kind: "coordinate",
                y: readNumber(input.clicks, "clicks")
            },
            type: "scroll"
        }))),
        tool("keyboard_type", "Type text into the focused desktop target through the desktop safety policy.", {
            text: stringProp("Text to type.")
        }, (input) => actionResult(() => controller.act({
            text: readString(input.text, "text"),
            type: "type"
        }))),
        tool("keyboard_press", "Press a single key through the desktop safety policy.", {
            key: stringProp("Key name such as Return, Escape, or Ctrl+L.")
        }, (input) => actionResult(() => controller.act({
            text: readString(input.key, "key"),
            type: "keypress"
        }))),
        tool("keyboard_hotkey", "Press a hotkey through the desktop safety policy.", {
            keys: {
                items: {
                    type: "string"
                },
                type: "array"
            }
        }, (input) => actionResult(() => controller.act({
            keys: readStringArray(input.keys, "keys"),
            type: "keypress"
        }))),
        tool("clipboard_read", "Read clipboard text through the desktop safety policy.", {}, () => actionResult(() => controller.clipboardRead())),
        tool("clipboard_write", "Write clipboard text through the desktop safety policy.", {
            text: stringProp("Text to write.")
        }, (input) => actionResult(() => controller.clipboardWrite(readString(input.text, "text")))),
        tool("desktop_mode", "Set desktop-control safety mode.", {
            mode: stringProp("readonly, assistive, approve, or autopilot.")
        }, (input) => runStructured(() => controller.setMode(readDesktopMode(input.mode)), (config) => `Desktop mode set to ${config.mode}.`)),
        tool("desktop_allow", "Add an app/window pattern to the desktop allowlist.", {
            app: stringProp("App/window pattern.")
        }, (input) => runStructured(() => controller.allowApp(readString(input.app, "app")), (config) => `Allowed desktop apps: ${config.allowedApps.join(", ") || "all"}`)),
        tool("desktop_block", "Add an app/window pattern to the desktop blocklist.", {
            app: stringProp("App/window pattern.")
        }, (input) => runStructured(() => controller.blockApp(readString(input.app, "app")), (config) => `Blocked desktop apps: ${config.blockedApps.join(", ") || "none"}`)),
        tool("desktop_allowed", "Return desktop allowlist and blocklist policy.", {}, () => runStructured(() => controller.listAllowed(), (lists) => [
            "Desktop App Policy",
            `Allowed: ${lists.allowedApps.join(", ") || "all apps"}`,
            `Blocked: ${lists.blockedApps.join(", ") || "none"}`
        ].join("\n"))),
        tool("desktop_act", "Execute a structured desktop action through app/accessibility/raw executor and safety policy.", {
            action: {
                additionalProperties: true,
                type: "object"
            }
        }, (input) => actionResult(() => controller.act(parseAction(input.action)))),
        tool("vision_status", "Return selected desktop vision provider/model/configuration state.", {}, () => runStructured(() => readVisionStatusWithLocalDetails(controller), (status) => [
            "Vision Status",
            `Provider: ${status.provider}`,
            `Model: ${status.model ?? "-"}`,
            `Base URL: ${status.baseUrl ?? "-"}`,
            `Configured: ${status.configured ? "yes" : "no"}`,
            `Supports vision: ${status.supportsVision}`,
            status.availableModels && status.availableModels.length > 0
                ? `Installed Ollama models: ${status.availableModels.join(", ")}`
                : undefined,
            status.reason ? `Reason: ${status.reason}` : undefined
        ]
            .filter((line) => Boolean(line))
            .join("\n"))),
        tool("vision_provider", "Set desktop vision provider.", {
            provider: stringProp("mistral, ollama, or local.")
        }, (input) => runStructured(() => controller.setVisionProvider(readVisionProvider(input.provider)), (config) => `Vision provider set to ${config.visionProvider}.`)),
        tool("vision_model", "Set desktop vision model.", {
            model: stringProp("Vision model name.")
        }, (input) => runStructured(() => controller.setVisionModel(readString(input.model, "model")), (config) => `Vision model set to ${config.visionModel ?? "-"}.`))
    ];
}
async function readVisionStatusWithLocalDetails(controller) {
    const status = await controller.visionStatus();
    if (status.provider !== "ollama" || !status.baseUrl) {
        return status;
    }
    const models = await listOllamaModelNames(status.baseUrl).catch(() => []);
    return {
        ...status,
        availableModels: models,
        reason: status.reason ??
            (models.length === 0
                ? "No Ollama models were reported by /api/tags."
                : undefined)
    };
}
async function listOllamaModelNames(baseUrl) {
    const response = await fetch(new URL("api/tags", withTrailingSlash(baseUrl)), {
        method: "GET"
    });
    if (!response.ok) {
        return [];
    }
    const data = (await response.json());
    if (!isRecord(data) || !Array.isArray(data.models)) {
        return [];
    }
    return data.models
        .filter(isRecord)
        .map((model) => model.name)
        .filter((name) => typeof name === "string" && name.length > 0);
}
async function requestDesktopApproval(approvalManager, request) {
    const retry = desktopRetryMetadata(request);
    const decision = await approvalManager.request({
        detail: request.detail,
        kind: "tool",
        metadata: {
            action: request.action,
            actionLabel: request.summary,
            actionType: request.action.type,
            riskLevel: request.risk,
            source: "core-desktop",
            toolArgs: retry.args,
            toolName: retry.toolName
        },
        resource: request.resource,
        safetyLevel: request.risk,
        scope: "full-machine",
        summary: request.summary
    });
    return {
        approved: decision.approved,
        id: decision.request.id,
        reason: decision.approved ? undefined : `Approval required: ${decision.request.id}`
    };
}
function desktopRetryMetadata(request) {
    const action = request.action;
    if (/^Close app /i.test(request.summary)) {
        return {
            args: {
                app: action.target?.app ?? request.resource ?? ""
            },
            toolName: "app_close"
        };
    }
    if (/^Write desktop clipboard/i.test(request.summary)) {
        return {
            args: {
                text: action.text ?? ""
            },
            toolName: "clipboard_write"
        };
    }
    if (/^Read desktop clipboard/i.test(request.summary)) {
        return {
            args: {},
            toolName: "clipboard_read"
        };
    }
    if (action.type === "open_app") {
        return {
            args: {
                app: action.target?.app ?? action.text ?? request.resource ?? ""
            },
            toolName: "app_open"
        };
    }
    if (action.type === "focus" && action.target?.kind === "window") {
        return {
            args: {
                windowId: action.target.windowId ?? request.resource ?? ""
            },
            toolName: "window_focus"
        };
    }
    if (action.type === "focus" && action.target?.kind === "app") {
        return {
            args: {
                app: action.target.app ?? request.resource ?? ""
            },
            toolName: "app_focus"
        };
    }
    if (action.type === "focus" && action.target?.kind === "coordinate") {
        return {
            args: {
                x: action.target.x,
                y: action.target.y
            },
            toolName: "mouse_move"
        };
    }
    if (action.type === "click" && action.target?.kind === "coordinate") {
        return {
            args: {
                x: action.target.x,
                y: action.target.y
            },
            toolName: "mouse_click"
        };
    }
    if (action.type === "type") {
        return {
            args: {
                text: action.text ?? ""
            },
            toolName: "keyboard_type"
        };
    }
    if (action.type === "keypress") {
        if (action.keys && action.keys.length > 0) {
            return {
                args: {
                    keys: action.keys
                },
                toolName: "keyboard_hotkey"
            };
        }
        return {
            args: {
                key: action.text ?? ""
            },
            toolName: "keyboard_press"
        };
    }
    if (action.type === "scroll") {
        return {
            args: {
                clicks: action.target?.y ?? Number(action.text ?? -3)
            },
            toolName: "mouse_scroll"
        };
    }
    return {
        args: {
            action
        },
        toolName: "desktop_act"
    };
}
function readDesktopVisionAuth(getModelConfig) {
    if (!getModelConfig) {
        return undefined;
    }
    try {
        const config = getModelConfig();
        if (config.provider === "mistral") {
            return {
                mistralApiKey: config.apiKey,
                mistralBaseUrl: config.baseUrl,
                mistralModel: config.model
            };
        }
        if (config.provider === "ollama") {
            return {
                ollamaBaseUrl: config.baseUrl,
                ollamaModel: config.model
            };
        }
        if (config.provider === "local") {
            if (config.transport === "ollama") {
                return {
                    ollamaBaseUrl: config.baseUrl,
                    ollamaModel: config.model
                };
            }
            return {
                localBaseUrl: config.baseUrl,
                localModel: config.model
            };
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
function tool(name, description, properties, execute, required = []) {
    return {
        execute,
        tool: {
            description,
            id: `core::${name}`,
            inputSchema: {
                additionalProperties: false,
                properties,
                required,
                type: "object"
            },
            name,
            originalName: name,
            owner: "core",
            source: "core"
        }
    };
}
async function runStructured(operation, format) {
    try {
        const structuredContent = await operation();
        return {
            content: format
                ? format(structuredContent)
                : JSON.stringify(structuredContent, null, 2),
            isError: false,
            structuredContent
        };
    }
    catch (error) {
        return {
            content: error instanceof Error ? error.message : String(error),
            isError: true
        };
    }
}
async function actionResult(operation) {
    try {
        const structuredContent = await operation();
        return {
            content: formatActionResult(structuredContent),
            isError: !structuredContent.ok,
            structuredContent
        };
    }
    catch (error) {
        return {
            content: error instanceof Error ? error.message : String(error),
            isError: true
        };
    }
}
function formatDesktopRunResult(controller, result) {
    void controller;
    return [
        `Desktop task: ${result.done ? "complete" : "not complete"}`,
        `Watcher: ${result.watcher.id} (${result.watcher.state})`,
        result.actions.length > 0
            ? result.actions.map((action) => formatActionResult(action)).join("\n")
            : "No desktop actions were executed.",
        result.observation ? summarizeObservation(result.observation) : undefined
    ]
        .filter((line) => Boolean(line))
        .join("\n");
}
function stringProp(description) {
    return {
        description,
        type: "string"
    };
}
function numberProp(description) {
    return {
        description,
        type: "number"
    };
}
function booleanProp(description) {
    return {
        description,
        type: "boolean"
    };
}
function readString(value, name) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string.`);
    }
    return value.trim();
}
function readOptionalString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function readNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number.`);
    }
    return value;
}
function readOptionalNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function readStringArray(value, name) {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
        throw new Error(`${name} must be an array of strings.`);
    }
    return value;
}
function withTrailingSlash(value) {
    return value.endsWith("/") ? value : `${value}/`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=desktop-core-tools.js.map