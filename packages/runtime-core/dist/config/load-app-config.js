import { createEnabledMcpServerConfigs, readAppConfigFile } from "./app-config-file.js";
const DEFAULT_LOCAL_MODEL = "mock-local";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export function loadAppConfig(env = process.env, cwd = process.cwd()) {
    const provider = parseModelProvider(env.CHATGPT_CODE_MODEL_PROVIDER);
    const fileConfig = loadConfigFile(env, cwd);
    return {
        model: provider === "openai"
            ? loadOpenAIModelConfig(env)
            : provider === "anthropic"
                ? loadAnthropicModelConfig(env)
                : provider === "mistral"
                    ? loadMistralModelConfig(env)
                    : loadLocalModelConfig(env),
        mcpDefaults: fileConfig.defaults,
        mcpServers: fileConfig.mcpServers
    };
}
function parseModelProvider(value) {
    if (value === undefined || value.trim().length === 0) {
        return "local";
    }
    if (value === "local" ||
        value === "openai" ||
        value === "anthropic" ||
        value === "mistral") {
        return value;
    }
    throw new Error(`Unsupported model provider "${value}". Expected "local", "openai", "anthropic", or "mistral".`);
}
function loadLocalModelConfig(env) {
    const model = readOptionalValue(env.CHATGPT_CODE_MODEL) ?? DEFAULT_LOCAL_MODEL;
    return {
        provider: "local",
        model,
        transport: model === DEFAULT_LOCAL_MODEL ? "mock" : "ollama",
        ...(model === DEFAULT_LOCAL_MODEL
            ? {}
            : {
                baseUrl: readOptionalValue(env.CHATGPT_CODE_LOCAL_BASE_URL) ??
                    DEFAULT_OLLAMA_BASE_URL
            })
    };
}
function loadOpenAIModelConfig(env) {
    const model = readOptionalValue(env.CHATGPT_CODE_MODEL);
    const apiKey = readOptionalValue(env.CHATGPT_CODE_OPENAI_API_KEY);
    if (model === undefined) {
        throw new Error("CHATGPT_CODE_MODEL is required when CHATGPT_CODE_MODEL_PROVIDER=openai.");
    }
    if (apiKey === undefined) {
        throw new Error("CHATGPT_CODE_OPENAI_API_KEY is required when CHATGPT_CODE_MODEL_PROVIDER=openai.");
    }
    return {
        provider: "openai",
        model,
        apiKey,
        baseUrl: readOptionalValue(env.CHATGPT_CODE_OPENAI_BASE_URL) ??
            DEFAULT_OPENAI_BASE_URL
    };
}
function loadAnthropicModelConfig(env) {
    const model = readOptionalValue(env.CHATGPT_CODE_MODEL);
    const apiKey = readOptionalValue(env.CHATGPT_CODE_ANTHROPIC_API_KEY);
    if (model === undefined) {
        throw new Error("CHATGPT_CODE_MODEL is required when CHATGPT_CODE_MODEL_PROVIDER=anthropic.");
    }
    if (apiKey === undefined) {
        throw new Error("CHATGPT_CODE_ANTHROPIC_API_KEY is required when CHATGPT_CODE_MODEL_PROVIDER=anthropic.");
    }
    return {
        provider: "anthropic",
        model,
        apiKey,
        baseUrl: readOptionalValue(env.CHATGPT_CODE_ANTHROPIC_BASE_URL) ??
            DEFAULT_ANTHROPIC_BASE_URL
    };
}
function loadMistralModelConfig(env) {
    const model = readOptionalValue(env.CHATGPT_CODE_MODEL);
    const apiKey = readOptionalValue(env.CHATGPT_CODE_MISTRAL_API_KEY);
    if (model === undefined) {
        throw new Error("CHATGPT_CODE_MODEL is required when CHATGPT_CODE_MODEL_PROVIDER=mistral.");
    }
    if (apiKey === undefined) {
        throw new Error("CHATGPT_CODE_MISTRAL_API_KEY is required when CHATGPT_CODE_MODEL_PROVIDER=mistral.");
    }
    return {
        provider: "mistral",
        model,
        apiKey,
        baseUrl: readOptionalValue(env.CHATGPT_CODE_MISTRAL_BASE_URL) ??
            DEFAULT_MISTRAL_BASE_URL
    };
}
function readOptionalValue(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}
function loadConfigFile(env, cwd) {
    const parsedConfig = readAppConfigFile(env, cwd);
    return {
        defaults: parsedConfig.file.defaults,
        mcpServers: createEnabledMcpServerConfigs(parsedConfig.file, parsedConfig.configDirectory)
    };
}
//# sourceMappingURL=load-app-config.js.map