export declare const PLAN_FILENAME = "plan.md";
export interface PlanStep {
    index: number;
    title: string;
    description: string;
}
export interface PlanDocument {
    markdown: string;
    path: string;
    steps: readonly PlanStep[];
}
export interface PlanClarificationState {
    combinedPrompt: string;
    originalPrompt: string;
    questions: readonly string[];
}
export declare function buildProjectPlanPrompt(): string;
export declare function buildTaskPlanPrompt(taskPrompt: string): string;
export declare function buildPlanRevisionPrompt(currentPlan: PlanDocument, feedback: string, originalTaskPrompt: string): string;
export declare function buildPlanExecutionPrompt(plan: PlanDocument, step: PlanStep, completedSteps: readonly PlanStep[]): string;
export declare function buildPlanConfirmationMessage(plan: PlanDocument): string;
export declare function writePlanDocument(workspaceRoot: string, rawContent: string): Promise<PlanDocument>;
export declare function readPlanDocument(workspaceRoot: string): Promise<PlanDocument>;
export declare function normalizePlanMarkdown(rawContent: string): string;
export declare function formatPlanForTranscript(plan: PlanDocument): string;
export declare function detectPlanClarificationState(taskPrompt: string): PlanClarificationState | undefined;
export declare function mergeClarificationIntoPlanPrompt(clarificationState: PlanClarificationState, answer: string): string;
//# sourceMappingURL=plan-workflow.d.ts.map