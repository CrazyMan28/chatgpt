import type { McpServerConfig } from "../mcp/mcp-server-config.js";
import { type AppConfigFile } from "./app-config-schema.js";
export declare const DEFAULT_CONFIG_FILENAME = "chatgpt-code.config.json";
export interface ResolvedAppConfigFile {
    configDirectory: string;
    configPath: string;
    file: AppConfigFile;
}
export declare function resolveAppConfigPath(env?: NodeJS.ProcessEnv, cwd?: string): string;
export declare function readAppConfigFile(env?: NodeJS.ProcessEnv, cwd?: string): ResolvedAppConfigFile;
export declare function writeAppConfigFile(configPath: string, file: AppConfigFile): void;
export declare function normalizeAppConfigFile(value: unknown): AppConfigFile;
export declare function createEnabledMcpServerConfigs(file: AppConfigFile, configDirectory: string): McpServerConfig[];
//# sourceMappingURL=app-config-file.d.ts.map