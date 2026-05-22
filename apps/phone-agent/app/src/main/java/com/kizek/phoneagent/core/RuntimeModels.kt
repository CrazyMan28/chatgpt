package com.kizek.phoneagent.core

enum class WorkerMode(val id: String, val label: String) {
    PHONE_LOCAL("phone-local", "Run on phone"),
    LAPTOP("laptop", "Run on laptop"),
    SERVER("server", "Run on server"),
    HYBRID("hybrid-auto", "Hybrid auto");

    companion object {
        fun fromId(id: String): WorkerMode = entries.firstOrNull { it.id == id } ?: HYBRID
    }
}

data class RuntimeSnapshot(
    val sessions: List<com.kizek.phoneagent.storage.SessionEntity>,
    val events: List<com.kizek.phoneagent.storage.EventEntity>,
    val tasks: List<com.kizek.phoneagent.storage.TaskEntity>,
    val approvals: List<com.kizek.phoneagent.storage.ApprovalEntity>,
    val questions: List<com.kizek.phoneagent.storage.QuestionEntity>,
    val selectedSessionId: String?,
    val consoleLines: List<String>,
    val remoteStatus: String
)

data class WorkerCapability(
    val workerId: String,
    val type: String,
    val status: String,
    val capabilities: List<String>
)
