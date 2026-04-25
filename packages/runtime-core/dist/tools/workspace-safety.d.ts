import type { ExecutionContext, FilesystemScope, SafetyLevel } from "../platform/types.js";
export type PathAccessErrorCode = "blocked_policy" | "invalid_path" | "outside_scope" | "remote_host_unavailable";
export declare class PathAccessError extends Error {
    readonly code: PathAccessErrorCode;
    readonly path?: string | undefined;
    readonly details?: {
        activeScope?: FilesystemScope;
        reason?: string;
        resolvedScope?: FilesystemScope;
    } | undefined;
    constructor(message: string, code: PathAccessErrorCode, path?: string | undefined, details?: {
        activeScope?: FilesystemScope;
        reason?: string;
        resolvedScope?: FilesystemScope;
    } | undefined);
}
export interface CommandPathAnalysis {
    cwd: string;
    primaryTargetPath?: string;
    resolvedScope: FilesystemScope;
    targetPaths: string[];
}
export declare function resolvePathFromContext(context: ExecutionContext, targetPath: string, cwdOverride?: string): string;
export declare function ensureLocalPathAllowed(context: ExecutionContext, resolvedPath: string): void;
export declare function analyzeCommandPathAccess(context: ExecutionContext, command: string, args: readonly string[], cwd: string): CommandPathAnalysis;
export declare function classifyCommandSafety(command: string, args: readonly string[], options?: {
    context?: ExecutionContext;
    cwd?: string;
}): SafetyLevel;
export declare function classifyFileWriteSafety(context: ExecutionContext, targetPath: string): SafetyLevel;
export declare function classifyFileReadSafety(context: ExecutionContext, targetPath: string): SafetyLevel;
export declare function formatPathForDisplay(context: ExecutionContext, targetPath: string): string;
export declare function isPathOutsideProject(context: ExecutionContext, targetPath: string): boolean;
export declare function classifyPathScope(context: ExecutionContext, targetPath: string): FilesystemScope;
export declare function readScopeLabel(scope: FilesystemScope): string;
//# sourceMappingURL=workspace-safety.d.ts.map