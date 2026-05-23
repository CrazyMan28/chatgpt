import type { AgentMode, BackgroundTaskView, SessionRecord } from "@chatgpt-code/runtime-core";

import type { ConnectionState, ProTranscriptEntry } from "./types.js";

export function compact(value: string | undefined, maxLength: number): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized || "-";
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function compactPath(value: string | undefined, maxLength: number): string {
  const raw = value?.trim();

  if (!raw) {
    return "-";
  }

  const home = process.env.HOME;
  const path = home && raw.startsWith(home) ? `~${raw.slice(home.length)}` : raw;

  if (path.length <= maxLength) {
    return path;
  }

  const parts = path.split("/").filter(Boolean);
  const tail = parts.slice(-2).join("/");
  const prefix = path.startsWith("~") ? "~/" : "…/";
  const next = `${prefix}${tail}`;

  return next.length <= maxLength ? next : `…${path.slice(-(maxLength - 1))}`;
}

export function wrapText(value: string, width: number, maxLines = 8): string[] {
  const safeWidth = Math.max(8, width);
  const output: string[] = [];

  for (const sourceLine of value.split(/\r?\n/)) {
    const words = sourceLine.trim().split(/\s+/).filter(Boolean);
    let line = "";

    if (words.length === 0) {
      output.push("");
      continue;
    }

    for (const word of words) {
      if (word.length >= safeWidth) {
        if (line) {
          output.push(line);
          line = "";
        }
        output.push(word.slice(0, safeWidth - 1));
        continue;
      }

      const next = line ? `${line} ${word}` : word;
      if (next.length > safeWidth) {
        output.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    if (line) {
      output.push(line);
    }
  }

  if (output.length <= maxLines) {
    return output;
  }

  return [...output.slice(0, maxLines - 1), "…"];
}

export function timeLabel(value: number | undefined): string {
  if (!value) {
    return "--:--";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function statusFromTasks(tasks: readonly BackgroundTaskView[], offline: boolean): ConnectionState {
  if (offline) {
    return "offline";
  }

  if (tasks.some((task) => task.state === "waiting_approval" || task.state === "blocked" || task.state === "rate_limited")) {
    return "blocked";
  }

  if (tasks.some((task) => task.isRunning || task.state === "running" || task.state === "planning" || task.state === "validating")) {
    return "running";
  }

  return "ready";
}

export function transcriptFromSession(session: SessionRecord | undefined): ProTranscriptEntry[] {
  return (session?.transcript ?? []).map((entry) => ({
    content: entry.content,
    createdAt: entry.createdAt,
    id: entry.id,
    kind:
      entry.role === "user"
        ? "user"
        : entry.role === "assistant"
          ? "assistant"
          : entry.role === "tool"
            ? "tool"
            : "system",
    status: entry.status
  }));
}

export function isAgentMode(value: string): value is AgentMode {
  return value === "normal" || value === "plan" || value === "build";
}

export function activeTaskCount(tasks: readonly BackgroundTaskView[]): number {
  return tasks.filter((task) =>
    task.isRunning ||
    task.state === "running" ||
    task.state === "planning" ||
    task.state === "validating" ||
    task.state === "waiting_approval"
  ).length;
}

export function stateTone(state: string): "success" | "warning" | "error" | "muted" | "accent" {
  if (["complete", "approved", "ready", "enabled", "healthy", "running"].includes(state)) {
    return state === "running" ? "accent" : "success";
  }

  if (["queued", "planning", "waiting", "waiting_approval", "paused", "blocked", "rate_limited"].includes(state)) {
    return "warning";
  }

  if (["failed", "rejected", "cancelled", "offline", "disabled"].includes(state)) {
    return "error";
  }

  return "muted";
}

export function shortId(value: string | undefined, length = 12): string {
  if (!value) {
    return "-";
  }

  return value.length <= length ? value : value.slice(0, length);
}

