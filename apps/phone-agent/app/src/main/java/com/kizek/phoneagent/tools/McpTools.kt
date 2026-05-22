package com.kizek.phoneagent.tools

import com.kizek.phoneagent.sync.OrchestratorClient

class McpTools(
    private val orchestratorClient: OrchestratorClient,
    private val containerTools: ContainerTools
) {
    suspend fun remoteStatus(): String {
        return orchestratorClient.getStatus().fold(
            onSuccess = { "Remote MCP can be accessed through the orchestrator when configured." },
            onFailure = { "Remote MCP unavailable: ${it.message ?: "orchestrator offline"}" }
        )
    }

    fun localStatus(): String {
        val status = containerTools.status()
        return if (status.installed && status.lastTestPassed) {
            "Local MCP container prerequisite is ready. Stdio/http JSON-RPC bridge is not linked yet; define and test MCP commands through the container console before enabling tool calls."
        } else {
            "Local MCP blocked: container not ready. ${status.detail}"
        }
    }

    fun startLocal(command: String): String {
        val status = containerTools.status()
        if (!status.installed || !status.lastTestPassed) {
            return "Local MCP blocked: container not ready. ${status.detail}"
        }
        if (command.isBlank()) {
            return "Local MCP command is missing. Provide an MCP server command that can run inside the container."
        }
        val result = containerTools.exec("command -v sh >/dev/null && echo mcp-command-accepted")
        return if (result.exitCode == 0) {
            "Container can run commands, but the MCP JSON-RPC bridge is not implemented in this APK. Command saved/tested externally: $command"
        } else {
            "Container command test failed; MCP not started. ${result.error ?: result.output}"
        }
    }
}
