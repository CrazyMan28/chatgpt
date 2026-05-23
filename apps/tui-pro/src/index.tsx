#!/usr/bin/env node

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { render, useApp, useInput } from "ink";

import type {
  AgentMode,
  ApprovalRequest,
  BackgroundTaskView,
  FleetAgentRecord,
  MarketplaceEntry,
  ProjectDossier,
  SessionRecord,
  SessionSummary,
  TimelineEvent,
  UserDossier,
  WatcherRecord
} from "@chatgpt-code/runtime-core";

import { createProDaemonClient, optional } from "./api.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { InputBar } from "./components/InputBar.js";
import { PANEL_ORDER } from "./components/PanelTabs.js";
import { ProAppShell } from "./components/ProAppShell.js";
import { getTheme } from "./theme.js";
import type { MemorySnapshot, ProData, ProPanel, ProStatus, ProThemeName, ProTranscriptEntry } from "./types.js";
import { isAgentMode, statusFromTasks, transcriptFromSession } from "./utils.js";

const CLIENT = createProDaemonClient();

const INITIAL_DATA: ProData = {
  approvals: [],
  autopilot: "off",
  connectionDetail: "connecting",
  connectionState: "offline",
  fleetAgents: [],
  fleetEnabled: false,
  logs: [],
  marketplace: [],
  memory: {
    results: []
  },
  mode: "normal",
  panel: "overview",
  sessionRegistry: [],
  sessions: [],
  tasks: [],
  themeName: "cyber",
  timeline: [],
  transcript: [],
  watchers: []
};

