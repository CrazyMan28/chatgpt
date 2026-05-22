package com.kizek.phoneagent.core

import org.json.JSONObject

data class PhoneToolResult(
    val tool: String,
    val success: Boolean,
    val summary: String,
    val details: String = "",
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int? = null,
    val errorType: String? = null,
    val errorMessage: String? = null,
    val approvalId: String? = null,
    val workerUsed: String = WorkerMode.PHONE_LOCAL.id,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject {
        return JSONObject()
            .put("tool", tool)
            .put("success", success)
            .put("summary", summary)
            .put("details", details)
            .put("stdout", stdout)
            .put("stderr", stderr)
            .put("exitCode", exitCode)
            .put("errorType", errorType)
            .put("errorMessage", errorMessage)
            .put("approvalId", approvalId)
            .put("workerUsed", workerUsed)
            .put("timestamp", timestamp)
    }

    fun detailsText(): String {
        return buildString {
            appendLine("summary: $summary")
            appendLine("success: $success")
            appendLine("worker: $workerUsed")
            appendLine("timestamp: $timestamp")
            approvalId?.let { appendLine("approval: $it") }
            exitCode?.let { appendLine("exitCode: $it") }
            if (stdout.isNotBlank()) {
                appendLine()
                appendLine("stdout:")
                appendLine(stdout.trimEnd())
            }
            if (stderr.isNotBlank()) {
                appendLine()
                appendLine("stderr:")
                appendLine(stderr.trimEnd())
            }
            if (details.isNotBlank()) {
                appendLine()
                appendLine("details:")
                appendLine(details.trimEnd())
            }
            if (errorType != null || errorMessage != null) {
                appendLine()
                appendLine("errorType: ${errorType ?: "unknown"}")
                appendLine("errorMessage: ${errorMessage ?: ""}")
            }
        }.trimEnd()
    }

    companion object {
        fun ok(
            tool: String,
            summary: String,
            details: String = "",
            stdout: String = "",
            stderr: String = "",
            exitCode: Int? = null,
            workerUsed: String = WorkerMode.PHONE_LOCAL.id
        ): PhoneToolResult {
            return PhoneToolResult(
                tool = tool,
                success = true,
                summary = summary,
                details = details,
                stdout = stdout,
                stderr = stderr,
                exitCode = exitCode,
                workerUsed = workerUsed
            )
        }

        fun blocked(
            tool: String,
            summary: String,
            approvalId: String,
            details: String = "",
            workerUsed: String = WorkerMode.PHONE_LOCAL.id
        ): PhoneToolResult {
            return PhoneToolResult(
                tool = tool,
                success = false,
                summary = summary,
                details = details,
                errorType = "approval_required",
                errorMessage = summary,
                approvalId = approvalId,
                workerUsed = workerUsed
            )
        }

        fun fail(
            tool: String,
            summary: String,
            errorType: String = "tool_error",
            errorMessage: String = summary,
            details: String = "",
            stdout: String = "",
            stderr: String = "",
            exitCode: Int? = null,
            workerUsed: String = WorkerMode.PHONE_LOCAL.id
        ): PhoneToolResult {
            return PhoneToolResult(
                tool = tool,
                success = false,
                summary = summary,
                details = details,
                stdout = stdout,
                stderr = stderr,
                exitCode = exitCode,
                errorType = errorType,
                errorMessage = errorMessage,
                workerUsed = workerUsed
            )
        }
    }
}
