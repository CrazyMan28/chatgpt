import { homedir } from "node:os";
import { resolve } from "node:path";

import type {
  ApprovalPolicy,
  ExecutionContext,
  FilesystemGrant,
  FilesystemScope
} from "./types.js";

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  dangerousRequiresApproval: true,
  fullMachineRequiresApproval: true,
  homeWriteRequiresApproval: true,
  mediumRequiresApproval: false,
  preset: "auto-safe-medium",
  remoteHostRequiresApproval: true,
  safeAutoApprove: true
};

export interface ExecutionContextController {
  addGrant(grant: FilesystemGrant): ExecutionContext;
  get(): ExecutionContext;
  getGrants(): readonly FilesystemGrant[];
  reset(nextContext?: Partial<ExecutionContext>): ExecutionContext;
  revokeGrant(grantIdOrScope: string): ExecutionContext;
  set(nextContext: ExecutionContext): ExecutionContext;
  update(nextContext: Partial<ExecutionContext>): ExecutionContext;
}

export function createExecutionContextController(
  initialContext: ExecutionContext,
  initialGrants: readonly FilesystemGrant[] = []
): ExecutionContextController {
  let context = normalizeExecutionContext(initialContext);
  let grants = dedupeGrants(initialGrants);

  return {
    addGrant(grant) {
      grants = dedupeGrants([grant, ...grants]);
      context = applyGrantRoots(context, grants);
      return context;
    },
    get() {
      return {
        ...context,
        allowedRoots: [...context.allowedRoots]
      };
    },
    getGrants() {
      return [...grants];
    },
    reset(nextContext) {
      context = normalizeExecutionContext({
        ...context,
        ...nextContext
      });
      grants = [];
      return context;
    },
    revokeGrant(grantIdOrScope) {
      const normalized = grantIdOrScope.trim().toLowerCase();
      grants = grants.filter(
        (grant) =>
          grant.id.toLowerCase() !== normalized &&
          grant.scope.toLowerCase() !== normalized
      );
      context = applyGrantRoots(context, grants);
      return context;
    },
    set(nextContext) {
      context = normalizeExecutionContext(nextContext);
      context = applyGrantRoots(context, grants);
      return context;
    },
    update(nextContext) {
      context = normalizeExecutionContext({
        ...context,
        ...nextContext,
        allowedRoots:
          nextContext.allowedRoots !== undefined
            ? nextContext.allowedRoots
            : context.allowedRoots
      });
      context = applyGrantRoots(context, grants);
      return context;
    }
  };
}

export function createDefaultExecutionContext(input: {
  projectId: string;
  projectRoot: string;
  cwd?: string;
  scope?: FilesystemScope;
  approvalPolicy?: ApprovalPolicy;
}): ExecutionContext {
  return normalizeExecutionContext({
    activeRemoteHostId: undefined,
    allowedRoots: [resolve(input.projectRoot)],
    approvalPolicy: input.approvalPolicy ?? DEFAULT_APPROVAL_POLICY,
    cwd: input.cwd ?? input.projectRoot,
    projectId: input.projectId,
    projectRoot: resolve(input.projectRoot),
    scope: input.scope ?? "workspace"
  });
}

export function normalizeExecutionContext(
  context: ExecutionContext
): ExecutionContext {
  const projectRoot = resolve(context.projectRoot);
  const cwd = normalizePathLike(context.cwd, projectRoot);
  const allowedRoots = dedupeRoots(
    context.allowedRoots.length > 0 ? context.allowedRoots : [projectRoot]
  );

  return {
    ...context,
    allowedRoots,
    approvalPolicy: {
      ...DEFAULT_APPROVAL_POLICY,
      ...context.approvalPolicy
    },
    cwd,
    projectRoot
  };
}

export function normalizePathLike(value: string, cwd: string): string {
  const trimmed = value.trim();
  const expanded = expandHome(trimmed.length > 0 ? trimmed : cwd);
  return resolve(cwd, expanded);
}

export function expandHome(value: string): string {
  if (value === "~") {
    return homedir();
  }

  if (value.startsWith("~/")) {
    return resolve(homedir(), value.slice(2));
  }

  return value;
}

export function isPathInsideRoot(root: string, targetPath: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(targetPath);
  const prefix = normalizedRoot.endsWith("/")
    ? normalizedRoot
    : `${normalizedRoot}/`;

  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(prefix);
}

function applyGrantRoots(
  context: ExecutionContext,
  grants: readonly FilesystemGrant[]
): ExecutionContext {
  const nextRoots = new Set<string>(context.allowedRoots.map((root) => resolve(root)));

  for (const grant of grants) {
    if (grant.root) {
      nextRoots.add(resolve(grant.root));
    } else if (grant.scope === "home") {
      nextRoots.add(homedir());
    } else if (grant.scope === "workspace") {
      nextRoots.add(resolve(context.projectRoot));
    }
  }

  return {
    ...context,
    allowedRoots: [...nextRoots]
  };
}

function dedupeRoots(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => resolve(expandHome(value))))];
}

function dedupeGrants(values: readonly FilesystemGrant[]): FilesystemGrant[] {
  const seen = new Set<string>();
  const grants: FilesystemGrant[] = [];

  for (const grant of values) {
    const signature = `${grant.scope}:${grant.hostId ?? ""}:${grant.root ?? ""}`.toLowerCase();

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    grants.push({
      ...grant,
      root: grant.root ? resolve(expandHome(grant.root)) : undefined
    });
  }

  return grants;
}
