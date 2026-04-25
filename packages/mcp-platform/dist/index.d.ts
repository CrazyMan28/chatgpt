import { type ManagedMcpServer } from "@chatgpt-code/runtime-core";
import type { MarketplaceEntry, SafetyLevel } from "@chatgpt-code/runtime-core";
export interface DiscoveredMcpManifest {
    args?: string[];
    author?: string;
    category?: string;
    command?: string;
    description?: string;
    name: string;
    safetyLevel?: SafetyLevel;
    tags?: string[];
    tools?: string[];
    transport: "stdio" | "http" | "sse";
    url?: string;
    version?: string;
}
export interface MarketplaceBuildOptions {
    directories?: string[];
    installedServers?: readonly ManagedMcpServer[];
    workspaceRoot: string;
}
export declare function buildUnifiedMarketplace({ directories, installedServers, workspaceRoot }: MarketplaceBuildOptions): Promise<MarketplaceEntry[]>;
export declare function discoverMarketplaceEntries(options: {
    directories?: string[];
    workspaceRoot: string;
}): Promise<MarketplaceEntry[]>;
export declare function searchMarketplaceEntries(entries: readonly MarketplaceEntry[], keyword: string): MarketplaceEntry[];
export declare function formatMarketplaceBrowser(entries: readonly MarketplaceEntry[]): string;
export declare function getUnifiedMarketplaceEntry(entries: readonly MarketplaceEntry[], name: string): MarketplaceEntry | undefined;
//# sourceMappingURL=index.d.ts.map