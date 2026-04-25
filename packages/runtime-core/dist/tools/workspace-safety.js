import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import { expandHome, isPathInsideRoot } from "../platform/execution-context.js";
const DANGEROUS_COMMANDS = new Set([
    "chattr",
    "chmod",
    "chown",
    "dd",
    "fdisk",
    "git-clean",
    "git-reset",
    "halt",
    "kill",
    "killall",
    "mkfs",
    "mount",
    "passwd",
    "parted",
    "poweroff",
    "reboot",
    "rm",
    "shutdown",
    "su",
    "sudo",
    "systemctl",
    "umount",
    "useradd",
    "usermod"
]);
const SAFE_COMMANDS = new Set([
    "cat",
    "find",
    "git",
    "grep",
    "head",
    "ls",
    "pwd",
    "readlink",
    "rg",
    "sed",
    "stat",
    "tail",
    "test",
    "which"
]);
export class PathAccessError extends Error {
    code;
    path;
    details;
    constructor(message, code, path, details) {
        super(message);
        this.code = code;
        this.path = path;
        this.details = details;
    }
}
export function resolvePathFromContext(context, targetPath, cwdOverride) {
    const normalized = targetPath.trim();
    if (normalized.length === 0) {
        throw new PathAccessError("Path must not be empty.", "invalid_path");
    }
    const baseCwd = cwdOverride ? resolve(cwdOverride) : resolve(context.cwd);
    return resolve(baseCwd, expandHome(normalized));
}
export function ensureLocalPathAllowed(context, resolvedPath) {
    const resolvedScope = classifyPathScope(context, resolvedPath);
    if (context.scope === "remote-host") {
        throw new PathAccessError("Remote-host scope is active, but no remote host executor is available for local path access.", "remote_host_unavailable", resolvedPath, {
            activeScope: context.scope,
            reason: "Local paths are unavailable while remote-host scope is active.",
            resolvedScope
        });
    }
    if (context.scope === "full-machine") {
        return;
    }
    if (context.scope === "home") {
        if (isPathInsideRoot(homedir(), resolvedPath) ||
            context.allowedRoots.some((root) => isPathInsideRoot(root, resolvedPath))) {
            return;
        }
        throw new PathAccessError(`Path "${resolvedPath}" is outside the granted home scope.`, "outside_scope", resolvedPath, {
            activeScope: context.scope,
            reason: "The resolved target path is outside the granted home/workspace roots.",
            resolvedScope
        });
    }
    if (context.allowedRoots.some((root) => isPathInsideRoot(root, resolvedPath)) ||
        isPathInsideRoot(context.projectRoot, resolvedPath)) {
        return;
    }
    throw new PathAccessError(`Path "${resolvedPath}" is blocked by the current workspace scope policy.`, "outside_scope", resolvedPath, {
        activeScope: context.scope,
        reason: "The resolved target path is outside the active project root and granted workspace roots.",
        resolvedScope
    });
}
export function analyzeCommandPathAccess(context, command, args, cwd) {
    const targetPaths = readCommandTargetPaths(command, args, context, cwd);
    const resolvedScope = targetPaths.length > 0
        ? readMostPermissiveScope(targetPaths.map((targetPath) => classifyPathScope(context, targetPath)))
        : classifyPathScope(context, cwd);
    return {
        cwd,
        primaryTargetPath: targetPaths.at(-1),
        resolvedScope,
        targetPaths
    };
}
export function classifyCommandSafety(command, args, options) {
    const normalized = command.trim().toLowerCase();
    const targetPaths = options?.context && options?.cwd
        ? readCommandTargetPaths(normalized, args, options.context, options.cwd)
        : [];
    if (targetPaths.some((targetPath) => isSensitivePath(targetPath))) {
        return "dangerous";
    }
    if (DANGEROUS_COMMANDS.has(normalized)) {
        return "dangerous";
    }
    if (normalized === "git") {
        const subcommand = args[0]?.trim().toLowerCase();
        if (subcommand === "reset" || subcommand === "clean") {
            return "dangerous";
        }
        if (subcommand === "status" || subcommand === "diff" || subcommand === "show") {
            return "safe";
        }
    }
    if (SAFE_COMMANDS.has(normalized)) {
        return "safe";
    }
    if (options?.context &&
        (normalized === "cp" ||
            normalized === "mkdir" ||
            normalized === "mv" ||
            normalized === "rm" ||
            normalized === "touch") &&
        targetPaths.length > 0 &&
        targetPaths.every((targetPath) => classifyPathScope(options.context, targetPath) === "workspace")) {
        return "medium";
    }
    return "medium";
}
export function classifyFileWriteSafety(context, targetPath) {
    if (isSensitivePath(targetPath)) {
        return "dangerous";
    }
    if (context.scope === "full-machine" || context.scope === "remote-host") {
        return "dangerous";
    }
    if (context.scope === "home" &&
        !isPathInsideRoot(context.projectRoot, targetPath)) {
        return "medium";
    }
    return "medium";
}
export function classifyFileReadSafety(context, targetPath) {
    if (context.scope === "full-machine" && isSensitivePath(targetPath)) {
        return "medium";
    }
    return "safe";
}
export function formatPathForDisplay(context, targetPath) {
    if (context.scope === "remote-host") {
        return targetPath;
    }
    const relativePath = relative(context.projectRoot, targetPath);
    return relativePath.length === 0 || relativePath.startsWith("..")
        ? targetPath
        : relativePath;
}
export function isPathOutsideProject(context, targetPath) {
    return !isPathInsideRoot(context.projectRoot, targetPath);
}
export function classifyPathScope(context, targetPath) {
    if (context.scope === "remote-host") {
        return "remote-host";
    }
    if (isPathInsideRoot(context.projectRoot, targetPath) ||
        context.allowedRoots.some((root) => isPathInsideRoot(root, targetPath) && isPathInsideRoot(context.projectRoot, root))) {
        return "workspace";
    }
    if (isPathInsideRoot(homedir(), targetPath) ||
        context.allowedRoots.some((root) => isPathInsideRoot(root, targetPath) && isPathInsideRoot(homedir(), root))) {
        return "home";
    }
    return "full-machine";
}
export function readScopeLabel(scope) {
    switch (scope) {
        case "workspace":
            return "workspace";
        case "home":
            return "home";
        case "full-machine":
            return "full-machine";
        case "remote-host":
            return "remote-host";
        default:
            return scope;
    }
}
function isSensitivePath(targetPath) {
    return (isPathInsideRoot("/etc", targetPath) ||
        isPathInsideRoot("/usr", targetPath) ||
        isPathInsideRoot("/var", targetPath) ||
        isPathInsideRoot("/bin", targetPath) ||
        isPathInsideRoot("/sbin", targetPath) ||
        isPathInsideRoot("/boot", targetPath) ||
        isPathInsideRoot("/dev", targetPath) ||
        isPathInsideRoot("/proc", targetPath) ||
        isPathInsideRoot("/sys", targetPath));
}
function readCommandTargetPaths(command, args, context, cwd) {
    if (!context || !cwd) {
        return [];
    }
    const normalizedCommand = command.trim().toLowerCase();
    const forcePlainPathTokens = normalizedCommand === "cp" ||
        normalizedCommand === "mkdir" ||
        normalizedCommand === "mv" ||
        normalizedCommand === "rm" ||
        normalizedCommand === "touch";
    return args
        .filter((value) => value.trim().length > 0 && !value.startsWith("-"))
        .filter((value) => forcePlainPathTokens ? true : isLikelyPathToken(value))
        .map((value) => {
        try {
            return resolvePathFromContext(context, value, cwd);
        }
        catch {
            return undefined;
        }
    })
        .filter((value) => typeof value === "string");
}
function isLikelyPathToken(value) {
    return (value.includes("/") ||
        value.startsWith(".") ||
        value.startsWith("~") ||
        value === ".." ||
        value === ".");
}
function readMostPermissiveScope(scopes) {
    return [...scopes].sort((left, right) => scopeRank(right) - scopeRank(left))[0] ?? "workspace";
}
function scopeRank(scope) {
    switch (scope) {
        case "workspace":
            return 1;
        case "home":
            return 2;
        case "full-machine":
            return 3;
        case "remote-host":
            return 4;
        default:
            return 0;
    }
}
//# sourceMappingURL=workspace-safety.js.map