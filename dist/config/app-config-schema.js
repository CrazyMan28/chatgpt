export const DEFAULT_MCP_SERVER_DEFAULTS = {
    timeout: 30_000,
    restartOnFail: true,
    log: false
};
export function serializeAppConfigFile(config) {
    return `${JSON.stringify(config, null, 2)}\n`;
}
