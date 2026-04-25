import type { AuthSession, DevicePairing, DevicePairingStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteDevicePairingStore implements DevicePairingStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    consumePairing(code: string): Promise<DevicePairing | undefined>;
    createAuthSession(session: AuthSession): Promise<AuthSession>;
    createPairing(pairing: DevicePairing): Promise<DevicePairing>;
    getPairing(code: string): Promise<DevicePairing | undefined>;
    listAuthSessions(): Promise<AuthSession[]>;
    listPairings(): Promise<DevicePairing[]>;
    revokeAuthSession(id: string): Promise<boolean>;
    revokePairing(id: string): Promise<boolean>;
}
//# sourceMappingURL=device-pairing-store.d.ts.map