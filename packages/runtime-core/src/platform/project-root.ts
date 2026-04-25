import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface ResolveProjectRootOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function readWorkspaceRootOverride(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const canonical = env.CHATGPT_CODE_WORKSPACE_ROOT?.trim();

  if (canonical) {
    return canonical;
  }

  const legacy = env.WORKSPACE_ROOT?.trim();

  return legacy && legacy.length > 0 ? legacy : undefined;
}

export async function resolveProjectRoot(
  options: ResolveProjectRootOptions = {}
): Promise<string> {
  const env = options.env ?? process.env;
  const launchPath = resolve(
    readWorkspaceRootOverride(env) ?? options.cwd ?? process.cwd()
  );
  const gitRoot = await findNearestGitRoot(launchPath);

  return gitRoot ?? launchPath;
}

export function commitWorkspaceRootEnv(
  workspaceRoot: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const resolvedRoot = resolve(workspaceRoot);
  env.CHATGPT_CODE_WORKSPACE_ROOT = resolvedRoot;

  if (!env.WORKSPACE_ROOT?.trim()) {
    env.WORKSPACE_ROOT = resolvedRoot;
  }

  return resolvedRoot;
}

async function findNearestGitRoot(startPath: string): Promise<string | undefined> {
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
