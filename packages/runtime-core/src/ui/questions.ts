import { createHash, randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { JsonSchema } from "../models/model-client.js";
import type { PlanStep } from "../plan/plan-workflow.js";
import type {
  Question,
  QuestionAnswer,
  QuestionOption,
  QuestionQueueState,
  QuestionSource,
  QuestionType
} from "./types.js";

export const ASK_QUESTION_TOOL_NAME = "ask_question";

export const ASK_QUESTION_TOOL_DEFINITION = {
  id: "core::ask_question",
  name: ASK_QUESTION_TOOL_NAME,
  owner: "core",
  source: "core" as const,
  originalName: ASK_QUESTION_TOOL_NAME,
  description:
    "Pause and ask the user a real interactive question when progress depends on a meaningful decision. Use this instead of guessing for high-impact choices.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description: "Short question title shown in the card."
      },
      description: {
        type: "string",
        description: "Brief detail explaining why the decision is needed."
      },
      type: {
        type: "string",
        enum: ["single_choice", "multi_choice", "free_text", "confirm"],
        description: "Question input type."
      },
      options: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: {
              type: "string"
            },
            value: {
              type: "string"
            },
            description: {
              type: "string"
            }
          },
          required: ["label"]
        }
      },
      allowCustom: {
        type: "boolean"
      },
      allowSkip: {
        type: "boolean"
      },
      recommendedOption: {
        type: "string",
        description: "Recommended option label or value, when one is clear."
      },
      recommendationReason: {
        type: "string",
        description: "One short reason for the recommendation."
      }
    },
    required: ["title", "type"]
  } satisfies JsonSchema
};

export type QuestionRow =
  | { option: QuestionOption; type: "option" }
  | { label: string; type: "done" }
  | { label: string; type: "custom" }
  | { label: string; type: "skip" };

export type QuestionResolution =
  | {
      answer: QuestionAnswer;
      state: "answered";
    }
  | {
      answer?: QuestionAnswer;
      state: "skipped" | "cancelled";
    };

export function createQuestion(input: {
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
}): Question {
  const options = (input.options ?? []).map((option, index) => ({
    ...option,
    id: createOptionId(option.value || option.label, index),
    value: option.value || option.label
  }));
  const recommendedOption = normalizeRecommendedOption(
    input.recommendedOption,
    options
  );

  return {
    allowCustom: input.allowCustom ?? input.type === "free_text",
    allowSkip: input.allowSkip ?? false,
    createdAt: Date.now(),
    description: input.description,
    id: createQuestionId(input.source, input.title),
    options,
    recommendedOption,
    relatedBuildStep: input.relatedBuildStep,
    relatedTaskId: input.relatedTaskId,
    source: input.source,
    state: "pending",
    title: input.title,
    type: input.type
  };
}

export function createQuestionQueue(input: {
  context?: QuestionQueueState["context"];
  questions: readonly Question[];
}): QuestionQueueState {
  const pendingQuestion = input.questions.find(
    (question) => question.state === "pending"
  );

  return {
    activeQuestionId: pendingQuestion?.id,
    context: input.context,
    questions: [...input.questions]
  };
}

export function getPendingQuestions(
  queue: QuestionQueueState | null | undefined
): Question[] {
  const questions = Array.isArray(queue?.questions) ? queue.questions : [];

  return questions.filter(
    (question) => question.state === "pending"
  );
}

export function getActiveQuestion(
  queue: QuestionQueueState | null | undefined
): Question | undefined {
  if (!queue) {
    return undefined;
  }

  const questions = Array.isArray(queue.questions) ? queue.questions : [];
  const activeQuestion = questions.find(
    (question) =>
      question.id === queue.activeQuestionId && question.state === "pending"
  );

  return activeQuestion ?? getPendingQuestions(queue)[0];
}

export function getQuestionProgress(
  queue: QuestionQueueState | null | undefined,
  question: Question | undefined
): string | undefined {
  if (!queue || !question) {
    return undefined;
  }

  const questions = Array.isArray(queue.questions) ? queue.questions : [];
  const total = questions.length;
  const index = questions.findIndex((entry) => entry.id === question.id);

  return index >= 0 && total > 1 ? `${index + 1} of ${total}` : undefined;
}

export function getQuestionRows(question: Question): QuestionRow[] {
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });
  const rows: QuestionRow[] = options.map((option) => ({
    option,
    type: "option"
  }));

  if (question.type === "multi_choice") {
    rows.push({
      label: "Done",
      type: "done"
    });
  }

  if (question.allowCustom) {
    rows.push({
      label: "Something else",
      type: "custom"
    });
  }

  if (question.allowSkip) {
    rows.push({
      label: "Skip",
      type: "skip"
    });
  }

  return rows;
}

