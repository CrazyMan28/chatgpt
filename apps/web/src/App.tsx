import { useEffect, useState } from "react";

import { DaemonClient } from "@chatgpt-code/client-sdk";

type SessionSummary = {
  id: string;
  title: string;
  turnCount: number;
  updatedAt: number;
};

type ApprovalRequest = {
  id: string;
  kind: string;
  scope?: string;
  state: string;
  summary: string;
};

type WatcherRecord = {
  id: string;
  status: string;
  summary: string;
  type: string;
};

type TaskView = {
  approvalRequestIds: string[];
  blockedReason?: string;
  currentStep?: string;
  id: string;
  isRunning: boolean;
  kind: string;
  lastError?: string;
  retries: number;
  sessionId: string;
  state: string;
  title: string;
  watcherIds: string[];
};

type AgentView = {
  blockers?: string[];
  currentCwd?: string;
  currentScope?: string;
  id: string;
  recentOutput?: string[];
  requestedAction?: string;
  role: string;
  state: string;
  summary?: string;
  task: string;
};

type StatusShape = {
  approvals?: {
    pending: number;
    total: number;
  };
  fleet?: {
    agents: AgentView[];
    enabled: boolean;
  };
  goals?: {
    id: string;
    nextBestAction?: string;
    state: string;
    title: string;
  }[];
  mode: string;
  project?: {
    displayName: string;
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
  sessions?: {
    backgroundState: string;
    sessionId: string;
    title: string;
  }[];
  tasks: TaskView[];
  toolCount: number;
  watchers?: {
    active: number;
    total: number;
  };
  workers: {
    currentTask?: string;
    id: string;
    name: string;
    status: string;
  }[];
};

export function App(): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:4017");
  const [client, setClient] = useState(() => new DaemonClient());
  const [status, setStatus] = useState<StatusShape | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [watchers, setWatchers] = useState<WatcherRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setClient(new DaemonClient({ baseUrl }));
  }, [baseUrl]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const [nextStatus, nextSessions, nextApprovals, nextWatchers] = await Promise.all([
          client.getOrchestratorStatus<StatusShape>(),
          client.listSessions(),
          client.listApprovals(),
          client.listWatchers<WatcherRecord[]>()
        ]);

        if (!cancelled) {
          setStatus(nextStatus);
          setSessions(nextSessions);
          setApprovals(nextApprovals);
          setWatchers(nextWatchers);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Web client failure.");
        }
      }
    };

    void refresh();
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "status") {
        setStatus(event.payload as StatusShape);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client]);

  async function refreshAll(): Promise<void> {
    const [nextStatus, nextSessions, nextApprovals, nextWatchers] = await Promise.all([
      client.getOrchestratorStatus<StatusShape>(),
      client.listSessions(),
      client.listApprovals(),
      client.listWatchers<WatcherRecord[]>()
    ]);

    setStatus(nextStatus);
    setSessions(nextSessions);
    setApprovals(nextApprovals);
    setWatchers(nextWatchers);
  }

  async function runAction(label: string, action: () => Promise<void>): Promise<void> {
    setBusy(label);
    setError(null);

    try {
      await action();
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dashboard action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main style={styles.shell}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Operator Console</div>
          <h1 style={styles.title}>ChatGPT Code Platform</h1>
          <p style={styles.subtitle}>
            Sessions, tasks, approvals, agents, watchers, and remote workers from the local or self-hosted orchestrator.
          </p>
        </div>
        <div style={styles.connectionPanel}>
          <label style={styles.label}>
            Orchestrator URL
            <input
              onChange={(event) => setBaseUrl(event.target.value)}
              style={styles.input}
              value={baseUrl}
            />
          </label>
          <div style={styles.toolbar}>
            <button onClick={() => void refreshAll()} style={styles.primaryButton}>Refresh</button>
            <button
              onClick={() => void runAction("Starting fleet", async () => {
                await client.startFleet();
              })}
              style={styles.secondaryButton}
            >
              Fleet Start
            </button>
            <button
              onClick={() => void runAction("Stopping fleet", async () => {
                await client.stopFleet();
              })}
              style={styles.secondaryButton}
            >
              Fleet Stop
            </button>
          </div>
          <div style={styles.connectionMeta}>
            <span>{busy ?? "Idle"}</span>
            <span>{error ?? "No current errors."}</span>
          </div>
        </div>
      </section>

      <section style={styles.overviewGrid}>
        <OverviewCard
          title="Runtime"
          value={status ? `${status.provider.providerLabel} / ${status.provider.model}` : "Disconnected"}
          meta={[
            status?.provider.loginLabel ?? "Not logged in",
            `Mode: ${status?.mode ?? "unknown"}`,
            `Project: ${status?.project?.displayName ?? "workspace"}`
          ]}
        />
        <OverviewCard
          title="Approvals"
          value={`${status?.approvals?.pending ?? 0} pending`}
          meta={[
            `Total: ${status?.approvals?.total ?? 0}`,
            `Tasks: ${status?.tasks.length ?? 0}`,
            `Goals: ${status?.goals?.length ?? 0}`
          ]}
        />
        <OverviewCard
          title="Fleet"
          value={status?.fleet?.enabled ? "Running" : "Stopped"}
          meta={[
            `Agents: ${status?.fleet?.agents.length ?? 0}`,
            `Workers: ${status?.workers.length ?? 0}`,
            `Tools: ${status?.toolCount ?? 0}`
          ]}
        />
        <OverviewCard
          title="Watchers"
          value={`${status?.watchers?.active ?? 0} active`}
          meta={[
            `Total: ${status?.watchers?.total ?? 0}`,
            `Sessions: ${sessions.length}`,
            `Queue: ${status?.queue?.length ?? 0}`
          ]}
        />
      </section>

      <section style={styles.panelGrid}>
        <Panel title="Sessions">
          {sessions.length === 0 ? (
            <EmptyState label="No sessions yet." />
          ) : (
            sessions.slice(0, 12).map((session) => (
              <div key={session.id} style={styles.rowCard}>
                <div>
                  <strong>{session.title}</strong>
                  <div style={styles.rowMeta}>{session.id}</div>
                </div>
                <div style={styles.rowMeta}>{session.turnCount} turns</div>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Tasks">
          {status?.tasks.length ? (
            status.tasks.map((task) => (
              <div key={task.id} style={styles.rowCard}>
                <div style={styles.rowContent}>
                  <strong>{task.title}</strong>
                  <div style={styles.rowMeta}>
                    {task.id} • {task.kind} • {task.state}{task.isRunning ? " • active" : ""}
                  </div>
                  <div style={styles.rowMeta}>
                    step={task.currentStep ?? "-"} • approvals={task.approvalRequestIds.length} • watchers={task.watcherIds.length} • retries={task.retries}
                  </div>
                  <div style={styles.rowMeta}>{task.blockedReason ?? task.lastError ?? "No blockers."}</div>
                </div>
                <div style={styles.actionStack}>
                  <button onClick={() => void runAction(`Pausing ${task.id}`, async () => client.pauseTask(task.id))} style={styles.smallButton}>Pause</button>
                  <button onClick={() => void runAction(`Resuming ${task.id}`, async () => client.resumeTask(task.id))} style={styles.smallButton}>Resume</button>
                  <button onClick={() => void runAction(`Stopping ${task.id}`, async () => client.stopTask(task.id))} style={styles.smallButton}>Stop</button>
                  <button onClick={() => void runAction(`Retrying ${task.id}`, async () => client.retryTask(task.id))} style={styles.smallButton}>Retry</button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No tracked tasks." />
          )}
        </Panel>

        <Panel title="Agents">
          {status?.fleet?.agents.length ? (
            status.fleet.agents.map((agent) => (
              <div key={agent.id} style={styles.rowCard}>
                <div style={styles.rowContent}>
                  <strong>{agent.id}</strong>
                  <div style={styles.rowMeta}>
                    {agent.role} • {agent.state} • {agent.currentScope ?? "workspace"}
                  </div>
                  <div style={styles.rowMeta}>{agent.task}</div>
                  <div style={styles.rowMeta}>
                    {agent.summary ?? agent.requestedAction ?? "No recent summary."}
                  </div>
                </div>
                <div style={styles.actionStack}>
                  <button onClick={() => void runAction(`Pausing ${agent.id}`, async () => client.pauseAgent(agent.id))} style={styles.smallButton}>Pause</button>
                  <button onClick={() => void runAction(`Resuming ${agent.id}`, async () => client.resumeAgent(agent.id))} style={styles.smallButton}>Resume</button>
                  <button onClick={() => void runAction(`Stopping ${agent.id}`, async () => client.stopAgent(agent.id))} style={styles.smallButton}>Stop</button>
                  <button onClick={() => void runAction(`Restarting ${agent.id}`, async () => client.restartAgent(agent.id))} style={styles.smallButton}>Restart</button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No agents in the fleet." />
          )}
        </Panel>

        <Panel title="Approvals">
          {approvals.length ? (
            approvals.slice(0, 12).map((approval) => (
              <div key={approval.id} style={styles.rowCard}>
                <div style={styles.rowContent}>
                  <strong>{approval.summary}</strong>
                  <div style={styles.rowMeta}>
                    {approval.id} • {approval.kind} • {approval.scope ?? "scope?"} • {approval.state}
                  </div>
                </div>
                <div style={styles.actionStack}>
                  <button onClick={() => void runAction(`Approving ${approval.id}`, async () => client.approveRequest(approval.id))} style={styles.smallButton}>Approve</button>
                  <button onClick={() => void runAction(`Rejecting ${approval.id}`, async () => client.rejectRequest(approval.id))} style={styles.smallButton}>Reject</button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No approval requests." />
          )}
        </Panel>

        <Panel title="Goals">
          {status?.goals?.length ? (
            status.goals.slice(0, 12).map((goal) => (
              <div key={goal.id} style={styles.rowCard}>
                <div>
                  <strong>{goal.title}</strong>
                  <div style={styles.rowMeta}>
                    {goal.id} • {goal.state}
                  </div>
                  <div style={styles.rowMeta}>{goal.nextBestAction ?? "No next action set."}</div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No goals registered." />
          )}
        </Panel>

        <Panel title="Watchers">
          {watchers.length ? (
            watchers.slice(0, 12).map((watcher) => (
              <div key={watcher.id} style={styles.rowCard}>
                <div>
                  <strong>{watcher.summary}</strong>
                  <div style={styles.rowMeta}>
                    {watcher.id} • {watcher.type} • {watcher.status}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No watchers." />
          )}
        </Panel>

        <Panel title="Queue">
          {status?.queue?.length ? (
            status.queue.slice(0, 12).map((item) => (
              <div key={item.id} style={styles.rowCard}>
                <div>
                  <strong>{item.summary}</strong>
                  <div style={styles.rowMeta}>
                    {item.id} • {item.type} • {item.state}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="Queue is empty." />
          )}
        </Panel>
      </section>
    </main>
  );
}

function Panel(props: {
  children: React.ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>{props.title}</h2>
      <div style={styles.panelBody}>{props.children}</div>
    </section>
  );
}

function OverviewCard(props: {
  meta: string[];
  title: string;
  value: string;
}): React.JSX.Element {
  return (
    <section style={styles.overviewCard}>
      <div style={styles.overviewTitle}>{props.title}</div>
      <div style={styles.overviewValue}>{props.value}</div>
      {props.meta.map((entry) => (
        <div key={entry} style={styles.overviewMeta}>{entry}</div>
      ))}
    </section>
  );
}

function EmptyState(props: { label: string }): React.JSX.Element {
  return <div style={styles.emptyState}>{props.label}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background:
      "radial-gradient(circle at top left, rgba(233, 118, 55, 0.14), transparent 30%), linear-gradient(180deg, #f4efe4 0%, #ece1d0 100%)",
    color: "#1f2430",
    fontFamily: "\"IBM Plex Sans\", \"Avenir Next\", sans-serif",
    minHeight: "100vh",
    padding: "32px 24px 56px"
  },
  hero: {
    alignItems: "flex-start",
    display: "grid",
    gap: 24,
    gridTemplateColumns: "1.4fr 1fr",
    margin: "0 auto 24px",
    maxWidth: 1440
  },
  eyebrow: {
    color: "#9c4f2b",
    fontSize: 12,
    letterSpacing: "0.22em",
    marginBottom: 12,
    textTransform: "uppercase"
  },
  title: {
    fontFamily: "\"Space Grotesk\", \"IBM Plex Sans\", sans-serif",
    fontSize: "clamp(2.8rem, 6vw, 5rem)",
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
    margin: 0
  },
  subtitle: {
    color: "#5d564e",
    fontSize: 18,
    lineHeight: 1.5,
    marginTop: 16,
    maxWidth: 680
  },
  connectionPanel: {
    background: "rgba(255, 250, 242, 0.9)",
    border: "1px solid rgba(31, 36, 48, 0.12)",
    borderRadius: 28,
    boxShadow: "0 16px 40px rgba(62, 41, 25, 0.08)",
    display: "grid",
    gap: 16,
    padding: 20
  },
  label: {
    color: "#5d564e",
    display: "grid",
    fontSize: 13,
    fontWeight: 600,
    gap: 8,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  },
  input: {
    background: "#fff9f1",
    border: "1px solid rgba(31, 36, 48, 0.14)",
    borderRadius: 16,
    color: "#1f2430",
    fontSize: 15,
    padding: "12px 14px"
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10
  },
  primaryButton: {
    ...buttonBase("#1f2430", "#f8f1e5")
  },
  secondaryButton: {
    ...buttonBase("#f08a4b", "#1f2430")
  },
  connectionMeta: {
    color: "#5d564e",
    display: "grid",
    gap: 6,
    fontSize: 13
  },
  overviewGrid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    margin: "0 auto 24px",
    maxWidth: 1440
  },
  overviewCard: {
    background: "rgba(255, 250, 242, 0.88)",
    border: "1px solid rgba(31, 36, 48, 0.1)",
    borderRadius: 24,
    boxShadow: "0 14px 30px rgba(62, 41, 25, 0.06)",
    padding: 18
  },
  overviewTitle: {
    color: "#9c4f2b",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.18em",
    marginBottom: 12,
    textTransform: "uppercase"
  },
  overviewValue: {
    fontFamily: "\"Space Grotesk\", sans-serif",
    fontSize: 28,
    marginBottom: 10
  },
  overviewMeta: {
    color: "#5d564e",
    fontSize: 14,
    marginTop: 4
  },
  panelGrid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    margin: "0 auto",
    maxWidth: 1440
  },
  panel: {
    background: "rgba(255, 250, 242, 0.92)",
    border: "1px solid rgba(31, 36, 48, 0.12)",
    borderRadius: 26,
    boxShadow: "0 18px 38px rgba(62, 41, 25, 0.07)",
    minHeight: 280,
    padding: 20
  },
  panelTitle: {
    fontFamily: "\"Space Grotesk\", sans-serif",
    fontSize: 24,
    letterSpacing: "-0.03em",
    margin: "0 0 14px"
  },
  panelBody: {
    display: "grid",
    gap: 12
  },
  rowCard: {
    alignItems: "flex-start",
    background: "#fff9f1",
    border: "1px solid rgba(31, 36, 48, 0.08)",
    borderRadius: 18,
    display: "flex",
    gap: 14,
    justifyContent: "space-between",
    padding: 14
  },
  rowContent: {
    display: "grid",
    gap: 5
  },
  rowMeta: {
    color: "#5d564e",
    fontSize: 13,
    lineHeight: 1.4
  },
  actionStack: {
    display: "grid",
    gap: 8
  },
  smallButton: {
    ...buttonBase("#efe2ca", "#1f2430"),
    fontSize: 13,
    minWidth: 84,
    padding: "8px 10px"
  },
  emptyState: {
    color: "#5d564e",
    fontStyle: "italic",
    padding: "12px 4px"
  }
};

function buttonBase(background: string, color: string): React.CSSProperties {
  return {
    background,
    border: "none",
    borderRadius: 999,
    color,
    cursor: "pointer",
    fontFamily: "\"IBM Plex Sans\", sans-serif",
    fontSize: 14,
    fontWeight: 700,
    padding: "10px 14px"
  };
}
