import type { ModelClient, ModelConfig } from "./model-client.js";
import { getProviderDefinition } from "../providers/provider-catalog.js";

export function createModelClient(config: ModelConfig): ModelClient {
  return getProviderDefinition(config.provider).createClient(config);
}