export function getRecommendedQuestionRowIndex(question: Question): number {
  const recommended = question.recommendedOption;
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });

  if (!recommended) {
    return 0;
  }

  const index = options.findIndex(
    (option) =>
      option.id === recommended.optionId ||
      normalizeChoice(option.value) === normalizeChoice(recommended.value ?? "") ||
      normalizeChoice(option.label) === normalizeChoice(recommended.value ?? "")
  );

  return Math.max(0, index);
}

export function resolveQuestionTextAnswer(
  question: Question,
  input: string
):
  | { ok: true; resolution: QuestionResolution }
  | { ok: false; error: string } {
  const trimmed = input.trim();
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });
  const safeQuestion = {
    ...question,
    options
  };

  if (trimmed.length === 0) {
    return {
      error: "Choose an option or type an answer.",
      ok: false
    };
  }

  if (safeQuestion.allowSkip && isSkipInput(trimmed)) {
    return {
      ok: true,
      resolution: {
        state: "skipped"
      }
    };
  }

  if (isCancelInput(trimmed)) {
    return {
      ok: true,
      resolution: {
        state: "cancelled"
      }
    };
  }

  if (safeQuestion.type === "free_text") {
    return {
      ok: true,
      resolution: {
        answer: {
          custom: true,
          text: trimmed
        },
        state: "answered"
      }
    };
  }

  if (safeQuestion.type === "multi_choice") {
    const selectedOptions = resolveMultiChoiceOptions(safeQuestion, trimmed);

    if (selectedOptions.length > 0) {
      return {
        ok: true,
        resolution: {
          answer: createOptionAnswer(selectedOptions),
          state: "answered"
        }
      };
    }
  } else {
    const selectedOption = resolveSingleChoiceOption(safeQuestion, trimmed);

    if (selectedOption) {
      return {
        ok: true,
        resolution: {
          answer: createOptionAnswer([selectedOption]),
          state: "answered"
        }
      };
    }
  }

  if (safeQuestion.allowCustom) {
    return {
      ok: true,
      resolution: {
        answer: {
          custom: true,
          text: trimmed
        },
        state: "answered"
      }
    };
  }

  return {
    error:
      options.length > 0
        ? `Choose one of: ${options.map((option) => option.label).join(", ")}.`
        : "This question needs a valid answer.",
    ok: false
  };
}

export function resolveQuestionSelection(
  question: Question,
  selectionIndex: number,
  inputText: string,
  selectedOptionIds: readonly string[]
):
  | { ok: true; resolution: QuestionResolution; toggleOptionId?: string }
  | { ok: false; error: string } {
  const rows = getQuestionRows(question);
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });
  const row = rows[Math.min(Math.max(0, selectionIndex), rows.length - 1)];

  if (!row) {
    return {
      error: "No answer choice is available.",
      ok: false
    };
  }

  if (row.type === "skip") {
    return {
      ok: true,
      resolution: {
        state: "skipped"
      }
    };
  }

  if (row.type === "custom") {
    const trimmed = inputText.trim();

    if (trimmed.length === 0) {
      return {
        error: "Type a custom answer, then press Enter.",
        ok: false
      };
    }

    return {
      ok: true,
      resolution: {
        answer: {
          custom: true,
          text: trimmed
        },
        state: "answered"
      }
    };
  }

  if (row.type === "done") {
    const selectedOptions = options.filter((option) =>
      selectedOptionIds.includes(option.id)
    );

    if (selectedOptions.length === 0) {
      return {
        error: "Select at least one option before choosing Done.",
        ok: false
      };
    }

    return {
      ok: true,
      resolution: {
        answer: createOptionAnswer(selectedOptions),
        state: "answered"
      }
    };
  }

  if (question.type === "multi_choice") {
    return {
      ok: true,
      resolution: {
        answer: createOptionAnswer([row.option]),
        state: "answered"
      },
      toggleOptionId: row.option.id
    };
  }

  return {
    ok: true,
    resolution: {
      answer: createOptionAnswer([row.option]),
      state: "answered"
    }
  };
}

export function resolveQuestionNumberShortcut(
  question: Question,
  input: string
): QuestionOption | undefined {
  if (!/^[1-9]$/.test(input)) {
    return undefined;
  }

  return readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  })[Number(input) - 1];
}

