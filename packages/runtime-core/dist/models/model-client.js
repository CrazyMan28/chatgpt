export function createModelResponse(text, toolCalls = []) {
    return {
        text,
        content: text,
        toolCalls
    };
}
export function isModelProvider(value) {
    return (value === "local" ||
        value === "openai" ||
        value === "anthropic" ||
        value === "mistral");
}
//# sourceMappingURL=model-client.js.map