import type {
  AgentMode,
  ApprovalRequest,
  AuthSession,
  BackgroundTaskView,
  DevicePairing,
  FleetAgentRecord,
  MarketplaceEntry,
  McpFavoriteRecord,
  McpSetRecord,
  ModelRuntimeSnapshot,
  ProjectDossier,
  QueueItem,
  SessionRecord,
  SessionClientAttachment,
  SessionRegistryEntry,
  SessionSummary,
  TimelineEvent,
  UserDossier
} from "@chatgpt-code/runtime-core";

export interface DaemonClientOptions {
  baseUrl?: string;
}

export interface DaemonEventMap {
  session: SessionRecord;
  status: unknown;
  timeline: TimelineEvent;
}

export class DaemonClient {
  readonly baseUrl: string;

  constructor(options: DaemonClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://127.0.0.1:4017";
  }

  async createSession(): Promise<SessionRecord> {
    return this.post("/sessions");
  }

  async createAuthSession(input: {
    clientType: "tui" | "web" | "mobile" | "remote" | "desktop" | "daemon";
    deviceLabel: string;
    ownerId?: string;
  }): Promise<AuthSession> {
    return this.post("/auth/sessions", input);
  }

  async createDevicePairing(input?: {
    expiresInMinutes?: number;
    label?: string;
    ownerId?: string;
  }): Promise<DevicePairing> {
    return this.post("/auth/pairings", input);
  }

  async generateProjectDossier(): Promise<ProjectDossier> {
    return this.post("/dossiers/project/generate");
  }

  async generateUserDossier(): Promise<UserDossier> {
    return this.post("/dossiers/user/generate");
  }

  async getMarketplace(): Promise<MarketplaceEntry[]> {
    return this.get("/mcp/marketplace");
  }

  async getOrchestratorQueue(): Promise<QueueItem[]> {
    return this.get("/orchestrator/queue");
  }

  async getOrchestratorStatus<T = unknown>(): Promise<T> {
    return this.get("/orchestrator/status");
  }

  async listGoals<T = unknown[]>(): Promise<T> {
    return this.get("/goals");
  }

  async listTasks<T = BackgroundTaskView[]>(): Promise<T> {
    return this.get("/tasks");
  }

