import type { WatcherRecord, WatcherStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteWatcherStore implements WatcherStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    create(watcher: WatcherRecord): Promise<WatcherRecord>;
    get(id: string): Promise<WatcherRecord | undefined>;
    list(): Promise<WatcherRecord[]>;
    listActive(): Promise<WatcherRecord[]>;
    update(watcher: WatcherRecord): Promise<WatcherRecord>;
}
//# sourceMappingURL=watcher-store.d.ts.map