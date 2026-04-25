#!/usr/bin/env node

import {
  commitWorkspaceRootEnv,
  resolveProjectRoot,
  runStandaloneTui
} from "@chatgpt-code/runtime-core";
import {
  PlatformDatabase,
  SqliteApprovalStore,
  SqliteFleetStore,
  SqliteMemoryStore,
  SqliteProjectRegistryStore,
  SqliteSessionRegistryStore,
  SqliteSessionStore,
  SqliteTaskStore,
  SqliteTimelineStore,
  SqliteVaultAuthStore,
  SqliteWatcherStore,
  migrateLegacyWorkspaceState,
  resolveVaultPassphrase
} from "@chatgpt-code/storage-sqlite";
import { createRemoteWorkerRegistry } from "@chatgpt-code/worker-remote";
import { access } from "node:fs/promises";

/**
 * Validates that the workspace root is a non-empty string and accessible.
 * @param workspaceRoot - The workspace root directory.
 * @throws {Error} If workspaceRoot is not a non-empty string or is inaccessible.
 */
async function validateWorkspaceRoot(workspaceRoot: string): Promise<void> {
  if (typeof workspaceRoot !== "string" || workspaceRoot.trim() === "") {
    throw new Error("Workspace root must be a non-empty string.");
  }

  try {
    await access(workspaceRoot);
  } catch (error) {
    const errorDetails = extractErrorDetails(error);
    logError(`Workspace root is inaccessible: ${workspaceRoot}`, {
      code: errorDetails.code,
      stack: errorDetails.stack,
      path: workspaceRoot,
      ...errorDetails
    });
    throw new Error(`Workspace root is inaccessible: ${workspaceRoot} (${errorDetails.code})`);
  }
}

function extractErrorDetails(error: unknown): {
  code?: string;
  message: string;
  stack?: string;
  [key: string]: unknown;
} {
  if (error instanceof Error) {
    const detail: {
      code?: string;
      message: string;
      stack?: string;
      [key: string]: unknown;
    } = {
      message: error.message,
      stack: error.stack
    };

    if ("code" in error && typeof error.code === "string") {
      detail.code = error.code;
    }

    return detail;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = typeof error.message === "string" ? error.message : String(error.message);
    const detail: {
      code?: string;
      message: string;
      stack?: string;
      [key: string]: unknown;
    } = {
      message
    };

    if ("code" in error && typeof error.code === "string") {
      detail.code = error.code;
    }

    if ("stack" in error && typeof error.stack === "string") {
      detail.stack = error.stack;
    }

    return detail;
  }

  return {
    message: String(error)
  };
}

/**
 * Handles an error by logging it and re-throwing it.
 * @param error - The error to handle.
 * @param context - Contextual information about the error.
 * @param workspaceRoot - The workspace root directory.
 */
function handleAndThrowError(error: unknown, context: string, workspaceRoot: string): never {
  const errorDetails = extractErrorDetails(error);
  logError(`Error: ${errorDetails.message}`, {
    context,
    workspace: workspaceRoot,
    code: errorDetails.code,
    stack: errorDetails.stack,
    ...errorDetails
  });
  throw error;
}

void main().catch((error) => {
  const errorDetails = extractErrorDetails(error);
  logError(`Fatal error in main(): ${errorDetails.message}`, {
    code: errorDetails.code,
    stack: errorDetails.stack,
    ...errorDetails
  });
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const workspaceRoot = commitWorkspaceRootEnv(
    await resolveProjectRoot({
      cwd: process.cwd(),
      env: process.env
    })
  );

  await validateWorkspaceRoot(workspaceRoot);

  const passphrase = await resolveVaultPassphrase();

  const database = new PlatformDatabase(workspaceRoot);

  try {
    await migrateLegacyWorkspaceState({
      database,
      passphrase,
      workspaceRoot
    });

    await runStandaloneTui({
      approvalStore: new SqliteApprovalStore(database),
      authStore: new SqliteVaultAuthStore(database, passphrase),
      fleetStore: new SqliteFleetStore(database),
      memoryStore: new SqliteMemoryStore(database),
      projectRegistryStore: new SqliteProjectRegistryStore(database),
      remoteManager: createRemoteWorkerRegistry({
        workspaceRoot
      }),
      sessionRegistryStore: new SqliteSessionRegistryStore(database),
      sessionStore: new SqliteSessionStore(database),
      taskStore: new SqliteTaskStore(database),
      timelineStore: new SqliteTimelineStore(database),
      watcherStore: new SqliteWatcherStore(database),
      workspaceRoot
    });
  } catch (error) {
    handleAndThrowError(error, "Error during migration or TUI execution", workspaceRoot);
  } finally {
    try {
      await database.close();
    } catch (error) {
      const errorDetails = extractErrorDetails(error);
      logError(`Failed to close database (Workspace: ${workspaceRoot}): ${errorDetails.message}`, {
        code: errorDetails.code,
        stack: errorDetails.stack,
        ...errorDetails
      });
    }
  }
}

function logError(message: string, details: Record<string, unknown>): void {
  console.error(message, details);
}
