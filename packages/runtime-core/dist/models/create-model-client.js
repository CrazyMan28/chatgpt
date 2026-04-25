import { getProviderDefinition } from "../providers/provider-catalog.js";
export function createModelClient(config) {
    return getProviderDefinition(config.provider).createClient(config);
}
//# sourceMappingURL=create-model-client.js.map