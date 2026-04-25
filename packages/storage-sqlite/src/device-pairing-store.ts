import type {
  AuthSession,
  DevicePairing,
  DevicePairingStore
} from "@chatgpt-code/runtime-core";

import { PlatformDatabase } from "./database.js";

interface PairingRow {
  data_json: string;
}

interface AuthSessionRow {
  data_json: string;
}

export class SqliteDevicePairingStore implements DevicePairingStore {
  constructor(private readonly database: PlatformDatabase) {}

  async consumePairing(code: string): Promise<DevicePairing | undefined> {
    const pairing = await this.getPairing(code);

    if (!pairing) {
      return undefined;
    }

    const consumed: DevicePairing = {
      ...pairing,
      consumedAt: Date.now(),
      state: "consumed",
      updatedAt: Date.now()
    };
    await this.createPairing(consumed);
    return consumed;
  }

  async createAuthSession(session: AuthSession): Promise<AuthSession> {
    this.database.run(
      `
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
      `,
      session.id,
      session.ownerId,
      session.deviceLabel,
      session.clientType,
      session.refreshTokenHash,
      session.createdAt,
      session.updatedAt,
      session.expiresAt,
      session.revokedAt ?? null,
      JSON.stringify(session)
    );

    return session;
  }

  async createPairing(pairing: DevicePairing): Promise<DevicePairing> {
    this.database.run(
      `
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
      `,
      pairing.id,
      pairing.code,
      pairing.ownerId,
      pairing.label,
      pairing.createdAt,
      pairing.updatedAt,
      pairing.expiresAt,
      pairing.consumedAt ?? null,
      pairing.state,
      JSON.stringify(pairing)
    );

    return pairing;
  }

  async getPairing(code: string): Promise<DevicePairing | undefined> {
    const row = this.database.get<PairingRow>(
      `
        SELECT data_json
        FROM device_pairings
        WHERE code = ?
      `,
      code
    );

    return row ? (JSON.parse(row.data_json) as DevicePairing) : undefined;
  }

  async listAuthSessions(): Promise<AuthSession[]> {
    return this.database
      .all<AuthSessionRow>(
        `
          SELECT data_json
          FROM auth_sessions
          ORDER BY updated_at DESC
        `
      )
      .map((row) => JSON.parse(row.data_json) as AuthSession);
  }

  async listPairings(): Promise<DevicePairing[]> {
    return this.database
      .all<PairingRow>(
        `
          SELECT data_json
          FROM device_pairings
          ORDER BY updated_at DESC
        `
      )
      .map((row) => JSON.parse(row.data_json) as DevicePairing);
  }

  async revokeAuthSession(id: string): Promise<boolean> {
    const current = this.database.get<AuthSessionRow>(
      `
        SELECT data_json
        FROM auth_sessions
        WHERE id = ?
      `,
      id
    );

    if (!current) {
      return false;
    }

    const session = JSON.parse(current.data_json) as AuthSession;
    await this.createAuthSession({
      ...session,
      revokedAt: Date.now(),
      updatedAt: Date.now()
    });
    return true;
  }

  async revokePairing(id: string): Promise<boolean> {
    const current = this.database.get<PairingRow>(
      `
        SELECT data_json
        FROM device_pairings
        WHERE id = ?
      `,
      id
    );

    if (!current) {
      return false;
    }

    const pairing = JSON.parse(current.data_json) as DevicePairing;
    await this.createPairing({
      ...pairing,
      state: "revoked",
      updatedAt: Date.now()
    });
    return true;
  }
}
