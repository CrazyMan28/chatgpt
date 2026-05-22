package com.kizek.phoneagent.core

import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.storage.ApprovalEntity
import java.util.UUID

class ApprovalManager(private val database: AppDatabase) {
    suspend fun request(
        sessionId: String,
        action: String,
        tool: String,
        risk: String,
        worker: WorkerMode,
        reason: String,
        target: String
    ): ApprovalEntity {
        val approval = ApprovalEntity(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            action = action,
            tool = tool,
            risk = risk,
            worker = worker.id,
            scope = "once",
            reason = reason,
            target = target,
            status = "pending",
            createdAt = System.currentTimeMillis()
        )
        database.approvals().upsert(approval)
        return approval
    }

    suspend fun approve(id: String, scope: String): ApprovalEntity? {
        val approval = database.approvals().get(id) ?: return null
        val updated = approval.copy(status = "approved", scope = scope)
        database.approvals().upsert(updated)
        return updated
    }

    suspend fun reject(id: String): ApprovalEntity? {
        val approval = database.approvals().get(id) ?: return null
        val updated = approval.copy(status = "rejected")
        database.approvals().upsert(updated)
        return updated
    }
}
