import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  FileSessionStore,
  JsonAuthStore,
  JsonMemoryStore,
  JsonTaskStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";
import { SqliteVaultAuthStore } from "./auth-store.js";
import { SqliteMemoryStore } from "./memory-store.js";
import { SqliteSessionStore } from "./session-store.js";
import { SqliteTaskStore } from "./task-store.js";

const LEGACY_MIGRATION_KEY = "legacy-json-migration";
const LEGACY_BACKUP_DIRECTORY = ".chatgpt-code/legacy-backups";

export async function migrateLegacyWorkspaceState(options: {
  database: PlatformDatabase;
  passphrase: string;
  workspaceRoot: string;
}): Promise<void> {
  const { database, passphrase, workspaceRoot } = options;

  if (database.getMeta(LEGACY_MIGRATION_KEY) === "complete") {
    return;
  }

  const legacyPaths = [
    ".chatgpt-code/auth.json",
    ".chatgpt-code/memory.json",
    ".chatgpt-code/tasks.json"
  ];

  for (const relativePath of legacyPaths) {
    backupLegacyFile(workspaceRoot, relativePath);
  }

  const authStore = new SqliteVaultAuthStore(database, passphrase);
  const memoryStore = new SqliteMemoryStore(database);
  const sessionStore = new SqliteSessionStore(database);
  const taskStore = new SqliteTaskStore(database);

  if (existsSync(resolve(workspaceRoot, ".chatgpt-code/auth.json"))) {
    const legacyAuthStore = new JsonAuthStore(workspaceRoot);
    const legacyAuth = await legacyAuthStore.load();
    await authStore.save(legacyAuth);
  }

  if (existsSync(resolve(workspaceRoot, ".chatgpt-code/memory.json"))) {
    const legacyMemoryStore = new JsonMemoryStore(workspaceRoot);
    const memories = await legacyMemoryStore.listMemories();

    for (const memory of memories) {
      if (memory.sessionId === "global") {
        await memoryStore.rememberGlobal(memory.text);
      } else {
        await memoryStore.rememberFromUserMessage(memory.text, {
          sessionId: memory.sessionId
        });
      }
    }
  }

  if (existsSync(resolve(workspaceRoot, ".chatgpt-code/tasks.json"))) {
    const legacyTaskStore = new JsonTaskStore(workspaceRoot);
    const tasks = await legacyTaskStore.listTasks();

    for (const task of tasks) {
      await taskStore.saveTask(task);
    }
  }

  if (existsSync(resolve(workspaceRoot, ".chatgpt-code/sessions"))) {
    const legacySessionStore = new FileSessionStore(workspaceRoot);
    const sessions = await legacySessionStore.listSessions();

    for (const summary of sessions) {
      const session = await legacySessionStore.loadSession(summary.id);

      if (session) {
        await sessionStore.saveSession(session);
      }
    }
  }

  database.setMeta(LEGACY_MIGRATION_KEY, "complete");
}

function backupLegacyFile(workspaceRoot: string, relativePath: string): void {
  const sourcePath = resolve(workspaceRoot, relativePath);

  if (!existsSync(sourcePath)) {
    return;
  }

  const destinationPath = resolve(
    workspaceRoot,
    LEGACY_BACKUP_DIRECTORY,
    relativePath.replace(/^\.chatgpt-code\//, "")
  );

  if (existsSync(destinationPath)) {
    return;
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}
