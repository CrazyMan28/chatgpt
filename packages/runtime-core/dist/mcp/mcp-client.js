import { HttpMcpClient } from "./http-mcp-client.js";
import { SseMcpClient } from "./sse-mcp-client.js";
import { StdioMcpClient } from "./stdio-mcp-client.js";
export function createMcpClient(config) {
    if (config.transport === "stdio") {
        return new StdioMcpClient(config);
    }
    if (config.transport === "sse") {
        return new SseMcpClient(config);
    }
    return new HttpMcpClient(config);
}
//# sourceMappingURL=mcp-client.js.map