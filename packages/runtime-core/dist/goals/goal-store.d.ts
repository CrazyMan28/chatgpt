import type { GoalRecord } from "../platform/types.js";
export interface GoalStore {
    createGoal(input: {
        description: string;
        estimatedEffort?: GoalRecord["estimatedEffort"];
        linkedProject?: string;
        nextBestAction?: string;
        source?: GoalRecord["source"];
        state?: GoalRecord["state"];
        suggestedMcps?: string[];
        title: string;
        whyItMatters?: string;
    }): Promise<GoalRecord>;
    listGoals(): Promise<GoalRecord[]>;
    loadGoal(id: string): Promise<GoalRecord | undefined>;
    saveGoal(goal: GoalRecord): Promise<GoalRecord>;
}
export declare class JsonGoalStore implements GoalStore {
    private readonly filePath;
    constructor(workspaceRoot?: string);
    createGoal(input: {
        description: string;
        estimatedEffort?: GoalRecord["estimatedEffort"];
        linkedProject?: string;
        nextBestAction?: string;
        source?: GoalRecord["source"];
        state?: GoalRecord["state"];
        suggestedMcps?: string[];
        title: string;
        whyItMatters?: string;
    }): Promise<GoalRecord>;
    listGoals(): Promise<GoalRecord[]>;
    loadGoal(id: string): Promise<GoalRecord | undefined>;
    saveGoal(goal: GoalRecord): Promise<GoalRecord>;
    private readSnapshot;
    private writeSnapshot;
}
//# sourceMappingURL=goal-store.d.ts.map