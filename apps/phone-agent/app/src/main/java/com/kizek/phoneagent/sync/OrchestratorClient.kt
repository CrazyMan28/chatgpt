package com.kizek.phoneagent.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

data class RemoteSessionSummary(
    val id: String,
    val title: String,
    val worker: String,
    val updatedAt: Long
)

data class RemoteQuestionSummary(
    val id: String,
    val sessionId: String,
    val prompt: String,
    val type: String,
    val options: List<String>,
    val status: String,
    val createdAt: Long
)

class OrchestratorClient(
    private val pairingManager: PairingManager,
    private val client: OkHttpClient = OkHttpClient()
) {
    val baseUrl: String
        get() = pairingManager.orchestratorUrl

    suspend fun getStatus(): Result<JSONObject> = getObject("/status")

    suspend fun listSessions(): Result<List<RemoteSessionSummary>> {
        return getArray("/sessions").map { array ->
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    add(
                        RemoteSessionSummary(
                            id = item.optString("id", item.optString("sessionId")),
                            title = item.optString("title", "Remote session"),
                            worker = item.optString("worker", "laptop"),
                            updatedAt = item.optLong("updatedAt", item.optLong("createdAt", 0L))
                        )
                    )
                }
            }.filter { it.id.isNotBlank() }
        }
    }

    suspend fun openSession(sessionId: String): Result<JSONObject> {
        return getObject("/sessions/${encode(sessionId)}")
    }

    suspend fun createSession(): Result<RemoteSessionSummary> {
        return postObject("/sessions", JSONObject()).map { json ->
            RemoteSessionSummary(
                id = json.optString("id", json.optString("sessionId")),
                title = json.optString("title", "Remote session"),
                worker = json.optString("worker", "laptop"),
                updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
            )
        }
    }

    suspend fun sendMessage(sessionId: String, prompt: String, mode: String = "normal"): Result<String> {
        val body = JSONObject()
            .put("prompt", prompt)
            .put("mode", mode)
            .put("style", "normal")
        return postObject("/sessions/${encode(sessionId)}/input", body).map { json ->
            json.optString("content", json.toString(2))
        }
    }

    suspend fun sendAdHocPrompt(prompt: String): Result<String> {
        return createSession().fold(
            onSuccess = { session -> sendMessage(session.id, prompt) },
            onFailure = { Result.failure(it) }
        )
    }

    suspend fun listTasks(): Result<JSONArray> = getArray("/tasks")

    suspend fun listApprovals(): Result<JSONArray> = getArray("/approvals")

    suspend fun approve(approvalId: String): Result<JSONObject> {
        return postObject("/approvals/${encode(approvalId)}/approve", JSONObject())
    }

    suspend fun reject(approvalId: String): Result<JSONObject> {
        return postObject("/approvals/${encode(approvalId)}/reject", JSONObject())
    }

    suspend fun listQuestions(sessionId: String): Result<List<RemoteQuestionSummary>> {
        return getArray("/sessions/${encode(sessionId)}/questions").map { array ->
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val options = item.optJSONArray("options")
                    add(
                        RemoteQuestionSummary(
                            id = item.optString("id"),
                            sessionId = sessionId,
                            prompt = item.optString("title", item.optString("prompt", "Question")),
                            type = item.optString("type", "single_choice"),
                            options = buildList {
                                if (options != null) {
                                    for (optionIndex in 0 until options.length()) {
                                        val option = options.optJSONObject(optionIndex)
                                        add(option?.optString("label", option.optString("value")) ?: options.optString(optionIndex))
                                    }
                                }
                            }.filter { it.isNotBlank() },
                            status = item.optString("state", item.optString("status", "pending")),
                            createdAt = item.optLong("createdAt", System.currentTimeMillis())
                        )
                    )
                }
            }.filter { it.id.isNotBlank() }
        }
    }

    suspend fun answerQuestion(sessionId: String, questionId: String, answer: String): Result<JSONObject> {
        return postObject(
            "/sessions/${encode(sessionId)}/questions/${encode(questionId)}/answer",
            JSONObject().put("answer", answer)
        )
    }

    suspend fun skipQuestion(sessionId: String, questionId: String): Result<JSONObject> {
        return postObject("/sessions/${encode(sessionId)}/questions/${encode(questionId)}/skip", JSONObject())
    }

    suspend fun cancelQuestion(sessionId: String, questionId: String): Result<JSONObject> {
        return postObject("/sessions/${encode(sessionId)}/questions/${encode(questionId)}/cancel", JSONObject())
    }

    suspend fun listWorkers(): Result<JSONArray> = getArray("/workers")

    suspend fun createPairing(label: String): Result<JSONObject> {
        return postObject(
            "/auth/pairings",
            JSONObject().put("label", label).put("expiresInMinutes", 30)
        )
    }

    private suspend fun getObject(path: String): Result<JSONObject> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url("$baseUrl$path").get().build()
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("GET $path failed: HTTP ${response.code}")
                }
                JSONObject(body.ifBlank { "{}" })
            }
        }
    }

    private suspend fun getArray(path: String): Result<JSONArray> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url("$baseUrl$path").get().build()
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("GET $path failed: HTTP ${response.code}")
                }
                JSONArray(body.ifBlank { "[]" })
            }
        }
    }

    private suspend fun postObject(path: String, json: JSONObject): Result<JSONObject> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$baseUrl$path")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .build()
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("POST $path failed: HTTP ${response.code}")
                }
                JSONObject(body.ifBlank { "{}" })
            }
        }
    }

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
}
