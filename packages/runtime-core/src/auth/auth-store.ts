import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ModelConfig, ModelProvider } from "../models/model-client.js";
import { isModelProvider } from "../models/model-client.js";
import type { StoredProviderSettingsMap } from "../providers/provider-types.js";

const AUTH_CONFIG_PATH = ".chatgpt-code/auth.json";
const AUTH_SCHEMA_VERSION = 1;
const DEFAULT_LOCAL_MODEL = "mock-local";

export interface AuthConfigRecord {
  activeProvider: ModelProvider;
  providers: StoredProviderSettingsMap;
  version: number;
}

export interface AuthStore {
  load(fallback?: AuthConfigRecord): Promise<AuthConfigRecord>;
  save(config: AuthConfigRecord): Promise<AuthConfigRecord>;
}

export class JsonAuthStore implements AuthStore {
  private readonly filePath: string;

  constructor(workspaceRoot = process.cwd()) {
    this.filePath = resolve(workspaceRoot, AUTH_CONFIG_PATH);
  }

  async load(fallback = createDefaultAuthConfig()): Promise<AuthConfigRecord> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = parseAuthConfig(JSON.parse(raw) as unknown);

      emitAuthDebugLog(
        `Loaded auth config from ${this.filePath} with provider=${parsed.activeProvider} model=${parsed.providers[parsed.activeProvider]?.model ?? "unset"}`
      );

      return parsed;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }

      emitAuthDebugLog(
        `Auth config missing at ${this.filePath}. Writing default provider=${fallback.activeProvider} model=${fallback.providers[fallback.activeProvider]?.model ?? "unset"}`
      );
      return this.save(fallback);
    }
  }

  async save(config: AuthConfigRecord): Promise<AuthConfigRecord> {
    const normalized = normalizeAuthConfig(config);
    const directoryPath = dirname(this.filePath);

    await mkdir(directoryPath, { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(tempPath, this.filePath);

    emitAuthDebugLog(
      `Saved auth config to ${this.filePath} with provider=${normalized.activeProvider} model=${normalized.providers[normalized.activeProvider]?.model ?? "unset"}`
    );

    return normalized;
  }
}

export function createAuthConfigFromModelConfig(
  modelConfig: ModelConfig
): AuthConfigRecord {
  switch (modelConfig.provider) {
    case "local":
      return normalizeAuthConfig({
        activeProvider: "local",
        providers: {
          local: {
            baseUrl: modelConfig.baseUrl,
            model: modelConfig.model
          }
        },
        version: AUTH_SCHEMA_VERSION
      });
    case "openai":
      return normalizeAuthConfig({
        activeProvider: "openai",
        providers: {
          openai: {
            apiKey: modelConfig.apiKey,
            baseUrl: modelConfig.baseUrl,
            model: modelConfig.model
          }
        },
        version: AUTH_SCHEMA_VERSION
      });
    case "anthropic":
      return normalizeAuthConfig({
        activeProvider: "anthropic",
        providers: {
          anthropic: {
            apiKey: modelConfig.apiKey,
            baseUrl: modelConfig.baseUrl,
            model: modelConfig.model
          }
        },
        version: AUTH_SCHEMA_VERSION
      });
    case "mistral":
      return normalizeAuthConfig({
        activeProvider: "mistral",
        providers: {
          mistral: {
            apiKey: modelConfig.apiKey,
            baseUrl: modelConfig.baseUrl,
            model: modelConfig.model
          }
        },
        version: AUTH_SCHEMA_VERSION
      });
    default:
      return assertNever(modelConfig);
  }
}

export function createDefaultAuthConfig(): AuthConfigRecord {
  return normalizeAuthConfig({
    activeProvider: "local",
    providers: {
      local: {
        model: DEFAULT_LOCAL_MODEL
      }
    },
    version: AUTH_SCHEMA_VERSION
  });
}

function parseAuthConfig(value: unknown): AuthConfigRecord {
  if (!isRecord(value)) {
    return createDefaultAuthConfig();
  }

  const activeProvider =
    typeof value.activeProvider === "string" && isModelProvider(value.activeProvider)
    ? value.activeProvider
    : "local";

  return normalizeAuthConfig({
    activeProvider,
    providers: isRecord(value.providers)
      ? {
          local: parseProviderSettings(value.providers.local),
          openai: parseProviderSettings(value.providers.openai),
          anthropic: parseProviderSettings(value.providers.anthropic),
          mistral: parseProviderSettings(value.providers.mistral)
        }
      : {},
    version:
      typeof value.version === "number" ? value.version : AUTH_SCHEMA_VERSION
  });
}

function parseProviderSettings(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const apiKey = normalizeOptionalString(value.apiKey);
  const baseUrl = normalizeOptionalString(value.baseUrl);
  const model = normalizeOptionalString(value.model);

  if (!apiKey && !baseUrl && !model) {
    return undefined;
  }

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {})
  };
}

function normalizeAuthConfig(config: AuthConfigRecord): AuthConfigRecord {
  const localSettings = config.providers.local;
  const normalizedProviders: StoredProviderSettingsMap = {
    ...(localSettings
      ? {
          local: normalizeProviderSettings(localSettings)
        }
      : {}),
    ...(config.providers.openai
      ? {
          openai: normalizeProviderSettings(config.providers.openai)
        }
      : {}),
    ...(config.providers.anthropic
      ? {
          anthropic: normalizeProviderSettings(config.providers.anthropic)
        }
      : {}),
    ...(config.providers.mistral
      ? {
          mistral: normalizeProviderSettings(config.providers.mistral)
        }
      : {})
  };

  if (!normalizedProviders.local) {
    normalizedProviders.local = {
      model: DEFAULT_LOCAL_MODEL
    };
  }

  return {
    activeProvider: config.activeProvider,
    providers: normalizedProviders,
    version: AUTH_SCHEMA_VERSION
  };
}

function normalizeProviderSettings(
  settings: NonNullable<StoredProviderSettingsMap[ModelProvider]>
) {
  const apiKey = normalizeOptionalString(settings.apiKey);
  const baseUrl = normalizeOptionalString(settings.baseUrl);
  const model = normalizeOptionalString(settings.model);

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {})
  };
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled auth bootstrap model: ${JSON.stringify(value)}`);
}

function emitAuthDebugLog(message: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[auth-store] ${message}\n`);
}
