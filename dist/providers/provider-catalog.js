import { AnthropicModelClient } from "../models/anthropic-model.js";
import { MistralModelClient } from "../models/mistral-model.js";
import { MockModelClient } from "../models/mock-model.js";
import { OllamaModelClient } from "../models/ollama-model.js";
import { OpenAICompatibleModelClient } from "../models/openai-compatible-model.js";
const DEFAULT_LOCAL_MODEL = "mock-local";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OPENAI_MODELS = [
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" }
];
const ANTHROPIC_MODELS = [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1" },
    { id: "claude-haiku-3-5", label: "Claude Haiku 3.5" }
];
const MISTRAL_MODELS = [
    { id: "mistral-large-latest", label: "mistral-large" },
    { id: "mistral-medium-latest", label: "mistral-medium" },
    { id: "mistral-small-latest", label: "mistral-small" }
];
const FALLBACK_LOCAL_MODELS = [
    { id: DEFAULT_LOCAL_MODEL, label: "Mock Local" },
    { id: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B" },
    { id: "llama3.2", label: "Llama 3.2" }
];
const PROVIDER_DEFINITIONS = {
    local: {
        name: "local",
        label: "Local",
        requiresApiKey: false,
        defaultModel: DEFAULT_LOCAL_MODEL,
        async listModels(settings) {
            const baseUrl = normalizeOptionalValue(settings?.baseUrl) ?? DEFAULT_OLLAMA_BASE_URL;
            const discoveredModels = await loadOllamaModels(baseUrl);
            if (discoveredModels.length === 0) {
                return FALLBACK_LOCAL_MODELS;
            }
            return [
                FALLBACK_LOCAL_MODELS[0],
                ...discoveredModels.filter((model) => model.id !== DEFAULT_LOCAL_MODEL)
            ];
        },
        createConfig(settings) {
            const model = normalizeOptionalValue(settings?.model) ?? DEFAULT_LOCAL_MODEL;
            if (model === DEFAULT_LOCAL_MODEL) {
                return {
                    provider: "local",
                    model,
                    transport: "mock"
                };
            }
            return {
                provider: "local",
                model,
                transport: "ollama",
                baseUrl: normalizeOptionalValue(settings?.baseUrl) ?? DEFAULT_OLLAMA_BASE_URL
            };
        },
        createClient(config) {
            if (config.provider !== "local") {
                throw new Error(`Local provider cannot create client for ${config.provider}.`);
            }
            if (config.transport === "mock") {
                return new MockModelClient(config.model);
            }
            return new OllamaModelClient({
                ...config,
                baseUrl: config.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
                transport: "ollama"
            });
        }
    },
    openai: {
        name: "openai",
        label: "OpenAI",
        requiresApiKey: true,
        defaultModel: OPENAI_MODELS[0].id,
        async listModels() {
            return OPENAI_MODELS;
        },
        createConfig(settings) {
            const apiKey = normalizeOptionalValue(settings?.apiKey);
            if (!apiKey) {
                throw new Error("OpenAI login is required before using this provider.");
            }
            return {
                provider: "openai",
                model: normalizeOptionalValue(settings?.model) ?? OPENAI_MODELS[0].id,
                apiKey,
                baseUrl: normalizeOptionalValue(settings?.baseUrl) ?? DEFAULT_OPENAI_BASE_URL
            };
        },
        createClient(config) {
            if (config.provider !== "openai") {
                throw new Error(`OpenAI provider cannot create client for ${config.provider}.`);
            }
            return new OpenAICompatibleModelClient(config);
        }
    },
    anthropic: {
        name: "anthropic",
        label: "Anthropic",
        requiresApiKey: true,
        defaultModel: ANTHROPIC_MODELS[0].id,
        async listModels() {
            return ANTHROPIC_MODELS;
        },
        createConfig(settings) {
            const apiKey = normalizeOptionalValue(settings?.apiKey);
            if (!apiKey) {
                throw new Error("Anthropic login is required before using this provider.");
            }
            return {
                provider: "anthropic",
                model: normalizeOptionalValue(settings?.model) ?? ANTHROPIC_MODELS[0].id,
                apiKey,
                baseUrl: normalizeOptionalValue(settings?.baseUrl) ??
                    DEFAULT_ANTHROPIC_BASE_URL
            };
        },
        createClient(config) {
            if (config.provider !== "anthropic") {
                throw new Error(`Anthropic provider cannot create client for ${config.provider}.`);
            }
            return new AnthropicModelClient(config);
        }
    },
    mistral: {
        name: "mistral",
        label: "Mistral",
        requiresApiKey: true,
        defaultModel: MISTRAL_MODELS[0].id,
        async listModels() {
            return MISTRAL_MODELS;
        },
        createConfig(settings) {
            const apiKey = normalizeOptionalValue(settings?.apiKey);
            if (!apiKey) {
                throw new Error("Mistral login is required before using this provider.");
            }
            return {
                provider: "mistral",
                model: normalizeOptionalValue(settings?.model) ?? MISTRAL_MODELS[0].id,
                apiKey,
                baseUrl: normalizeOptionalValue(settings?.baseUrl) ?? DEFAULT_MISTRAL_BASE_URL
            };
        },
        createClient(config) {
            if (config.provider !== "mistral") {
                throw new Error(`Mistral provider cannot create client for ${config.provider}.`);
            }
            return new MistralModelClient(config);
        }
    }
};
export function getProviderDefinition(provider) {
    return PROVIDER_DEFINITIONS[provider];
}
export function listProviderDefinitions() {
    return Object.values(PROVIDER_DEFINITIONS).map((provider) => ({
        label: provider.label,
        name: provider.name,
        requiresApiKey: provider.requiresApiKey
    }));
}
async function loadOllamaModels(baseUrl) {
    try {
        const response = await fetch(buildOllamaTagsUrl(baseUrl), {
            signal: AbortSignal.timeout(5_000)
        });
        if (!response.ok) {
            return [];
        }
        const payload = (await response.json());
        const modelNames = Array.isArray(payload.models)
            ? payload.models
                .map((model) => normalizeOptionalValue(model.name))
                .filter((name) => name !== undefined)
            : [];
        const uniqueNames = [...new Set(modelNames)];
        return uniqueNames.map((name) => ({
            id: name,
            label: name
        }));
    }
    catch {
        return [];
    }
}
function buildOllamaTagsUrl(baseUrl) {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("api/tags", normalizedBaseUrl).toString();
}
function normalizeOptionalValue(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}
