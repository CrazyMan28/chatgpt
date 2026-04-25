import type { ModelClient, ModelRequest, ModelResponse } from "./model-client.js";
export declare class MockModelClient implements ModelClient {
    private readonly _modelName;
    constructor(_modelName?: string);
    generate(request: ModelRequest): Promise<ModelResponse>;
}
//# sourceMappingURL=mock-model.d.ts.map