import type { ModelConfig } from "../models/model-client.js";
import type { ApprovalManager } from "../platform/approval-manager.js";
import type { ToolRegistration } from "./tool-registry.js";
export interface DesktopCoreToolOptions {
    approvalManager?: ApprovalManager;
    getModelConfig?: () => ModelConfig;
}
export declare function createDesktopCoreToolRegistrations(options: DesktopCoreToolOptions): ToolRegistration[];
//# sourceMappingURL=desktop-core-tools.d.ts.map