export function applyQuestionResolution(
  queue: QuestionQueueState,
  questionId: string,
  resolution: QuestionResolution
): QuestionQueueState {
  const now = Date.now();
  const questions = (Array.isArray(queue.questions) ? queue.questions : []).map((question) =>
    question.id === questionId
      ? {
          ...question,
          answer: resolution.answer,
          answeredAt: now,
          state: resolution.state
        }
      : question
  );
  const nextActiveQuestion = questions.find(
    (question) => question.state === "pending"
  );

  return {
    activeQuestionId: nextActiveQuestion?.id,
    context: queue.context,
    questions
  };
}

export function findQuestionForFallback(
  queue: QuestionQueueState | null | undefined,
  idOrLast: string
): Question | undefined {
  if (!queue) {
    return undefined;
  }
  const questions = Array.isArray(queue.questions) ? queue.questions : [];

  if (idOrLast.trim().toLowerCase() === "last") {
    return (
      getActiveQuestion(queue) ??
      [...questions].reverse().find(
        (question) => question.state === "pending"
      ) ??
      [...questions].reverse()[0]
    );
  }

  const normalized = idOrLast.trim().toLowerCase();

  return questions.find((question) => {
    return (
      question.id.toLowerCase() === normalized ||
      shortQuestionId(question.id).toLowerCase() === normalized
    );
  });
}

