import { createHash } from "node:crypto";

import type { AuthStore } from "../auth/auth-store.js";
import { loadAppConfig } from "../config/load-app-config.js";
import { createFleetManager } from "../fleet/fleet-manager.js";
import { JsonGoalStore } from "../goals/goal-store.js";
import { createMcpManager } from "../mcp/mcp-manager.js";
import { createApprovalManager } from "../platform/approval-manager.js";
import {
  createDefaultExecutionContext,
  createExecutionContextController
} from "../platform/execution-context.js";
import { createModelRuntimeManager } from "../providers/model-runtime.js";
import type { ApprovalStore } from "../storage/approval-store.js";
import type { FleetStore } from "../storage/fleet-store.js";
import type { ProjectRegistryStore } from "../storage/project-registry-store.js";
import type { MemoryStore } from "../storage/memory-store.js";
import type { SessionRegistryStore } from "../storage/session-registry-store.js";
import type { SessionStore } from "../storage/session-store.js";
import { createInitialSessionState } from "../storage/session-state.js";
import type { TaskStore } from "../storage/task-store.js";
import type { TimelineStore } from "../storage/timeline-store.js";
import type { WatcherStore } from "../storage/watcher-store.js";
import { createBackgroundTaskRunner } from "../tasks/background-task-runner.js";
import type { RemoteToolExecutor } from "../tools/core-tools.js";
import { loadToolRegistry } from "../tools/load-tool-registry.js";
import type { ToolExecutionResult } from "../tools/tool-registry.js";
import { runTui } from "../ui/run-tui.js";

type StandaloneRemoteManager = {
  add(agent: {
    capabilities: string[];
    connectionType: "ssh" | "local" | "container" | "subprocess";
    host: string;
    id: string;
    name: string;
    password?: string;
    port?: number;
    role: "general" | "frontend" | "backend" | "tester" | "devops" | "docs" | "blender";
    status: "idle" | "running" | "waiting" | "degraded" | "offline";
    username?: string;
    workingDirectory?: string;
  }): Promise<unknown>;
  connect(id: string): Promise<{ status: string }>;
  disconnect(id: string): Promise<{ status: string }>;
  get(id: string): Promise<unknown>;
  list(): Promise<
    readonly {
      currentTask?: string;
      host: string;
      id: string;
      name: string;
      role: string;
      status: string;
    }[]
  >;
  remove(id: string): Promise<boolean>;
  runCommand(
    id: string,
    command: string,
    args?: string[]
  ): Promise<{
    code: number | null;
    stderr: string;
    stdout: string;
  }>;
  testConnection(id: string): Promise<{ ok: boolean; output: string }>;
};

export interface StandaloneTuiDependencies {
  approvalStore: ApprovalStore;
  authStore: AuthStore;
  fleetStore?: FleetStore;
  memoryStore: MemoryStore;
  projectRegistryStore: ProjectRegistryStore;
  remoteManager?: StandaloneRemoteManager;
  sessionRegistryStore: SessionRegistryStore;
  sessionStore: SessionStore;
  taskStore: TaskStore;
  timelineStore?: TimelineStore;
  watcherStore?: WatcherStore;
  workspaceRoot: string;
}

