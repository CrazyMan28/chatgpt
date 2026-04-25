import type { MistralModelConfig, ModelClient, ModelRequest, ModelResponse } from "./model-client.js";
export declare class MistralModelClient implements ModelClient {
    private readonly config;
    private readonly fetchFn;
    constructor(config: MistralModelConfig, fetchFn?: typeof fetch);
    generate(request: ModelRequest): Promise<ModelResponse>;
}
//# sourceMappingURL=mistral-model.d.ts.map