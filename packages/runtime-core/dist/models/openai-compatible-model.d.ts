import type { ModelClient, ModelRequest, ModelResponse, OpenAIModelConfig } from "./model-client.js";
export declare class OpenAICompatibleModelClient implements ModelClient {
    private readonly config;
    private readonly fetchFn;
    constructor(config: OpenAIModelConfig, fetchFn?: typeof fetch);
    generate(request: ModelRequest): Promise<ModelResponse>;
}
//# sourceMappingURL=openai-compatible-model.d.ts.map