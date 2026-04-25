import type { TimelineEvent } from "../platform/types.js";
export interface TimelineStore {
    filterByType(type: TimelineEvent["type"]): Promise<TimelineEvent[]>;
    listRecent(limit?: number): Promise<TimelineEvent[]>;
    record(event: Omit<TimelineEvent, "createdAt" | "id"> & Partial<Pick<TimelineEvent, "createdAt" | "id">>): Promise<TimelineEvent>;
}
//# sourceMappingURL=timeline-store.d.ts.map