export function createPlanQuestionsForPrompt(
  taskPrompt: string
): Question[] | undefined {
  const normalizedPrompt = taskPrompt.trim().replace(/\s+/g, " ");
  const lowered = normalizedPrompt.toLowerCase();

  if (/\bminecraft\b/.test(lowered) && /\b(mod|plugin|project)\b/.test(lowered)) {
    return [
      createQuestion({
        allowCustom: true,
        description: "Choose the loader or plugin platform before I generate the plan.",
        options: [
          {
            description: "Modern lightweight mod loader",
            label: "Fabric",
            value: "Fabric"
          },
          {
            description: "Broad legacy and modpack compatibility",
            label: "Forge",
            value: "Forge"
          },
          {
            description: "Fabric-compatible community fork",
            label: "Quilt",
            value: "Quilt"
          },
          {
            description: "Server plugin instead of a client mod",
            label: "Paper plugin",
            value: "Paper plugin"
          }
        ],
        recommendedOption: {
          reason: "best for modern lightweight mods",
          value: "Fabric"
        },
        source: "plan",
        title: "What kind of Minecraft project should this be?",
        type: "single_choice"
      }),
      createQuestion({
        allowCustom: true,
        description: "Use a released version such as 1.21.1, 1.20.1, or your target server version.",
        source: "plan",
        title: "Which Minecraft version should this target?",
        type: "free_text"
      }),
      createQuestion({
        description: "This controls whether the plan targets client APIs, dedicated servers, or shared code.",
        options: [
          {
            label: "Both",
            value: "Both"
          },
          {
            label: "Client-side",
            value: "Client-side"
          },
          {
            label: "Server-side",
            value: "Server-side"
          }
        ],
        recommendedOption: {
          reason: "keeps the first plan flexible until features are known",
          value: "Both"
        },
        source: "plan",
        title: "Should it be client-side, server-side, or both?",
        type: "single_choice"
      }),
      createQuestion({
        allowCustom: true,
        description: "Examples: mobs, custom items, dimensions, commands, boss fights, biomes, or progression.",
        source: "plan",
        title: "What should the project add?",
        type: "free_text"
      })
    ];
  }

  if (/\b(build|make|create)\b/.test(lowered) && /\bapp\b/.test(lowered)) {
    return [
      createQuestion({
        allowCustom: true,
        description: "Choose the primary app surface before I generate the plan.",
        options: [
          {
            description: "Browser-based app",
            label: "Web app",
            value: "web app"
          },
          {
            description: "Terminal command",
            label: "CLI",
            value: "CLI"
          },
          {
            description: "Terminal UI",
            label: "TUI",
            value: "TUI"
          },
          {
            description: "Phone or tablet app",
            label: "Mobile app",
            value: "mobile app"
          },
          {
            description: "Native desktop app",
            label: "Desktop app",
            value: "desktop app"
          },
          {
            description: "Backend service",
            label: "Server",
            value: "server"
          }
        ],
        recommendedOption: {
          reason: "fastest default for a usable local app",
          value: "web app"
        },
        source: "plan",
        title: "What kind of app should this be?",
        type: "single_choice"
      }),
      createQuestion({
        description: "Pick the primary implementation language for the plan.",
        options: [
          {
            label: "TypeScript",
            value: "TypeScript"
          },
          {
            label: "Python",
            value: "Python"
          },
          {
            label: "Rust",
            value: "Rust"
          }
        ],
        allowCustom: true,
        recommendedOption: {
          reason: "fits the existing TypeScript workspace",
          value: "TypeScript"
        },
        source: "plan",
        title: "Which language or stack should it use?",
        type: "single_choice"
      }),
      createQuestion({
        description: "This decides whether the plan modifies the current repo or creates a separate project folder.",
        options: [
          {
            label: "Current project",
            value: "current project"
          },
          {
            label: "New folder",
            value: "new folder"
          }
        ],
        recommendedOption: {
          reason: "preserves existing workspace conventions",
          value: "current project"
        },
        source: "plan",
        title: "Should this use the current project or a new folder?",
        type: "single_choice"
      }),
      createQuestion({
        description: "PLAN mode stays read-only, but this affects what the BUILD plan may do later.",
        options: [
          {
            label: "Install dependencies when building",
            value: "install dependencies"
          },
          {
            label: "Only generate files",
            value: "only generate files"
          }
        ],
        recommendedOption: {
          reason: "lets BUILD verify a real app when approved",
          value: "install dependencies"
        },
        source: "plan",
        title: "Should BUILD install dependencies or only generate files?",
        type: "single_choice"
      })
    ];
  }

  if (/\bmcp\b/.test(lowered) && /\b(server|tool)\b/.test(lowered)) {
    return [
      createQuestion({
        allowCustom: true,
        description: "Choose the transport before I generate the server plan.",
        options: [
          {
            description: "Local process transport",
            label: "stdio",
            value: "stdio"
          },
          {
            description: "Remote or hosted endpoint",
            label: "HTTP",
            value: "HTTP"
          },
          {
            description: "Streaming HTTP transport",
            label: "SSE",
            value: "SSE"
          }
        ],
        recommendedOption: {
          reason: "best default for local-only MCP servers",
          value: "stdio"
        },
        source: "plan",
        title: "Which MCP transport should this use?",
        type: "single_choice"
      }),
      createQuestion({
        description: "This controls hosting, auth, and permission assumptions.",
        options: [
          {
            label: "Local-only",
            value: "local-only"
          },
          {
            label: "Remote/server",
            value: "remote/server"
          }
        ],
        recommendedOption: {
          reason: "keeps permissions and deployment simple",
          value: "local-only"
        },
        source: "plan",
        title: "Should it be local-only or remote?",
        type: "single_choice"
      }),
      createQuestion({
        allowCustom: true,
        description: "Name the tools, resources, or APIs the MCP server should expose.",
        source: "plan",
        title: "What tools should it expose?",
        type: "free_text"
      }),
      createQuestion({
        description: "Choose the safety boundary for filesystem, command, or network access.",
        options: [
          {
            label: "Read-only",
            value: "read-only"
          },
          {
            label: "Workspace write",
            value: "workspace write"
          },
          {
            label: "Network access",
            value: "network access"
          },
          {
            label: "Full machine",
            value: "full machine"
          }
        ],
        recommendedOption: {
          reason: "safe default until exact tools are known",
          value: "read-only"
        },
        source: "plan",
        title: "What permission level should it have?",
        type: "single_choice"
      })
    ];
  }

  return undefined;
}

export function mapClarificationQuestionsToCards(
  questions: readonly string[]
): Question[] {
  return questions.map((question) =>
    createQuestion({
      allowCustom: true,
      source: "plan",
      title: question,
      type: "free_text"
    })
  );
}

export function buildPromptWithQuestionAnswers(
  originalPrompt: string,
  questions: readonly Question[]
): string {
  const summaryLines = questions
    .filter((question) => question.state === "answered" && question.answer)
    .map((question) => `- ${question.title}: ${question.answer?.text ?? ""}`);
  const skippedLines = questions
    .filter((question) => question.state === "skipped")
    .map((question) => `- ${question.title}: skipped`);

  return [
    originalPrompt.trim(),
    "",
    "Selected choices summary:",
    ...(summaryLines.length > 0 ? summaryLines : ["- none"]),
    ...(skippedLines.length > 0 ? ["", "Skipped optional questions:", ...skippedLines] : [])
  ].join("\n");
}

