import { type AuthConfigRecord, type AuthStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteVaultAuthStore implements AuthStore {
    private readonly database;
    private readonly passphrase;
    constructor(database: PlatformDatabase, passphrase: string);
    load(fallback?: AuthConfigRecord): Promise<AuthConfigRecord>;
    save(config: AuthConfigRecord): Promise<AuthConfigRecord>;
}
//# sourceMappingURL=auth-store.d.ts.map