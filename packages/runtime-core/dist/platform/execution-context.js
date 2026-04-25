import { homedir } from "node:os";
import { resolve } from "node:path";
export const DEFAULT_APPROVAL_POLICY = {
    dangerousRequiresApproval: true,
    fullMachineRequiresApproval: true,
    homeWriteRequiresApproval: true,
    mediumRequiresApproval: false,
    preset: "auto-safe-medium",
    remoteHostRequiresApproval: true,
    safeAutoApprove: true
};
export function createExecutionContextController(initialContext, initialGrants = []) {
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
            grants = grants.filter((grant) => grant.id.toLowerCase() !== normalized &&
                grant.scope.toLowerCase() !== normalized);
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
                allowedRoots: nextContext.allowedRoots !== undefined
                    ? nextContext.allowedRoots
                    : context.allowedRoots
            });
            context = applyGrantRoots(context, grants);
            return context;
        }
    };
}
export function createDefaultExecutionContext(input) {
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
export function normalizeExecutionContext(context) {
    const projectRoot = resolve(context.projectRoot);
    const cwd = normalizePathLike(context.cwd, projectRoot);
    const allowedRoots = dedupeRoots(context.allowedRoots.length > 0 ? context.allowedRoots : [projectRoot]);
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
export function normalizePathLike(value, cwd) {
    const trimmed = value.trim();
    const expanded = expandHome(trimmed.length > 0 ? trimmed : cwd);
    return resolve(cwd, expanded);
}
export function expandHome(value) {
    if (value === "~") {
        return homedir();
    }
    if (value.startsWith("~/")) {
        return resolve(homedir(), value.slice(2));
    }
    return value;
}
export function isPathInsideRoot(root, targetPath) {
    const normalizedRoot = resolve(root);
    const normalizedTarget = resolve(targetPath);
    const prefix = normalizedRoot.endsWith("/")
        ? normalizedRoot
        : `${normalizedRoot}/`;
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(prefix);
}
function applyGrantRoots(context, grants) {
    const nextRoots = new Set(context.allowedRoots.map((root) => resolve(root)));
    for (const grant of grants) {
        if (grant.root) {
            nextRoots.add(resolve(grant.root));
        }
        else if (grant.scope === "home") {
            nextRoots.add(homedir());
        }
        else if (grant.scope === "workspace") {
            nextRoots.add(resolve(context.projectRoot));
        }
    }
    return {
        ...context,
        allowedRoots: [...nextRoots]
    };
}
function dedupeRoots(values) {
    return [...new Set(values.map((value) => resolve(expandHome(value))))];
}
function dedupeGrants(values) {
    const seen = new Set();
    const grants = [];
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
//# sourceMappingURL=execution-context.js.map