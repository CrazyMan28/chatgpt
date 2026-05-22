package com.kizek.phoneagent.core

import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.storage.MemoryEntity

class MemoryStore(private val database: AppDatabase) {
    suspend fun remember(key: String, value: String) {
        database.memory().upsert(
            MemoryEntity(
                key = key,
                value = value,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun get(key: String): MemoryEntity? = database.memory().get(key)

    suspend fun search(query: String): List<MemoryEntity> = database.memory().search(query)
}
