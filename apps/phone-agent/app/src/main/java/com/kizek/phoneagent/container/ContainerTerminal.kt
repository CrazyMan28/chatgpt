package com.kizek.phoneagent.container

class ContainerTerminal(
    private val prootManager: ProotManager
) {
    private val logLines = mutableListOf<String>()

    fun exec(command: String): ContainerCommandResult {
        val result = prootManager.startSession().run(command)
        logLines += "$ ${result.command}"
        if (result.invocation.isNotBlank()) logLines += "invocation: ${result.invocation}"
        result.output.takeIf { it.isNotBlank() }?.let { logLines += it }
        result.error?.takeIf { it.isNotBlank() }?.let { logLines += "error: $it" }
        return result
    }

    fun test(): ContainerCommandResult {
        val result = prootManager.testCommand()
        logLines += "$ container_test"
        if (result.invocation.isNotBlank()) logLines += "invocation: ${result.invocation}"
        result.output.takeIf { it.isNotBlank() }?.let { logLines += it }
        result.error?.takeIf { it.isNotBlank() }?.let { logLines += "error: $it" }
        return result
    }

    fun logs(): List<String> = logLines.toList()

    fun clear() {
        logLines.clear()
    }
}
