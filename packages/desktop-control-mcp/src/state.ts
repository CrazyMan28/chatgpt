import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type {
  DesktopConfig,
  DesktopMode,
  DesktopStatus,
  VisionProviderName
} from "./types.js";
import { isRecord } from "./utils.js";

export interface DesktopState {
  config: DesktopConfig;
  lastStatus?: Partial<DesktopStatus>;
}

export function defaultStatePath(): string {
  const root =
    process.env.CHATGPT_CODE_STATE_DIR?.trim() ||
    join(homedir(), ".chatgpt-code");

  return join(root, "desktop-control-state.json");
}

export async function loadDesktopState(path = defaultStatePath()): Promise<DesktopState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

    if (!isRecord(parsed)) {
      return createDefaultDesktopState();
    }

    return {
      config: parseConfig(parsed.config),
      lastStatus: isRecord(parsed.lastStatus)
        ? (parsed.lastStatus as Partial<DesktopStatus>)
        : undefined
    };
  } catch {
    return createDefaultDesktopState();
  }
}

export async function saveDesktopState(
  state: DesktopState,
  path = defaultStatePath()
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function createDefaultDesktopState(): DesktopState {
  return {
    config: {
      allowedApps: readCsvEnv("CHATGPT_CODE_DESKTOP_ALLOWED_APPS"),
      blockedApps: readCsvEnv("CHATGPT_CODE_DESKTOP_BLOCKED_APPS"),
      mode: parseMode(process.env.CHATGPT_CODE_DESKTOP_MODE) ?? "approve",
      useAccessibilityFirst:
        process.env.CHATGPT_CODE_DESKTOP_ACCESSIBILITY_FIRST !== "0",
      visionFallback: process.env.CHATGPT_CODE_DESKTOP_VISION_FALLBACK !== "0",
      visionModel:
        process.env.CHATGPT_CODE_DESKTOP_VISION_MODEL?.trim() ||
        process.env.CHATGPT_CODE_MISTRAL_VISION_MODEL?.trim() ||
        undefined,
      visionProvider:
        parseVisionProvider(process.env.CHATGPT_CODE_DESKTOP_VISION_PROVIDER) ??
        "mistral"
    }
  };
}

function parseConfig(value: unknown): DesktopConfig {
  const fallback = createDefaultDesktopState().config;

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    allowedApps: parseStringList(value.allowedApps),
    blockedApps: parseStringList(value.blockedApps),
    mode: parseMode(value.mode) ?? fallback.mode,
    useAccessibilityFirst:
      typeof value.useAccessibilityFirst === "boolean"
        ? value.useAccessibilityFirst
        : fallback.useAccessibilityFirst,
    visionFallback:
      typeof value.visionFallback === "boolean"
        ? value.visionFallback
        : fallback.visionFallback,
    visionModel:
      typeof value.visionModel === "string" && value.visionModel.trim().length > 0
        ? value.visionModel.trim()
        : fallback.visionModel,
    visionProvider:
      parseVisionProvider(value.visionProvider) ?? fallback.visionProvider
  };
}

export function parseMode(value: unknown): DesktopMode | undefined {
  return value === "readonly" ||
    value === "assistive" ||
    value === "approve" ||
    value === "autopilot"
    ? value
    : undefined;
}

export function parseVisionProvider(value: unknown): VisionProviderName | undefined {
  return value === "mistral" || value === "ollama" || value === "local"
    ? value
    : undefined;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readCsvEnv(key: string): string[] {
  const raw = process.env[key];

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
