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

const MARKETPLACE_ENTRIES: readonly MarketplaceEntry[] = [
  {
    name: "filesystem",
    description: "Read and inspect files through the official filesystem MCP server.",
    capabilities: ["workspace read/write", "directory access"],
    draft: {
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      command: "npx",
      cwd: ".",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "stdio",
      type: "local"
    }
  },
  {
    name: "playwright",
    description: "Browser automation and page inspection through Playwright MCP.",
    capabilities: ["browser automation", "screenshots", "DOM inspection"],
    draft: {
      args: ["-y", "@playwright/mcp@latest"],
      command: "npx",
      cwd: ".",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "stdio",
      type: "local"
    }
  },
  {
    name: "docs",
    description: "Remote documentation lookup via a streamable HTTP MCP endpoint.",
    capabilities: ["documentation search", "reference lookup"],
    draft: {
      args: [],
      command: "",
      cwd: "",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "http",
      type: "http",
      url: "https://mcp.context7.com/mcp"
    }
  },
  {
    name: "github",
    description: "GitHub repository and issue operations via a starter MCP preset.",
    capabilities: ["issues", "pull requests", "repository metadata"],
    draft: {
      args: ["-y", "@modelcontextprotocol/server-github"],
      command: "npx",
      cwd: ".",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "stdio",
      type: "command"
    },
    prompts: [
      {
        description: "Provide a personal access token for GitHub API access.",
        key: "GITHUB_TOKEN",
        label: "GitHub Token",
        mask: "*",
        target: "env"
      }
    ]
  },
  {
    name: "browser",
    description: "A browser automation starter preset that can be customized after install.",
    capabilities: ["remote browser control", "page navigation"],
    draft: {
      args: ["-y", "@browserbasehq/mcp-server"],
      command: "npx",
      cwd: ".",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "stdio",
      type: "command"
    }
  },
  {
    name: "azure",
    description: "Azure-focused MCP starter preset for cloud and docs workflows.",
    capabilities: ["Azure tooling", "cloud automation"],
    draft: {
      args: ["-y", "@azure/mcp"],
      command: "npx",
      cwd: ".",
      env: {},
      headers: {},
      tools: ["*"],
      transport: "stdio",
      type: "command"
    },
    prompts: [
      {
        description: "Azure API token or key required by your server preset.",
        key: "AZURE_API_KEY",
        label: "Azure API Key",
        mask: "*",
        target: "env"
      }
    ]
  }
];

export function listMarketplaceEntries(): readonly MarketplaceEntry[] {
  return MARKETPLACE_ENTRIES;
}

export function getMarketplaceEntry(name: string): MarketplaceEntry | undefined {
  return MARKETPLACE_ENTRIES.find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase()
  );
}

export function formatMarketplaceList(
  entries: readonly MarketplaceEntry[]
): string {
  if (entries.length === 0) {
    return "No marketplace entries are available.";
  }

  const lines = ["MCP marketplace", ""];

  for (const entry of entries) {
    lines.push(
      `${entry.name.padEnd(14, " ")} ${entry.draft.type.padEnd(8, " ")} ${entry.description}`
    );
  }

  lines.push("");
  lines.push("Use /mcp info <name> for details or /mcp install <name> to install.");

  return lines.join("\n");
}

export function formatMarketplaceInfo(entry: MarketplaceEntry): string {
  const lines = [
    `${entry.name}`,
    entry.description,
    "",
    `Type: ${entry.draft.type}`,
    `Transport: ${entry.draft.transport}`,
    `Capabilities: ${entry.capabilities.join(", ")}`,
    "",
    "Starter config:",
    JSON.stringify(
      {
        enabled: true,
        ...entry.draft
      },
      null,
      2
    )
  ];

  if (entry.prompts && entry.prompts.length > 0) {
    lines.push("");
    lines.push(
      `Prompts: ${entry.prompts.map((prompt) => prompt.label).join(", ")}`
    );
  }

  return lines.join("\n");
}
