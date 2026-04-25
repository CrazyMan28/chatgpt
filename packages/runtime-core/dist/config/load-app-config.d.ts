import type { McpServerConfig } from "../mcp/mcp-server-config.js";
import type { ModelConfig } from "../models/model-client.js";
import type { McpServerDefaults } from "./app-config-schema.js";
export interface AppConfig {
    model: ModelConfig;
    mcpDefaults: McpServerDefaults;
    mcpServers: McpServerConfig[];
}
export declare function loadAppConfig(env?: NodeJS.ProcessEnv, cwd?: string): AppConfig;
//# sourceMappingURL=load-app-config.d.ts.map