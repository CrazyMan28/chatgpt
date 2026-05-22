package com.kizek.phoneagent.models

class LocalModelProvider(
    private val localModelManager: LocalModelManager
) : ModelProvider {
    override val id: String = "local-placeholder"
    override val label: String = "Local model"

    override suspend fun state(): ModelProviderState {
        val status = localModelManager.runtimeStatus()
        val active = status.activeModel
        return ModelProviderState(
            id = id,
            label = label,
            selectedModel = active?.name ?: "not-installed",
            available = status.ready,
            detail = if (active == null) "No local model imported. ${status.detail}" else status.detail
        )
    }

    override suspend fun chat(messages: List<ModelMessage>, model: String): Result<ModelResponse> {
        val prompt = messages.lastOrNull { it.role == "user" }?.content.orEmpty()
        return localModelManager.testPrompt(prompt).map {
            ModelResponse(provider = id, model = localModelManager.activeModel()?.name ?: model, content = it)
        }
    }
}
