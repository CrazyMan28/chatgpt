import type { ApprovalPolicy, ExecutionContext, FilesystemGrant, FilesystemScope } from "./types.js";
export declare const DEFAULT_APPROVAL_POLICY: ApprovalPolicy;
export interface ExecutionContextController {
    addGrant(grant: FilesystemGrant): ExecutionContext;
    get(): ExecutionContext;
    getGrants(): readonly FilesystemGrant[];
    reset(nextContext?: Partial<ExecutionContext>): ExecutionContext;
    revokeGrant(grantIdOrScope: string): ExecutionContext;
    set(nextContext: ExecutionContext): ExecutionContext;
    update(nextContext: Partial<ExecutionContext>): ExecutionContext;
}
export declare function createExecutionContextController(initialContext: ExecutionContext, initialGrants?: readonly FilesystemGrant[]): ExecutionContextController;
export declare function createDefaultExecutionContext(input: {
    projectId: string;
    projectRoot: string;
    cwd?: string;
    scope?: FilesystemScope;
    approvalPolicy?: ApprovalPolicy;
}): ExecutionContext;
export declare function normalizeExecutionContext(context: ExecutionContext): ExecutionContext;
export declare function normalizePathLike(value: string, cwd: string): string;
export declare function expandHome(value: string): string;
export declare function isPathInsideRoot(root: string, targetPath: string): boolean;
//# sourceMappingURL=execution-context.d.ts.map