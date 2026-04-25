import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
export function readWorkspaceRootOverride(env = process.env) {
    const canonical = env.CHATGPT_CODE_WORKSPACE_ROOT?.trim();
    if (canonical) {
        return canonical;
    }
    const legacy = env.WORKSPACE_ROOT?.trim();
    return legacy && legacy.length > 0 ? legacy : undefined;
}
export async function resolveProjectRoot(options = {}) {
    const env = options.env ?? process.env;
    const launchPath = resolve(readWorkspaceRootOverride(env) ?? options.cwd ?? process.cwd());
    const gitRoot = await findNearestGitRoot(launchPath);
    return gitRoot ?? launchPath;
}
export function commitWorkspaceRootEnv(workspaceRoot, env = process.env) {
    const resolvedRoot = resolve(workspaceRoot);
    env.CHATGPT_CODE_WORKSPACE_ROOT = resolvedRoot;
    if (!env.WORKSPACE_ROOT?.trim()) {
        env.WORKSPACE_ROOT = resolvedRoot;
    }
    return resolvedRoot;
}
async function findNearestGitRoot(startPath) {
    let currentPath = resolve(startPath);
    while (true) {
        if (await pathExists(join(currentPath, ".git"))) {
            return currentPath;
        }
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            return undefined;
        }
        currentPath = parentPath;
    }
}
async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=project-root.js.map