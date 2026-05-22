package com.kizek.phoneagent.models

import android.content.Context
import android.net.Uri
import org.json.JSONArray

data class LocalModelRecord(
    val uri: String,
    val name: String,
    val active: Boolean
)

enum class LocalModelBackend(val label: String) {
    MISSING("missing"),
    LLAMA_GGUF("llama.cpp/gguf"),
    ONNX("ONNX"),
    LITERT("LiteRT/TFLite")
}

data class LocalModelRuntimeStatus(
    val backend: LocalModelBackend,
    val ready: Boolean,
    val activeModel: LocalModelRecord?,
    val importedModels: List<LocalModelRecord>,
    val detail: String,
    val supportedFormats: List<String>,
    val nextSteps: String
)

class LocalModelManager(context: Context) {
    private val prefs = context.getSharedPreferences("phone_agent_local_models", Context.MODE_PRIVATE)

    fun listModels(): List<LocalModelRecord> {
        val active = prefs.getString(KEY_ACTIVE, null)
        val array = JSONArray(prefs.getString(KEY_MODELS, "[]"))
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val uri = item.optString("uri")
                if (uri.isNotBlank()) {
                    add(
                        LocalModelRecord(
                            uri = uri,
                            name = item.optString("name", Uri.parse(uri).lastPathSegment ?: "model"),
                            active = uri == active
                        )
                    )
                }
            }
        }
    }

    fun importModel(uri: Uri, name: String = uri.lastPathSegment ?: "local-model.gguf") {
        val records = listModels().filterNot { it.uri == uri.toString() } +
            LocalModelRecord(uri.toString(), name, active = false)
        saveModels(records)
        if (prefs.getString(KEY_ACTIVE, null) == null) {
            setActive(uri.toString())
        }
    }

    fun deleteModel(uri: String) {
        val next = listModels().filterNot { it.uri == uri }
        saveModels(next)
        if (prefs.getString(KEY_ACTIVE, null) == uri) {
            prefs.edit().remove(KEY_ACTIVE).apply()
        }
    }

    fun setActive(uri: String) {
        prefs.edit().putString(KEY_ACTIVE, uri).apply()
    }

    fun activeModel(): LocalModelRecord? = listModels().firstOrNull { it.active }

    fun configured(): Boolean = activeModel() != null

    fun runtimeStatus(): LocalModelRuntimeStatus {
        val models = listModels()
        val backend = detectBackend()
        val active = activeModel()
        val ready = backend != LocalModelBackend.MISSING && active != null
        return LocalModelRuntimeStatus(
            backend = backend,
            ready = ready,
            activeModel = active,
            importedModels = models,
            detail = when {
                backend == LocalModelBackend.MISSING -> "Local inference backend not linked yet."
                active == null -> "A local inference backend appears linked, but no model file is active."
                else -> "Local inference backend ${backend.label} is available for ${active.name}."
            },
            supportedFormats = listOf("GGUF for llama.cpp", "ONNX models if ONNX Runtime Mobile is linked", "TFLite/LiteRT models if LiteRT is linked"),
            nextSteps = "Link a real native backend such as llama.cpp JNI, ONNX Runtime Mobile, or LiteRT/TFLite, then map imported SAF model files into that runtime. Until then, imported model files are tracked but not executed."
        )
    }

    fun testPrompt(prompt: String): Result<String> {
        val status = runtimeStatus()
        val active = status.activeModel ?: return Result.failure(
            IllegalStateException("No local model file is active.")
        )
        if (!status.ready) {
            return Result.failure(
                IllegalStateException("Model file exists, but no runtime backend is available.")
            )
        }
        return Result.failure(
            IllegalStateException("Local backend ${status.backend.label} is detected, but the inference adapter is not implemented for ${active.name}.")
        )
    }

    private fun saveModels(records: List<LocalModelRecord>) {
        val array = JSONArray()
        records.forEach { record ->
            array.put(
                org.json.JSONObject()
                    .put("uri", record.uri)
                    .put("name", record.name)
            )
        }
        prefs.edit().putString(KEY_MODELS, array.toString()).apply()
    }

    private fun detectBackend(): LocalModelBackend {
        return when {
            classExists("org.tensorflow.lite.Interpreter") -> LocalModelBackend.LITERT
            classExists("ai.onnxruntime.OrtEnvironment") -> LocalModelBackend.ONNX
            classExists("com.kizek.phoneagent.models.llama.LlamaNative") -> LocalModelBackend.LLAMA_GGUF
            else -> LocalModelBackend.MISSING
        }
    }

    private fun classExists(name: String): Boolean = runCatching {
        Class.forName(name)
    }.isSuccess

    companion object {
        private const val KEY_MODELS = "models"
        private const val KEY_ACTIVE = "active_model"
    }
}
