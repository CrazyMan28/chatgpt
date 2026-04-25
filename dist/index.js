#!/usr/bin/env node
import { JsonAuthStore } from "./auth/auth-store.js";
import { loadAppConfig } from "./config/load-app-config.js";
import { createMcpManager } from "./mcp/mcp-manager.js";
import { createModelRuntimeManager } from "./providers/model-runtime.js";
import { JsonMemoryStore } from "./storage/memory-store.js";
import { FileSessionStore } from "./storage/session-store.js";
import { createInitialSessionState } from "./storage/session-state.js";
import { JsonTaskStore } from "./storage/task-store.js";
import { createBackgroundTaskRunner } from "./tasks/background-task-runner.js";
import { loadToolRegistry } from "./tools/load-tool-registry.js";
import { runTui } from "./ui/run-tui.js";
void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unexpected CLI failure";
    process.stderr.write(`Fatal: ${message}\n`);
    process.exitCode = 1;
});
async function main() {
    const workspaceRoot = process.cwd();
    const config = loadAppConfig();
    const authStore = new JsonAuthStore(workspaceRoot);
    const modelRuntime = await createModelRuntimeManager({
        authStore,
        bootstrapModelConfig: config.model
    });
    const memoryStore = new JsonMemoryStore(workspaceRoot);
    const sessionStore = new FileSessionStore(workspaceRoot);
    const taskStore = new JsonTaskStore(workspaceRoot);
    const initialSession = await sessionStore.createSession(createInitialSessionState());
    const toolRegistry = await loadToolRegistry(config.mcpServers, workspaceRoot);
    const mcpManager = createMcpManager({
        cwd: workspaceRoot,
        env: process.env,
        toolRegistry
    });
    const taskRunner = await createBackgroundTaskRunner({
        memoryStore,
        modelRuntime,
        sessionStore,
        taskStore,
        toolRegistry,
        workspaceRoot
    });
    try {
        await runTui({
            initialSession,
            memoryStore,
            mcpManager,
            modelRuntime,
            sessionStore,
            taskRunner,
            toolRegistry,
            workspaceRoot
        });
    }
    finally {
        await taskRunner.close();
        await toolRegistry.close();
    }
}
