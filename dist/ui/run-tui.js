import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "ink";
import { App } from "./app.js";
export async function runTui({ initialSession, memoryStore, mcpManager, modelRuntime, sessionStore, taskRunner, toolRegistry, workspaceRoot }) {
    const instance = render(_jsx(App, { initialSession: initialSession, memoryStore: memoryStore, mcpManager: mcpManager, modelRuntime: modelRuntime, sessionStore: sessionStore, taskRunner: taskRunner, toolRegistry: toolRegistry, workspaceRoot: workspaceRoot }), {
        alternateScreen: Boolean(process.stdout.isTTY),
        concurrent: true,
        incrementalRendering: true,
        interactive: Boolean(process.stdout.isTTY),
        patchConsole: true
    });
    await instance.waitUntilExit();
}
