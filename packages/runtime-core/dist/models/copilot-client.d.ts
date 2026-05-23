import type { CopilotModelConfig, ModelClient, ModelRequest, ModelResponse } from "./model-client.js";
export declare class CopilotCliModelClient implements ModelClient {
    private readonly config;
    constructor(config: CopilotModelConfig);
    generate(request: ModelRequest): Promise<ModelResponse>;
}
//# sourceMappingURL=copilot-client.d.ts.map