export function formatQuestionList(
  queue: QuestionQueueState | null | undefined
): string {
  const questions = Array.isArray(queue?.questions) ? queue.questions : [];

  if (!queue || questions.length === 0) {
    return "Questions\n\nNo questions are pending.";
  }

  const lines = ["Questions"];

  for (const question of questions) {
    const marker =
      question.state === "pending" && question.id === queue.activeQuestionId
        ? "*"
        : " ";
    lines.push(
      `${marker} ${shortQuestionId(question.id)}  [${question.state}]  ${question.title}`
    );

    const options = readQuestionOptions(question.options, {
      questionId: question.id,
      warn: undefined
    });

    if (question.state === "pending" && options.length > 0) {
      lines.push(
        `  choices: ${options.map((option, index) => `${index + 1}. ${option.label}`).join("  ")}`
      );
    }

    if (question.answer) {
      lines.push(`  answer: ${question.answer.text}`);
    }
  }

  lines.push("");
  lines.push("Use the card normally, or fallback commands: /question current, /question skip, /question cancel, /answer last <text>.");

  return lines.join("\n");
}

export function formatQuestionDetail(question: Question | undefined): string {
  if (!question) {
    return "No active question.";
  }

  const lines = [
    `Question ${shortQuestionId(question.id)}`,
    `Title: ${question.title}`,
    `State: ${question.state}`,
    `Type: ${question.type}`,
    `Source: ${question.source}`,
    `Optional: ${question.allowSkip ? "yes" : "no"}`,
    `Custom answer: ${question.allowCustom ? "yes" : "no"}`
  ];

  if (question.description) {
    lines.push(`Description: ${question.description}`);
  }

  if (question.relatedTaskId) {
    lines.push(`Task: ${question.relatedTaskId}`);
  }

  if (question.relatedBuildStep) {
    lines.push(`Build step: ${question.relatedBuildStep}`);
  }

  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });

  if (options.length > 0) {
    lines.push("");
    lines.push("Choices:");
    for (const [index, option] of options.entries()) {
      lines.push(`${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ""}`);
    }
  }

  if (question.answer) {
    lines.push("");
    lines.push(`Answer: ${question.answer.text}`);
  }

  return lines.join("\n");
}

export function shortQuestionId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return value.slice(-12);
}

export function isQuestionQueueState(
  value: unknown
): value is QuestionQueueState {
  return restoreQuestionQueueState(value) !== null;
}

export function normalizeQuestionQueueState(
  value: QuestionQueueState
): QuestionQueueState {
  return restoreQuestionQueueState(value) ?? {
    activeQuestionId: undefined,
    context: undefined,
    questions: []
  };
}

export function restoreQuestionQueueState(
  value: unknown,
  options?: {
    warn?: (message: string) => void;
  }
): QuestionQueueState | null {
  const warn = options?.warn;

  if (!isRecord(value) || !Array.isArray(value.questions)) {
    warn?.("Question queue state is missing or invalid; ignoring saved questions.");
    return null;
  }

  const questions = value.questions
    .map((question, index) =>
      parseQuestion(question, {
        index,
        warn
      })
    )
    .filter((question): question is Question => question !== undefined);

  if (questions.length === 0) {
    if (value.questions.length > 0) {
      warn?.("Saved question queue had no valid questions; clearing it.");
    }

    return null;
  }

  const activeQuestionId = readString(value.activeQuestionId);
  const activeQuestion =
    questions.find(
      (question) =>
        question.id === activeQuestionId && question.state === "pending"
    ) ?? questions.find((question) => question.state === "pending");

  return {
    activeQuestionId: activeQuestion?.id,
    context: readQuestionContinuationContext(value.context, warn),
    questions
  };
}

export function isQuestionFallbackCommand(input: string): boolean {
  const normalized = input.trim().toLowerCase();

  return (
    normalized === "/questions" ||
    normalized.startsWith("/question") ||
    normalized.startsWith("/answer") ||
    normalized === "/cancel"
  );
}

export async function detectExistingFolderQuestion(input: {
  completedStepIndexes: readonly number[];
  planStep: PlanStep;
  workspaceRoot: string;
}): Promise<Question | undefined> {
  const candidate = await findExistingFolderCandidate(
    input.workspaceRoot,
    `${input.planStep.title}\n${input.planStep.description}`
  );

  if (!candidate) {
    return undefined;
  }

  return createQuestion({
    allowCustom: true,
    description: `Folder already exists: ${candidate.displayPath}. Choose how BUILD should proceed.`,
    options: [
      {
        description: "Keep existing files and add or update what is needed",
        label: "Merge",
        value: "merge"
      },
      {
        description: "Replace the existing folder contents if required",
        label: "Overwrite",
        value: "overwrite"
      },
      {
        description: "Use a different folder name",
        label: "Create new folder",
        value: "create new folder"
      },
      {
        description: "Stop before touching the folder",
        label: "Cancel build",
        value: "cancel build"
      }
    ],
    recommendedOption: {
      reason: "preserves existing files while letting the build continue",
      value: "merge"
    },
    relatedBuildStep: input.planStep.index,
    source: "build",
    title: "Folder already exists. How should BUILD continue?",
    type: "confirm"
  });
}

