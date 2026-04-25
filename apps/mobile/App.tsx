import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";

type SessionSummary = {
  id: string;
  title: string;
  turnCount: number;
  updatedAt: number;
};

type TranscriptEntry = {
  content: string;
  createdAt: number;
  id: string;
  role: "assistant" | "system" | "tool" | "user";
  status?: string;
};

type SessionDetail = {
  attachments: {
    attachedAt: number;
    clientId: string;
    clientType: string;
    id: string;
    isActive: boolean;
  }[];
  registry?: {
    backgroundState: string;
    cwd: string;
    model: string;
    provider: string;
    scope: string;
    style: string;
  };
  session?: {
    id: string;
    title: string;
    transcript: TranscriptEntry[];
  };
};

type ApprovalRequest = {
  detail: string;
  id: string;
  kind: string;
  scope?: string;
  state: "approved" | "cancelled" | "pending" | "rejected";
  summary: string;
};

type WatcherRecord = {
  id: string;
  status: string;
  summary: string;
  type: string;
};

type MarketplaceEntry = {
  category: string;
  description: string;
  enabledStatus: string;
  favorite: boolean;
  installStatus: string;
  name: string;
  tags: string[];
  version?: string;
};

type PairingRecord = {
  code: string;
  expiresAt: number;
  id: string;
  label: string;
  state: string;
};

type OrchestratorStatus = {
  approvals?: {
    pending: number;
    total: number;
  };
  fleet?: {
    agents: {
      currentScope?: string;
      id: string;
      recentOutput?: string[];
      role: string;
      state: string;
      summary?: string;
      task: string;
    }[];
    enabled: boolean;
  };
  goals?: {
    id: string;
    nextBestAction?: string;
    state: string;
    title: string;
  }[];
  project?: {
    displayName: string;
    path: string;
  };
  provider: {
    loginLabel: string;
    model: string;
    providerLabel: string;
  };
  queue?: {
    id: string;
    state: string;
    summary: string;
    type: string;
  }[];
  tasks: {
    approvalRequestIds: string[];
    blockedReason?: string;
    currentStep?: string;
    id: string;
    isRunning: boolean;
    kind: string;
    lastResultSummary?: string;
    retries: number;
    state: string;
    title: string;
    watcherIds: string[];
  }[];
  toolCount: number;
  watchers?: {
    active: number;
    total: number;
  };
  workers: {
    id: string;
    name: string;
    status: string;
  }[];
};

const DEFAULT_BASE_URL = "http://127.0.0.1:4017";

