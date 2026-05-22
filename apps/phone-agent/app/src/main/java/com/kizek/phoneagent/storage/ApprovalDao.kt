package com.kizek.phoneagent.storage

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ApprovalDao {
    @Query("SELECT * FROM approvals ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<ApprovalEntity>>

    @Query("SELECT * FROM approvals ORDER BY createdAt DESC")
    suspend fun listAll(): List<ApprovalEntity>

    @Query("SELECT * FROM approvals WHERE status = 'pending' ORDER BY createdAt DESC")
    suspend fun pending(): List<ApprovalEntity>

    @Query("SELECT * FROM approvals WHERE id = :id LIMIT 1")
    suspend fun get(id: String): ApprovalEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(approval: ApprovalEntity)
}
