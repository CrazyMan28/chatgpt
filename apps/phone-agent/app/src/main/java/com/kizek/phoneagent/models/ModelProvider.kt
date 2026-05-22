package com.kizek.phoneagent.models

data class ModelMessage(
    val role: String,
    val content: String
)

data class ModelResponse(
    val provider: String,
    val model: String,
    val content: String
)

data class ModelProviderState(
    val id: String,
    val label: String,
    val selectedModel: String,
    val available: Boolean,
    val detail: String
)

interface ModelProvider {
    val id: String
    val label: String
    suspend fun chat(messages: List<ModelMessage>, model: String): Result<ModelResponse>
    suspend fun state(): ModelProviderState
}
