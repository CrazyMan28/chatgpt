import type { McpServerDraft } from "./mcp-manager.js";
export interface MarketplacePromptField {
    defaultValue?: string;
    description: string;
    key: string;
    label: string;
    mask?: string;
    target: "env" | "headers";
}
export interface MarketplaceEntry {
    capabilities: readonly string[];
    description: string;
    draft: Omit<McpServerDraft, "enabled" | "name">;
    name: string;
    prompts?: readonly MarketplacePromptField[];
}
export declare function listMarketplaceEntries(): readonly MarketplaceEntry[];
export declare function getMarketplaceEntry(name: string): MarketplaceEntry | undefined;
export declare function formatMarketplaceList(entries: readonly MarketplaceEntry[]): string;
export declare function formatMarketplaceInfo(entry: MarketplaceEntry): string;
//# sourceMappingURL=mcp-marketplace.d.ts.map