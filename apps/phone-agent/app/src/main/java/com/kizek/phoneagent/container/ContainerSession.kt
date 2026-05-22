package com.kizek.phoneagent.container

data class ContainerCommandResult(
    val command: String,
    val exitCode: Int?,
    val output: String,
    val error: String?,
    val durationMs: Long = 0L,
    val timedOut: Boolean = false,
    val invocation: String = ""
)

data class ContainerInstallResult(
    val success: Boolean,
    val summary: String,
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int? = null,
    val error: String? = null,
    val details: String = ""
)

class ContainerSession(
    private val status: ProotStatus,
    private val prootManager: ProotManager
) {
    fun run(command: String): ContainerCommandResult {
        if (!status.installed) {
            return ContainerCommandResult(
                command = command,
                exitCode = null,
                output = "",
                error = status.detail,
                invocation = "blocked"
            )
        }
        return prootManager.runCommand(command)
    }
}
