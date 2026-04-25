import { resolve } from "node:path";
export function resolveWorkspacePath(workspaceRoot, targetPath) {
    const normalizedPath = targetPath.trim();
    if (normalizedPath.length === 0) {
        throw new Error("Path must not be empty.");
    }
    const resolvedPath = resolve(workspaceRoot, normalizedPath);
    const workspacePrefix = workspaceRoot.endsWith("/")
        ? workspaceRoot
        : `${workspaceRoot}/`;
    if (resolvedPath === workspaceRoot || resolvedPath.startsWith(workspacePrefix)) {
        return resolvedPath;
    }
    throw new Error(`Path "${targetPath}" resolves outside the workspace and cannot be accessed.`);
}
