export interface ResolveProjectRootOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
export declare function readWorkspaceRootOverride(env?: NodeJS.ProcessEnv): string | undefined;
export declare function resolveProjectRoot(options?: ResolveProjectRootOptions): Promise<string>;
export declare function commitWorkspaceRootEnv(workspaceRoot: string, env?: NodeJS.ProcessEnv): string;
//# sourceMappingURL=project-root.d.ts.map