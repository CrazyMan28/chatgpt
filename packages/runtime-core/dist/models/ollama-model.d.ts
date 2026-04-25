import type { LocalModelConfig, ModelClient, ModelResponse } from "./model-client.js";
export declare class OllamaModelClient implements ModelClient {
    private readonly config;
    private readonly fetchFn;
    constructor(config: LocalModelConfig & {
        transport: "ollama";
        baseUrl: string;
    }, fetchFn?: typeof fetch);
    generate(request: Parameters<ModelClient["generate"]>[0]): Promise<ModelResponse>;
}
//# sourceMappingURL=ollama-model.d.ts.map