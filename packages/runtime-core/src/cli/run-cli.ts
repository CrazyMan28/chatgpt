import { createInterface } from "node:readline/promises";

import { runAgentTurn } from "../agent/run-agent-turn.js";
import type { ModelClient } from "../models/model-client.js";
import type { ToolRegistry } from "../tools/tool-registry.js";

const EXIT_COMMANDS = new Set(["exit", "quit"]);

export interface RunCliOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  model: ModelClient;
  toolRegistry?: ToolRegistry;
}

export async function runCli({
  input,
  output,
  model,
  toolRegistry
}: RunCliOptions): Promise<void> {
  const rl = createInterface({
    input,
    output,
    terminal: isInteractive(input, output)
  });

  rl.setPrompt("> ");
  rl.on("SIGINT", () => {
    output.write("\n");
    rl.close();
  });

  try {
    rl.prompt();

    for await (const line of rl) {
      const prompt = line.trim();

      if (prompt.length === 0) {
        rl.prompt();
        continue;
      }

      if (EXIT_COMMANDS.has(prompt.toLowerCase())) {
        rl.close();
        break;
      }

      try {
        const response = await runAgentTurn({
          prompt,
          model,
          toolRegistry
        });
        output.write(`${response.content}\n`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown model error";
        output.write(`Error: ${message}\n`);
      }

      rl.prompt();
    }
  } finally {
    rl.close();
  }
}

function isInteractive(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream
): boolean {
  return Boolean(
    (input as NodeJS.ReadStream).isTTY && (output as NodeJS.WriteStream).isTTY
  );
}
