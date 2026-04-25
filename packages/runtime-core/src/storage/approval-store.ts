import type { ApprovalRequest } from "../platform/types.js";

export interface ApprovalStore {
  create(request: ApprovalRequest): Promise<ApprovalRequest>;
  get(id: string): Promise<ApprovalRequest | undefined>;
  list(): Promise<ApprovalRequest[]>;
  listPending(): Promise<ApprovalRequest[]>;
  update(request: ApprovalRequest): Promise<ApprovalRequest>;
}
