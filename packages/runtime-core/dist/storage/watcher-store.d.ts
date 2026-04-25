import type { WatcherRecord } from "../platform/types.js";
export interface WatcherStore {
    create(watcher: WatcherRecord): Promise<WatcherRecord>;
    get(id: string): Promise<WatcherRecord | undefined>;
    list(): Promise<WatcherRecord[]>;
    listActive(): Promise<WatcherRecord[]>;
    update(watcher: WatcherRecord): Promise<WatcherRecord>;
}
//# sourceMappingURL=watcher-store.d.ts.map