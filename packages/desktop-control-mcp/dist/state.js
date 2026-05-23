import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isRecord } from "./utils.js";
export function defaultStatePath() {
    const root = process.env.CHATGPT_CODE_STATE_DIR?.trim() ||
        join(homedir(), ".chatgpt-code");
    return join(root, "desktop-control-state.json");
}
export async function loadDesktopState(path = defaultStatePath()) {
    try {
        const parsed = JSON.parse(await readFile(path, "utf8"));
        if (!isRecord(parsed)) {
            return createDefaultDesktopState();
        }
        return {
            config: parseConfig(parsed.config),
            lastStatus: isRecord(parsed.lastStatus)
                ? parsed.lastStatus
                : undefined
        };
    }
    catch {
        return createDefaultDesktopState();
    }
}
export async function saveDesktopState(state, path = defaultStatePath()) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
export function createDefaultDesktopState() {
    return {
        config: {
            allowedApps: readCsvEnv("CHATGPT_CODE_DESKTOP_ALLOWED_APPS"),
            blockedApps: readCsvEnv("CHATGPT_CODE_DESKTOP_BLOCKED_APPS"),
            mode: parseMode(process.env.CHATGPT_CODE_DESKTOP_MODE) ?? "approve",
            useAccessibilityFirst: process.env.CHATGPT_CODE_DESKTOP_ACCESSIBILITY_FIRST !== "0",
            visionFallback: process.env.CHATGPT_CODE_DESKTOP_VISION_FALLBACK !== "0",
            visionModel: process.env.CHATGPT_CODE_DESKTOP_VISION_MODEL?.trim() ||
                process.env.CHATGPT_CODE_MISTRAL_VISION_MODEL?.trim() ||
                undefined,
            visionProvider: parseVisionProvider(process.env.CHATGPT_CODE_DESKTOP_VISION_PROVIDER) ??
                "mistral"
        }
    };
}
function parseConfig(value) {
    const fallback = createDefaultDesktopState().config;
    if (!isRecord(value)) {
        return fallback;
    }
    return {
        allowedApps: parseStringList(value.allowedApps),
        blockedApps: parseStringList(value.blockedApps),
        mode: parseMode(value.mode) ?? fallback.mode,
        useAccessibilityFirst: typeof value.useAccessibilityFirst === "boolean"
            ? value.useAccessibilityFirst
            : fallback.useAccessibilityFirst,
        visionFallback: typeof value.visionFallback === "boolean"
            ? value.visionFallback
            : fallback.visionFallback,
        visionModel: typeof value.visionModel === "string" && value.visionModel.trim().length > 0
            ? value.visionModel.trim()
            : fallback.visionModel,
        visionProvider: parseVisionProvider(value.visionProvider) ?? fallback.visionProvider
    };
}
export function parseMode(value) {
    return value === "readonly" ||
        value === "assistive" ||
        value === "approve" ||
        value === "autopilot"
        ? value
        : undefined;
}
export function parseVisionProvider(value) {
    return value === "mistral" || value === "ollama" || value === "local"
        ? value
        : undefined;
}
function parseStringList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function readCsvEnv(key) {
    const raw = process.env[key];
    if (!raw) {
        return [];
    }
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
//# sourceMappingURL=state.js.map