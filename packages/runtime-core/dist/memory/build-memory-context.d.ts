import type { ModelMessage } from "../models/model-client.js";
import type { MemoryRecord } from "../storage/memory-store.js";
export declare function buildMemoryContextMessages(memories: readonly MemoryRecord[]): Extract<ModelMessage, {
    role: "system";
}>[];
//# sourceMappingURL=build-memory-context.d.ts.map