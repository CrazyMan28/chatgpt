package com.kizek.phoneagent.storage

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memory WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): MemoryEntity?

    @Query("SELECT * FROM memory WHERE value LIKE '%' || :query || '%' OR `key` LIKE '%' || :query || '%' ORDER BY updatedAt DESC LIMIT 50")
    suspend fun search(query: String): List<MemoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(memory: MemoryEntity)
}
