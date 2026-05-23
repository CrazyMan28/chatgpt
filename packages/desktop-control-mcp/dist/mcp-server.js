import { createDesktopController, formatActionResult, formatDesktopStatus, parseAction, readDesktopMode, readToolBoolean, readToolNumber, readVisionProvider, summarizeAccessibilityTree, summarizeObservation } from "./controller.js";
import { isRecord, readNumber, readOptionalString, readString } from "./utils.js";
const controller = createDesktopController();
const TOOLS = [
    tool("screen.screenshot", "Capture a desktop screenshot and return metadata.", {}),
    tool("screen.describe", "Describe the current screenshot with the selected vision provider.", {
        prompt: stringProp("Optional vision prompt.")
    }),
    tool("screen.locate", "Locate a visible UI target using screenshot vision.", {
        target: stringProp("Text description of the UI target to locate.")
    }, ["target"]),
    tool("screen.compare", "Compare two screenshot paths with the selected vision provider.", {
        afterPath: stringProp("After screenshot PNG path."),
        beforePath: stringProp("Before screenshot PNG path."),
        prompt: stringProp("Optional comparison prompt.")
    }, ["beforePath", "afterPath"]),
    tool("screen.watch", "Start a progress-aware desktop screenshot watcher.", {
        intervalMs: numberProp("Optional watch interval in milliseconds."),
        taskId: stringProp("Optional task id."),
        taskSummary: stringProp("Optional watcher summary.")
    }),
    tool("window.list", "List visible windows where supported by the desktop session.", {}),
    tool("window.active", "Return the active window where supported.", {}),
    tool("window.focus", "Focus a window by id.", {
        windowId: stringProp("Window id from window.list.")
    }, ["windowId"]),
    tool("window.close", "Close a window by id after safety validation.", {
        windowId: stringProp("Window id from window.list.")
    }, ["windowId"]),
    tool("window.bounds", "Return window bounds by id.", {
        windowId: stringProp("Window id from window.list.")
    }, ["windowId"]),
    tool("app.open", "Open a desktop app using app-specific launchers where available.", {
        app: stringProp("App name, desktop id, or known alias such as calculator or text editor.")
    }, ["app"]),
    tool("app.close", "Close an app process by exact process name after dangerous-action approval.", {
        app: stringProp("Exact process/app name.")
    }, ["app"]),
    tool("app.list", "List running desktop app process names.", {}),
    tool("app.focus", "Focus a visible app window by title match.", {
        app: stringProp("App/window title text.")
    }, ["app"]),
    tool("accessibility.tree", "Inspect the AT-SPI accessibility tree.", {
        full: booleanProp("Return full JSON tree instead of summary."),
        maxDepth: numberProp("Maximum tree depth.")
    }),
    tool("accessibility.active", "Return active window plus focused accessibility summary.", {}),
    tool("accessibility.focused", "Return the focused accessible element.", {}),
    tool("accessibility.find", "Find accessible elements by name, text, role, app, or focus state.", {
        app: stringProp("Optional app name."),
        focused: booleanProp("Only focused element."),
        name: stringProp("Name/label query."),
        role: stringProp("Role query."),
        text: stringProp("Visible text query."),
        window: stringProp("Window query.")
    }),
    tool("accessibility.click", "Click an accessible element, falling back to its bounds if needed.", {
        elementId: stringProp("Element id from accessibility.tree/find.")
    }, ["elementId"]),
    tool("accessibility.focus", "Focus an accessible element.", {
        elementId: stringProp("Element id from accessibility.tree/find.")
    }, ["elementId"]),
    tool("accessibility.type", "Focus an accessible element and type text.", {
        elementId: stringProp("Element id from accessibility.tree/find."),
        text: stringProp("Text to type.")
    }, ["elementId", "text"]),
    tool("accessibility.action", "Run a named accessibility action. Currently maps to click/focus.", {
        action: stringProp("Action name, such as click, press, activate, or focus."),
        elementId: stringProp("Element id from accessibility.tree/find.")
    }, ["elementId", "action"]),
    tool("mouse.move", "Move the mouse pointer with raw coordinates after safety validation.", {
        x: numberProp("X coordinate."),
        y: numberProp("Y coordinate.")
    }, ["x", "y"]),
    tool("mouse.click", "Click raw screen coordinates after safety validation.", {
        button: numberProp("Mouse button, default 1."),
        x: numberProp("X coordinate."),
        y: numberProp("Y coordinate.")
    }, ["x", "y"]),
    tool("mouse.double_click", "Double click raw screen coordinates after safety validation.", {
        x: numberProp("X coordinate."),
        y: numberProp("Y coordinate.")
    }, ["x", "y"]),
    tool("mouse.drag", "Drag from one coordinate to another after safety validation.", {
        x1: numberProp("Start X."),
        x2: numberProp("End X."),
        y1: numberProp("Start Y."),
        y2: numberProp("End Y.")
    }, ["x1", "y1", "x2", "y2"]),
    tool("mouse.scroll", "Scroll the active desktop target after safety validation.", {
        clicks: numberProp("Positive scrolls up, negative scrolls down.")
    }, ["clicks"]),
    tool("keyboard.type", "Type text into the focused desktop target after safety validation.", {
        text: stringProp("Text to type.")
    }, ["text"]),
    tool("keyboard.press", "Press a key after safety validation.", {
        key: stringProp("Key name such as Return, Escape, or Ctrl+L.")
    }, ["key"]),
    tool("keyboard.hotkey", "Press a hotkey after safety validation.", {
        keys: {
            items: {
                type: "string"
            },
            type: "array"
        }
    }, ["keys"]),
    tool("clipboard.read", "Read clipboard text.", {}),
    tool("clipboard.write", "Write clipboard text after safety validation.", {
        text: stringProp("Text to write to clipboard.")
    }, ["text"]),
    tool("desktop.observe", "Observe active window, accessibility summary, window list, and screenshot metadata.", {
        accessibility: booleanProp("Include accessibility tree summary."),
        maxDepth: numberProp("Accessibility tree depth."),
        screenshot: booleanProp("Capture screenshot metadata.")
    }),
    tool("desktop.act", "Validate and execute a desktop action through app, accessibility, then raw fallback.", {
        action: {
            additionalProperties: true,
            type: "object"
        }
    }, ["action"]),
    tool("desktop.run_task", "Run a small progress-aware desktop task loop for simple app/open/type tasks.", {
        task: stringProp("Desktop task instruction.")
    }, ["task"]),
    tool("desktop.stop", "Stop active desktop loops/watchers.", {}),
    tool("desktop.status", "Return desktop control mode, safety state, watcher state, and vision config.", {}),
    tool("browser.open", "Open a URL or browser target, preferring app-level launch.", {
        url: stringProp("URL or browser target.")
    }, ["url"]),
    tool("browser.dom", "Report browser adapter availability.", {}),
    tool("browser.click_selector", "Click a browser selector if a browser adapter is available.", {
        selector: stringProp("CSS selector.")
    }, ["selector"]),
    tool("browser.type_selector", "Type into a browser selector if a browser adapter is available.", {
        selector: stringProp("CSS selector."),
        text: stringProp("Text to type.")
    }, ["selector", "text"]),
    tool("browser.screenshot", "Capture a browser screenshot using desktop screenshot fallback.", {}),
    tool("browser.current_url", "Report browser current URL if a browser adapter is available.", {})
];
export function runMcpServer() {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    process.stdin.on("data", (chunk) => {
        buffer += chunk;
        while (true) {
            const newlineIndex = buffer.indexOf("\n");
            if (newlineIndex === -1) {
                break;
            }
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line.length > 0) {
                void handleLine(line);
            }
        }
    });
}
async function handleLine(line) {
    let message;
    try {
        message = JSON.parse(line);
    }
    catch {
        return;
    }
    if (!isRecord(message)) {
        return;
    }
    const request = message;
    if (request.id === undefined || typeof request.method !== "string") {
        return;
    }
    try {
        switch (request.method) {
            case "initialize":
                sendResult(request.id, {
                    capabilities: {
                        tools: {
                            listChanged: false
                        }
                    },
                    protocolVersion: "2025-11-25",
                    serverInfo: {
                        name: "desktop-control",
                        version: "0.2.0"
                    }
                });
                return;
            case "tools/list":
                sendResult(request.id, {
                    tools: TOOLS
                });
                return;
            case "tools/call": {
                const params = isRecord(request.params) ? request.params : {};
                const name = readString(params.name, "name");
                const args = isRecord(params.arguments) ? params.arguments : {};
                const toolCallResult = await callTool(name, args).catch((error) => result({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error)
                }, error instanceof Error ? error.message : String(error), true));
                sendResult(request.id, toolCallResult);
                return;
            }
            default:
                sendError(request.id, -32601, `Unsupported MCP method: ${request.method}`);
        }
    }
    catch (error) {
        sendError(request.id, -32000, error instanceof Error ? error.message : String(error));
    }
}
async function callTool(name, input) {
    switch (name) {
        case "screen.screenshot":
            return result(await controller.screenshot());
        case "screen.describe":
            return result(await controller.describeScreen({
                prompt: readOptionalString(input.prompt)
            }));
        case "screen.locate":
            return result(await controller.locateOnScreen({
                target: readString(input.target, "target")
            }));
        case "screen.compare":
            return result(await controller.compareScreens({
                afterPath: readString(input.afterPath, "afterPath"),
                beforePath: readString(input.beforePath, "beforePath"),
                prompt: readOptionalString(input.prompt)
            }));
        case "screen.watch":
            return result(await controller.startWatch({
                intervalMs: typeof input.intervalMs === "number" ? readNumber(input.intervalMs, "intervalMs") : undefined,
                taskId: readOptionalString(input.taskId),
                taskSummary: readOptionalString(input.taskSummary)
            }));
        case "window.list":
            return result(await controller.listWindows());
        case "window.active":
            return result((await controller.activeWindow()) ?? null);
        case "window.focus":
            return actionResult(await controller.focusWindow(readString(input.windowId, "windowId")));
        case "window.close":
            return actionResult(await controller.closeWindow(readString(input.windowId, "windowId")));
        case "window.bounds": {
            const windowId = readString(input.windowId, "windowId");
            const windows = await controller.listWindows();
            return result(windows.find((window) => window.id === windowId)?.bounds ?? null);
        }
        case "app.open":
            return actionResult(await controller.openApp(readString(input.app, "app")));
        case "app.close":
            return actionResult(await controller.closeApp(readString(input.app, "app")));
        case "app.list":
            return result(await controller.listApps());
        case "app.focus":
            return actionResult(await controller.act({
                target: {
                    app: readString(input.app, "app"),
                    kind: "app"
                },
                type: "focus"
            }));
        case "accessibility.tree": {
            const tree = await controller.accessibilityTree({
                maxDepth: readToolNumber(input, "maxDepth", 5)
            });
            return result(tree, summarizeAccessibilityTree(tree, readToolBoolean(input, "full", false)));
        }
        case "accessibility.active":
            return result(await controller.observe({ accessibility: true, screenshot: false }));
        case "accessibility.focused":
            return result(await controller.accessibilityFocused());
        case "accessibility.find":
            return result(compactAccessibilityFindResult(await controller.accessibilityFind({
                app: readOptionalString(input.app),
                focused: typeof input.focused === "boolean" ? input.focused : undefined,
                name: readOptionalString(input.name),
                role: readOptionalString(input.role),
                text: readOptionalString(input.text),
                window: readOptionalString(input.window)
            })));
        case "accessibility.click":
            return actionResult(await controller.accessibilityClick(readString(input.elementId, "elementId")));
        case "accessibility.focus":
            return actionResult(await controller.accessibilityFocus(readString(input.elementId, "elementId")));
        case "accessibility.type":
            return actionResult(await controller.accessibilityType(readString(input.elementId, "elementId"), readString(input.text, "text")));
        case "accessibility.action": {
            const action = readString(input.action, "action").toLowerCase();
            return actionResult(action === "focus"
                ? await controller.accessibilityFocus(readString(input.elementId, "elementId"))
                : await controller.accessibilityClick(readString(input.elementId, "elementId")));
        }
        case "mouse.move":
            return actionResult(await controller.mouseMove(readNumber(input.x, "x"), readNumber(input.y, "y")));
        case "mouse.click":
            return actionResult(await controller.act({
                target: {
                    kind: "coordinate",
                    x: readNumber(input.x, "x"),
                    y: readNumber(input.y, "y")
                },
                type: "click"
            }));
        case "mouse.double_click": {
            const x = readNumber(input.x, "x");
            const y = readNumber(input.y, "y");
            return actionResult(await controller.mouseDoubleClick(x, y));
        }
        case "mouse.drag":
            return actionResult(await controller.act({
                target: {
                    kind: "coordinate",
                    x: readNumber(input.x1, "x1"),
                    y: readNumber(input.y1, "y1")
                },
                type: "drag",
                x2: readNumber(input.x2, "x2"),
                y2: readNumber(input.y2, "y2")
            }));
        case "mouse.scroll":
            return actionResult(await controller.act({
                target: {
                    kind: "coordinate",
                    y: readNumber(input.clicks, "clicks")
                },
                type: "scroll"
            }));
        case "keyboard.type":
            return actionResult(await controller.act({
                text: readString(input.text, "text"),
                type: "type"
            }));
        case "keyboard.press":
            return actionResult(await controller.act({
                text: readString(input.key, "key"),
                type: "keypress"
            }));
        case "keyboard.hotkey":
            return actionResult(await controller.act({
                keys: Array.isArray(input.keys)
                    ? input.keys.filter((entry) => typeof entry === "string")
                    : [],
                type: "keypress"
            }));
        case "clipboard.read":
            return actionResult(await controller.clipboardRead());
        case "clipboard.write":
            return actionResult(await controller.clipboardWrite(readString(input.text, "text")));
        case "desktop.observe": {
            const observation = await controller.observe({
                accessibility: readToolBoolean(input, "accessibility", true),
                maxDepth: readToolNumber(input, "maxDepth", 4),
                screenshot: readToolBoolean(input, "screenshot", true)
            });
            return result(compactObservation(observation), summarizeObservation(observation));
        }
        case "desktop.act":
            return actionResult(await controller.act(parseAction(input.action)));
        case "desktop.run_task":
            return result(await controller.runTask(readString(input.task, "task")));
        case "desktop.stop":
            return result(await controller.stop());
        case "desktop.status": {
            const status = await controller.status();
            return result(status, formatDesktopStatus(status));
        }
        case "browser.open":
            return actionResult(await controller.browserOpen(readString(input.url, "url")));
        case "browser.screenshot":
            return result(await controller.browserScreenshot());
        case "browser.dom":
        case "browser.click_selector":
        case "browser.type_selector":
        case "browser.current_url":
            return result(await controller.browserUnavailable(name), undefined, true);
        default:
            return result({
                ok: false,
                reason: `Unknown desktop-control tool: ${name}`
            }, `Unknown desktop-control tool: ${name}`, true);
    }
}
export async function runDesktopCli(command, input = {}) {
    return callTool(command, input);
}
function actionResult(action) {
    return result(action, formatActionResult(action), !action.ok);
}
function result(structuredContent, text, isError = false) {
    return {
        content: [
            {
                text: text ??
                    truncateForTool(typeof structuredContent === "string"
                        ? structuredContent
                        : JSON.stringify(structuredContent, null, 2)),
                type: "text"
            }
        ],
        isError,
        structuredContent
    };
}
function truncateForTool(value) {
    return value.length > 8_000 ? `${value.slice(0, 8_000)}\n... [truncated]` : value;
}
function compactObservation(observation) {
    return {
        ...observation,
        accessibility: observation.accessibility
            ? {
                available: observation.accessibility.available,
                error: observation.accessibility.error,
                focused: observation.accessibility.focused,
                generatedAt: observation.accessibility.generatedAt,
                summary: observation.accessibility.summary
            }
            : undefined
    };
}
function compactAccessibilityFindResult(input) {
    return {
        matches: input.matches,
        tree: {
            available: input.tree.available,
            error: input.tree.error,
            focused: input.tree.focused,
            generatedAt: input.tree.generatedAt,
            summary: input.tree.summary
        }
    };
}
function sendResult(id, value) {
    process.stdout.write(`${JSON.stringify({ id, jsonrpc: "2.0", result: value })}\n`);
}
function sendError(id, code, message) {
    process.stdout.write(`${JSON.stringify({
        error: {
            code,
            message
        },
        id,
        jsonrpc: "2.0"
    })}\n`);
}
function tool(name, description, properties, required = []) {
    return {
        description,
        inputSchema: {
            additionalProperties: false,
            properties,
            required,
            type: "object"
        },
        name
    };
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
export async function handleDesktopCommand(input) {
    switch (input.command) {
        case "desktop.mode": {
            const mode = readDesktopMode(input.args?.mode);
            const config = await controller.setMode(mode);
            return `Desktop mode set to ${config.mode}.`;
        }
        case "desktop.allow": {
            const config = await controller.allowApp(readString(input.args?.app, "app"));
            return `Allowed desktop apps: ${config.allowedApps.join(", ") || "all"}`;
        }
        case "desktop.block": {
            const config = await controller.blockApp(readString(input.args?.app, "app"));
            return `Blocked desktop apps: ${config.blockedApps.join(", ") || "none"}`;
        }
        case "vision.provider": {
            const config = await controller.setVisionProvider(readVisionProvider(input.args?.provider));
            return `Vision provider set to ${config.visionProvider}.`;
        }
        case "vision.model": {
            const config = await controller.setVisionModel(readString(input.args?.model, "model"));
            return `Vision model set to ${config.visionModel}.`;
        }
        default: {
            const response = await callTool(input.command, input.args ?? {});
            const content = response.content;
            if (Array.isArray(content) && isRecord(content[0]) && typeof content[0].text === "string") {
                return content[0].text;
            }
            return JSON.stringify(response, null, 2);
        }
    }
}
//# sourceMappingURL=mcp-server.js.map