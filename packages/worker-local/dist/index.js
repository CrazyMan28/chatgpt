import { appendTranscriptEntry, buildAgentPromptContext, buildExecutionModeContextMessage, buildResponseModeContextMessage, createExecutionModeToolRegistry, createSystemEntry, createUserEntry, filterPersistedTranscript, mergeAgentTurnHistory, reduceTranscriptEntries, runWithRateLimitRecovery, runAgentTurn } from "@chatgpt-code/runtime-core";
export function createLocalWorker(dependencies) {
    return {
        async runPrompt(input, options) {
            const session = (await dependencies.sessionStore.loadSession(input.sessionId)) ??
                (await dependencies.sessionStore.createSession());
            await persistMemories(dependencies.memoryStore, input.prompt, session.id);
            const promptContext = await buildAgentPromptContext({
                history: session.history,
                memoryStore: dependencies.memoryStore,
                prompt: input.prompt,
                sessionSummary: session.summary,
                systemMessages: [
                    buildExecutionModeContextMessage(input.mode),
                    buildResponseModeContextMessage(input.style)
                ]
            });
            let turnTranscript = input.prompt.trim().length > 0
                ? appendTranscriptEntry(session.transcript, createUserEntry(input.prompt))
                : [...session.transcript];
            const baseTranscript = [...turnTranscript];
            const result = await runWithRateLimitRecovery({
                onRetry: async ({ attempt, delayMs, error }) => {
                    turnTranscript = appendTranscriptEntry([...baseTranscript], createSystemEntry(`Provider rate limited this worker turn. Retrying in ${delayMs}ms (attempt ${attempt}/3).`, true));
                    await options?.onRetry?.({
                        attempt,
                        delayMs,
                        error
                    });
                },
                run: () => runAgentTurn({
                    contextMessages: promptContext.contextMessages,
                    history: promptContext.recentHistory,
                    maxSteps: input.mode === "plan" ? 12 : 24,
                    model: dependencies.modelRuntime.getClient(),
                    onEvent: async (event) => {
                        turnTranscript = reduceTranscriptEntries(turnTranscript, event, Date.now());
                        if (options?.onEvent) {
                            await options.onEvent(event);
                        }
                    },
                    prompt: input.prompt,
                    shouldContinue: options?.shouldContinue,
                    toolRegistry: createExecutionModeToolRegistry(dependencies.toolRegistry, input.mode)
                })
            });
            const nextHistory = mergeAgentTurnHistory(session.history, promptContext.recentHistory, result.messages);
            const savedSession = await dependencies.sessionStore.saveSession({
                ...session,
                history: nextHistory,
                transcript: filterPersistedTranscript(turnTranscript)
            });
            return {
                content: result.content,
                session: savedSession
            };
        }
    };
}
async function persistMemories(memoryStore, prompt, sessionId) {
    if (prompt.trim().length === 0) {
        return;
    }
    if ("rememberFromUserMessage" in memoryStore) {
        await memoryStore.rememberFromUserMessage(prompt, { sessionId });
    }
}
//# sourceMappingURL=index.js.map