export default function App(): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [watchers, setWatchers] = useState<WatcherRecord[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceEntry[]>([]);
  const [pairings, setPairings] = useState<PairingRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"assistant" | "mcp" | "ops">("assistant");

  const summary = useMemo(() => {
    if (!status) {
      return "Disconnected";
    }

    const taskCount = status.tasks?.length ?? 0;
    const workerCount = status.workers?.length ?? 0;
    return `${status.provider.providerLabel} / ${status.provider.model} • ${taskCount} tasks • ${workerCount} workers`;
  }, [status]);

  const selectedTranscript = selectedSession?.session?.transcript ?? [];

  useEffect(() => {
    void refreshAll();
  }, [baseUrl]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshAll();
    }, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, [baseUrl, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedSession(null);
      return;
    }

    void loadSession(selectedSessionId);
  }, [baseUrl, selectedSessionId]);

  async function refreshAll(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [
        statusResponse,
        sessionsResponse,
        approvalsResponse,
        watchersResponse,
        marketplaceResponse,
        pairingsResponse
      ] = await Promise.all([
        requestJson<OrchestratorStatus>(`${baseUrl}/orchestrator/status`),
        requestJson<SessionSummary[]>(`${baseUrl}/sessions`),
        requestJson<ApprovalRequest[]>(`${baseUrl}/approvals`),
        requestJson<WatcherRecord[]>(`${baseUrl}/watchers`),
        requestJson<MarketplaceEntry[]>(`${baseUrl}/mcp/marketplace`),
        requestJson<PairingRecord[]>(`${baseUrl}/auth/pairings`)
      ]);

      setStatus(statusResponse);
      setSessions(sessionsResponse);
      setApprovals(approvalsResponse);
      setWatchers(watchersResponse);
      setMarketplace(marketplaceResponse);
      setPairings(pairingsResponse);

      if (!selectedSessionId && sessionsResponse.length > 0) {
        setSelectedSessionId(sessionsResponse[0].id);
      } else if (selectedSessionId) {
        await loadSession(selectedSessionId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unexpected mobile error.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(sessionId: string): Promise<void> {
    try {
      const detail = await requestJson<SessionDetail>(
        `${baseUrl}/sessions/${encodeURIComponent(sessionId)}`
      );
      setSelectedSession(detail);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load session.");
    }
  }

  async function createSession(): Promise<void> {
    await runBusy("Creating session", async () => {
      const session = await requestJson<SessionSummary>(`${baseUrl}/sessions`, {
        method: "POST"
      });
      await refreshAll();
      setSelectedSessionId(session.id);
      setTab("assistant");
    });
  }

  async function sendPrompt(): Promise<void> {
    if (!selectedSessionId || prompt.trim().length === 0) {
      return;
    }

    const nextPrompt = prompt.trim();
    setPrompt("");

    await runBusy("Sending prompt", async () => {
      await requestJson(`${baseUrl}/sessions/${encodeURIComponent(selectedSessionId)}/input`, {
        body: JSON.stringify({
          mode: "normal",
          prompt: nextPrompt,
          style: "normal"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      await Promise.all([refreshAll(), loadSession(selectedSessionId)]);
    });
  }

  async function updateApproval(
    id: string,
    action: "approve" | "reject"
  ): Promise<void> {
    await runBusy(`${action === "approve" ? "Approving" : "Rejecting"} request`, async () => {
      await requestJson(`${baseUrl}/approvals/${encodeURIComponent(id)}/${action}`, {
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function createPairing(): Promise<void> {
    await runBusy("Creating pairing code", async () => {
      await requestJson(`${baseUrl}/auth/pairings`, {
        body: JSON.stringify({
          expiresInMinutes: 15,
          label: "Android companion"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function setBackgroundState(action: "resume" | "start" | "stop"): Promise<void> {
    if (!selectedSessionId) {
      return;
    }

    await runBusy("Updating background state", async () => {
      await requestJson(
        `${baseUrl}/sessions/${encodeURIComponent(selectedSessionId)}/background/${action}`,
        {
          method: "POST"
        }
      );
      await Promise.all([refreshAll(), loadSession(selectedSessionId)]);
    });
  }

  async function favoriteMarketplaceEntry(name: string): Promise<void> {
    await runBusy("Saving MCP favorite", async () => {
      await requestJson(`${baseUrl}/mcp/favorite`, {
        body: JSON.stringify({ name }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function updateTask(
    id: string,
    action: "pause" | "resume" | "stop" | "retry"
  ): Promise<void> {
    await runBusy(`Task ${action}`, async () => {
      await requestJson(`${baseUrl}/tasks/${encodeURIComponent(id)}/${action}`, {
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function updateAgent(
    id: string,
    action: "pause" | "resume" | "stop" | "restart"
  ): Promise<void> {
    await runBusy(`Agent ${action}`, async () => {
      await requestJson(`${baseUrl}/agents/${encodeURIComponent(id)}/${action}`, {
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function toggleFleet(action: "start" | "stop"): Promise<void> {
    await runBusy(`Fleet ${action}`, async () => {
      await requestJson(`${baseUrl}/fleet/${action}`, {
        method: "POST"
      });
      await refreshAll();
    });
  }

  async function runBusy(label: string, action: () => Promise<void>): Promise<void> {
    setBusyLabel(label);
    setError(null);

    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Mobile request failed.");
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Phone Client</Text>
          <Text style={styles.heroTitle}>ChatGPT Code</Text>
          <Text style={styles.heroSubtitle}>
            Live sessions, approvals, MCP state, and background control from the orchestrator.
          </Text>
        </View>

        <Card>
          <Text style={styles.cardLabel}>Orchestrator URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setBaseUrl}
            style={styles.input}
            value={baseUrl}
          />
          <View style={styles.buttonRow}>
            <ActionButton label="Refresh" onPress={() => void refreshAll()} />
            <ActionButton label="New Session" onPress={() => void createSession()} tone="accent" />
            <ActionButton label="Pair Phone" onPress={() => void createPairing()} />
            <ActionButton label="Fleet Start" onPress={() => void toggleFleet("start")} />
            <ActionButton label="Fleet Stop" onPress={() => void toggleFleet("stop")} />
          </View>
          <Text style={styles.statusSummary}>{summary}</Text>
          <Text style={styles.statusMeta}>
            {status?.provider.loginLabel ?? "Not logged in"}
          </Text>
          {busyLabel ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#1f5eff" />
              <Text style={styles.busyText}>{busyLabel}</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        <View style={styles.tabRow}>
          <TabChip active={tab === "assistant"} label="Assistant" onPress={() => setTab("assistant")} />
          <TabChip active={tab === "ops"} label="Ops" onPress={() => setTab("ops")} />
          <TabChip active={tab === "mcp"} label="MCP" onPress={() => setTab("mcp")} />
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#1f5eff" />
            <Text style={styles.loadingText}>Syncing orchestrator state…</Text>
          </View>
        ) : null}

        {tab === "assistant" ? (
          <>
            <Card title="Sessions">
              {sessions.length === 0 ? (
                <Text style={styles.muted}>No sessions yet.</Text>
              ) : (
                sessions.map((session) => (
                  <Pressable
                    key={session.id}
                    onPress={() => setSelectedSessionId(session.id)}
                    style={[
                      styles.sessionRow,
                      selectedSessionId === session.id && styles.sessionRowActive
                    ]}
                  >
                    <View style={styles.sessionRowText}>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                      <Text style={styles.sessionMeta}>
                        {session.turnCount} turns • {formatTime(session.updatedAt)}
                      </Text>
                    </View>
                    <Text style={styles.sessionId}>{session.id.slice(0, 10)}</Text>
                  </Pressable>
                ))
              )}
            </Card>

            <Card title={selectedSession?.session?.title ?? "Session"}>
              <Text style={styles.sectionMeta}>
                {selectedSession?.registry
                  ? `${selectedSession.registry.scope} • ${selectedSession.registry.cwd}`
                  : "Select a session to continue it"}
              </Text>
              <View style={styles.buttonRow}>
                <ActionButton label="Background Start" onPress={() => void setBackgroundState("start")} />
                <ActionButton label="Pause" onPress={() => void setBackgroundState("stop")} />
                <ActionButton label="Resume" onPress={() => void setBackgroundState("resume")} />
              </View>
              <View style={styles.transcript}>
                {selectedTranscript.length === 0 ? (
                  <Text style={styles.muted}>No transcript available yet.</Text>
                ) : (
                  selectedTranscript.slice(-8).map((entry) => (
                    <View key={entry.id} style={styles.messageBlock}>
                      <Text style={styles.messageRole}>{entry.role.toUpperCase()}</Text>
                      <Text style={styles.messageText}>{entry.content}</Text>
                    </View>
                  ))
                )}
              </View>
              <TextInput
                multiline
                onChangeText={setPrompt}
                placeholder="Continue this session"
                placeholderTextColor="#8f95a3"
                style={styles.composer}
                value={prompt}
              />
              <ActionButton
                disabled={!selectedSessionId || prompt.trim().length === 0}
                label="Send Prompt"
                onPress={() => void sendPrompt()}
                tone="accent"
              />
            </Card>
          </>
        ) : null}

        {tab === "ops" ? (
          <>
            <Card title="Approvals">
              {approvals.length === 0 ? (
                <Text style={styles.muted}>No approval requests.</Text>
              ) : (
                approvals.map((approval) => (
                  <View key={approval.id} style={styles.stackRow}>
                    <Text style={styles.cardTitleText}>{approval.summary}</Text>
                    <Text style={styles.sectionMeta}>
                      {approval.kind} • {approval.scope ?? "scope?"} • {approval.state}
                    </Text>
                    <Text style={styles.muted}>{approval.detail}</Text>
                    {approval.state === "pending" ? (
                      <View style={styles.buttonRow}>
                        <ActionButton label="Approve" onPress={() => void updateApproval(approval.id, "approve")} tone="accent" />
                        <ActionButton label="Reject" onPress={() => void updateApproval(approval.id, "reject")} />
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </Card>

            <Card title="Watchers">
              {watchers.length === 0 ? (
                <Text style={styles.muted}>No watchers running.</Text>
              ) : (
                watchers.map((watcher) => (
                  <View key={watcher.id} style={styles.inlineStatRow}>
                    <Text style={styles.cardTitleText}>{watcher.summary}</Text>
                    <Text style={styles.inlinePill}>{watcher.type}</Text>
                    <Text style={styles.inlinePill}>{watcher.status}</Text>
                  </View>
                ))
              )}
            </Card>

            <Card title="Goals">
              {(status?.goals ?? []).length === 0 ? (
                <Text style={styles.muted}>No goals tracked.</Text>
              ) : (
                (status?.goals ?? []).map((goal) => (
                  <View key={goal.id} style={styles.stackRow}>
                    <Text style={styles.cardTitleText}>{goal.title}</Text>
                    <Text style={styles.sectionMeta}>
                      {goal.id} • {goal.state}
                    </Text>
                    <Text style={styles.muted}>
                      {goal.nextBestAction ?? "No next action set."}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Card title="Tasks">
              {(status?.tasks ?? []).length === 0 ? (
                <Text style={styles.muted}>No tracked tasks.</Text>
              ) : (
                (status?.tasks ?? []).map((task) => (
                  <View key={task.id} style={styles.stackRow}>
                    <Text style={styles.cardTitleText}>{task.title}</Text>
                    <Text style={styles.sectionMeta}>
                      {task.id} • {task.kind} • {task.state}{task.isRunning ? " • active" : ""}
                    </Text>
                    <Text style={styles.muted}>
                      {task.currentStep ?? task.blockedReason ?? task.lastResultSummary ?? "No recent output."}
                    </Text>
                    <Text style={styles.sectionMeta}>
                      approvals {task.approvalRequestIds.length} • watchers {task.watcherIds.length} • retries {task.retries}
                    </Text>
                    <View style={styles.buttonRow}>
                      <ActionButton label="Pause" onPress={() => void updateTask(task.id, "pause")} />
                      <ActionButton label="Resume" onPress={() => void updateTask(task.id, "resume")} />
                      <ActionButton label="Stop" onPress={() => void updateTask(task.id, "stop")} />
                      <ActionButton label="Retry" onPress={() => void updateTask(task.id, "retry")} tone="accent" />
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card title="Fleet and Workers">
              <Text style={styles.sectionMeta}>
                Fleet: {status?.fleet?.enabled ? "enabled" : "disabled"} • {(status?.fleet?.agents.length ?? 0)} agents
              </Text>
              {(status?.fleet?.agents ?? []).map((agent) => (
                <View key={agent.id} style={styles.stackRow}>
                  <Text style={styles.cardTitleText}>{agent.id}</Text>
                  <Text style={styles.sectionMeta}>
                    {agent.role} • {agent.state} • {agent.currentScope ?? "workspace"}
                  </Text>
                  <Text style={styles.muted}>{agent.task}</Text>
                  <Text style={styles.sectionMeta}>
                    {agent.summary ?? agent.recentOutput?.slice(-1)[0] ?? "No recent output."}
                  </Text>
                  <View style={styles.buttonRow}>
                    <ActionButton label="Pause" onPress={() => void updateAgent(agent.id, "pause")} />
                    <ActionButton label="Resume" onPress={() => void updateAgent(agent.id, "resume")} />
                    <ActionButton label="Stop" onPress={() => void updateAgent(agent.id, "stop")} />
                    <ActionButton label="Restart" onPress={() => void updateAgent(agent.id, "restart")} tone="accent" />
                  </View>
                </View>
              ))}
              <Text style={[styles.sectionMeta, styles.sectionSpacer]}>
                Workers: {status?.workers.length ?? 0}
              </Text>
              {(status?.workers ?? []).map((worker) => (
                <Text key={worker.id} style={styles.muted}>
                  {worker.name} • {worker.status}
                </Text>
              ))}
            </Card>

            <Card title="Pairings">
              {pairings.length === 0 ? (
                <Text style={styles.muted}>No pairings issued yet.</Text>
              ) : (
                pairings.map((pairing) => (
                  <View key={pairing.id} style={styles.inlineStatRow}>
                    <Text style={styles.cardTitleText}>{pairing.label}</Text>
                    <Text style={styles.pairingCode}>{pairing.code}</Text>
                    <Text style={styles.inlinePill}>{pairing.state}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "mcp" ? (
          <>
            <Card title="Marketplace">
              {marketplace.slice(0, 12).map((entry) => (
                <View key={entry.name} style={styles.stackRow}>
                  <View style={styles.inlineStatRow}>
                    <Text style={styles.cardTitleText}>{entry.name}</Text>
                    <Text style={styles.inlinePill}>{entry.category}</Text>
                    <Text style={styles.inlinePill}>{entry.installStatus}</Text>
                  </View>
                  <Text style={styles.muted}>{entry.description}</Text>
                  <Text style={styles.sectionMeta}>
                    {entry.enabledStatus} • {entry.version ?? "unknown version"}
                  </Text>
                  <View style={styles.buttonRow}>
                    <ActionButton
                      label={entry.favorite ? "Favorited" : "Favorite"}
                      onPress={() => void favoriteMarketplaceEntry(entry.name)}
                      tone={entry.favorite ? "secondary" : "accent"}
                    />
                  </View>
                </View>
              ))}
            </Card>

            <Card title="Project Signals">
              <Text style={styles.muted}>
                Marketplace install, update, and full project-scoped set loading remain server-driven. The mobile client exposes browse, favorite, and live state today while direct install/update controls still need a dedicated mobile flow.
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card(
  props: {
    children: React.ReactNode;
    title?: string;
  }
): React.JSX.Element {
  return (
    <View style={styles.card}>
      {props.title ? <Text style={styles.cardHeading}>{props.title}</Text> : null}
      {props.children}
    </View>
  );
}

function ActionButton(
  props: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
    tone?: "accent" | "secondary";
  }
): React.JSX.Element {
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.actionButton,
        props.tone === "accent" && styles.actionButtonAccent,
        props.disabled && styles.actionButtonDisabled
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          props.tone === "accent" && styles.actionButtonTextAccent
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function TabChip(
  props: {
    active: boolean;
    label: string;
    onPress: () => void;
  }
): React.JSX.Element {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.tabChip, props.active && styles.tabChipActive]}
    >
      <Text style={[styles.tabChipText, props.active && styles.tabChipTextActive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

async function requestJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f2eee6",
    flex: 1
  },
  screen: {
    gap: 14,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 18
  },
  hero: {
    backgroundColor: "#1b2636",
    borderRadius: 24,
    padding: 20
  },
  heroEyebrow: {
    color: "#f0c36c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: "#f7f3ea",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8
  },
  heroSubtitle: {
    color: "#c9d1dc",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  card: {
    backgroundColor: "#fffaf0",
    borderColor: "#d9cdb7",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  cardHeading: {
    color: "#1f2430",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12
  },
  cardLabel: {
    color: "#4f5a67",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "#f2ede0",
    borderColor: "#d0c3ad",
    borderRadius: 14,
    borderWidth: 1,
    color: "#1f2430",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  actionButton: {
    backgroundColor: "#ece5d8",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  actionButtonAccent: {
    backgroundColor: "#1f5eff"
  },
  actionButtonDisabled: {
    opacity: 0.45
  },
  actionButtonText: {
    color: "#1f2430",
    fontSize: 13,
    fontWeight: "700"
  },
  actionButtonTextAccent: {
    color: "#ffffff"
  },
  statusSummary: {
    color: "#1f2430",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14
  },
  statusMeta: {
    color: "#5f6977",
    marginTop: 4
  },
  busyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  busyText: {
    color: "#1f2430",
    fontWeight: "600"
  },
  error: {
    color: "#b6332f",
    marginTop: 12
  },
  tabRow: {
    flexDirection: "row",
    gap: 10
  },
  tabChip: {
    backgroundColor: "#e3dbc9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  tabChipActive: {
    backgroundColor: "#1b2636"
  },
  tabChipText: {
    color: "#4f5a67",
    fontWeight: "700"
  },
  tabChipTextActive: {
    color: "#f7f3ea"
  },
  loadingBlock: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: "#d9cdb7",
    borderRadius: 18,
    borderWidth: 1,
    padding: 22
  },
  loadingText: {
    color: "#4f5a67",
    marginTop: 8
  },
  muted: {
    color: "#65707d",
    lineHeight: 20
  },
  sessionRow: {
    alignItems: "center",
    backgroundColor: "#f4efe4",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 12
  },
  sessionRowActive: {
    borderColor: "#1f5eff",
    borderWidth: 1
  },
  sessionRowText: {
    flex: 1,
    paddingRight: 12
  },
  sessionTitle: {
    color: "#1f2430",
    fontSize: 15,
    fontWeight: "700"
  },
  sessionMeta: {
    color: "#65707d",
    marginTop: 4
  },
  sessionId: {
    color: "#7e8793",
    fontSize: 12,
    fontWeight: "700"
  },
  sectionMeta: {
    color: "#5f6977",
    marginBottom: 10
  },
  sectionSpacer: {
    marginTop: 12
  },
  transcript: {
    gap: 10,
    marginBottom: 12
  },
  messageBlock: {
    backgroundColor: "#f4efe4",
    borderRadius: 14,
    padding: 12
  },
  messageRole: {
    color: "#1f5eff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6
  },
  messageText: {
    color: "#1f2430",
    lineHeight: 20
  },
  composer: {
    backgroundColor: "#f2ede0",
    borderColor: "#d0c3ad",
    borderRadius: 16,
    borderWidth: 1,
    color: "#1f2430",
    marginBottom: 12,
    minHeight: 90,
    padding: 12,
    textAlignVertical: "top"
  },
  stackRow: {
    borderBottomColor: "#e7dece",
    borderBottomWidth: 1,
    gap: 6,
    paddingBottom: 12,
    paddingTop: 4
  },
  inlineStatRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  cardTitleText: {
    color: "#1f2430",
    fontSize: 15,
    fontWeight: "700"
  },
  inlinePill: {
    backgroundColor: "#ece5d8",
    borderRadius: 999,
    color: "#58616d",
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  pairingCode: {
    color: "#1f5eff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2
  }
});
