package com.kizek.phoneagent.models

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

enum class ModelErrorKind(val id: String) {
    CONFIGURATION("configuration"),
    AUTH("auth"),
    RATE_LIMITED("rate_limited"),
    TEMPORARY("temporary"),
    OFFLINE("offline"),
    MODEL("model"),
    UNKNOWN("unknown")
}

data class ModelErrorInfo(
    val kind: ModelErrorKind,
    val userMessage: String,
    val retryable: Boolean,
    val retryAfterSeconds: Long? = null
)

object ModelErrorClassifier {
    fun classify(error: Throwable?, providerLabel: String = "Provider"): ModelErrorInfo {
        val message = error?.message.orEmpty()
        val lower = message.lowercase()
        val retryAfter = Regex("""retryAfterSeconds=(\d+)""").find(message)?.groupValues?.getOrNull(1)?.toLongOrNull()
        return when {
            lower.contains("api key is not configured") ||
                lower.contains("base url is missing") ||
                lower.contains("model name is missing") ||
                lower.contains("provider is disabled") ||
                lower.contains("not configured") ->
                ModelErrorInfo(ModelErrorKind.CONFIGURATION, "$providerLabel is not configured.", retryable = false)

            lower.contains("http 401") ||
                lower.contains("http 403") ||
                lower.contains("invalid key") ||
                lower.contains("unauthorized") ||
                lower.contains("forbidden") ||
                lower.contains("authentication failed") ->
                ModelErrorInfo(ModelErrorKind.AUTH, "API key rejected. Check provider settings.", retryable = false)

            lower.contains("http 429") ||
                lower.contains("rate limit") ||
                lower.contains("rate-limited") ->
                ModelErrorInfo(ModelErrorKind.RATE_LIMITED, "$providerLabel is rate-limited.", retryable = true, retryAfterSeconds = retryAfter)

            lower.contains("http 408") ||
                lower.contains("http 500") ||
                lower.contains("http 502") ||
                lower.contains("http 503") ||
                lower.contains("http 504") ||
                lower.contains("overloaded") ||
                lower.contains("temporarily") ||
                lower.contains("timeout") ||
                lower.contains("connection reset") ||
                error is SocketTimeoutException ->
                ModelErrorInfo(ModelErrorKind.TEMPORARY, "$providerLabel is temporarily unreachable.", retryable = true, retryAfterSeconds = retryAfter)

            error is UnknownHostException ||
                error is ConnectException ||
                error is IOException && (lower.contains("failed to connect") || lower.contains("unable to resolve") || lower.contains("connection refused")) ||
                lower.contains("network is unreachable") ||
                lower.contains("no route to host") ||
                lower.contains("ollama not running") ||
                lower.contains("endpoint unreachable") ->
                ModelErrorInfo(ModelErrorKind.OFFLINE, "$providerLabel is offline or unreachable.", retryable = true, retryAfterSeconds = retryAfter)

            lower.contains("http 400") ||
                lower.contains("http 404") ||
                lower.contains("model error") ||
                lower.contains("model not found") ->
                ModelErrorInfo(ModelErrorKind.MODEL, "$providerLabel rejected the model or endpoint.", retryable = false)

            else -> ModelErrorInfo(ModelErrorKind.UNKNOWN, "$providerLabel failed.", retryable = false)
        }
    }
}