export async function runStandaloneTui({
  approvalStore,
  authStore,
  fleetStore,
  memoryStore,
  projectRegistryStore,
  remoteManager,
  sessionRegistryStore,
  sessionStore,
  taskStore,
  timelineStore,
  watcherStore,
  workspaceRoot
}: StandaloneTuiDependencies): Promise<void> {
  const config = loadAppConfig(process.env, workspaceRoot);
  const modelRuntime = await createModelRuntimeManager({
    authStore,
    bootstrapModelConfig: config.model
  });
  const ownerId = "local-owner";
  const existingProject = await projectRegistryStore.getByPath(workspaceRoot);
  const projectRecord =
    existingProject ??
    {
      createdAt: Date.now(),
      displayName: workspaceRoot.split("/").filter(Boolean).at(-1) ?? "workspace",
      id: createProjectId(workspaceRoot),
      lastCwd: workspaceRoot,
      lastScope: "workspace" as const,
      name: workspaceRoot.split("/").filter(Boolean).at(-1) ?? "workspace",
      path: workspaceRoot,
      updatedAt: Date.now()
    };
  await projectRegistryStore.save({
    ...projectRecord,
    updatedAt: Date.now()
  });
  const executionContextController = createExecutionContextController(
    createDefaultExecutionContext({
      cwd: projectRecord.lastCwd,
      projectId: projectRecord.id,
      projectRoot: workspaceRoot,
      scope: projectRecord.lastScope
    })
  );
  const approvalManager = createApprovalManager(
    approvalStore,
    executionContextController.get().approvalPolicy
  );
  const initialSession = await sessionStore.createSession(
    createInitialSessionState()
  );
  await sessionRegistryStore.save({
    activeRemoteHostId: executionContextController.get().activeRemoteHostId,
    allowedRoots: executionContextController.get().allowedRoots,
    backgroundState: "idle",
    createdAt: initialSession.createdAt,
    cwd: executionContextController.get().cwd,
    lastActivityAt: Date.now(),
    mode: "normal",
    model: modelRuntime.getSnapshot().model,
    ownerId,
    projectId: projectRecord.id,
    provider: modelRuntime.getSnapshot().provider,
    scope: executionContextController.get().scope,
    sessionId: initialSession.id,
    style: "normal",
    title: initialSession.title,
    updatedAt: Date.now()
  });
  const toolRegistry = await loadToolRegistry(config.mcpServers, {
    approvalManager,
    getExecutionContext: () => executionContextController.get(),
    remoteExecutor: remoteManager
      ? createRemoteToolExecutorFromManager(remoteManager)
      : undefined,
    watcherStore,
    workspaceRoot
  });
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
  const fleetManager = createFleetManager({
    fleetStore,
    initialAgents: fleetStore ? await fleetStore.listAgents() : undefined,
    memoryStore,
    maxConcurrentAgents: readFleetSoftLimit(),
    modelRuntime,
    sessionStore,
    toolRegistry
  });
  const goalStore = new JsonGoalStore(workspaceRoot);

  try {
    await runTui({
      fleetManager,
      goalStore,
      initialSession,
      approvalManager,
      executionContextController,
      memoryStore,
      mcpManager,
      modelRuntime,
      projectRecord,
      projectRegistryStore,
      remoteManager,
      sessionRegistryStore,
      sessionStore,
      taskRunner,
      toolRegistry,
      timelineStore,
      watcherStore,
      workspaceRoot
    });
  } finally {
    await taskRunner.close();
    await toolRegistry.close();
  }
}

function createProjectId(workspaceRoot: string): string {
  return createHash("sha1").update(workspaceRoot).digest("hex").slice(0, 12);
}

const DEFAULT_FLEET_SOFT_LIMIT = 8;

function readFleetSoftLimit(): number {
  const value = Number(process.env.CHATGPT_CODE_FLEET_MAX_AGENTS);

  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_FLEET_SOFT_LIMIT;
  }

  return Math.floor(value);
}

function createRemoteToolExecutorFromManager(
  remoteManager: StandaloneRemoteManager
): RemoteToolExecutor {
  return {
    async listFiles(input) {
      return formatRemoteToolResult(
        await remoteManager.runCommand(input.hostId, "sh", [
          "-lc",
          `find ${shellQuote(input.path)} -maxdepth ${input.maxDepth} | sed -n '1,${input.maxEntries}p'`
        ])
      );
    },
    async readFile(input) {
      return formatRemoteToolResult(
        await remoteManager.runCommand(input.hostId, "cat", ["--", input.path])
      );
    },
    async runCommand(input) {
      return formatRemoteToolResult(
        await remoteManager.runCommand(input.hostId, input.command, input.args)
      );
    },
    async writeFile(input) {
      const encoded = Buffer.from(input.content, "utf8").toString("base64");
      return formatRemoteToolResult(
        await remoteManager.runCommand(input.hostId, "sh", [
          "-lc",
          `mkdir -p ${shellQuote(dirnameForPath(input.path))} && printf %s ${shellQuote(encoded)} | base64 -d > ${shellQuote(input.path)}`
        ])
      );
    }
  };
}

function formatRemoteToolResult(output: {
  code: number | null;
  stderr: string;
  stdout: string;
}): ToolExecutionResult {
  const content = [output.stdout.trim(), output.stderr.trim()]
    .filter((chunk) => chunk.length > 0)
    .join(output.stdout.trim().length > 0 && output.stderr.trim().length > 0 ? "\n" : "");

  return {
    content: content.length > 0 ? content : `exit code ${output.code ?? "unknown"}`,
    isError: output.code !== 0
  };
}

function dirnameForPath(path: string): string {
  const normalized = path.trim();

  if (normalized === "/") {
    return "/";
  }

  const lastSeparator = normalized.lastIndexOf("/");
  return lastSeparator <= 0 ? "." : normalized.slice(0, lastSeparator);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
