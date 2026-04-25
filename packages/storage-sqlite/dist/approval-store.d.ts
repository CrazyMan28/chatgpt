import type { ApprovalRequest, ApprovalStore } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
export declare class SqliteApprovalStore implements ApprovalStore {
    private readonly database;
    constructor(database: PlatformDatabase);
    create(request: ApprovalRequest): Promise<ApprovalRequest>;
    get(id: string): Promise<ApprovalRequest | undefined>;
    list(): Promise<ApprovalRequest[]>;
    listPending(): Promise<ApprovalRequest[]>;
    update(request: ApprovalRequest): Promise<ApprovalRequest>;
}
//# sourceMappingURL=approval-store.d.ts.map