import {
  DEFAULT_MCP_SERVER_DEFAULTS,
  type AppConfigFile,
  type McpServerDefinitions
} from "./app-config-schema.js";

export const DEFAULT_APP_CONFIG: AppConfigFile = {
  defaults: {
    ...DEFAULT_MCP_SERVER_DEFAULTS
  },
  mcpServers: {}
};

export const EXAMPLE_MCP_SERVERS: McpServerDefinitions = {
  filesystem: {
    enabled: false,
    transport: "stdio",
    type: "local",
    command: "node",
    args: ["./path/to/mcp-server.js"],
    cwd: ".",
    env: {
      EXAMPLE_API_KEY: "replace-me"
    },
    headers: {},
    tools: ["*"]
  }
};
