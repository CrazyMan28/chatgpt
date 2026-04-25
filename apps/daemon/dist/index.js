#!/usr/bin/env node
import { commitWorkspaceRootEnv, resolveProjectRoot } from "@chatgpt-code/runtime-core";
import { createOrchestratorRuntime, startOrchestratorServer } from "@chatgpt-code/orchestrator";
import { resolveVaultPassphrase } from "@chatgpt-code/storage-sqlite";
void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unexpected daemon failure.";
    process.stderr.write(`Fatal: ${message}\n`);
    process.exitCode = 1;
});
async function main() {
    const workspaceRoot = commitWorkspaceRootEnv(await resolveProjectRoot({
        cwd: process.cwd(),
        env: process.env
    }));
    const host = process.env.CHATGPT_CODE_DAEMON_HOST?.trim() || "127.0.0.1";
    const port = readPort(process.env.CHATGPT_CODE_DAEMON_PORT);
    const passphrase = await resolveVaultPassphrase();
    const runtime = await createOrchestratorRuntime({
        passphrase,
        workspaceRoot
    });
    const server = await startOrchestratorServer({
        host,
        port,
        runtime
    });
    process.stderr.write(`Daemon listening at ${server.url}\n`);
    const shutdown = async () => {
        await server.close();
        await runtime.close();
    };
    process.once("SIGINT", () => {
        void shutdown().finally(() => {
            process.exit(0);
        });
    });
    process.once("SIGTERM", () => {
        void shutdown().finally(() => {
            process.exit(0);
        });
    });
}
function readPort(value) {
    const port = Number(value);
    if (!Number.isFinite(port) || port < 1 || port > 65_535) {
        return undefined;
    }
    return Math.floor(port);
}
//# sourceMappingURL=index.js.map