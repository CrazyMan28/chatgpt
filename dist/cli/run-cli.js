import { createInterface } from "node:readline/promises";
import { runAgentTurn } from "../agent/run-agent-turn.js";
const EXIT_COMMANDS = new Set(["exit", "quit"]);
export async function runCli({ input, output, model, toolRegistry }) {
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown model error";
                output.write(`Error: ${message}\n`);
            }
            rl.prompt();
        }
    }
    finally {
        rl.close();
    }
}
function isInteractive(input, output) {
    return Boolean(input.isTTY && output.isTTY);
}
