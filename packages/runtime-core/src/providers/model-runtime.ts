import type { AuthConfigRecord, AuthStore } from "../auth/auth-store.js";
import {
  createAuthConfigFromModelConfig,
  createDefaultAuthConfig
} from "../auth/auth-store.js";
import type { ModelClient, ModelConfig, ModelProvider } from "../models/model-client.js";
import type {
  ModelRuntimeSnapshot,
  ProviderModelDefinition,
  ProviderSummary
} from "./provider-types.js";
import { getProviderDefinition, listProviderDefinitions } from "./provider-catalog.js";

export interface LoginInput {
  apiKey?: string;
  provider: ModelProvider;
}

export interface ModelRuntimeManager {
  getClient(): ModelClient;
  getConfig(): ModelConfig;
  getSnapshot(): ModelRuntimeSnapshot;
  listModels(): Promise<readonly ProviderModelDefinition[]>;
  listProviders(): readonly ProviderSummary[];
  login(input: LoginInput): Promise<ModelRuntimeSnapshot>;
  setModel(model: string): Promise<ModelRuntimeSnapshot>;
  subscribe(listener: (snapshot: ModelRuntimeSnapshot) => void): () => void;
}

export interface CreateModelRuntimeManagerOptions {
  authStore: AuthStore;
  bootstrapModelConfig?: ModelConfig;
}

export async function createModelRuntimeManager({
  authStore,
  bootstrapModelConfig
}: CreateModelRuntimeManagerOptions): Promise<ModelRuntimeManager> {
  const bootstrapConfig = bootstrapModelConfig
    ? createAuthConfigFromModelConfig(bootstrapModelConfig)
    : createDefaultAuthConfig();
  const authConfig = await authStore.load(bootstrapConfig);

  return new ModelRuntimeManagerImpl(authStore, authConfig);
}

class ModelRuntimeManagerImpl implements ModelRuntimeManager {
  private readonly listeners = new Set<(snapshot: ModelRuntimeSnapshot) => void>();
  private cachedClient?: ModelClient;
  private cachedConfigKey?: string;

  constructor(
    private readonly authStore: AuthStore,
    private authConfig: AuthConfigRecord
  ) {}

  getClient(): ModelClient {
    const config = this.getConfig();
    const configKey = JSON.stringify(config);

    if (!this.cachedClient || this.cachedConfigKey !== configKey) {
      this.cachedClient = getProviderDefinition(config.provider).createClient(config);
      this.cachedConfigKey = configKey;
      emitRuntimeDebugLog(
        "client_resolved",
        `provider=${config.provider} model=${config.model}`
      );
    }

    return this.cachedClient;
  }

  getConfig(): ModelConfig {
    const providerDefinition = getProviderDefinition(this.authConfig.activeProvider);
    const settings = this.authConfig.providers[this.authConfig.activeProvider];

    return providerDefinition.createConfig(settings);
  }

  getSnapshot(): ModelRuntimeSnapshot {
    const providerDefinition = getProviderDefinition(this.authConfig.activeProvider);
    const settings = this.authConfig.providers[this.authConfig.activeProvider];
    const model = settings?.model?.trim() || providerDefinition.defaultModel;
    const isAuthenticated = !providerDefinition.requiresApiKey || Boolean(settings?.apiKey);

    return {
      isAuthenticated,
      loginLabel: providerDefinition.requiresApiKey
        ? isAuthenticated
          ? "Logged in"
          : "Login required"
        : "Local ready",
      model,
      provider: providerDefinition.name,
      providerLabel: providerDefinition.label
    };
  }

  async listModels(): Promise<readonly ProviderModelDefinition[]> {
    const providerDefinition = getProviderDefinition(this.authConfig.activeProvider);
    const models = await providerDefinition.listModels(
      this.authConfig.providers[this.authConfig.activeProvider]
    );

    emitRuntimeDebugLog(
      "models_listed",
      `provider=${this.authConfig.activeProvider} models=${models.map((model) => model.id).join(",")}`
    );

    return models;
  }

