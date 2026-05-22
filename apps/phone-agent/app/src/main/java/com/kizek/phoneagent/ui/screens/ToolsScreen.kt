package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.SubsystemStatusCard

@Composable
fun ToolsScreen(
    app: PhoneAgentApplication,
    onOpenSecondary: (String) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val containerStatus = app.containerTools.status()
    val workspace = app.workspaceManager.status()
    val screen = app.screenCaptureManager.status()
    val voice = app.voiceManager.status()
    val assistant = app.assistantManager.status()
    val localModel = app.localModelManager.runtimeStatus()
    val termux = app.termuxBridgeManager.status()
    val ssh = app.sshAgentManager.status()
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                GlassCard(
                    title = "Capability center",
                    subtitle = "Every phone, local, and remote capability stays visible with setup and test entry points.",
                    icon = "RUN",
                    status = "Ready"
                ) {
                    QuickLinks(onOpenSecondary)
                }
            }
            section("Agent")
            item {
                SubsystemStatusCard(
                    title = "Runtime",
                    status = "Ready",
                    detail = "Room store, task queue, approvals, questions, local tools, and worker routing are active.",
                    actionLabel = "Sessions",
                    onAction = { onOpenSecondary("sessions") },
                    onDetails = {
                        onDetails(
                            "Runtime",
                            app.runtime.toolRegistry.phoneCapabilities.capabilities.joinToString("\n")
                        )
                    }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Approvals and questions",
                    status = "Ready",
                    detail = "Pending user decisions appear in chat as polished cards and bottom sheets.",
                    actionLabel = "Open",
                    onAction = { onOpenSecondary("approvals") },
                    onDetails = { onDetails("Approvals and questions", "Approvals and questions are persisted in Room and mirrored to chat.") }
                )
            }
            section("Phone control")
            item {
                SubsystemStatusCard(
                    title = "Accessibility",
                    status = app.accessibilityTools.status().substringBefore(" / "),
                    detail = app.accessibilityTools.status(),
                    actionLabel = "Device",
                    onAction = { onOpenSecondary("device") },
                    onDetails = { onDetails("Accessibility", app.accessibilityTools.status()) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Screen",
                    status = if (screen.configured) "Ready" else "Permission needed",
                    detail = screen.detail,
                    actionLabel = "Device",
                    onAction = { onOpenSecondary("device") },
                    onDetails = { onDetails("Screen capture", screen.detail) }
                )
            }
            section("Voice")
            item {
                SubsystemStatusCard(
                    title = "Voice",
                    status = if (voice.voiceEnabled) "Ready" else "Setup needed",
                    detail = voice.detail,
                    actionLabel = "Voice",
                    onAction = { onOpenSecondary("voice") },
                    onDetails = { onDetails("Voice", voice.detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Assistant Mode",
                    status = if (assistant.bubbleEnabled) "Ready" else "Setup needed",
                    detail = assistant.detail,
                    actionLabel = "Assistant",
                    onAction = { onOpenSecondary("assistant") },
                    onDetails = { onDetails("Assistant Mode", assistant.detail) }
                )
            }
            section("Files and shell")
            item {
                SubsystemStatusCard(
                    title = "Files",
                    status = if (workspace.ready) "Ready" else "Setup needed",
                    detail = "${workspace.label}: ${workspace.detail}",
                    actionLabel = "Files",
                    onAction = { onOpenSecondary("files") },
                    onDetails = { onDetails("Workspace", workspace.detail) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "App shell",
                    status = "Ready",
                    detail = "${app.shellTools.status()} inside the app workspace.",
                    actionLabel = "Console",
                    onAction = { onOpenSecondary("console") },
                    onDetails = { onDetails("Shell", app.shellTools.logs().takeLast(40).joinToString("\n").ifBlank { app.shellTools.status() }) }
                )
            }
            section("AI Providers")
            item {
                SubsystemStatusCard(
                    title = "Mistral API",
                    status = if (app.modelRouter.mistral.isConfigured()) "configured" else "missing key",
                    detail = "${app.modelRouter.mistral.selectedModel} at ${app.modelRouter.mistral.baseUrl}",
                    actionLabel = "Mistral",
                    onAction = { onOpenSecondary("mistral") },
                    onDetails = { onDetails("Mistral", app.modelRouter.mistral.maskedApiKey()) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "OpenAI Compatible",
                    status = if (app.modelRouter.openAiCompatible.enabled) "configured" else "not configured",
                    detail = "${app.modelRouter.openAiCompatible.model} at ${app.modelRouter.openAiCompatible.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSecondary("openai-compatible") },
                    onDetails = { onDetails("OpenAI Compatible", app.modelRouter.openAiCompatible.maskedApiKey()) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Local HTTP",
                    status = if (app.modelRouter.localHttp.enabled) "configured" else "not configured",
                    detail = "${app.modelRouter.localHttp.endpointStyle.label}: ${app.modelRouter.localHttp.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSecondary("local-http") },
                    onDetails = { onDetails("Local HTTP", app.modelRouter.localHttp.baseUrl) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Ollama",
                    status = if (app.modelRouter.ollama.enabled) "configured" else "not configured",
                    detail = "${app.modelRouter.ollama.model} at ${app.modelRouter.ollama.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSecondary("ollama") },
                    onDetails = { onDetails("Ollama", app.modelRouter.ollama.baseUrl) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "AI fallback order",
                    status = if (app.modelRouter.fallbackEnabled) "enabled" else "disabled",
                    detail = app.modelRouter.fallbackOrder().joinToString(" > ") { it.name.lowercase().replace('_', '-') },
                    actionLabel = "Open",
                    onAction = { onOpenSecondary("provider-fallback") },
                    onDetails = { onDetails("AI fallback order", app.modelRouter.fallbackOrder().joinToString("\n") { it.name }) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Remote model",
                    status = if (app.pairingManager.orchestratorUrl.isNotBlank()) "configured" else "offline",
                    detail = app.pairingManager.orchestratorUrl.ifBlank { "No remote model/orchestrator configured." },
                    actionLabel = "Runtime",
                    onAction = { onOpenSecondary("runtime") },
                    onDetails = { onDetails("Remote model", app.pairingManager.orchestratorUrl.ifBlank { "Not configured." }) }
                )
            }
            section("Local Runtime")
            item {
                SubsystemStatusCard(
                    title = "Local model",
                    status = if (localModel.ready) "ready" else localModel.backend.label,
                    detail = localModel.detail,
                    actionLabel = "Local model",
                    onAction = { onOpenSecondary("local-model") },
                    onDetails = { onDetails("Local model", localModel.importedModels.joinToString("\n") { it.name }.ifBlank { "No imported local models." }) }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "App shell",
                    status = "ready",
                    detail = "${app.shellTools.status()} inside the app workspace.",
                    actionLabel = "Console",
                    onAction = { onOpenSecondary("console") },
                    onDetails = { onDetails("Shell", app.shellTools.logs().takeLast(40).joinToString("\n").ifBlank { app.shellTools.status() }) }
                )
            }
            section("PRoot")
            item {
                SubsystemStatusCard(
                    title = "Container",
                    status = if (containerStatus.installed) "Ready" else if (containerStatus.prootPresent && containerStatus.rootfsPresent) "Blocked" else "Missing assets",
                    detail = "Import PRoot and a rootfs to enable local Linux commands. ${containerStatus.detail}",
                    actionLabel = "PRoot settings",
                    onAction = { onOpenSecondary("container-settings") },
                    onDetails = { onDetails("Container", containerStatus.detail) }
                )
            }
            section("Termux")
            item {
                SubsystemStatusCard(
                    title = "Termux bridge",
                    status = if (termux.connected) "connected" else if (termux.configured) "configured" else "not configured",
                    detail = termux.detail,
                    actionLabel = "Termux",
                    onAction = { onOpenSecondary("termux") },
                    onDetails = { onDetails("Termux bridge", app.termuxBridgeManager.installHint()) }
                )
            }
            section("SSH Agents")
            item {
                SubsystemStatusCard(
                    title = "SSH targets",
                    status = if (ssh.configuredTargets > 0) ssh.lastStatus else "not configured",
                    detail = "targets=${ssh.configuredTargets}, fallbackTargets=${ssh.fallbackTargets}, lastError=${ssh.lastError.ifBlank { "none" }}",
                    actionLabel = "SSH",
                    onAction = { onOpenSecondary("ssh") },
                    onDetails = { onDetails("SSH targets", app.sshAgentManager.listTargets().joinToString("\n") { "${it.name}: ${it.username}@${it.host}:${it.port}" }.ifBlank { "No SSH targets." }) }
                )
            }
            section("Execution Fallback")
            item {
                SubsystemStatusCard(
                    title = "Fallback order",
                    status = "configured",
                    detail = app.executionRouteManager.installSummary(),
                    actionLabel = "Fallback",
                    onAction = { onOpenSecondary("fallback") },
                    onDetails = { onDetails("Execution fallback", app.executionRouteManager.installSummary()) }
                )
            }
            section("MCP")
            item {
                SubsystemStatusCard(
                    title = "MCP",
                    status = if (containerStatus.installed && containerStatus.lastTestPassed) "Ready" else "Scaffolded",
                    detail = "Local MCP requires a container bridge. Remote MCP routes through the orchestrator.",
                    actionLabel = "MCP",
                    onAction = { onOpenSecondary("mcp") },
                    onDetails = { onDetails("MCP", "remote=Checked from the MCP screen through the orchestrator.\nlocal=${app.mcpTools.localStatus()}") }
                )
            }
            section("Remote")
            item {
                SubsystemStatusCard(
                    title = "Remote orchestrator",
                    status = if (app.pairingManager.orchestratorUrl.isNotBlank()) "Configured" else "Offline",
                    detail = app.pairingManager.orchestratorUrl.ifBlank { "No laptop/server URL configured." },
                    actionLabel = "Settings",
                    onAction = { onOpenSecondary("settings") },
                    onDetails = { onDetails("Remote orchestrator", app.pairingManager.orchestratorUrl.ifBlank { "Not configured." }) }
                )
            }
            item {
                Button(onClick = { onOpenSecondary("developer") }, modifier = Modifier.fillMaxWidth()) {
                    Text("Developer Tests")
                }
            }
        }
    }
}

@Composable
private fun QuickLinks(onOpenSecondary: (String) -> Unit) {
    val links = listOf(
        "Dashboard" to "home",
        "Sessions" to "sessions",
        "Console" to "console",
        "Device" to "device",
        "Models" to "models",
        "MCP" to "mcp",
        "Approvals" to "approvals",
        "Questions" to "questions",
        "Voice" to "voice",
        "Assistant" to "assistant",
        "Mistral" to "mistral",
        "OpenAI" to "openai-compatible",
        "Local HTTP" to "local-http",
        "Ollama" to "ollama",
        "AI Fallback" to "provider-fallback",
        "Local Model" to "local-model",
        "Runtime" to "runtime",
        "Diagnostics" to "diagnostics",
        "PRoot" to "container-settings",
        "Termux" to "termux",
        "SSH" to "ssh",
        "Fallback" to "fallback",
        "Container" to "container"
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        links.forEach { (label, target) ->
            OutlinedButton(onClick = { onOpenSecondary(target) }) {
                Text(label)
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.section(title: String) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            StatusPill(title)
        }
    }
}
