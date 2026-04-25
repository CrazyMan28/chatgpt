import type { TimelineEvent } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export interface TimelineStore {
    filterByType(type: TimelineEvent["type"]): Promise<TimelineEvent[]>;
    listRecent(limit?: number): Promise<TimelineEvent[]>;
    record(event: Omit<TimelineEvent, "createdAt" | "id"> & Partial<Pick<TimelineEvent, "createdAt" | "id">>): Promise<TimelineEvent>;
}
export declare class SqliteTimelineStore implements TimelineStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    filterByType(type: TimelineEvent["type"]): Promise<TimelineEvent[]>;
    listRecent(limit?: number): Promise<TimelineEvent[]>;
    record(event: Omit<TimelineEvent, "createdAt" | "id"> & Partial<Pick<TimelineEvent, "createdAt" | "id">>): Promise<TimelineEvent>;
}
//# sourceMappingURL=timeline-store.d.ts.map