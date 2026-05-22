package com.kizek.phoneagent.models

import android.content.Context
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

enum class MistralConnectionState(val label: String) {
    CONFIGURED("configured"),
    MISSING_KEY("missing key"),
    INVALID_KEY("invalid key"),
    RATE_LIMITED("rate limited"),
    TEMPORARY_ERROR("temporary error"),
    OFFLINE("offline"),
    NETWORK_ERROR("network error"),
    MODEL_ERROR("model error")
}

data class MistralConnectionResult(
    val state: MistralConnectionState,
    val detail: String
)

class MistralProvider(
    private val context: Context,
    private val client: OkHttpClient = OkHttpClient()
) : ModelProvider {
    override val id: String = "mistral"
    override val label: String = "Mistral API"
    private val keyStore = SecureApiKeyStore(context)
    private val prefs = context.getSharedPreferences("phone_agent_mistral", Context.MODE_PRIVATE)
    private val defaultModel = "mistral-small-latest"
    val modelOptions = listOf(
        "mistral-small-latest",
        "mistral-medium-latest",
        "mistral-large-latest"
    )
    val visionModelOptions = listOf(
        "pixtral-large-latest",
        "custom-vision-model"
    )

    var baseUrl: String
        get() = prefs.getString("base_url", DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) {
            prefs.edit().putString("base_url", value.trim().ifBlank { DEFAULT_BASE_URL }).apply()
        }

    var selectedModel: String
        get() = prefs.getString("selected_model", defaultModel) ?: defaultModel
        set(value) {
            prefs.edit().putString("selected_model", value.ifBlank { defaultModel }).apply()
        }

    var selectedVisionModel: String
        get() = prefs.getString("selected_vision_model", "").orEmpty()
        set(value) {
            prefs.edit().putString("selected_vision_model", value.trim()).apply()
        }

    var maxTokens: Int
        get() = prefs.getInt("max_tokens", 512)
        set(value) {
            prefs.edit().putInt("max_tokens", value.coerceIn(1, 32_000)).apply()
        }

    var temperature: Double
        get() = Double.fromBits(prefs.getLong("temperature_bits", 0.2.toBits()))
        set(value) {
            prefs.edit().putLong("temperature_bits", value.coerceIn(0.0, 2.0).toBits()).apply()
        }

    var timeoutSeconds: Long
        get() = prefs.getLong("timeout_seconds", 30L)
        set(value) {
            prefs.edit().putLong("timeout_seconds", value.coerceIn(5L, 180L)).apply()
        }

    fun saveApiKey(apiKey: String) {
        keyStore.save(id, apiKey)
    }

    fun removeApiKey() {
        keyStore.remove(id)
    }

    fun isConfigured(): Boolean = keyStore.has(id)

    fun maskedApiKey(): String {
        val key = keyStore.read(id).orEmpty()
        if (key.isBlank()) return "not saved"
        val suffix = key.takeLast(4)
        return "saved: ${"\u2022".repeat(8)}$suffix"
    }

    override suspend fun state(): ModelProviderState {
        val configured = keyStore.has(id)
        return ModelProviderState(
            id = id,
            label = label,
            selectedModel = selectedModel,
            available = configured,
            detail = if (configured) {
                "API key saved in Android Keystore; base URL $baseUrl"
            } else {
                "API key not configured"
            }
        )
    }

    suspend fun testConnection(model: String = selectedModel): Result<String> {
        return chat(
            messages = listOf(
                ModelMessage(role = "system", content = "Reply with exactly: ok"),
                ModelMessage(role = "user", content = "Connection test")
            ),
            model = model
        ).map { "Mistral key works for ${it.model}." }
    }

    suspend fun testConnectionStatus(model: String = selectedModel): MistralConnectionResult {
        if (!isConfigured()) {
            return MistralConnectionResult(MistralConnectionState.MISSING_KEY, "Mistral API key is not configured.")
        }
        return chat(
            messages = listOf(
                ModelMessage(role = "system", content = "Reply with exactly: ok"),
                ModelMessage(role = "user", content = "Connection test")
            ),
            model = model
        ).fold(
            onSuccess = { MistralConnectionResult(MistralConnectionState.CONFIGURED, "Tiny chat request succeeded for ${it.model}.") },
            onFailure = { error ->
                val info = ModelErrorClassifier.classify(error, label)
                val state = when (info.kind) {
                    ModelErrorKind.AUTH -> MistralConnectionState.INVALID_KEY
                    ModelErrorKind.RATE_LIMITED -> MistralConnectionState.RATE_LIMITED
                    ModelErrorKind.TEMPORARY -> MistralConnectionState.TEMPORARY_ERROR
                    ModelErrorKind.OFFLINE -> MistralConnectionState.OFFLINE
                    ModelErrorKind.MODEL -> MistralConnectionState.MODEL_ERROR
                    ModelErrorKind.CONFIGURATION -> MistralConnectionState.MISSING_KEY
                    ModelErrorKind.UNKNOWN -> MistralConnectionState.NETWORK_ERROR
                }
                MistralConnectionResult(state, error.message.orEmpty().ifBlank { info.userMessage })
            }
        )
    }

    override suspend fun chat(messages: List<ModelMessage>, model: String): Result<ModelResponse> {
        val apiKey = keyStore.read(id)
            ?: return Result.failure(IllegalStateException("Mistral API key is not configured."))
        return withContext(Dispatchers.IO) {
            runCatching {
                val jsonMessages = JSONArray()
                messages.forEach { message ->
                    jsonMessages.put(
                        JSONObject()
                            .put("role", message.role)
                            .put("content", message.content)
                    )
                }
                val body = JSONObject()
                    .put("model", model.ifBlank { selectedModel })
                    .put("messages", jsonMessages)
                    .put("max_tokens", maxTokens)
                    .put("temperature", temperature)
                    .toString()
                    .toRequestBody("application/json".toMediaType())

                val normalizedBase = baseUrl.trim().ifBlank { DEFAULT_BASE_URL }.trimEnd('/')
                val request = Request.Builder()
                    .url("$normalizedBase/chat/completions")
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()

                client.newBuilder()
                    .callTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .build()
                    .newCall(request)
                    .execute()
                    .use { response ->
                    val responseBody = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        val responseCode = response.code
                        val retryAfter = response.header("Retry-After")?.toLongOrNull()
                        val kind = when (responseCode) {
                            401, 403 -> "invalid key"
                            429 -> "rate limited"
                            408, 500, 502, 503, 504 -> "temporary failure"
                            400, 404 -> "model error"
                            else -> "request failed"
                        }
                        throw IllegalStateException(
                            buildString {
                                append("Mistral $kind: HTTP $responseCode")
                                if (retryAfter != null) append(" retryAfterSeconds=$retryAfter")
                            }
                        )
                    }
                    val content = JSONObject(responseBody)
                        .getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .optString("content")
                    ModelResponse(
                        provider = id,
                        model = model.ifBlank { selectedModel },
                        content = content
                    )
                }
            }
        }
    }

    companion object {
        const val DEFAULT_BASE_URL = "https://api.mistral.ai/v1"
    }
}
