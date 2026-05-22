package com.kizek.phoneagent.runtime

import android.content.Context
import com.kizek.phoneagent.container.ProotManager
import com.kizek.phoneagent.sync.OrchestratorClient
import com.kizek.phoneagent.tools.ContainerTools
import com.kizek.phoneagent.tools.ShellTools
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray

enum class ExecutionRuntime(val id: String, val label: String) {
    APP_SHELL("app_shell", "App shell"),
    BUILT_IN_PROOT("built_in_proot", "Built-in PRoot"),
    TERMUX_BRIDGE("termux_bridge", "Termux bridge"),
    SSH_AGENT("ssh_agent", "SSH agent"),
    REMOTE_ORCHESTRATOR("remote_orchestrator", "Laptop/server orchestrator");

    companion object {
        fun fromId(id: String): ExecutionRuntime = entries.firstOrNull { it.id == id } ?: APP_SHELL
    }
}

data class RuntimeEndpointStatus(
    val runtime: ExecutionRuntime,
    val ready: Boolean,
    val status: String,
    val detail: String
)

data class ExecutionAttempt(
    val runtime: ExecutionRuntime,
    val success: Boolean,
    val summary: String,
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int? = null
)

data class ExecutionRouteResult(
    val selectedRuntime: ExecutionRuntime?,
    val reason: String,
    val attempts: List<ExecutionAttempt>,
    val success: Boolean,
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int? = null
) {
    fun details(): String {
        return buildString {
            appendLine("selectedRuntime=${selectedRuntime?.label ?: "none"}")
            appendLine("reason=$reason")
            appendLine("attempts:")
            attempts.forEachIndexed { index, attempt ->
                appendLine("${index + 1}. ${attempt.runtime.label}: success=${attempt.success}, exit=${attempt.exitCode}, ${attempt.summary}")
                if (attempt.stdout.isNotBlank()) appendLine("stdout: ${attempt.stdout.trimEnd()}")
                if (attempt.stderr.isNotBlank()) appendLine("stderr: ${attempt.stderr.trimEnd()}")
            }
        }.trimEnd()
    }
}

