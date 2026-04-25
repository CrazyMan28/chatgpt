import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "ink";
import { App } from "./app.js";
export async function runTui({ approvalManager, executionContextController, fleetManager, goalStore, initialSession, memoryStore, mcpManager, modelRuntime, projectRecord, projectRegistryStore, remoteManager, sessionRegistryStore, sessionStore, taskRunner, toolRegistry, timelineStore, watcherStore, workspaceRoot }) {
    const instance = render(_jsx(App, { approvalManager: approvalManager, executionContextController: executionContextController, fleetManager: fleetManager, goalStore: goalStore, initialSession: initialSession, memoryStore: memoryStore, mcpManager: mcpManager, modelRuntime: modelRuntime, projectRecord: projectRecord, projectRegistryStore: projectRegistryStore, remoteManager: remoteManager, sessionRegistryStore: sessionRegistryStore, sessionStore: sessionStore, taskRunner: taskRunner, toolRegistry: toolRegistry, timelineStore: timelineStore, watcherStore: watcherStore, workspaceRoot: workspaceRoot }), {
        alternateScreen: Boolean(process.stdout.isTTY),
        concurrent: true,
        incrementalRendering: true,
        interactive: Boolean(process.stdout.isTTY),
        patchConsole: true
    });
    await instance.waitUntilExit();
}
//# sourceMappingURL=run-tui.js.map