import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isModelProvider } from "../models/model-client.js";
const AUTH_CONFIG_PATH = ".chatgpt-code/auth.json";
const AUTH_SCHEMA_VERSION = 1;
const DEFAULT_LOCAL_MODEL = "mock-local";
export class JsonAuthStore {
    filePath;
    constructor(workspaceRoot = process.cwd()) {
        this.filePath = resolve(workspaceRoot, AUTH_CONFIG_PATH);
    }
    async load(fallback = createDefaultAuthConfig()) {
        try {
            const raw = await readFile(this.filePath, "utf8");
            const parsed = parseAuthConfig(JSON.parse(raw));
            emitAuthDebugLog(`Loaded auth config from ${this.filePath} with provider=${parsed.activeProvider} model=${parsed.providers[parsed.activeProvider]?.model ?? "unset"}`);
            return parsed;
        }
        catch (error) {
            if (!isMissingFileError(error)) {
                throw error;
            }
            emitAuthDebugLog(`Auth config missing at ${this.filePath}. Writing default provider=${fallback.activeProvider} model=${fallback.providers[fallback.activeProvider]?.model ?? "unset"}`);
            return this.save(fallback);
        }
    }
    async save(config) {
        const normalized = normalizeAuthConfig(config);
        const directoryPath = dirname(this.filePath);
        await mkdir(directoryPath, { recursive: true });
        const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, {
            encoding: "utf8",
            mode: 0o600
        });
        await rename(tempPath, this.filePath);
        emitAuthDebugLog(`Saved auth config to ${this.filePath} with provider=${normalized.activeProvider} model=${normalized.providers[normalized.activeProvider]?.model ?? "unset"}`);
        return normalized;
    }
}
export function createAuthConfigFromModelConfig(modelConfig) {
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
export function createDefaultAuthConfig() {
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
function parseAuthConfig(value) {
    if (!isRecord(value)) {
        return createDefaultAuthConfig();
    }
    const activeProvider = typeof value.activeProvider === "string" && isModelProvider(value.activeProvider)
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
        version: typeof value.version === "number" ? value.version : AUTH_SCHEMA_VERSION
    });
}
function parseProviderSettings(value) {
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
function normalizeAuthConfig(config) {
    const localSettings = config.providers.local;
    const normalizedProviders = {
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
function normalizeProviderSettings(settings) {
    const apiKey = normalizeOptionalString(settings.apiKey);
    const baseUrl = normalizeOptionalString(settings.baseUrl);
    const model = normalizeOptionalString(settings.model);
    return {
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(model ? { model } : {})
    };
}
function normalizeOptionalString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function isMissingFileError(error) {
    return isRecord(error) && error.code === "ENOENT";
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function assertNever(value) {
    throw new Error(`Unhandled auth bootstrap model: ${JSON.stringify(value)}`);
}
function emitAuthDebugLog(message) {
    if (process.env.CHATGPT_CODE_DEBUG !== "1") {
        return;
    }
    process.stderr.write(`[auth-store] ${message}\n`);
}