function ProRoot({
  smoke = false
}: {
  smoke?: boolean;
}): React.JSX.Element {
  const { exit } = useApp();
  const [data, setData] = useState<ProData>(INITIAL_DATA);
  const [input, setInput] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [terminalSize, setTerminalSize] = useState(() => readTerminalSize());
  const theme = getTheme(data.themeName);
  const hiddenInspector = terminalSize.columns < 96;

  const logLine = useCallback((line: string) => {
    setData((current) => ({
      ...current,
      lastDetails: line,
      logs: [...current.logs, `${new Date().toLocaleTimeString()} ${line}`].slice(-80)
    }));
  }, []);

  const appendTranscript = useCallback((entry: Omit<ProTranscriptEntry, "createdAt" | "id">) => {
    setData((current) => ({
      ...current,
      transcript: [
        ...current.transcript,
        {
          ...entry,
          createdAt: Date.now(),
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        }
      ].slice(-80)
    }));
  }, []);

  const refresh = useCallback(async (options?: { loadSession?: boolean }) => {
    try {
      const [
        status,
        sessions,
        tasks,
        approvals,
        marketplace,
        fleet,
        timeline,
        watchers,
        project,
        user
      ] = await Promise.all([
        CLIENT.getOrchestratorStatus<ProStatus>(),
        CLIENT.listSessions(),
        CLIENT.listTasks(),
        CLIENT.listApprovals(),
        CLIENT.getMarketplace(),
        CLIENT.listFleet<{ agents: FleetAgentRecord[]; enabled: boolean }>(),
        CLIENT.timelineRecent(),
        CLIENT.listWatchers<WatcherRecord[]>(),
        optional<ProjectDossier | undefined>(() => CLIENT.getProjectDossier(), undefined),
        optional<UserDossier | undefined>(() => CLIENT.getUserDossier(), undefined)
      ]);

      let loadedSession: SessionRecord | undefined;
      const nextSessionId = data.currentSession?.id;

      if (options?.loadSession !== false && nextSessionId) {
        const detail = await CLIENT.getSession(nextSessionId);
        loadedSession = detail.session;
      }

      setData((current) => {
        const nextTasks = tasks as readonly BackgroundTaskView[];
        const offline = false;
        const currentSession = loadedSession ?? current.currentSession;

        return {
          ...current,
          approvals: approvals as ApprovalRequest[],
          connectionDetail: CLIENT.baseUrl,
          connectionState: statusFromTasks(nextTasks, offline),
          currentSession,
          fleetAgents: fleet.agents ?? [],
          fleetEnabled: Boolean(fleet.enabled),
          marketplace: marketplace as MarketplaceEntry[],
          memory: {
            ...current.memory,
            project,
            user
          },
          provider: status.provider,
          sessionRegistry: status.sessions ?? [],
          sessions: sessions as SessionSummary[],
          status,
          tasks: nextTasks,
          timeline: timeline as TimelineEvent[],
          transcript:
            currentSession && currentSession.transcript.length > 0
              ? transcriptFromSession(currentSession)
              : current.transcript,
          watchers: watchers as WatcherRecord[]
        };
      });
    } catch (error) {
      setData((current) => ({
        ...current,
        connectionDetail: error instanceof Error ? error.message : "daemon offline",
        connectionState: "offline",
        lastDetails: error instanceof Error ? error.message : String(error)
      }));
    }
  }, [data.currentSession?.id]);

  const sendPrompt = useCallback(async (prompt: string, modeOverride?: AgentMode) => {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    setBusy(true);
    appendTranscript({
      content: trimmed,
      kind: "user",
      title: "USER"
    });
    appendTranscript({
      content: "Sent to daemon. Waiting for session transcript update.",
      kind: "progress",
      title: "PROGRESS"
    });

    try {
      let session = data.currentSession;

      if (!session) {
        session = await CLIENT.createSession();
      }

      const result = await CLIENT.sendSessionInput({
        mode: modeOverride ?? data.mode,
        prompt: trimmed,
        sessionId: session.id,
        style: "normal"
      });

      setData((current) => ({
        ...current,
        currentSession: result.session,
        transcript: transcriptFromSession(result.session)
      }));
      await refresh({ loadSession: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTranscript({
        content: message,
        kind: "error",
        title: "REQUEST FAILED"
      });
      logLine(message);
    } finally {
      setBusy(false);
    }
  }, [appendTranscript, data.currentSession, data.mode, logLine, refresh]);

  const handleCommand = useCallback(async (commandLine: string) => {
    const [command = "", ...args] = commandLine.trim().split(/\s+/);
    const lower = command.toLowerCase();

    if (lower === "/help") {
      appendTranscript({
        content: "/panel <name>, /theme cyber|minimal|compact, /palette, /details last, /plan, /build, /approve all, /tasks, /mcp marketplace, /fleet status, /memory show",
        kind: "system",
        title: "HELP"
      });
      return;
    }

    if (lower === "/palette") {
      setPaletteOpen(true);
      return;
    }

    const panelArg = args[0];
    if (lower === "/panel" && isPanel(panelArg)) {
      setData((current) => ({ ...current, panel: panelArg }));
      return;
    }

    const themeArg = args[0];
    if (lower === "/theme" && isTheme(themeArg)) {
      setData((current) => ({ ...current, themeName: themeArg }));
      return;
    }

    if (lower === "/details" && args[0] === "last") {
      setData((current) => ({ ...current, panel: "logs" }));
      return;
    }

    if (lower === "/plan" || lower === "/build") {
      const mode: AgentMode = lower === "/plan" ? "plan" : "build";
      setData((current) => ({ ...current, mode }));
      if (args.length > 0) {
        await sendPrompt(args.join(" "), mode);
      } else {
        logLine(`Mode set to ${mode}. Next prompt uses ${mode}.`);
      }
      return;
    }

    if (lower === "/mode" && isAgentMode(args[0] ?? "")) {
      setData((current) => ({ ...current, mode: args[0] as AgentMode }));
      return;
    }

    const autopilotArg = args[0];
    if (lower === "/autopilot" && (autopilotArg === "on" || autopilotArg === "off")) {
      setData((current) => ({ ...current, autopilot: autopilotArg }));
      logLine("Autopilot route is not exposed by the daemon; display state changed locally only.");
      return;
    }

    if (lower === "/tasks") {
      setData((current) => ({ ...current, panel: "tasks" }));
      await refresh();
      return;
    }

    if (lower === "/approve" && args[0] === "all") {
      const pending = data.approvals.filter((approval) => approval.state === "pending");
      for (const approval of pending) {
        await CLIENT.approveRequest(approval.id);
      }
      logLine(`Approved ${pending.length} pending request(s).`);
      setData((current) => ({ ...current, panel: "approvals" }));
      await refresh();
      return;
    }

    if (lower === "/approve" && args[0]) {
      await CLIENT.approveRequest(args[0]);
      setData((current) => ({ ...current, panel: "approvals" }));
      await refresh();
      return;
    }

    if (lower === "/resume") {
      const taskId = args[0] ?? data.tasks.find((task) => task.state === "paused" || task.state === "blocked" || task.state === "rate_limited")?.id;
      if (taskId) {
        await CLIENT.resumeTask(taskId);
        logLine(`Resume requested for ${taskId}.`);
        await refresh();
      } else {
        logLine("No resumable task found.");
      }
      return;
    }

    if (lower === "/mcp" && (args[0] === "marketplace" || args.length === 0)) {
      setData((current) => ({ ...current, panel: "mcp" }));
      await refresh();
      return;
    }

    if (lower === "/mcp" && args[0] === "search") {
      const results = await CLIENT.searchMarketplace(args.slice(1).join(" "));
      setData((current) => ({ ...current, marketplace: results, panel: "mcp" }));
      return;
    }

    if (lower === "/fleet" && (args[0] === "status" || args.length === 0)) {
      setData((current) => ({ ...current, panel: "fleet" }));
      await refresh();
      return;
    }

    if (lower === "/memory" && (args[0] === "show" || args.length === 0)) {
      setData((current) => ({ ...current, panel: "memory" }));
      await refresh();
      return;
    }

    if (lower === "/memory" && args[0] === "search") {
      const results = await CLIENT.searchMemory<unknown[]>(args.slice(1).join(" "));
      setData((current) => ({
        ...current,
        memory: {
          ...current.memory,
          results
        },
        panel: "memory"
      }));
      return;
    }

    if (lower === "/model" && args.length > 0) {
      await CLIENT.setModel(args.join(" "));
      await refresh();
      return;
    }

    if (lower === "/new") {
      const session = await CLIENT.createSession();
      setData((current) => ({
        ...current,
        currentSession: session,
        transcript: transcriptFromSession(session)
      }));
      await refresh({ loadSession: false });
      return;
    }

    if (lower === "/open" && args[0]) {
      const detail = await CLIENT.getSession(args[0]);
      if (detail.session) {
        setData((current) => ({
          ...current,
          currentSession: detail.session,
          panel: "session",
          transcript: transcriptFromSession(detail.session)
        }));
      }
      return;
    }

    await sendPrompt(commandLine);
  }, [appendTranscript, data.approvals, data.tasks, logLine, refresh, sendPrompt]);

  const handleSubmit = useCallback((value: string) => {
    const next = value.trim();

    setInput("");

    if (!next) {
      return;
    }

    void (next.startsWith("/") ? handleCommand(next) : sendPrompt(next));
  }, [handleCommand, sendPrompt]);

  const inputSupported = Boolean(process.stdin.isTTY);

  useInput((inputValue, key) => {
    if (key.ctrl && inputValue === "c") {
      exit();
    }

    if (key.escape && paletteOpen) {
      setPaletteOpen(false);
      setPaletteQuery("");
      return;
    }

    if (key.ctrl && inputValue === "k") {
      setPaletteOpen((current) => !current);
      return;
    }

    if (key.tab) {
      setData((current) => ({
        ...current,
        panel: PANEL_ORDER[(PANEL_ORDER.indexOf(current.panel) + 1) % PANEL_ORDER.length] ?? "overview"
      }));
      return;
    }

    if (key.ctrl && inputValue === "t") {
      setData((current) => ({ ...current, panel: "tasks" }));
    }
    if (key.ctrl && inputValue === "a") {
      setData((current) => ({ ...current, panel: "approvals" }));
    }
    if (key.ctrl && inputValue === "m") {
      setData((current) => ({ ...current, panel: "mcp" }));
    }
    if (key.ctrl && inputValue === "f") {
      setData((current) => ({ ...current, panel: "fleet" }));
    }
    if (key.ctrl && inputValue === "l") {
      setData((current) => ({ ...current, panel: "logs" }));
    }
  }, {
    isActive: inputSupported
  });

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh({ loadSession: false });
    }, 4000);
    const unsubscribe = CLIENT.subscribe((event) => {
      if (event.type === "status") {
        const status = event.payload as ProStatus;
        setData((current) => ({
          ...current,
          connectionDetail: CLIENT.baseUrl,
          connectionState: statusFromTasks(status.tasks ?? current.tasks, false),
          fleetAgents: status.fleet?.agents ?? current.fleetAgents,
          fleetEnabled: status.fleet?.enabled ?? current.fleetEnabled,
          provider: status.provider ?? current.provider,
          sessionRegistry: status.sessions ?? current.sessionRegistry,
          status,
          tasks: status.tasks ?? current.tasks
        }));
      }

      if (event.type === "timeline") {
        const timeline = event.payload as TimelineEvent;
        setData((current) => ({
          ...current,
          lastDetails: timeline.detail ?? timeline.summary,
          logs: [...current.logs, `${new Date(timeline.createdAt).toLocaleTimeString()} ${timeline.summary}`].slice(-80),
          timeline: [timeline, ...current.timeline].slice(0, 50)
        }));
      }

      if (event.type === "session") {
        const session = event.payload as SessionRecord;
        setData((current) =>
          !current.currentSession || current.currentSession.id === session.id
            ? {
                ...current,
                currentSession: session,
                transcript: session.transcript.length > 0 ? transcriptFromSession(session) : current.transcript
              }
            : current
        );
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    const onResize = (): void => setTerminalSize(readTerminalSize());
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!smoke) {
      return;
    }

    const timer = setTimeout(() => {
      exit();
    }, 300);

    return () => clearTimeout(timer);
  }, [exit, smoke]);

  const palette = paletteOpen ? (
    <CommandPalette
      onQueryChange={setPaletteQuery}
      onSubmit={(command) => {
        setPaletteOpen(false);
        setPaletteQuery("");
        void handleCommand(command);
      }}
      query={paletteQuery}
      theme={theme}
      width={terminalSize.columns}
    />
  ) : undefined;

  const inputBar = useMemo(
    () => (
      <InputBar
        disabled={busy || paletteOpen || !inputSupported}
        hiddenInspector={hiddenInspector}
        mode={data.mode}
        onChange={setInput}
        onSubmit={handleSubmit}
        theme={theme}
        value={input}
        width={terminalSize.columns}
      />
    ),
    [busy, data.mode, handleSubmit, hiddenInspector, input, inputSupported, paletteOpen, terminalSize.columns, theme]
  );

  return (
    <ProAppShell
      data={data}
      input={inputBar}
      palette={palette}
      terminalHeight={terminalSize.rows}
      terminalWidth={terminalSize.columns}
      theme={theme}
    />
  );
}

function readTerminalSize(): { columns: number; rows: number } {
  return {
    columns: Math.max(72, process.stdout.columns ?? 120),
    rows: Math.max(24, process.stdout.rows ?? 38)
  };
}

function isPanel(value: string | undefined): value is ProPanel {
  return Boolean(value && PANEL_ORDER.includes(value as ProPanel));
}

function isTheme(value: string | undefined): value is ProThemeName {
  return value === "cyber" || value === "minimal" || value === "compact";
}

render(<ProRoot smoke={process.argv.includes("--smoke")} />, {
  exitOnCtrlC: true,
  interactive: Boolean(process.stdin.isTTY)
});
