package com.kizek.phoneagent.models

import android.content.Context
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

enum class HttpEndpointStyle(val id: String, val label: String) {
    OPENAI_COMPATIBLE("openai", "OpenAI-compatible"),
    OLLAMA_NATIVE("ollama", "Ollama native"),
    SIMPLE_CHAT("simple", "Custom simple chat");

    companion object {
        fun fromId(value: String): HttpEndpointStyle {
            return entries.firstOrNull { it.id == value } ?: OPENAI_COMPATIBLE
        }
    }
}

open class HttpChatProvider(
    context: Context,
    override val id: String,
    override val label: String,
    private val defaultBaseUrl: String,
    private val defaultModel: String,
    private val defaultStyle: HttpEndpointStyle,
    private val keyRequiredForPublicOpenAi: Boolean = false,
    private val client: OkHttpClient = OkHttpClient()
) : ModelProvider {
    private val keyStore = SecureApiKeyStore(context)
    private val prefs = context.getSharedPreferences("phone_agent_provider_$id", Context.MODE_PRIVATE)

    var providerName: String
        get() = prefs.getString("name", label) ?: label
        set(value) {
            prefs.edit().putString("name", value.trim().ifBlank { label }).apply()
        }

    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(value) {
            prefs.edit().putBoolean("enabled", value).apply()
        }

    var baseUrl: String
        get() = prefs.getString("base_url", defaultBaseUrl) ?: defaultBaseUrl
        set(value) {
            prefs.edit().putString("base_url", value.trim().ifBlank { defaultBaseUrl }).apply()
        }

    var model: String
        get() = prefs.getString("model", defaultModel) ?: defaultModel
        set(value) {
            prefs.edit().putString("model", value.trim().ifBlank { defaultModel }).apply()
        }

    var endpointStyle: HttpEndpointStyle
        get() = HttpEndpointStyle.fromId(prefs.getString("endpoint_style", defaultStyle.id) ?: defaultStyle.id)
        set(value) {
            prefs.edit().putString("endpoint_style", value.id).apply()
        }

    var supportsVision: Boolean
        get() = prefs.getBoolean("supports_vision", false)
        set(value) {
            prefs.edit().putBoolean("supports_vision", value).apply()
        }

    var supportsTools: Boolean
        get() = prefs.getBoolean("supports_tools", false)
        set(value) {
            prefs.edit().putBoolean("supports_tools", value).apply()
        }

    var timeoutSeconds: Long
        get() = prefs.getLong("timeout_seconds", 30L)
        set(value) {
            prefs.edit().putLong("timeout_seconds", value.coerceIn(3L, 300L)).apply()
        }

    var maxTokens: Int
        get() = prefs.getInt("max_tokens", 512)
        set(value) {
            prefs.edit().putInt("max_tokens", value.coerceIn(1, 64_000)).apply()
        }

    var temperature: Double
        get() = Double.fromBits(prefs.getLong("temperature_bits", 0.2.toBits()))
        set(value) {
            prefs.edit().putLong("temperature_bits", value.coerceIn(0.0, 2.0).toBits()).apply()
        }

    fun saveApiKey(apiKey: String) {
        if (apiKey.isNotBlank()) keyStore.save(id, apiKey)
    }

    fun removeApiKey() {
        keyStore.remove(id)
    }

    fun hasApiKey(): Boolean = keyStore.has(id)

    fun maskedApiKey(): String {
        val key = keyStore.read(id).orEmpty()
        if (key.isBlank()) return "not saved"
        return "saved: ${"\u2022".repeat(8)}${key.takeLast(4)}"
    }

    fun deleteProvider() {
        prefs.edit().clear().apply()
        keyStore.remove(id)
    }

    override suspend fun state(): ModelProviderState {
        val base = baseUrl.trim()
        val needsKey = keyRequiredForPublicOpenAi && base.contains("api.openai.com", ignoreCase = true)
        val available = enabled && base.isNotBlank() && (!needsKey || hasApiKey())
        return ModelProviderState(
            id = id,
            label = providerName,
            selectedModel = model,
            available = available,
            detail = when {
                !enabled -> "Provider is disabled. Save settings to enable it."
                base.isBlank() -> "Base URL is missing."
                needsKey && !hasApiKey() -> "API key required for api.openai.com."
                else -> "${endpointStyle.label} at $base; vision=${supportsVision}; tools=${supportsTools}"
            }
        )
    }

    suspend fun testConnection(testModel: String = model): Result<String> {
        return chat(
            listOf(
                ModelMessage("system", "Reply with exactly: ok"),
                ModelMessage("user", "Connection test")
            ),
            testModel
        ).map { "${providerName} answered with ${it.model}." }
    }

    suspend fun listModels(): Result<List<String>> {
        return withContext(Dispatchers.IO) {
            runCatching {
                when (endpointStyle) {
                    HttpEndpointStyle.OLLAMA_NATIVE -> listOllamaModels()
                    else -> listOpenAiModels()
                }
            }
        }
    }

    override suspend fun chat(messages: List<ModelMessage>, model: String): Result<ModelResponse> {
        if (!enabled) {
            return Result.failure(IllegalStateException("$providerName is disabled."))
        }
        val selected = model.ifBlank { this.model }
        return withContext(Dispatchers.IO) {
            runCatching {
                when (endpointStyle) {
                    HttpEndpointStyle.OPENAI_COMPATIBLE -> chatOpenAiCompatible(messages, selected)
                    HttpEndpointStyle.OLLAMA_NATIVE -> chatOllamaNative(messages, selected)
                    HttpEndpointStyle.SIMPLE_CHAT -> chatSimple(messages, selected)
                }
            }
        }
    }

    private fun chatOpenAiCompatible(messages: List<ModelMessage>, selectedModel: String): ModelResponse {
        val response = executeJsonPost(
            url = "${baseUrl.trimEnd('/')}/chat/completions",
            body = JSONObject()
                .put("model", selectedModel)
                .put("messages", JSONArray(messages.map { JSONObject().put("role", it.role).put("content", it.content) }))
                .put("max_tokens", maxTokens)
                .put("temperature", temperature)
        )
        val content = response
            .getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .optString("content")
        return ModelResponse(provider = id, model = selectedModel, content = content)
    }

    private fun chatOllamaNative(messages: List<ModelMessage>, selectedModel: String): ModelResponse {
        val response = executeJsonPost(
            url = "${baseUrl.trimEnd('/')}/api/chat",
            body = JSONObject()
                .put("model", selectedModel)
                .put("messages", JSONArray(messages.map { JSONObject().put("role", it.role).put("content", it.content) }))
                .put("stream", false)
                .put("options", JSONObject().put("temperature", temperature))
        )
        val content = response.optJSONObject("message")?.optString("content")
            ?: response.optString("response", response.optString("content"))
        return ModelResponse(provider = id, model = selectedModel, content = content)
    }

    private fun chatSimple(messages: List<ModelMessage>, selectedModel: String): ModelResponse {
        val response = executeJsonPost(
            url = baseUrl.trim(),
            body = JSONObject()
                .put("model", selectedModel)
                .put("prompt", messages.lastOrNull { it.role == "user" }?.content.orEmpty())
                .put("messages", JSONArray(messages.map { JSONObject().put("role", it.role).put("content", it.content) }))
                .put("max_tokens", maxTokens)
                .put("temperature", temperature)
        )
        val content = response.optString("content")
            .ifBlank { response.optString("response") }
            .ifBlank { response.optString("text") }
            .ifBlank { response.toString(2) }
        return ModelResponse(provider = id, model = selectedModel, content = content)
    }

    private fun executeJsonPost(url: String, body: JSONObject): JSONObject {
        val apiKey = keyStore.read(id).orEmpty()
        val builder = Request.Builder()
            .url(url)
            .addHeader("Content-Type", "application/json")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
        if (apiKey.isNotBlank()) {
            builder.addHeader("Authorization", "Bearer $apiKey")
        }
        val responseText = httpClient().newCall(builder.build()).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val code = response.code
                val retryAfter = response.header("Retry-After")?.toLongOrNull()
                val kind = when (code) {
                    401, 403 -> "authentication failed"
                    429 -> "rate limited"
                    408, 500, 502, 503, 504 -> "temporary failure"
                    404 -> "endpoint or model not found"
                    else -> "request failed"
                }
                throw IOException(
                    buildString {
                        append("$providerName $kind: HTTP $code")
                        if (retryAfter != null) append(" retryAfterSeconds=$retryAfter")
                    }
                )
            }
            responseBody
        }
        return JSONObject(responseText.ifBlank { "{}" })
    }

    private fun listOpenAiModels(): List<String> {
        val apiKey = keyStore.read(id).orEmpty()
        val builder = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/models")
            .get()
        if (apiKey.isNotBlank()) builder.addHeader("Authorization", "Bearer $apiKey")
        val responseText = httpClient().newCall(builder.build()).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IOException("$providerName model list failed: HTTP ${response.code}")
            body
        }
        val data = JSONObject(responseText.ifBlank { "{}" }).optJSONArray("data") ?: return emptyList()
        return buildList {
            for (index in 0 until data.length()) {
                val id = data.optJSONObject(index)?.optString("id").orEmpty()
                if (id.isNotBlank()) add(id)
            }
        }
    }

    private fun listOllamaModels(): List<String> {
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/tags")
            .get()
            .build()
        val responseText = httpClient().newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IOException("$providerName tags failed: HTTP ${response.code}")
            body
        }
        val models = JSONObject(responseText.ifBlank { "{}" }).optJSONArray("models") ?: return emptyList()
        return buildList {
            for (index in 0 until models.length()) {
                val name = models.optJSONObject(index)?.optString("name").orEmpty()
                if (name.isNotBlank()) add(name)
            }
        }
    }

    private fun httpClient(): OkHttpClient {
        return client.newBuilder()
            .callTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .build()
    }
}

class OpenAiCompatibleProvider(context: Context) : HttpChatProvider(
    context = context,
    id = "openai-compatible",
    label = "OpenAI Compatible",
    defaultBaseUrl = "https://api.openai.com/v1",
    defaultModel = "gpt-4o-mini",
    defaultStyle = HttpEndpointStyle.OPENAI_COMPATIBLE,
    keyRequiredForPublicOpenAi = true
)

class LocalHttpProvider(context: Context) : HttpChatProvider(
    context = context,
    id = "local-http",
    label = "Local HTTP",
    defaultBaseUrl = "http://127.0.0.1:11434/v1",
    defaultModel = "llama3.1",
    defaultStyle = HttpEndpointStyle.OPENAI_COMPATIBLE
)

class OllamaProvider(context: Context) : HttpChatProvider(
    context = context,
    id = "ollama",
    label = "Ollama",
    defaultBaseUrl = "http://127.0.0.1:11434",
    defaultModel = "llama3.1",
    defaultStyle = HttpEndpointStyle.OLLAMA_NATIVE
)