export function createQuestionFromToolInput(
  input: Record<string, unknown>,
  source: QuestionSource,
  relatedTaskId?: string
): Question {
  const title = readString(input.title) ?? "Decision needed";
  const type = readQuestionType(input.type) ?? "single_choice";
  const options = readToolQuestionOptions(input.options);
  const recommendedOptionValue = readString(input.recommendedOption);
  const recommendationReason =
    readString(input.recommendationReason) ?? "best available default";

  return createQuestion({
    allowCustom:
      typeof input.allowCustom === "boolean"
        ? input.allowCustom
        : type === "free_text",
    allowSkip: typeof input.allowSkip === "boolean" ? input.allowSkip : false,
    description: readString(input.description),
    options,
    recommendedOption: recommendedOptionValue
      ? {
          reason: recommendationReason,
          value: recommendedOptionValue
        }
      : undefined,
    relatedTaskId,
    source,
    title,
    type
  });
}

function createQuestionId(source: QuestionSource, title: string): string {
  const hash = createHash("sha1")
    .update(`${source}:${title}:${Date.now()}:${randomBytes(4).toString("hex")}`)
    .digest("hex")
    .slice(0, 10);

  return `question-${source}-${hash}`;
}

function createOptionId(value: string, index: number): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : `option-${index + 1}`;
}

function normalizeRecommendedOption(
  recommendedOption: Question["recommendedOption"],
  options: readonly QuestionOption[]
): Question["recommendedOption"] {
  if (!recommendedOption) {
    return undefined;
  }

  const value = recommendedOption.value ?? recommendedOption.optionId ?? "";
  const matchedOption = options.find(
    (option) =>
      option.id === recommendedOption.optionId ||
      normalizeChoice(option.value) === normalizeChoice(value) ||
      normalizeChoice(option.label) === normalizeChoice(value)
  );

  return {
    optionId: matchedOption?.id ?? recommendedOption.optionId,
    reason: recommendedOption.reason,
    value: matchedOption?.value ?? recommendedOption.value
  };
}

function resolveSingleChoiceOption(
  question: Question,
  input: string
): QuestionOption | undefined {
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });

  if (/^[1-9]$/.test(input.trim())) {
    return options[Number(input.trim()) - 1];
  }

  const normalized = normalizeChoice(input);

  return options.find((option) => {
    const label = normalizeChoice(option.label);
    const value = normalizeChoice(option.value);

    return (
      label === normalized ||
      value === normalized ||
      label.startsWith(normalized) ||
      value.startsWith(normalized)
    );
  });
}

