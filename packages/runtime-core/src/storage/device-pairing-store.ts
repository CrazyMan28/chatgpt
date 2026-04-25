import type { AuthSession, DevicePairing } from "../platform/types.js";

export interface DevicePairingStore {
  consumePairing(code: string): Promise<DevicePairing | undefined>;
  createAuthSession(session: AuthSession): Promise<AuthSession>;
  createPairing(pairing: DevicePairing): Promise<DevicePairing>;
  getPairing(code: string): Promise<DevicePairing | undefined>;
  listAuthSessions(): Promise<AuthSession[]>;
  listPairings(): Promise<DevicePairing[]>;
  revokeAuthSession(id: string): Promise<boolean>;
  revokePairing(id: string): Promise<boolean>;
}
