package com.kizek.phoneagent.models

import android.content.Context
import kotlinx.coroutines.delay

enum class ModelRoute {
    MISTRAL,
    OPENAI_COMPATIBLE,
    LOCAL_HTTP,
    OLLAMA,
    LOCAL,
    REMOTE,
    HYBRID
}

class ModelRouter(
    context: Context,
    val mistral: MistralProvider,
    val openAiCompatible: OpenAiCompatibleProvider,
    val localHttp: LocalHttpProvider,
    val ollama: OllamaProvider,
    val local: LocalModelProvider,
    val remote: RemoteProvider
) {
    private val prefs = context.getSharedPreferences("phone_agent_model_router", Context.MODE_PRIVATE)

    var selectedRoute: ModelRoute
        get() = runCatching { ModelRoute.valueOf(prefs.getString("selected_route", ModelRoute.HYBRID.name) ?: ModelRoute.HYBRID.name) }.getOrDefault(ModelRoute.HYBRID)
        set(value) {
            prefs.edit().putString("selected_route", value.name).apply()
        }
    var fallbackEnabled: Boolean
        get() = prefs.getBoolean("fallback_enabled", true)
        set(value) {
            prefs.edit().putBoolean("fallback_enabled", value).apply()
        }
    var lastProviderLabel: String = "Local deterministic"
        private set
    var selectedMistralModel: String
        get() = mistral.selectedModel
        set(value) {
            mistral.selectedModel = value
        }

    suspend fun states(): List<ModelProviderState> = listOf(
        mistral.state(),
        openAiCompatible.state(),
        localHttp.state(),
        ollama.state(),
        local.state(),
        remote.state()
    )

    suspend fun chat(messages: List<ModelMessage>): Result<ModelResponse> {
        val routes = if (selectedRoute == ModelRoute.HYBRID || fallbackEnabled) {
            buildList {
                if (selectedRoute != ModelRoute.HYBRID) add(selectedRoute)
                fallbackOrder().filter { it != selectedRoute }.forEach { add(it) }
            }.distinct()
        } else {
            listOf(selectedRoute)
        }
        val failures = mutableListOf<String>()
        var finalKind = ModelErrorKind.CONFIGURATION
        var sawConfiguredProvider = false
        for (route in routes) {
            val provider = providerFor(route) ?: continue
            val state = runCatching { provider.state() }.getOrNull()
            if (state?.available == false) {
                failures += "${state.label}: configuration: ${state.detail}"
                continue
            }
            sawConfiguredProvider = true
            val label = state?.label ?: provider.label
            var attempt = 0
            var lastFailure: Throwable? = null
            while (attempt <= MAX_RETRIES) {
                val result = provider.chat(messages, modelFor(route))
                if (result.isSuccess) {
                    lastProviderLabel = label
                    return result
                }
                val failure = result.exceptionOrNull()
                lastFailure = failure
                val info = ModelErrorClassifier.classify(failure, label)
                finalKind = info.kind
                val canRetry = info.retryable && attempt < MAX_RETRIES
                failures += buildString {
                    append("$label: ${info.kind.id}: ${failure?.message ?: "failed"}")
                    if (canRetry) append(" retry=${attempt + 1}/$MAX_RETRIES")
                }
                if (!canRetry) break
                val backoff = info.retryAfterSeconds?.coerceAtLeast(1L) ?: RETRY_BACKOFF_SECONDS.getOrElse(attempt) { RETRY_BACKOFF_SECONDS.last() }
                delay(backoff * 1_000L)
                attempt += 1
            }
            val info = ModelErrorClassifier.classify(lastFailure, label)
            if (info.kind in setOf(ModelErrorKind.AUTH, ModelErrorKind.MODEL) && !fallbackEnabled) {
                break
            }
        }
        val kind = if (!sawConfiguredProvider) ModelErrorKind.CONFIGURATION else finalKind
        val message = when (kind) {
            ModelErrorKind.CONFIGURATION -> "MODEL_ERROR_CLASS=configuration No model provider is configured. Local phone commands still work. Add Mistral, OpenAI-compatible, Ollama, Local HTTP, or a laptop/server orchestrator in Settings."
            ModelErrorKind.AUTH -> "MODEL_ERROR_CLASS=auth API key rejected. Check provider settings. Local phone commands still work."
            ModelErrorKind.RATE_LIMITED -> "MODEL_ERROR_CLASS=rate_limited Provider is rate-limited. Retrying or using fallback provider failed. Local phone commands still work."
            ModelErrorKind.TEMPORARY -> "MODEL_ERROR_CLASS=temporary Provider is temporarily unreachable. Local phone commands still work."
            ModelErrorKind.OFFLINE -> "MODEL_ERROR_CLASS=offline Provider is offline or unreachable. Local phone commands still work."
            ModelErrorKind.MODEL -> "MODEL_ERROR_CLASS=model Provider rejected the model or endpoint. Check provider settings. Local phone commands still work."
            ModelErrorKind.UNKNOWN -> "MODEL_ERROR_CLASS=unknown All configured providers failed. Local phone commands still work."
        }
        return Result.failure(
            IllegalStateException(
                "$message ${failures.joinToString(" | ").take(900)}"
            )
        )
    }

    fun fallbackOrder(): List<ModelRoute> {
        val raw = prefs.getString("fallback_order", null)
        if (raw.isNullOrBlank()) return DEFAULT_FALLBACK_ORDER
        return raw.split(",").mapNotNull { name ->
            runCatching { ModelRoute.valueOf(name) }.getOrNull()
        }.filter { it != ModelRoute.HYBRID }.ifEmpty { DEFAULT_FALLBACK_ORDER }
    }

    fun saveFallbackOrder(order: List<ModelRoute>) {
        prefs.edit().putString("fallback_order", order.filter { it != ModelRoute.HYBRID }.joinToString(",") { it.name }).apply()
    }

    fun activeProviderLabel(): String {
        return when (selectedRoute) {
            ModelRoute.MISTRAL -> mistral.label
            ModelRoute.OPENAI_COMPATIBLE -> openAiCompatible.providerName
            ModelRoute.LOCAL_HTTP -> localHttp.providerName
            ModelRoute.OLLAMA -> ollama.providerName
            ModelRoute.LOCAL -> local.label
            ModelRoute.REMOTE -> remote.label
            ModelRoute.HYBRID -> "Hybrid fallback: $lastProviderLabel"
        }
    }

    private fun providerFor(route: ModelRoute): ModelProvider? {
        return when (route) {
            ModelRoute.MISTRAL -> mistral
            ModelRoute.OPENAI_COMPATIBLE -> openAiCompatible
            ModelRoute.LOCAL_HTTP -> localHttp
            ModelRoute.OLLAMA -> ollama
            ModelRoute.LOCAL -> local
            ModelRoute.REMOTE -> remote
            ModelRoute.HYBRID -> null
        }
    }

    private fun modelFor(route: ModelRoute): String {
        return when (route) {
            ModelRoute.MISTRAL -> selectedMistralModel
            ModelRoute.OPENAI_COMPATIBLE -> openAiCompatible.model
            ModelRoute.LOCAL_HTTP -> localHttp.model
            ModelRoute.OLLAMA -> ollama.model
            ModelRoute.LOCAL -> "local"
            ModelRoute.REMOTE -> "remote"
            ModelRoute.HYBRID -> ""
        }
    }

    companion object {
        private const val MAX_RETRIES = 3
        private val RETRY_BACKOFF_SECONDS = listOf(2L, 5L, 10L)
        val DEFAULT_FALLBACK_ORDER = listOf(
            ModelRoute.MISTRAL,
            ModelRoute.OPENAI_COMPATIBLE,
            ModelRoute.LOCAL_HTTP,
            ModelRoute.OLLAMA,
            ModelRoute.REMOTE
        )
    }
}
