import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  getMarketplaceEntry,
  listMarketplaceEntries,
  type ManagedMcpServer,
  type LegacyMarketplaceEntry
} from "@chatgpt-code/runtime-core";
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

export async function buildUnifiedMarketplace({
  directories = ["mcp", "mcp-servers"],
  installedServers = [],
  workspaceRoot
}: MarketplaceBuildOptions): Promise<MarketplaceEntry[]> {
  const curatedEntries = listMarketplaceEntries().map((entry) =>
    mapLegacyMarketplaceEntry(entry, installedServers)
  );
  const discoveredEntries = await discoverMarketplaceEntries({
    directories,
    workspaceRoot
  });
  const merged = new Map<string, MarketplaceEntry>();

  for (const entry of [...curatedEntries, ...discoveredEntries]) {
    merged.set(entry.name.toLowerCase(), entry);
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function discoverMarketplaceEntries(options: {
  directories?: string[];
  workspaceRoot: string;
}): Promise<MarketplaceEntry[]> {
  const directories = options.directories ?? ["mcp", "mcp-servers"];
  const discoveredEntries: MarketplaceEntry[] = [];

  for (const directory of directories) {
    const root = resolve(options.workspaceRoot, directory);
    const manifests = await findManifestFiles(root).catch(() => []);

    for (const manifestPath of manifests) {
      const entry = await readManifestAsMarketplaceEntry(manifestPath);

      if (entry) {
        discoveredEntries.push(entry);
      }
    }
  }

  return discoveredEntries;
}

export function searchMarketplaceEntries(
  entries: readonly MarketplaceEntry[],
  keyword: string
): MarketplaceEntry[] {
  const normalized = keyword.trim().toLowerCase();

  if (normalized.length === 0) {
    return [...entries];
  }

  return entries.filter((entry) => {
    return (
      entry.name.toLowerCase().includes(normalized) ||
      entry.description.toLowerCase().includes(normalized) ||
      entry.category.toLowerCase().includes(normalized) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(normalized))
    );
  });
}

export function formatMarketplaceBrowser(
  entries: readonly MarketplaceEntry[]
): string {
  if (entries.length === 0) {
    return "No MCP marketplace entries are available.";
  }

  const lines = ["MCP marketplace", ""];

  for (const entry of entries) {
    lines.push(
      `${entry.name.padEnd(14, " ")} ${entry.category.padEnd(12, " ")} ${entry.transport.padEnd(6, " ")} ${entry.installStatus === "installed" ? "installed" : "available"}  ${entry.description}`
    );
  }

  return lines.join("\n");
}

async function findManifestFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name === "manifest.json")
    .map((entry) => join(entry.parentPath, entry.name));
}

async function readManifestAsMarketplaceEntry(
  manifestPath: string
): Promise<MarketplaceEntry | undefined> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as DiscoveredMcpManifest;

    if (!parsed.name || !parsed.description || !parsed.transport) {
      return undefined;
    }

    return {
      author: parsed.author,
      category: parsed.category ?? "discovered",
      compatibilityNotes: [],
      description: parsed.description,
      enabledStatus: "disabled",
      favorite: false,
      installStatus: "not_installed",
      name: parsed.name,
      safetyLevel: parsed.safetyLevel ?? "medium",
      source: "discovered",
      tags: parsed.tags ?? [],
      tools: parsed.tools ?? [],
      transport: parsed.transport,
      version: parsed.version
    };
  } catch {
    return undefined;
  }
}

function mapLegacyMarketplaceEntry(
  entry: LegacyMarketplaceEntry,
  installedServers: readonly ManagedMcpServer[]
): MarketplaceEntry {
  const installed = installedServers.find(
    (server) => server.name.toLowerCase() === entry.name.toLowerCase()
  );

  return {
    category: "curated",
    compatibilityNotes: [],
    description: entry.description,
    enabledStatus:
      installed?.status === "ENABLED" ? "enabled" : "disabled",
    favorite: false,
    installStatus: installed ? "installed" : "not_installed",
    name: entry.name,
    safetyLevel: installed ? "medium" : "safe",
    source: "local",
    tags: [],
    tools: [...entry.capabilities],
    transport: entry.draft.transport,
    version: "bundled"
  };
}

export function getUnifiedMarketplaceEntry(
  entries: readonly MarketplaceEntry[],
  name: string
): MarketplaceEntry | undefined {
  return (
    entries.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase()) ??
    (() => {
      const legacy = getMarketplaceEntry(name);
      return legacy ? mapLegacyMarketplaceEntry(legacy, []) : undefined;
    })()
  );
}
