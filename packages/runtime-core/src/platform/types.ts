export type AgentMode = "normal" | "plan" | "build";

export type SafetyLevel = "safe" | "medium" | "dangerous";

export type ApprovalPolicyPreset =
  | "ask-every-time"
  | "approve-once"
  | "approve-task"
  | "approve-session"
  | "approve-all"
  | "auto-safe"
  | "auto-safe-medium"
  | "full"
  | "strict";

export type ApprovalGrantScope = "once" | "task" | "session" | "all";

export type FilesystemScope =
  | "workspace"
  | "home"
  | "full-machine"
  | "remote-host";

export interface FilesystemGrant {
  id: string;
  createdAt: number;
  scope: FilesystemScope;
  root?: string;
  hostId?: string;
  label?: string;
  source: "default" | "user" | "system";
}

export interface ApprovalRequest {
  id: string;
  createdAt: number;
  updatedAt: number;
  kind: "build" | "diff" | "tool" | "mcp" | "remote";
  state: "pending" | "approved" | "rejected" | "cancelled";
  summary: string;
  detail: string;
  safetyLevel?: SafetyLevel;
  scope?: FilesystemScope;
  resource?: string;
  metadata: Record<string, unknown>;
}

export interface ApprovalGrantState {
  grantedAt: number;
  maxSafety: "safe" | "medium";
  scope: ApprovalGrantScope;
  revertToPreset?: ApprovalPolicyPreset;
  sessionId?: string;
  taskId?: string;
}

export interface ApprovalPolicy {
  preset?: ApprovalPolicyPreset;
  dangerousRequiresApproval: boolean;
  mediumRequiresApproval: boolean;
  safeAutoApprove: boolean;
  fullMachineRequiresApproval?: boolean;
  homeWriteRequiresApproval?: boolean;
  remoteHostRequiresApproval?: boolean;
  trustedWorkspaceRoots?: string[];
  blanketGrant?: ApprovalGrantState;
}

export interface ExecutionContext {
  projectId: string;
  projectRoot: string;
  cwd: string;
  scope: FilesystemScope;
  allowedRoots: string[];
  activeRemoteHostId?: string;
  approvalPolicy: ApprovalPolicy;
}

export interface ProjectRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  path: string;
  displayName: string;
  lastScope: FilesystemScope;
  lastCwd: string;
  remoteHostId?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRegistryEntry {
  sessionId: string;
  projectId: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  title: string;
  mode: AgentMode;
  style: "normal" | "plan" | "ultra";
  provider: string;
  model: string;
  cwd: string;
  scope: FilesystemScope;
  allowedRoots: string[];
  activeRemoteHostId?: string;
  backgroundState: "idle" | "running" | "paused" | "detached";
  state?: "active" | "archived";
  resumablePlanState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SessionClientAttachment {
  id: string;
  sessionId: string;
  clientId: string;
  clientType: "tui" | "web" | "mobile" | "remote" | "desktop" | "daemon";
  attachedAt: number;
  detachedAt?: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExecutionState {
  retryCount: number;
  currentMode: AgentMode;
  currentStep: number;
  totalSteps: number;
  lastAction: string;
  validationStatus: "idle" | "running" | "passed" | "failed";
}

export interface PatchOperation {
  type: "insert" | "replace" | "delete";
  target:
    | { type: "exact"; value: string }
    | { type: "line_range"; start: number; end: number }
    | { type: "symbol"; value: string };
  content?: string;
}

export interface PatchPlan {
  id: string;
  filePath: string;
  summary: string;
  operations: PatchOperation[];
}

export interface MemoryEnvelope {
  goals: string[];
  decisions: string[];
  constraints: string[];
  currentTask: Record<string, unknown>;
  historySummary: string;
}

export interface UserDossier {
  preferredName?: string;
  preferredTools: string[];
  preferredCodingStyle: string[];
  recurringWorkflows: string[];
  preferredProviders: string[];
  importantPreferences: string[];
  updatedAt: number;
}

export interface ProjectDossier {
  summary: string;
  purpose: string;
  architectureNotes: string[];
  keyFiles: string[];
  howToRun: string[];
  howToTest: string[];
  knownIssues: string[];
  mcpUsage: string[];
  status: string;
  updatedAt: number;
}

export interface WorkerSpec {
  id: string;
  name: string;
  role:
    | "general"
    | "frontend"
    | "backend"
    | "tester"
    | "devops"
    | "docs"
    | "blender";
  connectionType: "local" | "ssh" | "container" | "subprocess";
  capabilities: string[];
  status: "idle" | "running" | "waiting" | "degraded" | "offline";
  currentTask?: string;
  lastHeartbeat?: number;
}

export interface MarketplaceEntry {
  name: string;
  description: string;
  transport: "stdio" | "http" | "sse";
  category: string;
  tools: string[];
  installStatus: "not_installed" | "installed";
  enabledStatus: "enabled" | "disabled";
  tags: string[];
  favorite: boolean;
  version?: string;
  author?: string;
  source?: "local" | "discovered" | "remote";
  safetyLevel?: SafetyLevel;
  compatibilityNotes?: string[];
}

export interface McpPermissionPolicy {
  serverName: string;
  allowedModes: AgentMode[];
  safetyLevel: SafetyLevel;
  confirmationRequired: boolean;
}

export interface GoalRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  description: string;
  linkedProject?: string;
  whyItMatters?: string;
  blockers: string[];
  nextBestAction?: string;
  suggestedMcps: string[];
  estimatedEffort: "small" | "medium" | "large";
  source: "user" | "proactive" | "dream";
  state:
    | "queued"
    | "planning"
    | "asking"
    | "waiting_approval"
    | "running"
    | "validating"
    | "paused"
    | "rate_limited"
    | "complete"
    | "failed"
    | "cancelled";
}

export interface FleetAgentRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  role: WorkerSpec["role"];
  state:
    | "queued"
    | "running"
    | "waiting"
    | "paused"
    | "complete"
    | "failed"
    | "cancelled";
  task: string;
  parentSessionId: string;
  workerSessionId?: string;
  summary?: string;
  error?: string;
  changedFiles: string[];
  lockKeys: string[];
  allowedToolNames?: string[];
  contextSnapshot?: Record<string, unknown>;
  blockers?: string[];
  currentCwd?: string;
  currentScope?: FilesystemScope;
  recentOutput?: string[];
  requestedAction?: "pause" | "resume" | "restart" | "stop";
}

