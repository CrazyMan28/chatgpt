export type ModelProvider = "local" | "openai" | "anthropic" | "mistral";
export type JsonSchema = Record<string, unknown>;
export interface LocalModelConfig {
    provider: "local";
    model: string;
    transport: "mock" | "ollama";
    baseUrl?: string;
}
export interface OpenAIModelConfig {
    provider: "openai";
    model: string;
    baseUrl: string;
    apiKey: string;
}
export interface AnthropicModelConfig {
    provider: "anthropic";
    model: string;
    baseUrl: string;
    apiKey: string;
}
export interface MistralModelConfig {
    provider: "mistral";
    model: string;
    baseUrl: string;
    apiKey: string;
}
export type ModelConfig = LocalModelConfig | OpenAIModelConfig | AnthropicModelConfig | MistralModelConfig;
export interface ModelToolDefinition {
    id: string;
    name: string;
    description: string;
    inputSchema: JsonSchema;
}
export interface ModelToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export type ModelMessage = {
    role: "system";
    content: string;
} | {
    role: "user";
    content: string;
} | {
    role: "assistant";
    content: string;
    toolCalls?: readonly ModelToolCall[];
} | {
    role: "tool";
    content: string;
    toolCallId: string;
    toolName: string;
    isError: boolean;
};
export interface ModelRequest {
    messages: readonly ModelMessage[];
    tools: readonly ModelToolDefinition[];
}
export interface NormalizedModelResponse {
    text: string;
    toolCalls: readonly ModelToolCall[];
}
export interface ModelResponse extends NormalizedModelResponse {
    content: string;
}
export interface ModelClient {
    generate(request: ModelRequest): Promise<ModelResponse>;
}
export declare function createModelResponse(text: string, toolCalls?: readonly ModelToolCall[]): ModelResponse;
export declare function isModelProvider(value: string): value is ModelProvider;
//# sourceMappingURL=model-client.d.ts.map