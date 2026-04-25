import { randomBytes } from "node:crypto";

import type { ApprovalStore } from "../storage/approval-store.js";
import type {
  AgentMode,
  ApprovalGrantScope,
  ApprovalGrantState,
  ApprovalPolicy,
  ApprovalPolicyPreset,
  ApprovalRequest,
  ExecutionContext,
  FilesystemScope,
  SafetyLevel
} from "./types.js";

export interface ApprovalDecision {
  approved: boolean;
  request: ApprovalRequest;
}

export interface ApprovalManagerStatus {
  activeSessionId?: string;
  activeTaskId?: string;
  blanketGrant?: ApprovalGrantState;
  mode?: AgentMode;
  policy: ApprovalPolicy;
}

export interface ApprovalManager {
  approve(id: string): Promise<ApprovalRequest | undefined>;
  approveLatestPending(): Promise<ApprovalRequest | undefined>;
  getPolicy(): ApprovalPolicy;
  getStatus(): ApprovalManagerStatus;
  grant(scope: ApprovalGrantScope, options?: {
    approvePending?: boolean;
    maxSafety?: "safe" | "medium";
  }): Promise<ApprovalGrantState | undefined>;
  list(): Promise<ApprovalRequest[]>;
  listPending(): Promise<ApprovalRequest[]>;
  reject(id: string): Promise<ApprovalRequest | undefined>;
  request(input: {
    detail: string;
    kind: ApprovalRequest["kind"];
    metadata?: Record<string, unknown>;
    policy?: ApprovalPolicy;
    resource?: string;
    safetyLevel: SafetyLevel;
    scope: FilesystemScope;
    summary: string;
  }): Promise<ApprovalDecision>;
  restore(status?: Partial<ApprovalManagerStatus>): void;
  setActiveSession(sessionId?: string): void;
  setActiveTask(taskId?: string): void;
  setMode(mode?: AgentMode): void;
  setPolicy(policy: ApprovalPolicy): ApprovalPolicy;
  setPolicyPreset(preset: ApprovalPolicyPreset): ApprovalPolicy;
}