export interface WorkerAssignment {
  agentId: string;
  assignedAt: number;
  parentSessionId: string;
  role: WorkerSpec["role"];
  task: string;
}

export interface FleetAssignmentRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  agentId: string;
  parentSessionId: string;
  workerSessionId?: string;
  role: WorkerSpec["role"];
  state: FleetAgentRecord["state"];
  task: string;
  changedFiles: string[];
  blockers: string[];
  summary?: string;
  error?: string;
}

export interface TaskRecord {
  id: string;
  goalId?: string;
  assignedWorker?: string;
  createdAt: number;
  updatedAt: number;
  state: GoalRecord["state"];
  description: string;
  retries: number;
}

export interface ScheduleRecord {
  id: string;
  goal: string;
  cadenceMinutes: number;
  nextRunAt: number;
  status: "active" | "paused" | "stopped";
}

export interface WatcherRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  type:
    | "command"
    | "build"
    | "test"
    | "download"
    | "log"
    | "file"
    | "remote"
    | "mcp";
  status: "active" | "healthy" | "stalled" | "completed" | "failed" | "cancelled";
  summary: string;
  detail?: string;
  target?: string;
  sessionId?: string;
  taskId?: string;
  projectId?: string;
  scope?: FilesystemScope;
  activityAt?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskLock {
  id: string;
  createdAt: number;
  ownerId: string;
  resource: string;
  type: "file" | "task";
}

export interface QueueItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  type: "task" | "fleet" | "approval" | "watcher" | "remote";
  state: "queued" | "running" | "blocked" | "waiting_approval" | "complete" | "failed";
  summary: string;
  detail?: string;
  sessionId?: string;
  watcherId?: string;
  agentId?: string;
  approvalId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}

export interface DevicePairing {
  id: string;
  createdAt: number;
  updatedAt: number;
  code: string;
  ownerId: string;
  label: string;
  expiresAt: number;
  consumedAt?: number;
  state: "pending" | "consumed" | "expired" | "revoked";
  metadata?: Record<string, unknown>;
}

export interface AuthSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  deviceLabel: string;
  clientType: SessionClientAttachment["clientType"];
  refreshTokenHash: string;
  expiresAt: number;
  revokedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface McpSetRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  serverNames: string[];
  favoritesFirst?: boolean;
  metadata?: Record<string, unknown>;
}

export interface McpFavoriteRecord {
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMcpSetAssignment {
  projectId: string;
  setId: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEvent {
  id: string;
  createdAt: number;
  type:
    | "mode_switch"
    | "user_command"
    | "tool_call"
    | "file_edit"
    | "retry"
    | "rate_limit"
    | "validation"
    | "mcp_change"
    | "approval"
    | "goal"
    | "watcher"
    | "worker"
    | "system";
  sessionId?: string;
  taskId?: string;
  summary: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}