  async getTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.get(`/tasks/${encodeURIComponent(id)}`);
  }

  async startTask<T = BackgroundTaskView>(input: {
    mode?: AgentMode;
    prompt?: string;
    sessionId?: string;
    style?: "normal" | "plan" | "ultra";
    taskId?: string;
  }): Promise<T> {
    return this.post("/tasks/start", input);
  }

  async pauseTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.post(`/tasks/${encodeURIComponent(id)}/pause`);
  }

  async resumeTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.post(`/tasks/${encodeURIComponent(id)}/resume`);
  }

  async stopTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.post(`/tasks/${encodeURIComponent(id)}/stop`);
  }

  async cancelTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.post(`/tasks/${encodeURIComponent(id)}/cancel`);
  }

  async retryTask<T = BackgroundTaskView>(id: string): Promise<T> {
    return this.post(`/tasks/${encodeURIComponent(id)}/retry`);
  }

  async listApprovals(): Promise<ApprovalRequest[]> {
    return this.get("/approvals");
  }

  async listAuthSessions(): Promise<AuthSession[]> {
    return this.get("/auth/sessions");
  }

  async listFleet<T = unknown>(): Promise<T> {
    return this.get("/fleet");
  }

  async listAgents<T = FleetAgentRecord[]>(): Promise<T> {
    return this.get("/agents");
  }

  async getAgent<T = FleetAgentRecord>(id: string): Promise<T> {
    return this.get(`/agents/${encodeURIComponent(id)}`);
  }

  async startFleet(): Promise<{ enabled: boolean }> {
    return this.post("/fleet/start");
  }

  async stopFleet(): Promise<{ enabled: boolean }> {
    return this.post("/fleet/stop");
  }

  async assignFleet(input: {
    mode: AgentMode;
    parentSessionId: string;
    role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
    style: "normal" | "plan" | "ultra";
    task: string;
  }): Promise<unknown> {
    return this.post("/fleet/assign", input);
  }

  async pauseAgent<T = FleetAgentRecord>(id: string): Promise<T> {
    return this.post(`/agents/${encodeURIComponent(id)}/pause`);
  }

  async resumeAgent<T = FleetAgentRecord>(id: string): Promise<T> {
    return this.post(`/agents/${encodeURIComponent(id)}/resume`);
  }

  async stopAgent<T = FleetAgentRecord>(id: string): Promise<T> {
    return this.post(`/agents/${encodeURIComponent(id)}/stop`);
  }

  async restartAgent<T = FleetAgentRecord>(id: string): Promise<T> {
    return this.post(`/agents/${encodeURIComponent(id)}/restart`);
  }

  async listWorkers<T = unknown[]>(): Promise<T> {
    return this.get("/workers");
  }

  async addWorker<T = unknown>(input: {
    capabilities: string[];
    connectionType: "local" | "ssh" | "container" | "subprocess";
    host: string;
    id: string;
    name: string;
    port?: number;
    role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
    status: "idle" | "running" | "waiting" | "degraded" | "offline";
    username?: string;
    workingDirectory?: string;
  }): Promise<T> {
    return this.post("/workers", input);
  }

  async connectWorker<T = unknown>(id: string): Promise<T> {
    return this.post(`/workers/connect/${encodeURIComponent(id)}`);
  }

  async disconnectWorker<T = unknown>(id: string): Promise<T> {
    return this.post(`/workers/disconnect/${encodeURIComponent(id)}`);
  }

  async testWorker<T = unknown>(id: string): Promise<T> {
    return this.post(`/workers/test/${encodeURIComponent(id)}`);
  }

  async getProjectDossier(): Promise<ProjectDossier | undefined> {
    return this.get("/dossiers/project");
  }

  async getStatus<T = unknown>(): Promise<T> {
    return this.get("/status");
  }

  async getUserDossier(): Promise<UserDossier | undefined> {
    return this.get("/dossiers/user");
  }

  async listModels<T = unknown>(): Promise<T> {
    return this.get("/models");
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.get("/sessions");
  }

  async listDevicePairings(): Promise<DevicePairing[]> {
    return this.get("/auth/pairings");
  }

  async listMcpFavorites(): Promise<McpFavoriteRecord[]> {
    return this.get("/mcp/favorites");
  }

  async listMcpSets(): Promise<McpSetRecord[]> {
    return this.get("/mcp/sets");
  }

  async listWatchers<T = unknown[]>(): Promise<T> {
    return this.get("/watchers");
  }

  async login(input: {
    apiKey?: string;
    provider: "local" | "openai" | "anthropic" | "mistral";
  }): Promise<ModelRuntimeSnapshot> {
    return this.post("/login", input);
  }

  async rememberGlobal(text: string): Promise<void> {
    await this.post("/memory/global/remember", {
      text
    });
  }

  async approveRequest(id: string): Promise<ApprovalRequest | undefined> {
    return this.post(`/approvals/${encodeURIComponent(id)}/approve`);
  }

  async rejectRequest(id: string): Promise<ApprovalRequest | undefined> {
    return this.post(`/approvals/${encodeURIComponent(id)}/reject`);
  }

  async runPrompt(input: {
    mode: AgentMode;
    prompt: string;
    sessionId: string;
    style: "normal" | "plan" | "ultra";
  }): Promise<{
    content: string;
    session: SessionRecord;
  }> {
    return this.post("/chat", input);
  }

  async searchMemory<T = unknown>(keyword: string): Promise<T> {
    return this.get(`/memory/search?q=${encodeURIComponent(keyword)}`);
  }

  async searchMarketplace(keyword: string): Promise<MarketplaceEntry[]> {
    return this.get(`/mcp/search?q=${encodeURIComponent(keyword)}`);
  }

  async getSession<T = { attachments: SessionClientAttachment[]; registry?: SessionRegistryEntry; session?: SessionRecord }>(
    id: string
  ): Promise<T> {
    return this.get(`/sessions/${encodeURIComponent(id)}`);
  }

  async sendSessionInput(input: {
    mode: AgentMode;
    prompt: string;
    sessionId: string;
    style: "normal" | "plan" | "ultra";
  }): Promise<{
    content: string;
    session: SessionRecord;
  }> {
    return this.post(`/sessions/${encodeURIComponent(input.sessionId)}/input`, {
      mode: input.mode,
      prompt: input.prompt,
      style: input.style
    });
  }

  async attachSession(input: {
    clientId: string;
    clientType: "tui" | "web" | "mobile" | "remote" | "desktop" | "daemon";
    metadata?: Record<string, unknown>;
    sessionId: string;
  }): Promise<SessionClientAttachment> {
    return this.post(`/sessions/${encodeURIComponent(input.sessionId)}/attach`, {
      clientId: input.clientId,
      clientType: input.clientType,
      metadata: input.metadata
    });
  }

  async detachSession(attachmentId: string, sessionId: string): Promise<SessionClientAttachment | undefined> {
    return this.post(`/sessions/${encodeURIComponent(sessionId)}/detach`, {
      attachmentId
    });
  }

  async setSessionBackgroundState(
    sessionId: string,
    action: "resume" | "start" | "stop"
  ): Promise<SessionRegistryEntry | undefined> {
    return this.post(`/sessions/${encodeURIComponent(sessionId)}/background/${action}`);
  }

  async setModel(model: string): Promise<ModelRuntimeSnapshot> {
    return this.post("/model", {
      model
    });
  }

  async cancelWatcher(id: string): Promise<unknown> {
    return this.post(`/watchers/${encodeURIComponent(id)}/cancel`);
  }

  async getWatcher<T = unknown>(id: string): Promise<T> {
    return this.get(`/watchers/${encodeURIComponent(id)}`);
  }

  async favoriteMcp(name: string): Promise<McpFavoriteRecord> {
    return this.post("/mcp/favorite", { name });
  }

  async unfavoriteMcp(name: string): Promise<{ removed: boolean }> {
    return this.post("/mcp/unfavorite", { name });
  }

  async saveMcpSet(input: {
    description?: string;
    name: string;
    projectId?: string;
    serverNames: string[];
  }): Promise<McpSetRecord> {
    return this.post("/mcp/sets/save", input);
  }

  async assignMcpSet(projectId: string, setId: string): Promise<{
    createdAt: number;
    projectId: string;
    setId: string;
    updatedAt: number;
  }> {
    return this.post("/mcp/sets/assign", {
      projectId,
      setId
    });
  }

  async timelineRecent(): Promise<TimelineEvent[]> {
    return this.get("/timeline/recent");
  }

  async removeWorker(id: string): Promise<{ removed: boolean }> {
    const response = await fetch(`${this.baseUrl}/workers/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    return readResponse(response);
  }

  subscribe(
    listener: <K extends keyof DaemonEventMap>(
      event: { payload: DaemonEventMap[K]; type: K }
    ) => void
  ): () => void {
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsUrl}/events`);
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as {
        payload: DaemonEventMap[keyof DaemonEventMap];
        type: keyof DaemonEventMap;
      };
      listener(payload as never);
    });

    return () => {
      socket.close();
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return readResponse<T>(response);
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: body
        ? {
            "Content-Type": "application/json"
          }
        : undefined,
      method: "POST"
    });
    return readResponse<T>(response);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