function resolveMultiChoiceOptions(
  question: Question,
  input: string
): QuestionOption[] {
  const parts = input
    .split(/[,;]+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const selected: QuestionOption[] = [];

  for (const part of parts.length > 0 ? parts : [input]) {
    const option = resolveSingleChoiceOption(question, part);

    if (option && !selected.some((entry) => entry.id === option.id)) {
      selected.push(option);
    }
  }

  return selected;
}

function createOptionAnswer(options: readonly QuestionOption[]): QuestionAnswer {
  return {
    optionIds: options.map((option) => option.id),
    text: options.map((option) => option.label).join(", "),
    values: options.map((option) => option.value)
  };
}

function normalizeChoice(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isSkipInput(input: string): boolean {
  const normalized = normalizeChoice(input);

  return normalized === "skip" || normalized === "none" || normalized === "no";
}

function isCancelInput(input: string): boolean {
  const normalized = normalizeChoice(input);

  return normalized === "cancel" || normalized === "/cancel" || normalized === "stop";
}

function parseQuestion(
  value: unknown,
  options: {
    index: number;
    warn?: (message: string) => void;
  }
): Question | undefined {
  if (!isRecord(value)) {
    options.warn?.(`Skipping saved question ${options.index + 1}: not an object.`);
    return undefined;
  }

  const type = readQuestionType(value.type);

  if (!type) {
    options.warn?.(
      `Skipping saved question ${formatQuestionDebugId(value, options.index)}: unknown question type.`
    );
    return undefined;
  }

  const title = readString(value.title) ?? "Decision needed";
  const source = isQuestionSource(value.source) ? value.source : "tool";
  const questionId =
    readString(value.id) ?? createRestoredQuestionId(source, title, options.index);
  const allowCustom =
    typeof value.allowCustom === "boolean" ? value.allowCustom : type === "free_text";
  const allowSkip = typeof value.allowSkip === "boolean" ? value.allowSkip : false;
  const questionOptions = readQuestionOptions(value.options, {
    questionId,
    warn: options.warn
  });

  if (
    (type === "single_choice" || type === "multi_choice") &&
    questionOptions.length === 0
  ) {
    options.warn?.(
      `Skipping saved question ${questionId}: ${type} question has no valid options.`
    );
    return undefined;
  }

  if (
    type === "confirm" &&
    questionOptions.length === 0 &&
    !allowCustom &&
    !allowSkip
  ) {
    options.warn?.(
      `Skipping saved question ${questionId}: confirm question has no valid choices.`
    );
    return undefined;
  }

  const answer = readQuestionAnswer(value.answer);

  return normalizeQuestion({
    allowCustom,
    allowSkip,
    answer,
    answeredAt: readTimestamp(value.answeredAt),
    createdAt: readTimestamp(value.createdAt) ?? Date.now(),
    description: readString(value.description),
    id: questionId,
    options: questionOptions,
    recommendedOption: readRecommendedOption(value.recommendedOption),
    relatedBuildStep: readNonNegativeInteger(value.relatedBuildStep),
    relatedTaskId: readString(value.relatedTaskId),
    source,
    state: isQuestionState(value.state) ? value.state : "pending",
    title,
    type
  });
}

function isQuestion(value: unknown): value is Question {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isQuestionType(value.type) &&
    isQuestionSource(value.source) &&
    isQuestionState(value.state) &&
    typeof value.createdAt === "number" &&
    Array.isArray(value.options)
  );
}

function normalizeQuestion(question: Question): Question {
  const options = readQuestionOptions(question.options, {
    questionId: question.id,
    warn: undefined
  });

  return {
    ...question,
    allowCustom: Boolean(question.allowCustom) || question.type === "free_text",
    allowSkip: Boolean(question.allowSkip),
    answeredAt: readTimestamp(question.answeredAt),
    createdAt: readTimestamp(question.createdAt) ?? Date.now(),
    description: readString(question.description),
    options: options.map((option, index) => ({
      description: option.description,
      id: option.id || createOptionId(option.value || option.label, index),
      label: option.label,
      value: option.value || option.label
    })),
    recommendedOption: normalizeRecommendedOption(
      readRecommendedOption(question.recommendedOption),
      options
    ),
    relatedBuildStep: readNonNegativeInteger(question.relatedBuildStep),
    relatedTaskId: readString(question.relatedTaskId),
    title: readString(question.title) ?? "Decision needed"
  };
}

function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === "single_choice" ||
    value === "multi_choice" ||
    value === "free_text" ||
    value === "confirm"
  );
}

function isQuestionSource(value: unknown): value is QuestionSource {
  return (
    value === "plan" ||
    value === "build" ||
    value === "agent" ||
    value === "tool" ||
    value === "approval"
  );
}

function isQuestionState(value: unknown): value is Question["state"] {
  return (
    value === "pending" ||
    value === "answered" ||
    value === "skipped" ||
    value === "cancelled"
  );
}

