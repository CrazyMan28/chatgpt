package com.kizek.phoneagent.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.SubsystemStatusCard

@Composable
fun HomeDashboardScreen(
    app: PhoneAgentApplication,
    remoteStatus: String,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var modelStatus by remember { mutableStateOf("checking") }
    LaunchedEffect(Unit) {
        modelStatus = app.modelRouter.states().joinToString("\n") {
            "${it.label}: ${if (it.available) "available" else "not available"} (${it.selectedModel})"
        }
    }
    val notifications = if (Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    ) "Ready" else "Missing permission"
    val proot = app.prootManager.status()
    val termux = app.termuxBridgeManager.status()
    val ssh = app.sshAgentManager.status()
    val fallback = app.executionRouteManager.installSummary()
    val workspace = app.workspaceManager.status()
    val screen = app.screenCaptureManager.status()
    val voice = app.voiceManager.status()

    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                GlassCard(
                    title = "Phone Agent",
                    subtitle = "Local and remote AI control status at a glance.",
                    icon = "AI",
                    status = "Dashboard"
                ) {
                    Text(
                        "Tap a subsystem for details. Setup-needed cards keep their real limitations visible.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            item { DashboardHeading("Core") }
            item {
                SubsystemStatusCard(
                    title = "Runtime",
                    status = "Ready",
                    detail = "App shell: ready/limited\nPRoot: ${if (proot.installed) "ready" else if (proot.prootPresent && proot.rootfsPresent) "blocked" else "missing"}\nTermux: ${if (termux.connected) "connected" else if (termux.configured) "configured" else "not configured"}\nSSH: ${if (ssh.configuredTargets > 0) ssh.lastStatus else "not configured"}\nFallback:\n$fallback",
                    onDetails = { onDetails("Runtime", app.runtime.toolRegistry.builtInTools().joinToString("\n")) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Model Providers",
                    status = if (app.modelRouter.mistral.isConfigured()) "Mistral configured" else "Mistral missing",
                    detail = "Mistral: ${if (app.modelRouter.mistral.isConfigured()) "configured" else "missing"}\nLocal model: ${app.localModelManager.runtimeStatus().detail}\nRemote model: ${if (remoteStatus.startsWith("connected")) "connected" else "offline"}\n$modelStatus",
                    onDetails = { onDetails("Model provider", modelStatus) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Remote Orchestrator",
                    status = remoteStatus.substringBefore(":").ifBlank { remoteStatus },
                    detail = remoteStatus,
                    onDetails = { onDetails("Remote orchestrator", remoteStatus) }
                )
            }
            item { DashboardHeading("Phone") }
            item {
                SubsystemStatusCard(
                    title = "Voice",
                    status = if (voice.voiceEnabled) "Ready" else "Setup needed",
                    detail = voice.detail,
                    onDetails = { onDetails("Voice", voice.detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Assistant Mode",
                    status = if (app.assistantManager.status().bubbleEnabled) "Ready" else "Setup needed",
                    detail = app.assistantManager.status().detail,
                    onDetails = { onDetails("Assistant Mode", app.assistantManager.status().detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Accessibility",
                    status = if (PhoneAccessibilityService.instance == null) "Missing permission" else "Ready",
                    detail = app.accessibilityTools.status(),
                    onDetails = { onDetails("Accessibility", app.accessibilityTools.status()) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Screen Capture",
                    status = if (screen.configured) "Ready" else "Missing permission",
                    detail = screen.detail,
                    onDetails = { onDetails("Screen capture", screen.detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Notifications",
                    status = notifications,
                    detail = "Foreground-service notifications are used for visible long-running phone-local work.",
                    onDetails = { onDetails("Notifications", notifications) }
                )
            }
            item { DashboardHeading("Workspace") }
            item {
                SubsystemStatusCard(
                    title = "Workspace",
                    status = if (workspace.ready) "Ready" else "Setup needed",
                    detail = "${workspace.label}: ${workspace.detail}",
                    onDetails = { onDetails("Workspace", workspace.detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Container Fallbacks",
                    status = if (proot.installed || termux.connected || ssh.configuredTargets > 0) "Configured" else "Setup needed",
                    detail = "Built-in PRoot: ${if (proot.installed) "ready" else proot.detail}\nTermux fallback: ${termux.detail}\nSSH fallback: targets=${ssh.configuredTargets}, last=${ssh.lastStatus}",
                    onDetails = { onDetails("Container and fallbacks", "PRoot:\n${proot.detail}\n\nTermux:\n${termux.detail}\n\nSSH:\ntargets=${ssh.configuredTargets}\nlast=${ssh.lastStatus}\n${ssh.lastError}") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Local MCP",
                    status = if (proot.installed) "Scaffolded" else "Blocked",
                    detail = app.mcpTools.localStatus(),
                    onDetails = { onDetails("Local MCP", app.mcpTools.localStatus()) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Local Model",
                    status = if (app.localModelManager.runtimeStatus().ready) "Ready" else "Runtime missing",
                    detail = app.localModelManager.runtimeStatus().detail,
                    onDetails = { onDetails("Local Model", app.localModelManager.runtimeStatus().nextSteps) }
                )
            }
        }
    }
}

@Composable
private fun DashboardHeading(title: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    }
}