class ExecutionRouteManager(
    context: Context,
    private val shellTools: ShellTools,
    private val containerTools: ContainerTools,
    private val prootManager: ProotManager,
    private val termuxBridgeManager: TermuxBridgeManager,
    private val sshAgentManager: SshAgentManager,
    private val orchestratorClient: OrchestratorClient
) {
    private val prefs = context.applicationContext.getSharedPreferences("phone_agent_execution_route", Context.MODE_PRIVATE)

    fun fallbackOrder(): List<ExecutionRuntime> {
        val stored = prefs.getString(KEY_ORDER, null) ?: return DEFAULT_ORDER
        val array = JSONArray(stored)
        return buildList {
            for (index in 0 until array.length()) {
                add(ExecutionRuntime.fromId(array.optString(index)))
            }
        }.distinct().ifEmpty { DEFAULT_ORDER }
    }

    fun saveFallbackOrder(order: List<ExecutionRuntime>) {
        val sanitized = order.distinct().ifEmpty { DEFAULT_ORDER }
        prefs.edit().putString(KEY_ORDER, JSONArray(sanitized.map { it.id }).toString()).apply()
    }

    fun resetFallbackOrder() {
        prefs.edit().remove(KEY_ORDER).apply()
    }

    suspend fun status(): List<RuntimeEndpointStatus> {
        val proot = prootManager.status()
        val termux = termuxBridgeManager.status()
        val ssh = sshAgentManager.status()
        val remote = orchestratorClient.getStatus()
        return listOf(
            RuntimeEndpointStatus(
                ExecutionRuntime.APP_SHELL,
                ready = true,
                status = "ready",
                detail = "Android app-private /system/bin/sh is available for limited commands in the workspace."
            ),
            RuntimeEndpointStatus(
                ExecutionRuntime.BUILT_IN_PROOT,
                ready = proot.installed,
                status = when {
                    proot.installed -> "ready"
                    proot.prootPresent && proot.rootfsPresent && !proot.lastTestPassed -> "blocked"
                    proot.prootPresent || proot.rootfsPresent -> "incomplete"
                    else -> "missing"
                },
                detail = proot.detail
            ),
            RuntimeEndpointStatus(
                ExecutionRuntime.TERMUX_BRIDGE,
                ready = termux.configured && termux.connected,
                status = when {
                    termux.configured && termux.connected -> "connected"
                    termux.configured -> "configured"
                    termux.installed -> "not configured"
                    else -> "not installed"
                },
                detail = termux.detail
            ),
            RuntimeEndpointStatus(
                ExecutionRuntime.SSH_AGENT,
                ready = ssh.configuredTargets > 0 && ssh.lastStatus == "connected",
                status = if (ssh.configuredTargets == 0) "not configured" else ssh.lastStatus,
                detail = "targets=${ssh.configuredTargets}, fallback=${ssh.fallbackTargets}, lastError=${ssh.lastError.ifBlank { "none" }}"
            ),
            RuntimeEndpointStatus(
                ExecutionRuntime.REMOTE_ORCHESTRATOR,
                ready = remote.isSuccess,
                status = if (remote.isSuccess) "connected" else "offline",
                detail = remote.exceptionOrNull()?.message ?: "Remote orchestrator reachable at ${orchestratorClient.baseUrl}"
            )
        )
    }

    suspend fun chooseRuntime(command: String): RuntimeEndpointStatus? {
        val statuses = status().associateBy { it.runtime }
        return fallbackOrder().firstNotNullOfOrNull { runtime ->
            statuses[runtime]?.takeIf { endpoint ->
                when (runtime) {
                    ExecutionRuntime.APP_SHELL -> true
                    ExecutionRuntime.BUILT_IN_PROOT -> endpoint.ready
                    ExecutionRuntime.TERMUX_BRIDGE -> endpoint.ready || termuxBridgeManager.settings().fallbackEnabled
                    ExecutionRuntime.SSH_AGENT -> sshAgentManager.fallbackTarget() != null
                    ExecutionRuntime.REMOTE_ORCHESTRATOR -> endpoint.ready
                }
            }
        }
    }

    suspend fun runCommand(command: String, allowRemoteRequest: Boolean = false): ExecutionRouteResult {
        val attempts = mutableListOf<ExecutionAttempt>()
        val statuses = status().associateBy { it.runtime }
        for (runtime in fallbackOrder()) {
            val endpoint = statuses[runtime]
            if (endpoint == null) continue
            when (runtime) {
                ExecutionRuntime.APP_SHELL -> {
                    val result = shellTools.exec(command)
                    attempts += ExecutionAttempt(
                        runtime,
                        result.exitCode == 0 && !result.timedOut,
                        if (result.timedOut) "App shell timed out." else "App shell exited with ${result.exitCode}.",
                        result.stdout,
                        result.stderr,
                        result.exitCode
                    )
                    if (result.exitCode == 0 && !result.timedOut) {
                        return ExecutionRouteResult(runtime, "App shell is first in fallback order and completed the command.", attempts, true, result.stdout, result.stderr, result.exitCode)
                    }
                }
                ExecutionRuntime.BUILT_IN_PROOT -> {
                    if (!endpoint.ready) {
                        attempts += ExecutionAttempt(runtime, false, endpoint.detail)
                        continue
                    }
                    val result = withContext(Dispatchers.IO) { containerTools.exec(command) }
                    attempts += ExecutionAttempt(
                        runtime,
                        result.exitCode == 0 && !result.timedOut,
                        if (result.timedOut) "Built-in PRoot timed out." else "Built-in PRoot exited with ${result.exitCode}.",
                        result.output,
                        result.error.orEmpty(),
                        result.exitCode
                    )
                    if (result.exitCode == 0 && !result.timedOut) {
                        return ExecutionRouteResult(runtime, "Built-in PRoot was ready and completed the command.", attempts, true, result.output, result.error.orEmpty(), result.exitCode)
                    }
                }
                ExecutionRuntime.TERMUX_BRIDGE -> {
                    if (!termuxBridgeManager.settings().fallbackEnabled && !endpoint.ready) {
                        attempts += ExecutionAttempt(runtime, false, endpoint.detail)
                        continue
                    }
                    val result = termuxBridgeManager.exec(command)
                    attempts += ExecutionAttempt(runtime, result.success, "Termux SSH exited with ${result.exitCode}. ${result.warning}".trim(), result.stdout, result.stderr, result.exitCode)
                    if (result.success) {
                        return ExecutionRouteResult(runtime, "Termux bridge fallback completed the command.", attempts, true, result.stdout, result.stderr, result.exitCode)
                    }
                }
                ExecutionRuntime.SSH_AGENT -> {
                    val target = sshAgentManager.fallbackTarget()
                    if (target == null) {
                        attempts += ExecutionAttempt(runtime, false, "No SSH fallback target is configured.")
                        continue
                    }
                    val result = sshAgentManager.exec(target.id, command)
                    attempts += ExecutionAttempt(runtime, result.success, "SSH target ${target.name} exited with ${result.exitCode}. ${result.warning}".trim(), result.stdout, result.stderr, result.exitCode)
                    if (result.success) {
                        return ExecutionRouteResult(runtime, "SSH fallback target ${target.name} completed the command.", attempts, true, result.stdout, result.stderr, result.exitCode)
                    }
                }
                ExecutionRuntime.REMOTE_ORCHESTRATOR -> {
                    if (!endpoint.ready) {
                        attempts += ExecutionAttempt(runtime, false, endpoint.detail)
                        continue
                    }
                    if (!allowRemoteRequest) {
                        attempts += ExecutionAttempt(runtime, false, "Remote orchestrator is reachable, but command execution needs explicit user choice.")
                        continue
                    }
                    val prompt = "Run this command on the configured remote worker and report exact stdout, stderr, exit code, and whether it succeeded. Do not claim success unless a tool result proves it.\n\n$command"
                    val remote = orchestratorClient.sendAdHocPrompt(prompt)
                    attempts += ExecutionAttempt(
                        runtime,
                        false,
                        remote.fold(
                            onSuccess = { "Remote request sent; local command success is unverified. Remote said: ${it.take(500)}" },
                            onFailure = { "Remote request failed: ${it.message}" }
                        )
                    )
                }
            }
        }
        return ExecutionRouteResult(
            selectedRuntime = attempts.lastOrNull()?.runtime,
            reason = "All configured runtimes failed or need explicit remote approval. No command success is claimed.",
            attempts = attempts,
            success = false,
            stdout = attempts.lastOrNull()?.stdout.orEmpty(),
            stderr = attempts.lastOrNull()?.stderr.orEmpty(),
            exitCode = attempts.lastOrNull()?.exitCode
        )
    }

    fun installSummary(): String {
        return fallbackOrder().mapIndexed { index, runtime -> "${index + 1}. ${runtime.label}" }.joinToString("\n")
    }

    companion object {
        private const val KEY_ORDER = "fallback_order"
        val DEFAULT_ORDER = listOf(
            ExecutionRuntime.APP_SHELL,
            ExecutionRuntime.BUILT_IN_PROOT,
            ExecutionRuntime.TERMUX_BRIDGE,
            ExecutionRuntime.SSH_AGENT,
            ExecutionRuntime.REMOTE_ORCHESTRATOR
        )
    }
}
