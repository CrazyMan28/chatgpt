import type { ModelProvider } from "../models/model-client.js";

export interface StoredProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export type StoredProviderSettingsMap = Partial<
  Record<ModelProvider, StoredProviderSettings>
>;

export interface ProviderModelDefinition {
  id: string;
  label: string;
}

export interface ProviderSummary {
  label: string;
  name: ModelProvider;
  requiresApiKey: boolean;
}

export interface ModelRuntimeSnapshot {
  isAuthenticated: boolean;
  loginLabel: string;
  model: string;
  provider: ModelProvider;
  providerLabel: string;
}
