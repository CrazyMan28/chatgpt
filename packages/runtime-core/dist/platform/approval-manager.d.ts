import type { ApprovalStore } from "../storage/approval-store.js";
import type { AgentMode, ApprovalGrantScope, ApprovalGrantState, ApprovalPolicy, ApprovalPolicyPreset, ApprovalRequest, ExecutionContext, FilesystemScope, SafetyLevel } from "./types.js";
export interface ApprovalDecision {
    approved: boolean;
    request: ApprovalRequest;
}
export interface ApprovalManagerStatus {
    activeSessionId?: string;
    activeTaskId?: string;
    blanketGrant?: ApprovalGrantState;
    mode?: AgentMode;
    policy: ApprovalPolicy;
}
export interface ApprovalManager {
    approve(id: string): Promise<ApprovalRequest | undefined>;
    approveLatestPending(): Promise<ApprovalRequest | undefined>;
    getPolicy(): ApprovalPolicy;
    getStatus(): ApprovalManagerStatus;
    grant(scope: ApprovalGrantScope, options?: {
        approvePending?: boolean;
        maxSafety?: "safe" | "medium";
    }): Promise<ApprovalGrantState | undefined>;
    list(): Promise<ApprovalRequest[]>;
    listPending(): Promise<ApprovalRequest[]>;
    reject(id: string): Promise<ApprovalRequest | undefined>;
    request(input: {
        detail: string;
        kind: ApprovalRequest["kind"];
        metadata?: Record<string, unknown>;
        policy?: ApprovalPolicy;
        resource?: string;
        safetyLevel: SafetyLevel;
        scope: FilesystemScope;
        summary: string;
    }): Promise<ApprovalDecision>;
    restore(status?: Partial<ApprovalManagerStatus>): void;
    setActiveSession(sessionId?: string): void;
    setActiveTask(taskId?: string): void;
    setMode(mode?: AgentMode): void;
    setPolicy(policy: ApprovalPolicy): ApprovalPolicy;
    setPolicyPreset(preset: ApprovalPolicyPreset): ApprovalPolicy;
}
export declare function createApprovalManager(store: ApprovalStore, defaultPolicy: ApprovalPolicy): ApprovalManager;
export declare function readScopeForApproval(context: ExecutionContext): FilesystemScope;
//# sourceMappingURL=approval-manager.d.ts.map