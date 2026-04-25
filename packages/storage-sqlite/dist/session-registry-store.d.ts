import type { SessionClientAttachment, SessionRegistryEntry, SessionRegistryStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteSessionRegistryStore implements SessionRegistryStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    attachClient(attachment: SessionClientAttachment): Promise<SessionClientAttachment>;
    detachClient(attachmentId: string): Promise<SessionClientAttachment | undefined>;
    get(sessionId: string): Promise<SessionRegistryEntry | undefined>;
    list(): Promise<SessionRegistryEntry[]>;
    listAttachments(sessionId: string): Promise<SessionClientAttachment[]>;
    save(entry: SessionRegistryEntry): Promise<SessionRegistryEntry>;
}
//# sourceMappingURL=session-registry-store.d.ts.map