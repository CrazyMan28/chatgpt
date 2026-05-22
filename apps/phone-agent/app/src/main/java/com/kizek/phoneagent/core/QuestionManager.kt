package com.kizek.phoneagent.core

import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.storage.QuestionEntity
import java.util.UUID

class QuestionManager(private val database: AppDatabase) {
    suspend fun ask(
        sessionId: String,
        prompt: String,
        type: String,
        options: List<String>,
        title: String = prompt.substringBefore('\n').ifBlank { "Question" },
        description: String = prompt.substringAfter('\n', "").trim(),
        allowCustom: Boolean = type.contains("free", ignoreCase = true) ||
            options.isEmpty() ||
            options.any { it.contains("something else", ignoreCase = true) || it.contains("custom", ignoreCase = true) },
        allowSkip: Boolean = true,
        source: String = "runtime",
        relatedTaskId: String? = null,
        relatedStepIndex: Int = -1
    ): QuestionEntity {
        val now = System.currentTimeMillis()
        val question = QuestionEntity(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            prompt = prompt,
            title = title,
            description = description,
            type = type,
            optionsCsv = options.joinToString("|"),
            allowCustom = allowCustom,
            allowSkip = allowSkip,
            source = source,
            relatedTaskId = relatedTaskId,
            relatedStepIndex = relatedStepIndex,
            answer = null,
            status = "pending",
            state = "pending",
            createdAt = now,
            answeredAt = null
        )
        database.questions().upsert(question)
        return question
    }

    suspend fun answer(id: String, answer: String): QuestionEntity? {
        val question = database.questions().get(id) ?: return null
        val updated = question.copy(
            answer = answer,
            status = "answered",
            state = "answered",
            answeredAt = System.currentTimeMillis()
        )
        database.questions().upsert(updated)
        return updated
    }

    suspend fun skip(id: String): QuestionEntity? {
        val question = database.questions().get(id) ?: return null
        val updated = question.copy(
            answer = null,
            status = "skipped",
            state = "skipped",
            answeredAt = System.currentTimeMillis()
        )
        database.questions().upsert(updated)
        return updated
    }
}