async function findExistingFolderCandidate(
  workspaceRoot: string,
  text: string
): Promise<{ displayPath: string; path: string } | undefined> {
  for (const candidate of extractFolderCandidates(text)) {
    const candidatePath = isAbsolute(candidate)
      ? candidate
      : resolve(workspaceRoot, candidate);

    if (candidatePath === workspaceRoot) {
      continue;
    }

    try {
      const stats = await stat(candidatePath);

      if (stats.isDirectory()) {
        return {
          displayPath: candidate,
          path: candidatePath
        };
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function extractFolderCandidates(text: string): string[] {
  const candidates: string[] = [];
  const add = (value: string | undefined): void => {
    const candidate = normalizePathCandidate(value);

    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  };

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    add(match[1]);
  }

  for (const match of text.matchAll(/["']([^"']+)["']/g)) {
    add(match[1]);
  }

  for (const match of text.matchAll(/\b(?:folder|directory|project|app)\s+(?:named\s+|called\s+|at\s+|in\s+|into\s+)?([A-Za-z0-9._/-]+)/gi)) {
    add(match[1]);
  }

  for (const match of text.matchAll(/\b(?:in|into|at)\s+([A-Za-z0-9._/-]+)\b/gi)) {
    add(match[1]);
  }

  return candidates;
}

function normalizePathCandidate(value: string | undefined): string | undefined {
  const candidate = value?.trim().replace(/[.,;:]+$/g, "") ?? "";

  if (
    candidate.length === 0 ||
    candidate === "." ||
    candidate === "/" ||
    candidate.startsWith("-") ||
    /\s/.test(candidate) ||
    /^(the|this|that|current|existing|new|folder|directory|project|app|repo|workspace)$/i.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

function readQuestionOptions(
  value: unknown,
  options: {
    questionId: string;
    warn?: (message: string) => void;
  }
): QuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questionOptions: QuestionOption[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      options.warn?.(
        `Skipping option ${index + 1} for saved question ${options.questionId}: not an object.`
      );
      continue;
    }

    const label = readString(entry.label) ?? readString(entry.value);

    if (!label) {
      options.warn?.(
        `Skipping option ${index + 1} for saved question ${options.questionId}: missing label.`
      );
      continue;
    }

    const valueText = readString(entry.value) ?? label;

    questionOptions.push({
      description: readString(entry.description),
      id: readString(entry.id) ?? createOptionId(valueText, index),
      label,
      value: valueText
    });
  }

  return questionOptions;
}

function readRecommendedOption(
  value: unknown
): Question["recommendedOption"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const reason = readString(value.reason);
  const optionId = readString(value.optionId);
  const optionValue = readString(value.value);

  if (!reason && !optionId && !optionValue) {
    return undefined;
  }

  return {
    optionId,
    reason: reason ?? "recommended option",
    value: optionValue
  };
}

function readQuestionAnswer(value: unknown): QuestionAnswer | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const text = readString(value.text);

  if (!text) {
    return undefined;
  }

  return {
    custom: typeof value.custom === "boolean" ? value.custom : undefined,
    optionIds: readStringArray(value.optionIds),
    text,
    values: readStringArray(value.values)
  };
}

function readQuestionContinuationContext(
  value: unknown,
  warn?: (message: string) => void
): QuestionQueueState["context"] {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.type === "plan") {
    const originalPrompt = readString(value.originalPrompt);

    if (!originalPrompt) {
      warn?.("Ignoring saved plan question context: missing original prompt.");
      return undefined;
    }

    return {
      originalPrompt,
      type: "plan"
    };
  }

  if (value.type === "build") {
    const startStepIndex = readNonNegativeInteger(value.startStepIndex);
    const completedStepIndexes = Array.isArray(value.completedStepIndexes)
      ? value.completedStepIndexes
          .map((entry) => readNonNegativeInteger(entry))
          .filter((entry): entry is number => entry !== undefined)
      : [];

    if (startStepIndex === undefined) {
      warn?.("Ignoring saved build question context: missing start step.");
      return undefined;
    }

    return {
      completedStepIndexes,
      startStepIndex,
      type: "build"
    };
  }

  if (value.type === "agent") {
    const prompt = readString(value.prompt);

    if (!prompt) {
      warn?.("Ignoring saved agent question context: missing prompt.");
      return undefined;
    }

    return {
      prompt,
      type: "agent"
    };
  }

  warn?.("Ignoring saved question context: unknown context type.");
  return undefined;
}

function readTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => readString(entry))
        .filter((entry): entry is string => entry !== undefined)
    : [];
}

function createRestoredQuestionId(
  source: QuestionSource,
  title: string,
  index: number
): string {
  const hash = createHash("sha1")
    .update(`${source}:${title}:${index}`)
    .digest("hex")
    .slice(0, 10);

  return `question-${source}-${hash}`;
}

function formatQuestionDebugId(
  value: Record<string, unknown>,
  index: number
): string {
  const id = readString(value.id);

  return id ? id : `${index + 1}`;
}

function readToolQuestionOptions(value: unknown): Omit<QuestionOption, "id">[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const options: Omit<QuestionOption, "id">[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const label = readString(entry.label);

    if (!label) {
      continue;
    }

    options.push({
      description: readString(entry.description),
      label,
      value: readString(entry.value) ?? label
    });
  }

  return options;
}

function readQuestionType(value: unknown): QuestionType | undefined {
  return isQuestionType(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
