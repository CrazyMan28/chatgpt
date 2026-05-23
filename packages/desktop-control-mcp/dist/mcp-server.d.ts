export declare function runMcpServer(): void;
export declare function runDesktopCli(command: string, input?: Record<string, unknown>): Promise<unknown>;
export declare function handleDesktopCommand(input: {
    args?: Record<string, unknown>;
    command: string;
}): Promise<string>;
//# sourceMappingURL=mcp-server.d.ts.map