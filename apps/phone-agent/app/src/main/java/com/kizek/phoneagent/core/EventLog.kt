package com.kizek.phoneagent.core

import com.kizek.phoneagent.storage.EventEntity
import com.kizek.phoneagent.storage.AppDatabase
import java.util.UUID

class EventLog(private val database: AppDatabase) {
    suspend fun append(
        sessionId: String,
        type: String,
        author: String,
        summary: String,
        payload: String = "{}"
    ): EventEntity {
        val normalizedSummary = summary.trim().trim('.', '!', '?')
        val safeSummary = if (author == "assistant" && normalizedSummary.equals("Message Added", ignoreCase = true)) {
            "Done."
        } else {
            summary
        }
        val event = EventEntity(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            type = type,
            author = author,
            summary = safeSummary,
            payload = payload,
            createdAt = System.currentTimeMillis()
        )
        database.events().insert(event)
        return event
    }

    suspend fun forSession(sessionId: String): List<EventEntity> {
        return database.events().listForSession(sessionId)
    }
}
