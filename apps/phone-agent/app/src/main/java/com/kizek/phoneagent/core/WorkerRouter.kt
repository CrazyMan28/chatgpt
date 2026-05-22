package com.kizek.phoneagent.core

import com.kizek.phoneagent.container.ProotManager
import com.kizek.phoneagent.runtime.ExecutionRouteManager

class WorkerRouter(
    private val prootManager: ProotManager,
    private val executionRouteManager: ExecutionRouteManager
) {
    fun routeForTool(toolName: String, selected: WorkerMode): WorkerMode {
        if (selected != WorkerMode.HYBRID) return selected
        return when {
            toolName.startsWith("phone_") -> WorkerMode.PHONE_LOCAL
            toolName.startsWith("desktop_") -> WorkerMode.LAPTOP
            toolName == "container_exec" && prootManager.status().installed -> WorkerMode.PHONE_LOCAL
            toolName == "container_exec" -> WorkerMode.LAPTOP
            toolName == "termux_exec" || toolName.startsWith("ssh_") || toolName.startsWith("execution_") -> WorkerMode.HYBRID
            toolName.contains("build", ignoreCase = true) -> WorkerMode.LAPTOP
            else -> WorkerMode.HYBRID
        }
    }
}
