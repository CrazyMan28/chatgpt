package com.kizek.phoneagent.models

import com.kizek.phoneagent.sync.OrchestratorClient

class RemoteProvider(
    private val orchestratorClient: OrchestratorClient
) : ModelProvider {
    override val id: String = "remote-orchestrator"
    override val label: String = "Laptop/server model"

    override suspend fun state(): ModelProviderState {
        val status = orchestratorClient.getStatus()
        return ModelProviderState(
            id = id,
            label = label,
            selectedModel = status.getOrNull()?.optString("model", "remote") ?: "remote",
            available = status.isSuccess,
            detail = status.exceptionOrNull()?.message ?: "Remote orchestrator reachable"
        )
    }

    override suspend fun chat(messages: List<ModelMessage>, model: String): Result<ModelResponse> {
        val prompt = messages.lastOrNull { it.role == "user" }?.content
            ?: return Result.failure(IllegalArgumentException("No user message supplied."))
        return orchestratorClient.sendAdHocPrompt(prompt).map { content ->
            ModelResponse(
                provider = id,
                model = model.ifBlank { "remote" },
                content = content
            )
        }
    }
}
