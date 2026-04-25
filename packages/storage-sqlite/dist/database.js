import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
export const DEFAULT_DATABASE_PATH = ".chatgpt-code/orchestrator.db";
export class PlatformDatabase {
    database;
    filePath;
    constructor(workspaceRoot, filePath = DEFAULT_DATABASE_PATH) {
        this.filePath = resolve(workspaceRoot, filePath);
        mkdirSync(dirname(this.filePath), { recursive: true });
        this.database = new Database(this.filePath);
        this.database.pragma("journal_mode = WAL");
        this.database.pragma("foreign_keys = ON");
        this.initialize();
    }
    close() {
        this.database.close();
    }
    exec(sql) {
        this.database.exec(sql);
    }
    get(sql, ...parameters) {
        return this.database.prepare(sql).get(...parameters);
    }
    all(sql, ...parameters) {
        return this.database.prepare(sql).all(...parameters);
    }
    run(sql, ...parameters) {
        return this.database.prepare(sql).run(...parameters);
    }
    transaction(callback) {
        return this.database.transaction(callback)();
    }
    setMeta(key, value) {
        this.run(`
        INSERT INTO meta(key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `, key, value, Date.now());
    }
    getMeta(key) {
        const row = this.get("SELECT value FROM meta WHERE key = ?", key);
        return row?.value;
    }
    initialize() {
        this.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        title TEXT NOT NULL,
        turn_count INTEGER NOT NULL,
        history_json TEXT NOT NULL,
        transcript_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        embedding_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        interval_minutes REAL NOT NULL,
        kind TEXT NOT NULL,
        next_run_at INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        run_count INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        last_error TEXT,
        last_result_summary TEXT,
        last_run_at INTEGER,
        auto_state_json TEXT
      );

      CREATE TABLE IF NOT EXISTS dossiers (
        kind TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        data_json TEXT NOT NULL,
        PRIMARY KEY(kind, scope_key)
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        session_id TEXT,
        task_id TEXT,
        summary TEXT NOT NULL,
        detail TEXT,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        state TEXT NOT NULL,
        summary TEXT NOT NULL,
        detail TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_registry (
        name TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_registry (
        session_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        style TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        cwd TEXT NOT NULL,
        scope TEXT NOT NULL,
        active_remote_host_id TEXT,
        background_state TEXT NOT NULL,
        last_activity_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_clients (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_type TEXT NOT NULL,
        attached_at INTEGER NOT NULL,
        detached_at INTEGER,
        is_active INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watchers (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        detail TEXT,
        target TEXT,
        session_id TEXT,
        task_id TEXT,
        project_id TEXT,
        scope TEXT,
        activity_at INTEGER,
        retry_count INTEGER,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS device_pairings (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER,
        state TEXT NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        device_label TEXT NOT NULL,
        client_type TEXT NOT NULL,
        refresh_token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcp_sets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcp_favorites (
        name TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_mcp_assignments (
        project_id TEXT PRIMARY KEY,
        set_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fleet_assignments (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        parent_session_id TEXT NOT NULL,
        worker_session_id TEXT,
        role TEXT NOT NULL,
        state TEXT NOT NULL,
        task TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        connection_type TEXT NOT NULL,
        status TEXT NOT NULL,
        last_heartbeat INTEGER,
        current_task TEXT,
        data_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vault_entries (
        key TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
        this.ensureColumn("tasks", "data_json", "TEXT");
    }
    ensureColumn(tableName, columnName, columnDefinition) {
        const columns = this.all(`PRAGMA table_info(${tableName})`);
        if (columns.some((column) => column.name === columnName)) {
            return;
        }
        this.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
}
//# sourceMappingURL=database.js.map