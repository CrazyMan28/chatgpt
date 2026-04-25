import type { ModelClient } from "../models/model-client.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
export interface RunCliOptions {
    input: NodeJS.ReadableStream;
    output: NodeJS.WritableStream;
    model: ModelClient;
    toolRegistry?: ToolRegistry;
}
export declare function runCli({ input, output, model, toolRegistry }: RunCliOptions): Promise<void>;
//# sourceMappingURL=run-cli.d.ts.map