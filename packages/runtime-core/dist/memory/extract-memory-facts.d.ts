export type MemoryFactType = "identity" | "preference" | "project" | "workflow" | "fact";
export interface ExtractedMemoryFact {
    text: string;
    type: MemoryFactType;
}
export declare function extractMemoryFacts(message: string): string[];
export declare function extractTypedMemoryFacts(message: string): ExtractedMemoryFact[];
export declare function inferMemoryFactType(value: string): MemoryFactType;
//# sourceMappingURL=extract-memory-facts.d.ts.map