export function createApprovalManager(
  store: ApprovalStore,
  defaultPolicy: ApprovalPolicy
): ApprovalManager {
  let policy = normalizePolicy(defaultPolicy);
  let activeSessionId: string | undefined;
  let activeTaskId: string | undefined;
  let activeMode: AgentMode | undefined;

  return {
    async approve(id) {
      const request = await store.get(id);

      if (!request) {
        return undefined;
      }

      return store.update({
        ...request,
        state: "approved",
        updatedAt: Date.now()
      });
    },
    async approveLatestPending() {
      const latest = (await store.listPending())[0];

      if (!latest) {
        return undefined;
      }

      return this.approve(latest.id);
    },
    getPolicy() {
      return {
        ...policy,
        blanketGrant: policy.blanketGrant
          ? { ...policy.blanketGrant }
          : undefined
      };
    },
    getStatus() {
      return {
        activeSessionId,
        activeTaskId,
        blanketGrant: policy.blanketGrant
          ? { ...policy.blanketGrant }
          : undefined,
        mode: activeMode,
        policy: this.getPolicy()
      };
    },
    async grant(scope, options) {
      const maxSafety = options?.maxSafety ?? "medium";

      if (scope === "task" && !activeTaskId) {
        return undefined;
      }

      if (scope === "session" && !activeSessionId) {
        return undefined;
      }

      const grant: ApprovalGrantState = {
        grantedAt: Date.now(),
        maxSafety,
        revertToPreset: normalizePresetName(policy.preset),
        scope,
        sessionId:
          scope === "session" || scope === "task" ? activeSessionId : undefined,
        taskId: scope === "task" ? activeTaskId : undefined
      };
      policy = normalizePolicy({
        ...policy,
        blanketGrant: grant,
        preset:
          scope === "once"
            ? "approve-once"
            : scope === "task"
              ? "approve-task"
              : scope === "session"
                ? "approve-session"
                : "approve-all"
      });

      if (options?.approvePending) {
        await approvePendingForGrant(store, grant);
      }

      return grant;
    },
    async list() {
      return store.list();
    },
    async listPending() {
      return store.listPending();
    },
    async reject(id) {
      const request = await store.get(id);

      if (!request) {
        return undefined;
      }

      return store.update({
        ...request,
        state: "rejected",
        updatedAt: Date.now()
      });
    },
    async request(input) {
      const effectivePolicy = normalizePolicy({
        ...policy,
        ...input.policy,
        blanketGrant: input.policy?.blanketGrant ?? policy.blanketGrant
      });
      const fingerprint = createApprovalFingerprint(input);
      const requestMetadata = {
        ...(input.metadata ?? {}),
        fingerprint,
        mode: activeMode,
        sessionId: activeSessionId,
        taskId: activeTaskId
      };
      const shouldApprove = isAutoApproved({
        activeSessionId,
        activeTaskId,
        policy: effectivePolicy,
        safetyLevel: input.safetyLevel,
        scope: input.scope
      });

      if (!shouldApprove) {
        const existingPending = await findMatchingPendingRequest(store, {
          fingerprint,
          sessionId: activeSessionId,
          taskId: activeTaskId
        });

        if (existingPending) {
          return {
            approved: false,
            request: existingPending
          };
        }
      }

      const request: ApprovalRequest = {
        createdAt: Date.now(),
        detail: input.detail,
        id: createApprovalId(),
        kind: input.kind,
        metadata: requestMetadata,
        resource: input.resource,
        safetyLevel: input.safetyLevel,
        scope: input.scope,
        state: shouldApprove ? "approved" : "pending",
        summary: input.summary,
        updatedAt: Date.now()
      };
      const storedRequest = await store.create(request);

      if (shouldApprove && effectivePolicy.blanketGrant?.scope === "once") {
        policy = normalizePolicy({
          ...effectivePolicy,
          blanketGrant: undefined,
          preset: effectivePolicy.blanketGrant.revertToPreset ?? "auto-safe"
        });
      } else {
        policy = effectivePolicy;
      }

      return {
        approved: shouldApprove,
        request: storedRequest
      };
    },
    restore(status) {
      if (status?.policy) {
        policy = normalizePolicy(status.policy);
      }

      if (status?.activeSessionId !== undefined) {
        activeSessionId = status.activeSessionId;
      }

      if (status?.activeTaskId !== undefined) {
        activeTaskId = status.activeTaskId;
      }

      if (status?.mode !== undefined) {
        activeMode = status.mode;
      }
    },
    setActiveSession(sessionId) {
      activeSessionId = sessionId;

      if (
        policy.blanketGrant?.scope === "session" &&
        policy.blanketGrant.sessionId &&
        sessionId !== policy.blanketGrant.sessionId
      ) {
        policy = normalizePolicy({
          ...policy,
          blanketGrant: undefined
        });
      }
    },
    setActiveTask(taskId) {
      activeTaskId = taskId;

      if (
        policy.blanketGrant?.scope === "task" &&
        policy.blanketGrant.taskId &&
        taskId !== policy.blanketGrant.taskId
      ) {
        policy = normalizePolicy({
          ...policy,
          blanketGrant: undefined,
          preset: "auto-safe"
        });
      }
    },
    setMode(mode) {
      activeMode = mode;
    },
    setPolicy(nextPolicy) {
      policy = normalizePolicy(nextPolicy);
      return this.getPolicy();
    },
    setPolicyPreset(preset) {
      policy = normalizePolicy({
        ...policy,
        ...presetToPolicy(preset, policy),
        preset
      });
      return this.getPolicy();
    }
  };
}

export function readScopeForApproval(context: ExecutionContext): FilesystemScope {
  return context.scope;
}

function normalizePolicy(policy: ApprovalPolicy): ApprovalPolicy {
  const normalizedPreset = normalizePresetName(
    policy.preset ?? inferPreset(policy)
  );

  return {
    ...presetToPolicy(normalizedPreset, policy),
    ...policy
  };
}

function inferPreset(policy: ApprovalPolicy): ApprovalPolicyPreset {
  if (policy.preset) {
    return normalizePresetName(policy.preset);
  }

  if (
    policy.safeAutoApprove &&
    policy.mediumRequiresApproval === false &&
    policy.dangerousRequiresApproval === false
  ) {
    return "full";
  }

  if (policy.safeAutoApprove && policy.mediumRequiresApproval === false) {
    return "auto-safe-medium";
  }

  if (policy.safeAutoApprove) {
    return "auto-safe";
  }

  return "strict";
}

function presetToPolicy(
  preset: ApprovalPolicyPreset,
  currentPolicy?: ApprovalPolicy
): ApprovalPolicy {
  const common = {
    fullMachineRequiresApproval:
      currentPolicy?.fullMachineRequiresApproval ?? true,
    homeWriteRequiresApproval:
      currentPolicy?.homeWriteRequiresApproval ?? true,
    remoteHostRequiresApproval:
      currentPolicy?.remoteHostRequiresApproval ?? true,
    trustedWorkspaceRoots: currentPolicy?.trustedWorkspaceRoots,
    blanketGrant:
      preset === "auto-safe" ||
      preset === "auto-safe-medium" ||
      preset === "full" ||
      preset === "ask-every-time" ||
      preset === "strict"
        ? undefined
        : currentPolicy?.blanketGrant
  };

  switch (preset) {
    case "ask-every-time":
      return {
        ...common,
        dangerousRequiresApproval: true,
        mediumRequiresApproval: true,
        preset,
        safeAutoApprove: false
      };
    case "auto-safe-medium":
      return {
        ...common,
        dangerousRequiresApproval: true,
        mediumRequiresApproval: false,
        preset,
        safeAutoApprove: true
      };
    case "full":
      return {
        ...common,
        dangerousRequiresApproval: false,
        fullMachineRequiresApproval: false,
        homeWriteRequiresApproval: false,
        mediumRequiresApproval: false,
        preset,
        remoteHostRequiresApproval: false,
        safeAutoApprove: true
      };
    case "approve-once":
    case "approve-once":
    case "approve-task":
    case "approve-session":
    case "approve-all":
    case "strict":
    case "auto-safe":
    default:
      return {
        ...common,
        dangerousRequiresApproval: true,
        mediumRequiresApproval: true,
        preset,
        safeAutoApprove: true
      };
  }
}

