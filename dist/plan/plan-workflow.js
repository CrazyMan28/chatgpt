import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
export const PLAN_FILENAME = "plan.md";
const MAX_STEP_TITLE_LENGTH = 72;
export function buildProjectPlanPrompt() {
    return [
        "Analyze the current project in read-only mode and produce the next implementation plan.",
        "Start by inspecting the repository structure with list_files, then read the most relevant files.",
        "Focus on meaningful improvements that can be executed safely in BUILD mode.",
        "Return only markdown in this exact structure:",
        "# Plan",
        "",
        "## Step 1",
        "Description...",
        "",
        "## Step 2",
        "Description...",
        "",
        "Use 3 to 6 sequential steps. Keep each step concrete and scoped."
    ].join("\n");
}
export function buildPlanExecutionPrompt(plan, step, completedSteps) {
    const completedSummary = completedSteps.length === 0
        ? "None."
        : completedSteps
            .map((completedStep) => {
            return `Step ${completedStep.index}: ${completedStep.title}`;
        })
            .join("\n");
    return [
        "Execute the current build step from plan.md.",
        "",
        "Rules:",
        "- Execute only the current step.",
        "- Do not skip ahead to future steps.",
        "- Use tools when needed to inspect, edit, and verify the project.",
        "- Summarize what changed, what files were touched, and any blockers.",
        "",
        "Plan overview:",
        plan.steps
            .map((planStep) => `Step ${planStep.index}: ${planStep.title}`)
            .join("\n"),
        "",
        "Completed steps:",
        completedSummary,
        "",
        `Current step: Step ${step.index} - ${step.title}`,
        step.description
    ].join("\n");
}
export function buildPlanConfirmationMessage(plan) {
    const lines = [
        `Ready to execute ${PLAN_FILENAME}.`,
        `${plan.steps.length} steps detected.`,
        "",
        ...plan.steps.map((step) => `Step ${step.index}: ${step.title}`),
        "",
        "Type yes to start BUILD mode, or /cancel to stop."
    ];
    return lines.join("\n");
}
export async function writePlanDocument(workspaceRoot, rawContent) {
    const normalizedMarkdown = normalizePlanMarkdown(rawContent);
    const planPath = getPlanPath(workspaceRoot);
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, `${normalizedMarkdown}\n`, "utf8");
    return {
        markdown: normalizedMarkdown,
        path: planPath,
        steps: parsePlanSteps(normalizedMarkdown)
    };
}
export async function readPlanDocument(workspaceRoot) {
    const planPath = getPlanPath(workspaceRoot);
    const rawContent = await readFile(planPath, "utf8");
    const normalizedMarkdown = normalizePlanMarkdown(rawContent);
    const steps = parsePlanSteps(normalizedMarkdown);
    if (steps.length === 0) {
        throw new Error("plan.md does not contain any executable steps.");
    }
    return {
        markdown: normalizedMarkdown,
        path: planPath,
        steps
    };
}
export function normalizePlanMarkdown(rawContent) {
    const trimmedContent = rawContent.trim();
    if (trimmedContent.length === 0) {
        return renderPlanMarkdown([
            {
                index: 1,
                title: "Inspect the project and define the next implementation task",
                description: "Review the current repository structure and identify the highest-value change to implement next."
            }
        ]);
    }
    const parsedSteps = parsePlanSteps(trimmedContent);
    if (parsedSteps.length > 0) {
        return renderPlanMarkdown(parsedSteps);
    }
    const looseSteps = parseLooseSteps(trimmedContent);
    if (looseSteps.length > 0) {
        return renderPlanMarkdown(looseSteps);
    }
    return renderPlanMarkdown([
        {
            index: 1,
            title: buildStepTitle(trimmedContent),
            description: trimmedContent
        }
    ]);
}
export function formatPlanForTranscript(plan) {
    return [`Saved ${PLAN_FILENAME} at ${plan.path}.`, "", plan.markdown].join("\n");
}
function getPlanPath(workspaceRoot) {
    return join(workspaceRoot, PLAN_FILENAME);
}
function parsePlanSteps(markdown) {
    const normalized = markdown.trim();
    if (normalized.length === 0) {
        return [];
    }
    const headingPattern = /^##\s+Step\s+(\d+)(?:\s*[-:]\s*(.+))?\s*$/gm;
    const matches = [...normalized.matchAll(headingPattern)];
    if (matches.length === 0) {
        return [];
    }
    return matches.map((match, index) => {
        const start = match.index ?? 0;
        const end = index + 1 < matches.length
            ? (matches[index + 1].index ?? normalized.length)
            : normalized.length;
        const body = normalized
            .slice(start + match[0].length, end)
            .trim();
        const headingTitle = match[2]?.trim();
        const title = sanitizeStepTitle(headingTitle ?? firstContentLine(body));
        return {
            index: index + 1,
            title,
            description: body.length > 0 ? body : "Complete this step."
        };
    });
}
function parseLooseSteps(content) {
    const numberedLines = content
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => /^\d+\.\s+/.test(line))
        .map((line) => line.replace(/^\d+\.\s+/, "").trim())
        .filter((line) => line.length > 0);
    if (numberedLines.length > 0) {
        return numberedLines.map((line, index) => ({
            index: index + 1,
            title: buildStepTitle(line),
            description: line
        }));
    }
    const paragraphs = content
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0);
    return paragraphs.slice(0, 6).map((paragraph, index) => ({
        index: index + 1,
        title: buildStepTitle(paragraph),
        description: paragraph
    }));
}
function renderPlanMarkdown(steps) {
    const sections = ["# Plan"];
    for (const step of steps) {
        sections.push("");
        sections.push(`## Step ${step.index}`);
        sections.push(step.description.trim());
    }
    return sections.join("\n");
}
function buildStepTitle(value) {
    const normalized = firstContentLine(value);
    if (normalized.length <= MAX_STEP_TITLE_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_STEP_TITLE_LENGTH - 1)}…`;
}
function sanitizeStepTitle(value) {
    const normalized = value.trim().replace(/^[-*]\s+/, "");
    return normalized.length > 0 ? buildStepTitle(normalized) : "Unnamed step";
}
function firstContentLine(value) {
    const firstLine = value
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    return firstLine ?? "Unnamed step";
}
