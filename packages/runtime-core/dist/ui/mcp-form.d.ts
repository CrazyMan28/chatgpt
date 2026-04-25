import type { ManagedMcpServer, McpServerDraft } from "../mcp/mcp-manager.js";
export type McpFormMode = "add" | "edit";
export type McpFormStep = "name" | "type" | "endpoint" | "args" | "cwd" | "env";
export interface McpFormState {
    draft: McpServerDraft;
    mode: McpFormMode;
    step: McpFormStep;
    type: "mcp_form";
}
export interface McpFormInputState {
    footer: string;
    placeholder: string;
    subtitle: string;
    title: string;
}
export type McpFormTransition = {
    flow: McpFormState;
    type: "continue";
} | {
    draft: McpServerDraft;
    type: "complete";
} | {
    message: string;
    type: "error";
};
export declare function createAddMcpFormState(): McpFormState;
export declare function createEditMcpFormState(server: ManagedMcpServer): McpFormState;
export declare function getMcpFormInputState(flow: McpFormState): McpFormInputState;
export declare function applyMcpFormInput(flow: McpFormState, rawInput: string): McpFormTransition;
//# sourceMappingURL=mcp-form.d.ts.map