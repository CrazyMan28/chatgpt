import { PlatformDatabase } from "./database.js";
export class SqliteDevicePairingStore {
    database;
    constructor(database) {
        this.database = database;
    }
    async consumePairing(code) {
        const pairing = await this.getPairing(code);
        if (!pairing) {
            return undefined;
        }
        const consumed = {
            ...pairing,
            consumedAt: Date.now(),
            state: "consumed",
            updatedAt: Date.now()
        };
        await this.createPairing(consumed);
        return consumed;
    }
    async createAuthSession(session) {
        this.database.run(`
        INSERT INTO auth_sessions(
          id,
          owner_id,
          device_label,
          client_type,
          refresh_token_hash,
          created_at,
          updated_at,
          expires_at,
          revoked_at,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at,
          revoked_at = excluded.revoked_at,
          data_json = excluded.data_json
      `, session.id, session.ownerId, session.deviceLabel, session.clientType, session.refreshTokenHash, session.createdAt, session.updatedAt, session.expiresAt, session.revokedAt ?? null, JSON.stringify(session));
        return session;
    }
    async createPairing(pairing) {
        this.database.run(`
        INSERT INTO device_pairings(
          id,
          code,
          owner_id,
          label,
          created_at,
          updated_at,
          expires_at,
          consumed_at,
          state,
          data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          consumed_at = excluded.consumed_at,
          state = excluded.state,
          data_json = excluded.data_json
      `, pairing.id, pairing.code, pairing.ownerId, pairing.label, pairing.createdAt, pairing.updatedAt, pairing.expiresAt, pairing.consumedAt ?? null, pairing.state, JSON.stringify(pairing));
        return pairing;
    }
    async getPairing(code) {
        const row = this.database.get(`
        SELECT data_json
        FROM device_pairings
        WHERE code = ?
      `, code);
        return row ? JSON.parse(row.data_json) : undefined;
    }
    async listAuthSessions() {
        return this.database
            .all(`
          SELECT data_json
          FROM auth_sessions
          ORDER BY updated_at DESC
        `)
            .map((row) => JSON.parse(row.data_json));
    }
    async listPairings() {
        return this.database
            .all(`
          SELECT data_json
          FROM device_pairings
          ORDER BY updated_at DESC
        `)
            .map((row) => JSON.parse(row.data_json));
    }
    async revokeAuthSession(id) {
        const current = this.database.get(`
        SELECT data_json
        FROM auth_sessions
        WHERE id = ?
      `, id);
        if (!current) {
            return false;
        }
        const session = JSON.parse(current.data_json);
        await this.createAuthSession({
            ...session,
            revokedAt: Date.now(),
            updatedAt: Date.now()
        });
        return true;
    }
    async revokePairing(id) {
        const current = this.database.get(`
        SELECT data_json
        FROM device_pairings
        WHERE id = ?
      `, id);
        if (!current) {
            return false;
        }
        const pairing = JSON.parse(current.data_json);
        await this.createPairing({
            ...pairing,
            state: "revoked",
            updatedAt: Date.now()
        });
        return true;
    }
}
//# sourceMappingURL=device-pairing-store.js.map