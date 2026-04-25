import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const GOAL_FILE_PATH = ".chatgpt-code/goals.json";
const GOAL_SCHEMA_VERSION = 1;
export class JsonGoalStore {
    filePath;
    constructor(workspaceRoot = process.cwd()) {
        this.filePath = resolve(workspaceRoot, GOAL_FILE_PATH);
    }
    async createGoal(input) {
        const snapshot = await this.readSnapshot();
        const now = Date.now();
        const goal = normalizeGoal({
            blockers: [],
            createdAt: now,
            description: input.description,
            estimatedEffort: input.estimatedEffort ?? "medium",
            id: createGoalId(),
            linkedProject: input.linkedProject,
            nextBestAction: input.nextBestAction,
            source: input.source ?? "user",
            state: input.state ?? "queued",
            suggestedMcps: input.suggestedMcps ?? [],
            title: input.title,
            updatedAt: now,
            whyItMatters: input.whyItMatters
        });
        snapshot.goals.push(goal);
        await this.writeSnapshot(snapshot);
        return goal;
    }
    async listGoals() {
        const snapshot = await this.readSnapshot();
        return [...snapshot.goals].sort((left, right) => right.updatedAt - left.updatedAt);
    }
    async loadGoal(id) {
        const snapshot = await this.readSnapshot();
        return snapshot.goals.find((goal) => goal.id === id);
    }
    async saveGoal(goal) {
        const snapshot = await this.readSnapshot();
        const normalized = normalizeGoal({
            ...goal,
            updatedAt: Date.now()
        });
        const existingIndex = snapshot.goals.findIndex((entry) => entry.id === normalized.id);
        if (existingIndex === -1) {
            snapshot.goals.push(normalized);
        }
        else {
            snapshot.goals[existingIndex] = normalized;
        }
        await this.writeSnapshot(snapshot);
        return normalized;
    }
    async readSnapshot() {
        try {
            const raw = await readFile(this.filePath, "utf8");
            return parseSnapshot(JSON.parse(raw));
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return {
                    goals: [],
                    version: GOAL_SCHEMA_VERSION
                };
            }
            throw error;
        }
    }
    async writeSnapshot(snapshot) {
        const normalized = normalizeSnapshot(snapshot);
        const directoryPath = dirname(this.filePath);
        const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        await mkdir(directoryPath, { recursive: true });
        await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
        await rename(tempPath, this.filePath);
    }
}
function normalizeSnapshot(snapshot) {
    return {
        goals: snapshot.goals.map((goal) => normalizeGoal(goal)),
        version: GOAL_SCHEMA_VERSION
    };
}
function parseSnapshot(value) {
    if (!isRecord(value)) {
        return {
            goals: [],
            version: GOAL_SCHEMA_VERSION
        };
    }
    return {
        goals: Array.isArray(value.goals)
            ? value.goals
                .map((goal) => parseGoal(goal))
                .filter((goal) => goal !== undefined)
            : [],
        version: typeof value.version === "number" ? value.version : GOAL_SCHEMA_VERSION
    };
}
function parseGoal(value) {
    if (!isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.createdAt !== "number" ||
        typeof value.updatedAt !== "number" ||
        typeof value.title !== "string" ||
        typeof value.description !== "string" ||
        typeof value.state !== "string") {
        return undefined;
    }
    const estimatedEffort = value.estimatedEffort === "small" ||
        value.estimatedEffort === "medium" ||
        value.estimatedEffort === "large"
        ? value.estimatedEffort
        : "medium";
    const source = value.source === "user" ||
        value.source === "proactive" ||
        value.source === "dream"
        ? value.source
        : "user";
    return normalizeGoal({
        blockers: readStringArray(value.blockers),
        createdAt: value.createdAt,
        description: value.description,
        estimatedEffort,
        id: value.id,
        linkedProject: typeof value.linkedProject === "string" ? value.linkedProject : undefined,
        nextBestAction: typeof value.nextBestAction === "string" ? value.nextBestAction : undefined,
        source,
        state: readGoalState(value.state),
        suggestedMcps: readStringArray(value.suggestedMcps),
        title: value.title,
        updatedAt: value.updatedAt,
        whyItMatters: typeof value.whyItMatters === "string" ? value.whyItMatters : undefined
    });
}
function normalizeGoal(goal) {
    return {
        ...goal,
        blockers: [...goal.blockers],
        description: goal.description.trim(),
        estimatedEffort: goal.estimatedEffort ?? "medium",
        source: goal.source ?? "user",
        suggestedMcps: [...goal.suggestedMcps],
        title: goal.title.trim()
    };
}
function readGoalState(value) {
    if (value === "queued" ||
        value === "planning" ||
        value === "asking" ||
        value === "waiting_approval" ||
        value === "running" ||
        value === "validating" ||
        value === "paused" ||
        value === "rate_limited" ||
        value === "complete" ||
        value === "failed" ||
        value === "cancelled") {
        return value;
    }
    return "queued";
}
function readStringArray(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === "string")
        : [];
}
function createGoalId() {
    return `goal-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}
function isMissingFileError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT");
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=goal-store.js.map