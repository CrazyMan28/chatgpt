import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandExists, firstAvailable, isRecord, listAvailableCommands, readOptionalString, runCommand, runShell, shellQuote } from "./utils.js";
const DESKTOP_COMMANDS = [
    "spectacle",
    "grim",
    "gnome-screenshot",
    "import",
    "scrot",
    "wmctrl",
    "xdotool",
    "qdbus",
    "xclip",
    "xsel",
    "wl-copy",
    "wl-paste",
    "wtype",
    "flatpak",
    "gtk-launch",
    "xdg-open",
    "python3"
];
export class LinuxDesktopDriver {
    async getEnvironment() {
        return {
            availableCommands: await listAvailableCommands(DESKTOP_COMMANDS),
            desktopSession: process.env.DESKTOP_SESSION,
            display: process.env.DISPLAY,
            platform: process.platform,
            waylandDisplay: process.env.WAYLAND_DISPLAY,
            xdgCurrentDesktop: process.env.XDG_CURRENT_DESKTOP,
            xdgSessionType: process.env.XDG_SESSION_TYPE
        };
    }
    async screenshot() {
        const environment = await this.getEnvironment();
        const directory = join(tmpdir(), "chatgpt-code-desktop");
        await mkdir(directory, { recursive: true });
        const path = join(directory, `screen-${Date.now()}.png`);
        const activeWindow = await this.activeWindow().catch(() => undefined);
        const attempts = [
            {
                command: "spectacle",
                args: ["-b", "-n", "-o", path],
                install: "sudo dnf install spectacle"
            },
            {
                command: "grim",
                args: [path],
                install: "sudo dnf install grim"
            },
            {
                command: "gnome-screenshot",
                args: ["-f", path],
                install: "sudo dnf install gnome-screenshot"
            },
            {
                command: "import",
                args: ["-window", "root", path],
                install: "sudo dnf install ImageMagick"
            },
            {
                command: "scrot",
                args: [path],
                install: "sudo dnf install scrot"
            }
        ];
        const errors = [];
        for (const attempt of attempts) {
            if (!(await commandExists(attempt.command))) {
                errors.push(`${attempt.command}: missing (${attempt.install})`);
                continue;
            }
            const result = await runCommand(attempt.command, attempt.args, {
                timeoutMs: 15_000
            }).catch((error) => {
                errors.push(`${attempt.command}: ${readError(error)}`);
                return undefined;
            });
            if (!result) {
                continue;
            }
            if (result.code !== 0) {
                errors.push(`${attempt.command}: exit ${result.code}${result.stderr ? `: ${result.stderr}` : ""}`);
                continue;
            }
            const metadata = await stat(path).catch(() => undefined);
            if (!metadata || metadata.size === 0) {
                errors.push(`${attempt.command}: did not create a non-empty screenshot`);
                continue;
            }
            const dimensions = await readPngDimensions(path);
            return {
                activeWindow,
                capturedAt: Date.now(),
                command: result.command,
                environment,
                height: dimensions?.height,
                mimeType: "image/png",
                path,
                sizeBytes: metadata.size,
                width: dimensions?.width
            };
        }
        throw new Error([
            "Screenshot capture is unavailable on this Linux desktop.",
            "Tried: spectacle, grim, gnome-screenshot, ImageMagick import, scrot.",
            "On Fedora/KDE install Spectacle with: sudo dnf install spectacle.",
            `Details: ${errors.join(" | ")}`
        ].join("\n"));
    }
    async listWindows() {
        if (!(await commandExists("wmctrl"))) {
            return this.listWindowsFromAccessibility();
        }
        const result = await runCommand("wmctrl", ["-l", "-G", "-p"], {
            timeoutMs: 5_000
        });
        if (result.code !== 0) {
            throw new Error(`Window listing failed with wmctrl: ${result.stderr || "unknown error"}`);
        }
        const activeId = await readActiveWindowId().catch(() => undefined);
        return result.stdout
            .split(/\r?\n/)
            .map((line) => parseWmctrlLine(line, activeId))
            .filter((entry) => entry !== undefined);
    }
    async listWindowsFromAccessibility() {
        const tree = await this.accessibilityTree({
            maxChildren: 80,
            maxDepth: 2
        }).catch(() => undefined);
        if (!tree?.root?.children) {
            return [];
        }
        const active = await this.activeWindow().catch(() => undefined);
        const windows = [];
        for (const app of tree.root.children) {
            const frames = (app.children ?? []).filter((child) => {
                const role = child.role?.toLowerCase() ?? "";
                return role.includes("frame") || role.includes("window") || role.includes("dialog");
            });
            if (frames.length === 0 && app.name) {
                windows.push({
                    app: app.name,
                    bounds: app.bounds,
                    id: app.id,
                    isActive: active ? active.title === app.name : undefined,
                    title: app.name
                });
                continue;
            }
            for (const frame of frames) {
                const title = frame.name || app.name || frame.role || frame.id;
                windows.push({
                    app: app.name,
                    bounds: frame.bounds,
                    id: frame.id,
                    isActive: active ? title === active.title : undefined,
                    title
                });
            }
        }
        return windows;
    }
    async activeWindow() {
        const activeId = await readActiveWindowId().catch(() => undefined);
        if (activeId && (await commandExists("xdotool"))) {
            const titleResult = await runCommand("xdotool", ["getwindowname", String(Number.parseInt(activeId, 16))], { timeoutMs: 5_000 }).catch(() => undefined);
            return {
                id: activeId,
                isActive: true,
                title: titleResult?.stdout.trim() || activeId
            };
        }
        if (activeId && (await commandExists("wmctrl"))) {
            const result = await runCommand("wmctrl", ["-l", "-G", "-p"], {
                timeoutMs: 5_000
            }).catch(() => undefined);
            if (result?.code === 0) {
                return result.stdout
                    .split(/\r?\n/)
                    .map((line) => parseWmctrlLine(line, activeId))
                    .find((window) => window?.isActive === true);
            }
        }
        return undefined;
    }
    async focusWindow(windowId) {
        if (await commandExists("wmctrl")) {
            const result = await runCommand("wmctrl", ["-ia", windowId], {
                timeoutMs: 5_000
            });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || `wmctrl could not focus ${windowId}.`);
        }
        throw new Error("Window focus requires wmctrl on this desktop. Install it with: sudo dnf install wmctrl");
    }
    async closeWindow(windowId) {
        if (await commandExists("wmctrl")) {
            const result = await runCommand("wmctrl", ["-ic", windowId], {
                timeoutMs: 5_000
            });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || `wmctrl could not close ${windowId}.`);
        }
        throw new Error("Window close requires wmctrl on this desktop. Install it with: sudo dnf install wmctrl");
    }
    async listApps() {
        const running = await runShell("ps -eo comm= | sort -u | head -500", {
            timeoutMs: 5_000
        }).catch(() => undefined);
        const installed = await listInstalledDesktopApps().catch(() => []);
        if (!running || running.code !== 0) {
            if (installed.length > 0) {
                return installed;
            }
            throw new Error(running?.stderr || "Unable to list running or installed apps.");
        }
        return [
            ...installed,
            ...running.stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        ]
            .filter((value, index, values) => values.indexOf(value) === index)
            .slice(0, 800);
    }
    async openApp(app) {
        const candidates = await resolveAppCandidates(app);
        const errors = [];
        for (const candidate of candidates) {
            if (candidate.desktopId && (await commandExists("gtk-launch"))) {
                if (!(await desktopIdExists(candidate.desktopId))) {
                    errors.push(`gtk-launch ${candidate.desktopId}: desktop file not found`);
                    continue;
                }
                const launchId = candidate.desktopId.endsWith(".desktop")
                    ? candidate.desktopId.slice(0, -8)
                    : candidate.desktopId;
                const result = await runCommand("gtk-launch", [launchId], {
                    timeoutMs: 3_000
                }).catch((error) => {
                    errors.push(`gtk-launch ${launchId}: ${readError(error)}`);
                    return undefined;
                });
                if (result && result.code === 0) {
                    return {
                        app,
                        command: `gtk-launch ${launchId}`
                    };
                }
                if (result) {
                    errors.push(`gtk-launch ${launchId}: ${result.stderr || `exit ${result.code}`}`);
                }
            }
            if (candidate.command && (await commandExists(candidate.command))) {
                const child = spawn(candidate.command, candidate.args ?? [], {
                    detached: true,
                    stdio: "ignore"
                });
                child.unref();
                return {
                    app,
                    command: [candidate.command, ...(candidate.args ?? [])].join(" ")
                };
            }
        }
        const suggestions = await suggestInstalledApps(app).catch(() => []);
        throw new Error([
            "App not found.",
            `Tried: ${formatAppCandidates(candidates)}`,
            suggestions.length > 0
                ? `Suggested installed apps: ${suggestions.join(", ")}`
                : "Suggested installed apps: none found",
            errors.length > 0 ? `Details: ${errors.join(" | ")}` : undefined
        ]
            .filter((line) => Boolean(line))
            .join("\n"));
    }
    async openUrl(url) {
        if (!(await commandExists("xdg-open"))) {
            throw new Error("Opening browser URLs requires xdg-open.");
        }
        const result = await runCommand("xdg-open", [url], {
            timeoutMs: 5_000
        });
        if (result.code !== 0) {
            throw new Error(result.stderr || `xdg-open failed for ${url}.`);
        }
        return {
            command: result.command,
            url
        };
    }
    async closeApp(app) {
        const normalized = app.trim();
        if (normalized.length === 0) {
            throw new Error("app is required.");
        }
        const result = await runCommand("pkill", ["-x", normalized], {
            timeoutMs: 5_000
        });
        if (result.code !== 0) {
            throw new Error(result.stderr || `No process named "${normalized}" was closed.`);
        }
    }
    async accessibilityTree(input = {}) {
        return runAccessibilityScript({
            maxChildren: input.maxChildren ?? 40,
            maxDepth: input.maxDepth ?? 5,
            op: "tree"
        });
    }
    async accessibilityFocused() {
        return runAccessibilityScript({
            maxChildren: 0,
            maxDepth: 8,
            op: "focused"
        });
    }
    async accessibilityClick(elementId) {
        return runAccessibilityAction("click", elementId);
    }
    async accessibilityFocus(elementId) {
        return runAccessibilityAction("focus", elementId);
    }
    async mouseMove(x, y) {
        if (await commandExists("xdotool")) {
            const result = await runCommand("xdotool", ["mousemove", String(x), String(y)], {
                timeoutMs: 5_000
            });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "xdotool mousemove failed.");
        }
        throw new Error("Raw mouse movement requires xdotool under X11. Wayland desktops usually block synthetic pointer input unless ydotool/dotool is installed and configured.");
    }
    async mouseClick(x, y, button = 1) {
        if (await commandExists("xdotool")) {
            const result = await runCommand("xdotool", ["mousemove", String(x), String(y), "click", String(button)], { timeoutMs: 5_000 });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "xdotool click failed.");
        }
        throw new Error("Raw mouse click requires xdotool under X11. On Wayland, prefer accessibility actions or configure a trusted input tool such as ydotool.");
    }
    async mouseDoubleClick(x, y) {
        await this.mouseClick(x, y, 1);
        await this.mouseClick(x, y, 1);
    }
    async mouseDrag(x1, y1, x2, y2) {
        if (await commandExists("xdotool")) {
            const result = await runCommand("xdotool", [
                "mousemove",
                String(x1),
                String(y1),
                "mousedown",
                "1",
                "mousemove",
                String(x2),
                String(y2),
                "mouseup",
                "1"
            ], { timeoutMs: 8_000 });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "xdotool drag failed.");
        }
        throw new Error("Raw drag requires xdotool under X11.");
    }
    async mouseScroll(clicks) {
        if (await commandExists("xdotool")) {
            const direction = clicks < 0 ? "5" : "4";
            const count = Math.min(20, Math.abs(Math.trunc(clicks)));
            for (let index = 0; index < count; index += 1) {
                const result = await runCommand("xdotool", ["click", direction], {
                    timeoutMs: 5_000
                });
                if (result.code !== 0) {
                    throw new Error(result.stderr || "xdotool scroll failed.");
                }
            }
            return;
        }
        throw new Error("Raw scroll requires xdotool under X11.");
    }
    async keyboardType(text) {
        if (await commandExists("xdotool")) {
            const result = await runCommand("xdotool", ["type", "--clearmodifiers", "--", text], { timeoutMs: Math.max(5_000, Math.min(60_000, text.length * 80)) });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "xdotool type failed.");
        }
        if (await commandExists("wtype")) {
            const result = await runCommand("wtype", [text], {
                timeoutMs: Math.max(5_000, Math.min(60_000, text.length * 80))
            });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "wtype failed.");
        }
        throw new Error("Keyboard typing requires xdotool on X11 or wtype on Wayland. Install one with: sudo dnf install xdotool wtype");
    }
    async keyboardPress(key) {
        if (await commandExists("xdotool")) {
            const result = await runCommand("xdotool", ["key", key], {
                timeoutMs: 5_000
            });
            if (result.code === 0) {
                return;
            }
            throw new Error(result.stderr || "xdotool key failed.");
        }
        throw new Error("Key press currently requires xdotool under X11.");
    }
    async keyboardHotkey(keys) {
        if (keys.length === 0) {
            throw new Error("keys must not be empty.");
        }
        await this.keyboardPress(keys.join("+"));
    }
    async clipboardRead() {
        const command = await firstAvailable(["wl-paste", "xclip", "xsel"]);
        if (!command) {
            throw new Error("Clipboard read requires wl-paste, xclip, or xsel. Install with: sudo dnf install wl-clipboard xclip xsel");
        }
        const args = command === "xclip"
            ? ["-selection", "clipboard", "-o"]
            : command === "xsel"
                ? ["--clipboard", "--output"]
                : [];
        const result = await runCommand(command, args, { timeoutMs: 5_000 });
        if (result.code !== 0) {
            throw new Error(result.stderr || `${command} clipboard read failed.`);
        }
        return result.stdout;
    }
    async clipboardWrite(text) {
        const command = await firstAvailable(["wl-copy", "xclip", "xsel"]);
        if (!command) {
            throw new Error("Clipboard write requires wl-copy, xclip, or xsel. Install with: sudo dnf install wl-clipboard xclip xsel");
        }
        const args = command === "xclip"
            ? ["-selection", "clipboard"]
            : command === "xsel"
                ? ["--clipboard", "--input"]
                : [];
        const result = await runCommand(command, args, {
            input: text,
            timeoutMs: 5_000
        });
        if (result.code !== 0) {
            throw new Error(result.stderr || `${command} clipboard write failed.`);
        }
    }
}
function parseWmctrlLine(line, activeId) {
    const match = /^(0x[0-9a-fA-F]+)\s+\S+\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+\S+\s+(.*)$/.exec(line.trim());
    if (!match) {
        return undefined;
    }
    const [, id, x, y, width, height, pid, title] = match;
    const normalizedId = id.toLowerCase();
    return {
        bounds: {
            height: Number(height),
            width: Number(width),
            x: Number(x),
            y: Number(y)
        },
        id: normalizedId,
        isActive: activeId ? activeId.toLowerCase() === normalizedId : false,
        pid: Number(pid),
        title: title.trim()
    };
}
async function readActiveWindowId() {
    if (!(await commandExists("xdotool"))) {
        return undefined;
    }
    const idResult = await runCommand("xdotool", ["getactivewindow"], {
        timeoutMs: 5_000
    });
    if (idResult.code !== 0 || idResult.stdout.trim().length === 0) {
        return undefined;
    }
    const decimal = Number(idResult.stdout.trim());
    return Number.isFinite(decimal)
        ? `0x${decimal.toString(16).padStart(8, "0")}`.toLowerCase()
        : idResult.stdout.trim().toLowerCase();
}
async function listInstalledDesktopApps() {
    const dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        `${process.env.HOME ?? ""}/.local/share/applications`
    ].filter((dir) => dir.length > 0);
    const result = await runShell([
        "for dir in",
        dirs.map(shellQuote).join(" "),
        "; do",
        "[ -d \"$dir\" ] || continue;",
        "find \"$dir\" -maxdepth 1 -type f -name '*.desktop' -printf '%f\\n';",
        "done | sed 's/\\.desktop$//' | sort -u | head -500"
    ].join(" "), { timeoutMs: 5_000 });
    if (result.code !== 0) {
        return [];
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
async function readPngDimensions(path) {
    const buffer = await readFile(path).catch(() => undefined);
    if (!buffer || buffer.length < 24) {
        return undefined;
    }
    if (buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47) {
        return undefined;
    }
    return {
        height: buffer.readUInt32BE(20),
        width: buffer.readUInt32BE(16)
    };
}
async function resolveAppCandidates(app) {
    const normalized = app.trim().toLowerCase();
    const fallback = app.trim();
    const aliases = {
        browser: [
            { command: "xdg-open", args: ["about:blank"] },
            { command: "firefox" },
            { command: "google-chrome" },
            { command: "chromium" }
        ],
        chrome: [
            { command: "google-chrome" },
            { desktopId: "google-chrome" },
            { command: "chromium" },
            { desktopId: "chromium" },
            { command: "chromium-browser" }
        ],
        "google chrome": [
            { command: "google-chrome" },
            { desktopId: "google-chrome" },
            { command: "chromium" },
            { command: "chromium-browser" }
        ],
        calculator: [
            { command: "kcalc" },
            { desktopId: "org.kde.kcalc" },
            { command: "gnome-calculator" },
            { command: "qalculate-gtk" }
        ],
        firefox: [
            { command: "firefox" },
            { desktopId: "firefox" },
            { desktopId: "firefox.desktop" },
            { desktopId: "org.mozilla.firefox" },
            { command: "flatpak", args: ["run", "org.mozilla.firefox"] }
        ],
        editor: [
            { command: "kate" },
            { desktopId: "org.kde.kate" },
            { command: "kwrite" },
            { desktopId: "org.kde.kwrite" },
            { command: "gnome-text-editor" },
            { command: "gedit" },
            { command: "mousepad" }
        ],
        notes: [
            { command: "kate" },
            { command: "kwrite" },
            { command: "gedit" },
            { command: "xed" },
            { command: "mousepad" },
            { command: "obsidian" },
            { desktopId: "md.obsidian.Obsidian" },
            { command: "standardnotes" }
        ],
        "text editor": [
            { command: "kate" },
            { desktopId: "org.kde.kate" },
            { command: "kwrite" },
            { desktopId: "org.kde.kwrite" },
            { command: "gnome-text-editor" },
            { command: "gedit" },
            { command: "xed" },
            { command: "mousepad" },
            { command: "code" },
            { command: "codium" }
        ],
        terminal: [
            { command: "konsole" },
            { desktopId: "org.kde.konsole" },
            { command: "gnome-terminal" },
            { command: "kitty" },
            { command: "alacritty" },
            { command: "xterm" }
        ],
        "visual studio code": vscodeCandidates(),
        "vs code": vscodeCandidates(),
        vscode: vscodeCandidates()
    };
    const desktopMatches = await findDesktopCandidates(fallback);
    return dedupeAppCandidates([
        ...(aliases[normalized] ?? []),
        ...desktopMatches,
        { desktopId: fallback },
        fallback.endsWith(".desktop") ? { desktopId: fallback.slice(0, -8) } : undefined,
        { command: fallback }
    ]);
}
function vscodeCandidates() {
    return [
        { command: "code" },
        { command: "code-insiders" },
        { command: "codium" },
        { desktopId: "code" },
        { desktopId: "code.desktop" },
        { desktopId: "com.visualstudio.code" },
        { desktopId: "com.visualstudio.code-oss" }
    ];
}
async function findDesktopCandidates(app) {
    const normalized = normalizeAppName(app);
    const dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        `${process.env.HOME ?? ""}/.local/share/applications`
    ].filter((dir) => dir.length > 0);
    const candidates = [];
    for (const dir of dirs) {
        const files = await readdir(dir).catch(() => []);
        for (const file of files) {
            if (!file.endsWith(".desktop")) {
                continue;
            }
            const id = file.slice(0, -8);
            if (normalizeAppName(id).includes(normalized)) {
                candidates.push({ desktopId: id }, { desktopId: file });
            }
        }
    }
    return candidates;
}
async function desktopIdExists(desktopId) {
    const normalized = desktopId.endsWith(".desktop")
        ? desktopId
        : `${desktopId}.desktop`;
    const alternate = desktopId.endsWith(".desktop")
        ? desktopId.slice(0, -8)
        : desktopId;
    const dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        `${process.env.HOME ?? ""}/.local/share/applications`
    ].filter((dir) => dir.length > 0);
    for (const dir of dirs) {
        const files = await readdir(dir).catch(() => []);
        if (files.includes(normalized) || files.includes(alternate)) {
            return true;
        }
    }
    return false;
}
async function suggestInstalledApps(app) {
    const normalized = normalizeAppName(app);
    const installed = await listInstalledDesktopApps().catch(() => []);
    const filtered = installed.filter((entry) => {
        const candidate = normalizeAppName(entry);
        return candidate.includes(normalized) || normalized.includes(candidate);
    });
    return (filtered.length > 0 ? filtered : installed).slice(0, 8);
}
function dedupeAppCandidates(candidates) {
    const seen = new Set();
    const result = [];
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        const key = [
            candidate.desktopId ?? "",
            candidate.command ?? "",
            ...(candidate.args ?? [])
        ].join("|");
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(candidate);
    }
    return result;
}
function formatAppCandidates(candidates) {
    return [
        ...new Set(candidates.map((candidate) => candidate.desktopId ??
            [candidate.command, ...(candidate.args ?? [])].filter(Boolean).join(" ")))
    ]
        .filter((value) => value.length > 0)
        .join(", ");
}
function normalizeAppName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\.desktop$/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
async function runAccessibilityScript(input) {
    if (!(await commandExists("python3"))) {
        return {
            available: false,
            error: "python3 is required for AT-SPI accessibility inspection.",
            generatedAt: Date.now(),
            summary: "Accessibility unavailable: python3 is missing."
        };
    }
    const result = await runCommand("python3", ["-c", PYATSPI_SCRIPT, JSON.stringify(input)], { timeoutMs: 12_000 }).catch((error) => ({
        code: 1,
        command: "python3 -c <pyatspi>",
        stderr: readError(error),
        stdout: ""
    }));
    if (result.code !== 0) {
        return {
            available: false,
            error: result.stderr || "AT-SPI script failed.",
            generatedAt: Date.now(),
            summary: "Accessibility unavailable. Install python3-pyatspi and ensure the desktop accessibility bridge is enabled."
        };
    }
    const parsed = parseJsonObject(result.stdout);
    if (!parsed.ok) {
        const error = typeof parsed.error === "string"
            ? parsed.error
            : "AT-SPI accessibility is unavailable.";
        return {
            available: false,
            error,
            generatedAt: Date.now(),
            summary: `Accessibility unavailable: ${error}`
        };
    }
    const root = parseElement(parsed.root);
    const focused = parseElement(parsed.focused);
    return {
        available: true,
        focused,
        generatedAt: Date.now(),
        root,
        summary: input.op === "focused"
            ? focused
                ? `Focused element: ${formatElementLabel(focused)}`
                : "No focused accessible element was found."
            : root
                ? `Accessibility tree captured: ${countElements(root)} elements.`
                : "Accessibility tree was empty."
    };
}
async function runAccessibilityAction(action, elementId) {
    if (!(await commandExists("python3"))) {
        return {
            message: "python3 is required for AT-SPI accessibility actions.",
            ok: false
        };
    }
    const result = await runCommand("python3", [
        "-c",
        PYATSPI_SCRIPT,
        JSON.stringify({
            elementId,
            maxChildren: 0,
            maxDepth: 0,
            op: action
        })
    ], { timeoutMs: 8_000 }).catch((error) => ({
        code: 1,
        command: "python3 -c <pyatspi>",
        stderr: readError(error),
        stdout: ""
    }));
    if (result.code !== 0) {
        return {
            message: result.stderr || "AT-SPI action failed.",
            ok: false
        };
    }
    const parsed = parseJsonObject(result.stdout);
    return {
        bounds: parseBounds(parsed.bounds),
        message: typeof parsed.message === "string"
            ? parsed.message
            : typeof parsed.error === "string"
                ? parsed.error
                : undefined,
        ok: parsed.ok === true
    };
}
function parseJsonObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
function parseElement(value) {
    if (!isRecord(value) || typeof value.id !== "string") {
        return undefined;
    }
    const children = Array.isArray(value.children)
        ? value.children
            .map(parseElement)
            .filter((entry) => entry !== undefined)
        : undefined;
    return {
        actions: Array.isArray(value.actions)
            ? value.actions.filter((entry) => typeof entry === "string")
            : [],
        app: readOptionalString(value.app),
        bounds: parseBounds(value.bounds),
        children,
        description: readOptionalString(value.description),
        id: value.id,
        name: readOptionalString(value.name),
        role: readOptionalString(value.role),
        states: Array.isArray(value.states)
            ? value.states.filter((entry) => typeof entry === "string")
            : [],
        value: readOptionalString(value.value)
    };
}
function parseBounds(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const x = Number(value.x);
    const y = Number(value.y);
    const width = Number(value.width);
    const height = Number(value.height);
    if (![x, y, width, height].every(Number.isFinite)) {
        return undefined;
    }
    return { height, width, x, y };
}
function countElements(element) {
    return 1 + (element.children ?? []).reduce((sum, child) => sum + countElements(child), 0);
}
function formatElementLabel(element) {
    return [element.role, element.name].filter(Boolean).join(" ");
}
function readError(error) {
    return error instanceof Error ? error.message : String(error);
}
const PYATSPI_SCRIPT = String.raw `
import json
import sys

request = json.loads(sys.argv[1])

try:
    import pyatspi
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "error": "python3-pyatspi is unavailable: %s" % exc
    }))
    sys.exit(0)

def safe(call, default=None):
    try:
        return call()
    except Exception:
        return default

def role_name(obj):
    return safe(lambda: obj.getRoleName(), None) or safe(lambda: str(obj.getRole()), None)

def states(obj):
    state_set = safe(lambda: obj.getState(), None)
    if state_set is None:
        return []
    result = []
    for name in [
        "active", "armed", "busy", "checked", "editable", "enabled",
        "expandable", "expanded", "focusable", "focused", "modal",
        "pressed", "sensitive", "selected", "showing", "visible"
    ]:
        constant = safe(lambda n=name: getattr(pyatspi, "STATE_" + n.upper()), None)
        if constant is not None and safe(lambda c=constant: state_set.contains(c), False):
            result.append(name)
    return result

def bounds(obj):
    component = safe(lambda: obj.queryComponent(), None)
    if component is None:
        return None
    extents = safe(lambda: component.getExtents(pyatspi.DESKTOP_COORDS), None)
    if extents is None:
        return None
    return {
        "x": int(extents.x),
        "y": int(extents.y),
        "width": int(extents.width),
        "height": int(extents.height)
    }

def actions(obj):
    action = safe(lambda: obj.queryAction(), None)
    if action is None:
        return []
    count = safe(lambda: action.nActions, None)
    if count is None:
        count = safe(lambda: action.getNActions(), 0)
    result = []
    for index in range(0, int(count or 0)):
        name = safe(lambda i=index: action.getName(i), None)
        if name:
            result.append(name)
    return result

def text_value(obj):
    text = safe(lambda: obj.queryText(), None)
    if text is not None:
        count = safe(lambda: text.characterCount, 0) or 0
        if count > 0:
            return safe(lambda: text.getText(0, min(count, 240)), None)
    value = safe(lambda: obj.queryValue(), None)
    if value is not None:
        current = safe(lambda: value.currentValue, None)
        if current is not None:
            return str(current)
    return None

def child_count(obj):
    return safe(lambda: obj.childCount, None) or safe(lambda: obj.getChildCount(), 0) or 0

def child_at(obj, index):
    return safe(lambda: obj.getChildAtIndex(index), None)

def node(obj, path, depth, app_name):
    item = {
        "id": path,
        "role": role_name(obj),
        "name": safe(lambda: obj.name, None),
        "description": safe(lambda: obj.description, None),
        "value": text_value(obj),
        "bounds": bounds(obj),
        "states": states(obj),
        "actions": actions(obj),
        "app": app_name,
        "children": []
    }
    if depth <= 0:
        return item
    count = min(child_count(obj), int(request.get("maxChildren") or 40))
    for index in range(0, count):
        child = child_at(obj, index)
        if child is not None:
            item["children"].append(node(child, path + "/" + str(index), depth - 1, app_name))
    return item

def resolve(desktop, element_id):
    parts = [int(part) for part in element_id.split("/") if part != ""]
    obj = desktop
    for part in parts:
        obj = child_at(obj, part)
        if obj is None:
            return None
    return obj

def find_focused(item):
    if "focused" in item.get("states", []):
        return item
    for child in item.get("children", []):
        found = find_focused(child)
        if found:
            return found
    return None

desktop = pyatspi.Registry.getDesktop(0)
op = request.get("op")

if op in ("click", "focus"):
    element = resolve(desktop, request.get("elementId", ""))
    if element is None:
        print(json.dumps({"ok": False, "error": "Accessible element was not found."}))
        sys.exit(0)
    if op == "focus":
        component = safe(lambda: element.queryComponent(), None)
        if component is not None and safe(lambda: component.grabFocus(), False):
            print(json.dumps({"ok": True, "message": "Focused accessible element.", "bounds": bounds(element)}))
            sys.exit(0)
        print(json.dumps({"ok": False, "message": "Accessible element does not support focus.", "bounds": bounds(element)}))
        sys.exit(0)
    action = safe(lambda: element.queryAction(), None)
    if action is not None:
        names = actions(element)
        preferred = ["click", "press", "activate", "jump", "open"]
        for wanted in preferred:
            for index, name in enumerate(names):
                if wanted in name.lower():
                    if safe(lambda i=index: action.doAction(i), False):
                        print(json.dumps({"ok": True, "message": "Ran accessibility action %s." % name, "bounds": bounds(element)}))
                        sys.exit(0)
        if names and safe(lambda: action.doAction(0), False):
            print(json.dumps({"ok": True, "message": "Ran accessibility action %s." % names[0], "bounds": bounds(element)}))
            sys.exit(0)
    print(json.dumps({"ok": False, "message": "Accessible element has no usable click action.", "bounds": bounds(element)}))
    sys.exit(0)

max_depth = int(request.get("maxDepth") or 5)
root = {"id": "", "role": "desktop", "name": "desktop", "states": [], "actions": [], "children": []}
count = child_count(desktop)
for index in range(0, count):
    app = child_at(desktop, index)
    if app is not None:
        app_name = safe(lambda a=app: a.name, None)
        root["children"].append(node(app, str(index), max_depth, app_name))

focused = find_focused(root)
print(json.dumps({"ok": True, "root": root, "focused": focused}))
`;
//# sourceMappingURL=linux.js.map