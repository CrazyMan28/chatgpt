export class DaemonClient {
    baseUrl;
    constructor(options = {}) {
        this.baseUrl = options.baseUrl ?? "http://127.0.0.1:4017";
    }
    async createSession() {
        return this.post("/sessions");
    }
    async createAuthSession(input) {
        return this.post("/auth/sessions", input);
    }
    async createDevicePairing(input) {
        return this.post("/auth/pairings", input);
    }
    async generateProjectDossier() {
        return this.post("/dossiers/project/generate");
    }
    async generateUserDossier() {
        return this.post("/dossiers/user/generate");
    }
    async getMarketplace() {
        return this.get("/mcp/marketplace");
    }
    async getOrchestratorQueue() {
        return this.get("/orchestrator/queue");
    }
    async getOrchestratorStatus() {
        return this.get("/orchestrator/status");
    }
    async listGoals() {
        return this.get("/goals");
    }
    async listTasks() {
        return this.get("/tasks");
    }
    async getTask(id) {
        return this.get(`/tasks/${encodeURIComponent(id)}`);
    }
    async startTask(input) {
        return this.post("/tasks/start", input);
    }
    async pauseTask(id) {
        return this.post(`/tasks/${encodeURIComponent(id)}/pause`);
    }
    async resumeTask(id) {
        return this.post(`/tasks/${encodeURIComponent(id)}/resume`);
    }
    async stopTask(id) {
        return this.post(`/tasks/${encodeURIComponent(id)}/stop`);
    }
    async cancelTask(id) {
        return this.post(`/tasks/${encodeURIComponent(id)}/cancel`);
    }
    async retryTask(id) {
        return this.post(`/tasks/${encodeURIComponent(id)}/retry`);
    }
    async listApprovals() {
        return this.get("/approvals");
    }
    async listAuthSessions() {
        return this.get("/auth/sessions");
    }
    async listFleet() {
        return this.get("/fleet");
    }
    async listAgents() {
        return this.get("/agents");
    }
    async getAgent(id) {
        return this.get(`/agents/${encodeURIComponent(id)}`);
    }
    async startFleet() {
        return this.post("/fleet/start");
    }
    async stopFleet() {
        return this.post("/fleet/stop");
    }
    async assignFleet(input) {
        return this.post("/fleet/assign", input);
    }
    async pauseAgent(id) {
        return this.post(`/agents/${encodeURIComponent(id)}/pause`);
    }
    async resumeAgent(id) {
        return this.post(`/agents/${encodeURIComponent(id)}/resume`);
    }
    async stopAgent(id) {
        return this.post(`/agents/${encodeURIComponent(id)}/stop`);
    }
    async restartAgent(id) {
        return this.post(`/agents/${encodeURIComponent(id)}/restart`);
    }
    async listWorkers() {
        return this.get("/workers");
    }
    async addWorker(input) {
        return this.post("/workers", input);
    }
    async connectWorker(id) {
        return this.post(`/workers/connect/${encodeURIComponent(id)}`);
    }
    async disconnectWorker(id) {
        return this.post(`/workers/disconnect/${encodeURIComponent(id)}`);
    }
    async testWorker(id) {
        return this.post(`/workers/test/${encodeURIComponent(id)}`);
    }
    async getProjectDossier() {
        return this.get("/dossiers/project");
    }
    async getStatus() {
        return this.get("/status");
    }
    async getUserDossier() {
        return this.get("/dossiers/user");
    }
    async listModels() {
        return this.get("/models");
    }
    async listSessions() {
        return this.get("/sessions");
    }
    async listDevicePairings() {
        return this.get("/auth/pairings");
    }
    async listMcpFavorites() {
        return this.get("/mcp/favorites");
    }
    async listMcpSets() {
        return this.get("/mcp/sets");
    }
    async listWatchers() {
        return this.get("/watchers");
    }
    async login(input) {
        return this.post("/login", input);
    }
    async rememberGlobal(text) {
        await this.post("/memory/global/remember", {
            text
        });
    }
    async approveRequest(id) {
        return this.post(`/approvals/${encodeURIComponent(id)}/approve`);
    }
    async rejectRequest(id) {
        return this.post(`/approvals/${encodeURIComponent(id)}/reject`);
    }
    async runPrompt(input) {
        return this.post("/chat", input);
    }
    async searchMemory(keyword) {
        return this.get(`/memory/search?q=${encodeURIComponent(keyword)}`);
    }
    async searchMarketplace(keyword) {
        return this.get(`/mcp/search?q=${encodeURIComponent(keyword)}`);
    }
    async getSession(id) {
        return this.get(`/sessions/${encodeURIComponent(id)}`);
    }
    async sendSessionInput(input) {
        return this.post(`/sessions/${encodeURIComponent(input.sessionId)}/input`, {
            mode: input.mode,
            prompt: input.prompt,
            style: input.style
        });
    }
    async attachSession(input) {
        return this.post(`/sessions/${encodeURIComponent(input.sessionId)}/attach`, {
            clientId: input.clientId,
            clientType: input.clientType,
            metadata: input.metadata
        });
    }
    async detachSession(attachmentId, sessionId) {
        return this.post(`/sessions/${encodeURIComponent(sessionId)}/detach`, {
            attachmentId
        });
    }
    async setSessionBackgroundState(sessionId, action) {
        return this.post(`/sessions/${encodeURIComponent(sessionId)}/background/${action}`);
    }
    async setModel(model) {
        return this.post("/model", {
            model
        });
    }
    async cancelWatcher(id) {
        return this.post(`/watchers/${encodeURIComponent(id)}/cancel`);
    }
    async getWatcher(id) {
        return this.get(`/watchers/${encodeURIComponent(id)}`);
    }
    async favoriteMcp(name) {
        return this.post("/mcp/favorite", { name });
    }
    async unfavoriteMcp(name) {
        return this.post("/mcp/unfavorite", { name });
    }
    async saveMcpSet(input) {
        return this.post("/mcp/sets/save", input);
    }
    async assignMcpSet(projectId, setId) {
        return this.post("/mcp/sets/assign", {
            projectId,
            setId
        });
    }
    async timelineRecent() {
        return this.get("/timeline/recent");
    }
    async removeWorker(id) {
        const response = await fetch(`${this.baseUrl}/workers/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
        return readResponse(response);
    }
    subscribe(listener) {
        const wsUrl = this.baseUrl.replace(/^http/, "ws");
        const socket = new WebSocket(`${wsUrl}/events`);
        socket.addEventListener("message", (event) => {
            const payload = JSON.parse(String(event.data));
            listener(payload);
        });
        return () => {
            socket.close();
        };
    }
    async get(path) {
        const response = await fetch(`${this.baseUrl}${path}`);
        return readResponse(response);
    }
    async post(path, body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            body: body ? JSON.stringify(body) : undefined,
            headers: body
                ? {
                    "Content-Type": "application/json"
                }
                : undefined,
            method: "POST"
        });
        return readResponse(response);
    }
}
async function readResponse(response) {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `${response.status} ${response.statusText}`);
    }
    if (response.status === 204) {
        return undefined;
    }
    return (await response.json());
}
//# sourceMappingURL=index.js.map