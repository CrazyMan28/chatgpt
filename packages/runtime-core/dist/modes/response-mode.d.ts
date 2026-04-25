import type { ModelMessage } from "../models/model-client.js";
export type ResponseMode = "normal" | "plan" | "ultra";
export declare function buildResponseModeContextMessage(mode: ResponseMode): Extract<ModelMessage, {
    role: "system";
}>;
export declare function describeMode(mode: ResponseMode): string;
export declare function formatResponseModeLabel(mode: ResponseMode): string;
export declare function isResponseMode(value: string): value is ResponseMode;
export declare function readResponseModeFromMessages(messages: readonly ModelMessage[]): ResponseMode | undefined;
//# sourceMappingURL=response-mode.d.ts.map