  listProviders(): readonly ProviderSummary[] {
    return listProviderDefinitions();
  }

  async login(input: LoginInput): Promise<ModelRuntimeSnapshot> {
    const previousSnapshot = this.getSnapshot();
    emitRuntimeDebugLog("login_started", `provider=${input.provider}`);
    const providerDefinition = getProviderDefinition(input.provider);
    const currentSettings = this.authConfig.providers[input.provider] ?? {};
    const apiKey = input.apiKey?.trim();

    if (providerDefinition.requiresApiKey && !apiKey && !currentSettings.apiKey) {
      throw new Error(
        `${providerDefinition.label} requires an API key.`
      );
    }

    this.authConfig = await this.authStore.save({
      ...this.authConfig,
      activeProvider: input.provider,
      providers: {
        ...this.authConfig.providers,
        [input.provider]: {
          ...currentSettings,
          ...(apiKey ? { apiKey } : {}),
          model: currentSettings.model ?? providerDefinition.defaultModel
        }
      }
    });

    this.invalidateClient();
    const nextSnapshot = this.emitSnapshot();

    if (previousSnapshot.provider !== nextSnapshot.provider) {
      emitRuntimeDebugLog(
        "provider_changed",
        `${previousSnapshot.provider} -> ${nextSnapshot.provider}`
      );
    }

    if (previousSnapshot.model !== nextSnapshot.model) {
      emitRuntimeDebugLog(
        "model_changed",
        `${previousSnapshot.model} -> ${nextSnapshot.model}`
      );
    }

    emitRuntimeDebugLog(
      "login_complete",
      `provider=${nextSnapshot.provider} model=${nextSnapshot.model} status=${nextSnapshot.loginLabel}`
    );

    return nextSnapshot;
  }

  async setModel(model: string): Promise<ModelRuntimeSnapshot> {
    const previousSnapshot = this.getSnapshot();
    const normalizedModel = model.trim();

    if (normalizedModel.length === 0) {
      throw new Error("Usage: /model <name>");
    }

    const availableModels = await this.listModels();
    const matchedModel = availableModels.find(
      (entry) =>
        entry.id.toLowerCase() === normalizedModel.toLowerCase() ||
        entry.label.toLowerCase() === normalizedModel.toLowerCase()
    );

    if (!matchedModel) {
      const availableLabels = availableModels.map((entry) => entry.id).join(", ");

      throw new Error(
        `Model "${normalizedModel}" is unavailable for ${this.getSnapshot().providerLabel}. Available models: ${availableLabels}.`
      );
    }

    const activeProvider = this.authConfig.activeProvider;
    const currentSettings = this.authConfig.providers[activeProvider] ?? {};

    this.authConfig = await this.authStore.save({
      ...this.authConfig,
      providers: {
        ...this.authConfig.providers,
        [activeProvider]: {
          ...currentSettings,
          model: matchedModel.id
        }
      }
    });

    this.invalidateClient();
    const nextSnapshot = this.emitSnapshot();

    if (previousSnapshot.model !== nextSnapshot.model) {
      emitRuntimeDebugLog(
        "model_changed",
        `${previousSnapshot.model} -> ${nextSnapshot.model}`
      );
    }

    return nextSnapshot;
  }

  subscribe(listener: (snapshot: ModelRuntimeSnapshot) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitSnapshot(): ModelRuntimeSnapshot {
    const snapshot = this.getSnapshot();

    emitRuntimeDebugLog(
      "snapshot_emitted",
      `provider=${snapshot.provider} model=${snapshot.model} status=${snapshot.loginLabel}`
    );

    for (const listener of this.listeners) {
      listener(snapshot);
    }

    return snapshot;
  }

  private invalidateClient(): void {
    this.cachedClient = undefined;
    this.cachedConfigKey = undefined;
  }
}

function emitRuntimeDebugLog(event: string, detail: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[model-runtime] ${event} ${detail}\n`);
}
