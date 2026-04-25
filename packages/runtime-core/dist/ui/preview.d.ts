import type { ModelConfig } from "../models/model-client.js";
import type { RegisteredTool } from "../tools/tool-registry.js";
export interface PreviewReplyOptions {
    modelConfig: ModelConfig;
    prompt: string;
    tools: readonly RegisteredTool[];
}
export declare function buildPreviewReply({ modelConfig, prompt, tools }: PreviewReplyOptions): string;
//# sourceMappingURL=preview.d.ts.map