async function approvePendingForGrant(
  store: ApprovalStore,
  grant: ApprovalGrantState
): Promise<void> {
  const pending = await store.listPending();

  for (const request of pending) {
    if (!request.safetyLevel || request.safetyLevel === "dangerous") {
      continue;
    }

    if (
      grant.scope === "task" &&
      request.metadata.taskId !== grant.taskId
    ) {
      continue;
    }

    if (
      (grant.scope === "session" || grant.scope === "task") &&
      request.metadata.sessionId !== grant.sessionId
    ) {
      continue;
    }

    await store.update({
      ...request,
      state: "approved",
      updatedAt: Date.now()
    });

    if (grant.scope === "once") {
      return;
    }
  }
}

async function findMatchingPendingRequest(
  store: ApprovalStore,
  input: {
    fingerprint: string;
    sessionId?: string;
    taskId?: string;
  }
): Promise<ApprovalRequest | undefined> {
  const pending = await store.listPending();

  return pending.find((request) => {
    return (
      request.metadata.fingerprint === input.fingerprint &&
      request.metadata.sessionId === input.sessionId &&
      request.metadata.taskId === input.taskId
    );
  });
}

function isAutoApproved(input: {
  activeSessionId?: string;
  activeTaskId?: string;
  policy: ApprovalPolicy;
  safetyLevel: SafetyLevel;
  scope: FilesystemScope;
}): boolean {
  if (isCoveredByGrant(input)) {
    return true;
  }

  if (input.safetyLevel === "safe") {
    return input.policy.safeAutoApprove;
  }

  if (input.safetyLevel === "dangerous") {
    return !input.policy.dangerousRequiresApproval;
  }

  if (
    input.scope === "remote-host" &&
    input.policy.remoteHostRequiresApproval !== false
  ) {
    return false;
  }

  if (
    input.scope === "full-machine" &&
    input.policy.fullMachineRequiresApproval !== false
  ) {
    return false;
  }

  if (
    input.scope === "home" &&
    input.policy.homeWriteRequiresApproval !== false
  ) {
    return false;
  }

  return !input.policy.mediumRequiresApproval;
}

function isCoveredByGrant(input: {
  activeSessionId?: string;
  activeTaskId?: string;
  policy: ApprovalPolicy;
  safetyLevel: SafetyLevel;
  scope: FilesystemScope;
}): boolean {
  const grant = input.policy.blanketGrant;

  if (!grant || input.safetyLevel === "dangerous") {
    return false;
  }

  if (grant.maxSafety === "safe" && input.safetyLevel !== "safe") {
    return false;
  }

  if (grant.scope === "once") {
    return true;
  }

  if (grant.scope === "all") {
    return true;
  }

  if (
    (grant.scope === "session" || grant.scope === "task") &&
    grant.sessionId &&
    grant.sessionId !== input.activeSessionId
  ) {
    return false;
  }

  if (grant.scope === "task" && grant.taskId && grant.taskId !== input.activeTaskId) {
    return false;
  }

  return true;
}

function createApprovalFingerprint(input: {
  kind: ApprovalRequest["kind"];
  detail: string;
  resource?: string;
  safetyLevel: SafetyLevel;
  summary: string;
}): string {
  return [
    input.kind,
    input.safetyLevel,
    input.resource ?? "",
    input.summary.trim().toLowerCase(),
    input.detail.trim().toLowerCase()
  ].join("|");
}

function createApprovalId(): string {
  return `approval-${randomBytes(4).toString("hex")}`;
}

function normalizePresetName(
  preset: string | undefined
): ApprovalPolicyPreset {
  switch (preset) {
    case "approve-this-task":
      return "approve-task";
    case "approve-this-session":
      return "approve-session";
    case "approve-once":
    case "approve-task":
    case "approve-session":
    case "approve-all":
    case "ask-every-time":
    case "auto-safe":
    case "auto-safe-medium":
    case "full":
    case "strict":
      return preset;
    default:
      return "strict";
  }
}
