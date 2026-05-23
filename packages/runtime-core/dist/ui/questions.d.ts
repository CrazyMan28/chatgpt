import type { PlanStep } from "../plan/plan-workflow.js";
import type { Question, QuestionAnswer, QuestionOption, QuestionQueueState, QuestionSource, QuestionType } from "./types.js";
export declare const ASK_QUESTION_TOOL_NAME = "ask_question";
export declare const ASK_QUESTION_TOOL_DEFINITION: {
    id: string;
    name: string;
    owner: string;
    source: "core";
    originalName: string;
    description: string;
    inputSchema: {
        type: string;
        additionalProperties: boolean;
        properties: {
            title: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            options: {
                type: string;
                items: {
                    type: string;
                    additionalProperties: boolean;
                    properties: {
                        label: {
                            type: string;
                        };
                        value: {
                            type: string;
                        };
                        description: {
                            type: string;
                        };
                    };
                    required: string[];
                };
            };
            allowCustom: {
                type: string;
            };
            allowSkip: {
                type: string;
            };
            recommendedOption: {
                type: string;
                description: string;
            };
            recommendationReason: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export type QuestionRow = {
    option: QuestionOption;
    type: "option";
} | {
    label: string;
    type: "done";
} | {
    label: string;
    type: "custom";
} | {
    label: string;
    type: "skip";
};
export type QuestionResolution = {
    answer: QuestionAnswer;
    state: "answered";
} | {
    answer?: QuestionAnswer;
    state: "skipped" | "cancelled";
};
export declare function createQuestion(input: {
    allowCustom?: boolean;
    allowSkip?: boolean;
    description?: string;
    options?: readonly Omit<QuestionOption, "id">[];
    recommendedOption?: {
        optionId?: string;
        reason: string;
        value?: string;
    };
    relatedBuildStep?: number;
    relatedTaskId?: string;
    source: QuestionSource;
    title: string;
    type: QuestionType;
}): Question;
export declare function createQuestionQueue(input: {
    context?: QuestionQueueState["context"];
    questions: readonly Question[];
}): QuestionQueueState;
export declare function getPendingQuestions(queue: QuestionQueueState | null | undefined): Question[];
export declare function getActiveQuestion(queue: QuestionQueueState | null | undefined): Question | undefined;
export declare function getQuestionProgress(queue: QuestionQueueState | null | undefined, question: Question | undefined): string | undefined;
export declare function getQuestionRows(question: Question): QuestionRow[];
export declare function getRecommendedQuestionRowIndex(question: Question): number;
export declare function resolveQuestionTextAnswer(question: Question, input: string): {
    ok: true;
    resolution: QuestionResolution;
} | {
    ok: false;
    error: string;
};
export declare function resolveQuestionSelection(question: Question, selectionIndex: number, inputText: string, selectedOptionIds: readonly string[]): {
    ok: true;
    resolution: QuestionResolution;
    toggleOptionId?: string;
} | {
    ok: false;
    error: string;
};
export declare function resolveQuestionNumberShortcut(question: Question, input: string): QuestionOption | undefined;
export declare function applyQuestionResolution(queue: QuestionQueueState, questionId: string, resolution: QuestionResolution): QuestionQueueState;
export declare function findQuestionForFallback(queue: QuestionQueueState | null | undefined, idOrLast: string): Question | undefined;
export declare function createPlanQuestionsForPrompt(taskPrompt: string): Question[] | undefined;
export declare function mapClarificationQuestionsToCards(questions: readonly string[]): Question[];
export declare function buildPromptWithQuestionAnswers(originalPrompt: string, questions: readonly Question[]): string;
export declare function formatQuestionList(queue: QuestionQueueState | null | undefined): string;
export declare function formatQuestionDetail(question: Question | undefined): string;
export declare function shortQuestionId(value: string): string;
export declare function isQuestionQueueState(value: unknown): value is QuestionQueueState;
export declare function normalizeQuestionQueueState(value: QuestionQueueState): QuestionQueueState;
export declare function restoreQuestionQueueState(value: unknown, options?: {
    warn?: (message: string) => void;
}): QuestionQueueState | null;
export declare function isQuestionFallbackCommand(input: string): boolean;
export declare function detectExistingFolderQuestion(input: {
    completedStepIndexes: readonly number[];
    planStep: PlanStep;
    workspaceRoot: string;
}): Promise<Question | undefined>;
export declare function createQuestionFromToolInput(input: Record<string, unknown>, source: QuestionSource, relatedTaskId?: string): Question;
//# sourceMappingURL=questions.d.ts.map