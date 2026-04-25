import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const PLAN_FILENAME = "plan.md";

const MAX_STEP_TITLE_LENGTH = 72;

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

export function buildProjectPlanPrompt(): string {
  return [
    "Analyze the current project in read-only mode and produce the next implementation plan.",
    "Start by clarifying ambiguity if the request is underspecified.",
    "Start by inspecting the repository structure with list_files, then read the most relevant files.",
    "Focus on meaningful improvements that can be executed safely in BUILD mode.",
    "Return only markdown in this exact structure:",
    "# TODO",
    "- Task 1",
    "- Task 2",
    "",
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

export function buildTaskPlanPrompt(taskPrompt: string): string {
  return [
    "You are in PLAN mode.",
    "Analyze the user's requested task in read-only mode before any build execution.",
    "Inspect the repository with list_files first, then read the most relevant files.",
    "Confirm the user's likely intent and constraints internally, then return only markdown in this exact structure:",
    "# TODO",
    "- Task 1",
    "- Task 2",
    "",
    "# Plan",
    "",
    "## Step 1",
    "Description...",
    "",
    "## Step 2",
    "Description...",
    "",
    "User task:",
    taskPrompt.trim()
  ].join("\n");
}

export function buildPlanRevisionPrompt(
  currentPlan: PlanDocument,
  feedback: string,
  originalTaskPrompt: string
): string {
  return [
    "You are revising an existing read-only implementation plan.",
    "Inspect the repository only as needed with read-only tools.",
    "Update both the TODO list and the plan steps based on the user's feedback.",
    "Return only markdown in this exact structure:",
    "# TODO",
    "- Task 1",
    "- Task 2",
    "",
    "# Plan",
    "",
    "## Step 1",
    "Description...",
    "",
    "Original task:",
    originalTaskPrompt.trim(),
    "",
    "Current plan:",
    currentPlan.markdown,
    "",
    "User feedback:",
    feedback.trim()
  ].join("\n");
}

export function buildPlanExecutionPrompt(
  plan: PlanDocument,
  step: PlanStep,
  completedSteps: readonly PlanStep[]
): string {
  const completedSummary =
    completedSteps.length === 0
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

export function buildPlanConfirmationMessage(plan: PlanDocument): string {
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

export async function writePlanDocument(
  workspaceRoot: string,
  rawContent: string
): Promise<PlanDocument> {
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

export async function readPlanDocument(
  workspaceRoot: string
): Promise<PlanDocument> {
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

export function normalizePlanMarkdown(rawContent: string): string {
  const trimmedContent = rawContent.trim();

  if (trimmedContent.length === 0) {
    return renderPlanMarkdown([
      {
        index: 1,
        title: "Inspect the project and define the next implementation task",
        description:
          "Review the current repository structure and identify the highest-value change to implement next."
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

export function formatPlanForTranscript(plan: PlanDocument): string {
  return [`Saved ${PLAN_FILENAME} at ${plan.path}.`, "", plan.markdown].join("\n");
}

export function detectPlanClarificationState(
  taskPrompt: string
): PlanClarificationState | undefined {
  const normalizedPrompt = taskPrompt.trim().replace(/\s+/g, " ");

  if (normalizedPrompt.length === 0) {
    return {
      combinedPrompt: normalizedPrompt,
      originalPrompt: normalizedPrompt,
      questions: [
        "What do you want changed or implemented?",
        "Which file, feature, or system should the plan focus on?"
      ]
    };
  }

  const questions: string[] = [];
  const lowered = normalizedPrompt.toLowerCase();
  const wordCount = normalizedPrompt.split(/\s+/).length;
  const refersToUnknownTarget =
    /\b(it|this|that|thing|stuff|shit)\b/.test(lowered) &&
    !/\b(file|screen|page|component|module|api|plan|build|session|memory|mcp|provider|model)\b/.test(
      lowered
    );
  const actionButNoTarget =
    /\b(fix|change|update|improve|implement|build|refactor|rewrite)\b/.test(lowered) &&
    !/\b(file|screen|page|component|module|api|plan|build|session|memory|mcp|provider|model|readme|docs|test|tests)\b/.test(
      lowered
    );

  if (wordCount < 4) {
    questions.push("What exact outcome do you want from this plan?");
  }

  if (refersToUnknownTarget || actionButNoTarget) {
    questions.push("What part of the codebase should this focus on?");
  }

  if (!/\b(test|tests|safe|constraint|limit|provider|mode|mcp|ui|tui|cli|api|file)\b/.test(lowered)) {
    questions.push("Are there any constraints, files, or behaviors I should preserve?");
  }

  if (questions.length === 0) {
    return undefined;
  }

  return {
    combinedPrompt: normalizedPrompt,
    originalPrompt: normalizedPrompt,
    questions: questions.slice(0, 3)
  };
}

export function mergeClarificationIntoPlanPrompt(
  clarificationState: PlanClarificationState,
  answer: string
): string {
  const normalizedAnswer = answer.trim();

  if (normalizedAnswer.length === 0) {
    return clarificationState.combinedPrompt;
  }

  return [
    clarificationState.originalPrompt,
    "",
    "Clarifications:",
    normalizedAnswer
  ].join("\n");
}

function getPlanPath(workspaceRoot: string): string {
  return join(workspaceRoot, PLAN_FILENAME);
}

function parsePlanSteps(markdown: string): PlanStep[] {
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
    const end =
      index + 1 < matches.length
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

function parseLooseSteps(content: string): PlanStep[] {
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

function renderPlanMarkdown(steps: readonly PlanStep[]): string {
  const sections = ["# TODO"];

  for (const step of steps) {
    sections.push(`- ${step.title}`);
  }

  sections.push("");
  sections.push("# Plan");

  for (const step of steps) {
    sections.push("");
    sections.push(`## Step ${step.index}`);
    sections.push(step.description.trim());
  }

  return sections.join("\n");
}

function buildStepTitle(value: string): string {
  const normalized = firstContentLine(value);

  if (normalized.length <= MAX_STEP_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_STEP_TITLE_LENGTH - 1)}…`;
}

function sanitizeStepTitle(value: string): string {
  const normalized = value.trim().replace(/^[-*]\s+/, "");

  return normalized.length > 0 ? buildStepTitle(normalized) : "Unnamed step";
}

function firstContentLine(value: string): string {
  const firstLine = value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "Unnamed step";
}
