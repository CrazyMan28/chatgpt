package com.kizek.phoneagent.core

import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.storage.TaskEntity
import java.util.UUID

class TaskQueue(private val database: AppDatabase) {
    suspend fun start(sessionId: String, title: String, worker: WorkerMode): TaskEntity {
        val now = System.currentTimeMillis()
        val task = TaskEntity(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            title = title,
            state = "running",
            step = "Queued on ${worker.label}",
            worker = worker.id,
            createdAt = now,
            updatedAt = now
        )
        database.tasks().upsert(task)
        return task
    }

    suspend fun update(task: TaskEntity, state: String, step: String): TaskEntity {
        val updated = task.copy(
            state = state,
            step = step,
            updatedAt = System.currentTimeMillis()
        )
        database.tasks().upsert(updated)
        return updated
    }

    suspend fun pause(id: String) = mutate(id, "paused", "Paused by user")
    suspend fun resume(id: String) = mutate(id, "running", "Resumed by user")
    suspend fun cancel(id: String) = mutate(id, "cancelled", "Cancelled by user")
    suspend fun retry(id: String) = mutate(id, "running", "Retry requested")

    private suspend fun mutate(id: String, state: String, step: String): TaskEntity? {
        val task = database.tasks().get(id) ?: return null
        return update(task, state, step)
    }
}
