import type { AnthropicModelConfig, ModelClient, ModelResponse } from "./model-client.js";
export declare class AnthropicModelClient implements ModelClient {
    private readonly config;
    private readonly fetchFn;
    constructor(config: AnthropicModelConfig, fetchFn?: typeof fetch);
    generate(request: Parameters<ModelClient["generate"]>[0]): Promise<ModelResponse>;
}
//# sourceMappingURL=anthropic-model.d.ts.map