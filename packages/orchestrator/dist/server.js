import { createServer } from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
export async function startOrchestratorServer(options) {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 4017;
    const server = createServer((request, response) => {
        void handleRequest(options.runtime, request, response);
    });
    const ws = new WebSocketServer({
        noServer: true
    });
    const unsubscribe = options.runtime.subscribe((event) => {
        const payload = JSON.stringify(event);
        for (const client of ws.clients) {
            if (client.readyState === client.OPEN) {
                client.send(payload);
            }
        }
    });
    server.on("upgrade", (request, socket, head) => {
        if (request.url !== "/events") {
            socket.destroy();
            return;
        }
        ws.handleUpgrade(request, socket, head, (client) => {
            ws.emit("connection", client, request);
        });
    });
    await new Promise((resolve) => {
        server.listen(port, host, resolve);
    });
    return {
        async close() {
            unsubscribe();
            await new Promise((resolve, reject) => {
                ws.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    server.close((closeError) => {
                        if (closeError) {
                            reject(closeError);
                            return;
                        }
                        resolve();
                    });
                });
            });
        },
        url: `http://${host}:${port}`
    };
}
async function handleRequest(runtime, request, response) {
    if (!request.url) {
        respondJson(response, 404, {
            error: "Not found"
        });
        return;
    }
    const url = new URL(request.url, "http://localhost");
    try {
        if (request.method === "GET" && url.pathname === "/health") {
            respondJson(response, 200, await runtime.getHealthReport());
            return;
        }
        if (request.method === "GET" && url.pathname === "/doctor") {
            respondJson(response, 200, await runtime.getDoctorReport());
            return;
        }
        if (request.method === "GET" && url.pathname === "/orchestrator/health") {
            respondJson(response, 200, await runtime.getHealthReport());
            return;
        }
        if (request.method === "GET" && url.pathname === "/orchestrator/status") {
            respondJson(response, 200, await runtime.getOrchestratorStatus());
            return;
        }
        if (request.method === "GET" && url.pathname === "/orchestrator/queue") {
            respondJson(response, 200, await runtime.getOrchestratorQueue());
            return;
        }
        if (request.method === "GET" && url.pathname === "/status") {
            respondJson(response, 200, await runtime.getStatus());
            return;
        }
        if (request.method === "GET" && url.pathname === "/approvals") {
            respondJson(response, 200, await runtime.listApprovals());
            return;
        }
        if (request.method === "POST" &&
            /^\/approvals\/[^/]+\/approve$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            respondJson(response, 200, await runtime.approveRequest(id));
            return;
        }
        if (request.method === "POST" &&
            /^\/approvals\/[^/]+\/reject$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            respondJson(response, 200, await runtime.rejectRequest(id));
            return;
        }
        if (request.method === "GET" && url.pathname === "/watchers") {
            respondJson(response, 200, await runtime.listWatchers());
            return;
        }
        if (request.method === "GET" && url.pathname === "/tasks") {
            respondJson(response, 200, await runtime.listTasks());
            return;
        }
        if (request.method === "POST" && url.pathname === "/tasks/start") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.startTask({
                mode: optionalString(body.mode),
                prompt: optionalString(body.prompt),
                sessionId: optionalString(body.sessionId),
                style: optionalString(body.style),
                taskId: optionalString(body.taskId)
            }));
            return;
        }
        if (request.method === "GET" && /^\/tasks\/[^/]+$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const task = await runtime.getTask(id);
            respondJson(response, task ? 200 : 404, task ?? { error: "Task not found" });
            return;
        }
        if (request.method === "POST" &&
            /^\/tasks\/[^/]+\/(pause|resume|stop|cancel|retry|start)$/.test(url.pathname)) {
            const segments = url.pathname.split("/");
            const id = decodeURIComponent(segments[2] ?? "");
            const action = segments[3];
            const result = action === "pause"
                ? await runtime.pauseTask(id)
                : action === "resume"
                    ? await runtime.resumeTask(id)
                    : action === "stop"
                        ? await runtime.stopTask(id)
                        : action === "cancel"
                            ? await runtime.cancelTask(id)
                            : action === "retry"
                                ? await runtime.retryTask(id)
                                : await runtime.startTask({ taskId: id });
            respondJson(response, result ? 200 : 404, result ?? { error: "Task not found" });
            return;
        }
        if (request.method === "GET" && /^\/watchers\/[^/]+$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const watcher = (await runtime.listWatchers()).find((entry) => entry.id === id);
            respondJson(response, watcher ? 200 : 404, watcher ?? { error: "Watcher not found" });
            return;
        }
        if (request.method === "POST" &&
            /^\/watchers\/[^/]+\/cancel$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const watcher = await runtime.updateWatcher(id, "cancelled");
            respondJson(response, watcher ? 200 : 404, watcher ?? { error: "Watcher not found" });
            return;
        }
        if (request.method === "GET" && url.pathname === "/sessions") {
            respondJson(response, 200, await runtime.listSessions());
            return;
        }
        if (request.method === "POST" && url.pathname === "/sessions") {
            respondJson(response, 200, await runtime.createSession());
            return;
        }
        if (request.method === "POST" && url.pathname === "/chat") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.runPrompt({
                mode: readString(body.mode, "normal"),
                prompt: readString(body.prompt),
                sessionId: readString(body.sessionId),
                style: readString(body.style, "normal")
            }));
            return;
        }
        if (request.method === "GET" && /^\/sessions\/[^/]+$/.test(url.pathname)) {
            respondJson(response, 200, await runtime.getSession(decodeURIComponent(url.pathname.split("/")[2] ?? "")));
            return;
        }
        if (request.method === "POST" &&
            /^\/sessions\/[^/]+\/input$/.test(url.pathname)) {
            const sessionId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.runPrompt({
                mode: readString(body.mode, "normal"),
                prompt: readString(body.prompt),
                sessionId,
                style: readString(body.style, "normal")
            }));
            return;
        }
        if (request.method === "POST" &&
            /^\/sessions\/[^/]+\/attach$/.test(url.pathname)) {
            const sessionId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.attachSession({
                clientId: readString(body.clientId),
                clientType: readString(body.clientType, "web"),
                metadata: isRecord(body.metadata) ? body.metadata : undefined,
                sessionId
            }));
            return;
        }
        if (request.method === "POST" &&
            /^\/sessions\/[^/]+\/detach$/.test(url.pathname)) {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.detachSession(readString(body.attachmentId)));
            return;
        }
        if (request.method === "POST" &&
            /^\/sessions\/[^/]+\/background\/(start|stop|resume)$/.test(url.pathname)) {
            const segments = url.pathname.split("/");
            const sessionId = decodeURIComponent(segments[2] ?? "");
            const action = segments[4];
            const state = action === "start"
                ? "running"
                : action === "resume"
                    ? "running"
                    : "paused";
            respondJson(response, 200, await runtime.setSessionBackgroundState(sessionId, state));
            return;
        }
        if (request.method === "POST" && url.pathname === "/login") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.login({
                apiKey: optionalString(body.apiKey),
                provider: readString(body.provider)
            }));
            return;
        }
        if (request.method === "GET" && url.pathname === "/models") {
            respondJson(response, 200, (await runtime.getStatus()).models);
            return;
        }
        if (request.method === "GET" && url.pathname === "/goals") {
            respondJson(response, 200, await runtime.listGoals());
            return;
        }
        if (request.method === "GET" && url.pathname === "/agents") {
            respondJson(response, 200, await runtime.listFleetAgents());
            return;
        }
        if (request.method === "GET" && /^\/agents\/[^/]+$/.test(url.pathname)) {
            const id = decodeURIComponent(url.pathname.split("/")[2] ?? "");
            const agent = await runtime.getFleetAgent(id);
            respondJson(response, agent ? 200 : 404, agent ?? { error: "Agent not found" });
            return;
        }
        if (request.method === "POST" &&
            /^\/agents\/[^/]+\/(pause|resume|stop|restart)$/.test(url.pathname)) {
            const segments = url.pathname.split("/");
            const id = decodeURIComponent(segments[2] ?? "");
            const action = segments[3];
            const result = action === "pause"
                ? await runtime.pauseFleetAgent(id)
                : action === "resume"
                    ? await runtime.resumeFleetAgent(id)
                    : action === "stop"
                        ? await runtime.stopFleetAgent(id)
                        : await runtime.restartFleetAgent(id);
            respondJson(response, result ? 200 : 404, result ?? { error: "Agent not found" });
            return;
        }
        if (request.method === "GET" && url.pathname === "/fleet") {
            respondJson(response, 200, {
                agents: await runtime.listFleetAgents(),
                enabled: runtime.fleet.isEnabled()
            });
            return;
        }
        if (request.method === "POST" && url.pathname === "/fleet/start") {
            runtime.fleet.start();
            respondJson(response, 200, {
                enabled: runtime.fleet.isEnabled()
            });
            return;
        }
        if (request.method === "POST" && url.pathname === "/fleet/stop") {
            await runtime.fleet.stop();
            respondJson(response, 200, {
                enabled: runtime.fleet.isEnabled()
            });
            return;
        }
        if (request.method === "POST" && url.pathname === "/fleet/assign") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.assignFleetTask({
                mode: readString(body.mode, "normal"),
                parentSessionId: readString(body.parentSessionId),
                role: readString(body.role, "general"),
                style: readString(body.style, "normal"),
                task: readString(body.task)
            }));
            return;
        }
        if (request.method === "POST" && url.pathname === "/model") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.setModel(readString(body.model)));
            return;
        }
        if (request.method === "GET" && url.pathname === "/memory/search") {
            respondJson(response, 200, await runtime.searchMemory(url.searchParams.get("q") ?? ""));
            return;
        }
        if (request.method === "POST" && url.pathname === "/memory/global/remember") {
            const body = await readJsonBody(request);
            await runtime.rememberGlobal(readString(body.text));
            respondJson(response, 204, {});
            return;
        }
        if (request.method === "GET" && (url.pathname === "/timeline" || url.pathname === "/timeline/recent")) {
            respondJson(response, 200, await runtime.timelineStore.listRecent());
            return;
        }
        if (request.method === "GET" && url.pathname.startsWith("/timeline/filter/")) {
            const type = url.pathname.slice("/timeline/filter/".length);
            respondJson(response, 200, await runtime.timelineStore.filterByType(type));
            return;
        }
        if (request.method === "GET" && url.pathname === "/dossiers/user") {
            respondJson(response, 200, await runtime.getUserDossier());
            return;
        }
        if (request.method === "POST" && url.pathname === "/dossiers/user/generate") {
            respondJson(response, 200, await runtime.generateUserDossier());
            return;
        }
        if (request.method === "GET" && url.pathname === "/dossiers/project") {
            respondJson(response, 200, await runtime.getProjectDossier());
            return;
        }
        if (request.method === "POST" && url.pathname === "/dossiers/project/generate") {
            respondJson(response, 200, await runtime.generateProjectDossier());
            return;
        }
        if (request.method === "GET" && url.pathname === "/mcp/marketplace") {
            respondJson(response, 200, await runtime.getUnifiedMarketplace());
            return;
        }
        if (request.method === "GET" && url.pathname === "/mcp/search") {
            respondJson(response, 200, await runtime.searchMarketplace(url.searchParams.get("q") ?? ""));
            return;
        }
        if (request.method === "GET" && url.pathname === "/mcp/favorites") {
            respondJson(response, 200, await runtime.listMcpFavorites());
            return;
        }
        if (request.method === "POST" && url.pathname === "/mcp/favorite") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.favoriteMcp(readString(body.name)));
            return;
        }
        if (request.method === "POST" && url.pathname === "/mcp/unfavorite") {
            const body = await readJsonBody(request);
            respondJson(response, 200, {
                removed: await runtime.unfavoriteMcp(readString(body.name))
            });
            return;
        }
        if (request.method === "GET" && url.pathname === "/mcp/sets") {
            respondJson(response, 200, await runtime.listMcpSets());
            return;
        }
        if (request.method === "POST" && url.pathname === "/mcp/sets/save") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.saveMcpSet({
                description: optionalString(body.description),
                name: readString(body.name),
                projectId: optionalString(body.projectId),
                serverNames: Array.isArray(body.serverNames)
                    ? body.serverNames.filter((value) => typeof value === "string")
                    : []
            }));
            return;
        }
        if (request.method === "POST" && url.pathname === "/mcp/sets/assign") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.assignProjectMcpSet(readString(body.projectId), readString(body.setId)));
            return;
        }
        if (request.method === "POST" && url.pathname === "/auth/pairings") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.createDevicePairing({
                expiresInMinutes: typeof body.expiresInMinutes === "number"
                    ? body.expiresInMinutes
                    : undefined,
                label: optionalString(body.label),
                ownerId: optionalString(body.ownerId)
            }));
            return;
        }
        if (request.method === "GET" && url.pathname === "/auth/pairings") {
            respondJson(response, 200, await runtime.listPairings());
            return;
        }
        if (request.method === "GET" && url.pathname === "/auth/sessions") {
            respondJson(response, 200, await runtime.listAuthSessions());
            return;
        }
        if (request.method === "POST" && url.pathname === "/auth/sessions") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.createAuthSession({
                clientType: readString(body.clientType, "web"),
                deviceLabel: readString(body.deviceLabel, "Linked device"),
                ownerId: optionalString(body.ownerId)
            }));
            return;
        }
        if (request.method === "GET" && url.pathname === "/workers") {
            respondJson(response, 200, await runtime.remoteWorkers.list());
            return;
        }
        if (request.method === "POST" && url.pathname === "/workers") {
            const body = await readJsonBody(request);
            respondJson(response, 200, await runtime.remoteWorkers.add({
                capabilities: Array.isArray(body.capabilities)
                    ? body.capabilities.filter((value) => typeof value === "string")
                    : [],
                connectionType: readString(body.connectionType, "ssh"),
                host: readString(body.host),
                id: readString(body.id),
                name: readString(body.name),
                port: typeof body.port === "number" ? body.port : undefined,
                role: readString(body.role, "general"),
                status: readString(body.status, "offline"),
                username: optionalString(body.username),
                workingDirectory: optionalString(body.workingDirectory)
            }));
            return;
        }
        if (request.method === "POST" && url.pathname.startsWith("/workers/connect/")) {
            respondJson(response, 200, await runtime.remoteWorkers.connect(url.pathname.slice("/workers/connect/".length)));
            return;
        }
        if (request.method === "POST" && url.pathname.startsWith("/workers/disconnect/")) {
            respondJson(response, 200, await runtime.remoteWorkers.disconnect(url.pathname.slice("/workers/disconnect/".length)));
            return;
        }
        if (request.method === "POST" && url.pathname.startsWith("/workers/test/")) {
            respondJson(response, 200, await runtime.remoteWorkers.testConnection(url.pathname.slice("/workers/test/".length)));
            return;
        }
        if (request.method === "DELETE" && url.pathname.startsWith("/workers/")) {
            respondJson(response, 200, {
                removed: await runtime.remoteWorkers.remove(url.pathname.slice("/workers/".length))
            });
            return;
        }
        respondJson(response, 404, {
            error: "Not found"
        });
    }
    catch (error) {
        respondJson(response, 500, {
            error: error instanceof Error ? error.message : "Unexpected server failure."
        });
    }
}
async function readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function respondJson(response, statusCode, value) {
    const body = statusCode === 204 ? "" : `${JSON.stringify(value, null, 2)}\n`;
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
    });
    response.end(body);
}
function optionalString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function readString(value, fallback) {
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }
    if (fallback !== undefined) {
        return fallback;
    }
    throw new Error("Expected a non-empty string.");
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=server.js.map