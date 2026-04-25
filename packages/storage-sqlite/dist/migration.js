import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { FileSessionStore, JsonAuthStore, JsonMemoryStore, JsonTaskStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
import { SqliteVaultAuthStore } from "./auth-store.js";
import { SqliteMemoryStore } from "./memory-store.js";
import { SqliteSessionStore } from "./session-store.js";
import { SqliteTaskStore } from "./task-store.js";
const LEGACY_MIGRATION_KEY = "legacy-json-migration";
const LEGACY_BACKUP_DIRECTORY = ".chatgpt-code/legacy-backups";
const AUTH_VAULT_KEY = "auth-config";
const DEFAULT_LOCAL_MODEL = "mock-local";
const VAULT_DECRYPT_SENTINEL_MODEL = "__chatgpt-code-vault-decrypt-sentinel__";
export async function migrateLegacyWorkspaceState(options) {
    const { database, passphrase, workspaceRoot } = options;
    if (database.getMeta(LEGACY_MIGRATION_KEY) === "complete") {
        await recoverLegacyMistralAuthIfVaultFallsBack({
            database,
            passphrase,
            workspaceRoot
        });
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
            }
            else {
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
async function recoverLegacyMistralAuthIfVaultFallsBack(options) {
    const { database, passphrase, workspaceRoot } = options;
    const legacyAuthPath = resolve(workspaceRoot, ".chatgpt-code/auth.json");
    if (!existsSync(legacyAuthPath) || !hasVaultAuthConfig(database)) {
        return;
    }
    const authStore = new SqliteVaultAuthStore(database, passphrase);
    const vaultAuth = await authStore.load(createVaultDecryptProbeAuthConfig());
    if (!shouldRecoverFromLegacyAuth(vaultAuth)) {
        return;
    }
    const legacyAuthStore = new JsonAuthStore(workspaceRoot);
    const legacyAuth = await legacyAuthStore.load();
    if (!hasMistralLogin(legacyAuth)) {
        return;
    }
    await authStore.save(legacyAuth);
}
function hasVaultAuthConfig(database) {
    return Boolean(database.get("SELECT key FROM vault_entries WHERE key = ?", AUTH_VAULT_KEY));
}
function createVaultDecryptProbeAuthConfig() {
    return {
        activeProvider: "local",
        providers: {
            local: {
                model: VAULT_DECRYPT_SENTINEL_MODEL
            }
        },
        version: 1
    };
}
function shouldRecoverFromLegacyAuth(auth) {
    return isVaultDecryptProbeAuthConfig(auth) || isMockLocalAuthConfig(auth);
}
function isVaultDecryptProbeAuthConfig(auth) {
    return (auth.activeProvider === "local" &&
        auth.providers.local?.model === VAULT_DECRYPT_SENTINEL_MODEL);
}
function isMockLocalAuthConfig(auth) {
    return (auth.activeProvider === "local" &&
        auth.providers.local?.model === DEFAULT_LOCAL_MODEL);
}
function hasMistralLogin(auth) {
    return (auth.activeProvider === "mistral" &&
        typeof auth.providers.mistral?.apiKey === "string" &&
        auth.providers.mistral.apiKey.trim().length > 0);
}
function backupLegacyFile(workspaceRoot, relativePath) {
    const sourcePath = resolve(workspaceRoot, relativePath);
    if (!existsSync(sourcePath)) {
        return;
    }
    const destinationPath = resolve(workspaceRoot, LEGACY_BACKUP_DIRECTORY, relativePath.replace(/^\.chatgpt-code\//, ""));
    if (existsSync(destinationPath)) {
        return;
    }
    mkdirSync(dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
}
//# sourceMappingURL=migration.js.map