package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import com.kizek.phoneagent.ui.components.SubsystemStatusCard

@Composable
fun SettingsScreen(
    app: PhoneAgentApplication,
    onOpenSettingsTarget: (String) -> Unit,
    onRerunOnboarding: () -> Unit,
    modifier: Modifier = Modifier
) {
    val proot = app.prootManager.status()
    val termux = app.termuxBridgeManager.status()
    val ssh = app.sshAgentManager.status()
    val local = app.localModelManager.runtimeStatus()
    AppBackground(modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                GlassCard(
                    title = "Settings",
                    subtitle = "Providers, runtimes, phone control, approvals, and developer checks.",
                    icon = "SET",
                    status = "Ready"
                ) {
                    Text("Runtime setup stays explicit. Imported binaries, local models, Termux, and SSH targets must pass real tests before they are marked ready.")
                }
            }

            section("AI Providers")
            item {
                SubsystemStatusCard(
                    title = "Mistral API",
                    status = if (app.modelRouter.mistral.isConfigured()) "configured" else "missing key",
                    detail = "${app.modelRouter.mistral.selectedModel} at ${app.modelRouter.mistral.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("mistral") }
                )
            }
            item {
                val state = app.modelRouter.openAiCompatible
                SubsystemStatusCard(
                    title = "OpenAI Compatible",
                    status = if (state.enabled) "configured" else "not configured",
                    detail = "${state.model} at ${state.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("openai-compatible") }
                )
            }
            item {
                val state = app.modelRouter.localHttp
                SubsystemStatusCard(
                    title = "Local HTTP / Loopback",
                    status = if (state.enabled) "configured" else "not configured",
                    detail = "${state.endpointStyle.label}: ${state.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("local-http") }
                )
            }
            item {
                val state = app.modelRouter.ollama
                SubsystemStatusCard(
                    title = "Ollama",
                    status = if (state.enabled) "configured" else "not configured",
                    detail = "${state.model} at ${state.baseUrl}",
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("ollama") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Local Model",
                    status = if (local.ready) "ready" else local.backend.label,
                    detail = local.detail,
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("local-model") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "AI Provider Fallback Order",
                    status = if (app.modelRouter.fallbackEnabled) "enabled" else "disabled",
                    detail = app.modelRouter.fallbackOrder().joinToString(" > ") { it.name.lowercase().replace('_', '-') },
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("provider-fallback") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Remote Orchestrator Model",
                    status = if (app.pairingManager.orchestratorUrl.isNotBlank()) "configured" else "offline",
                    detail = app.pairingManager.orchestratorUrl.ifBlank { "No laptop/server orchestrator URL configured." },
                    actionLabel = "Runtime",
                    onAction = { onOpenSettingsTarget("runtime") }
                )
            }

            section("Runtime / Execution")
            item {
                SubsystemStatusCard(
                    title = "App Shell",
                    status = "ready",
                    detail = "${app.shellTools.status()} in app-private workspace.",
                    actionLabel = "Runtime",
                    onAction = { onOpenSettingsTarget("runtime") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Built-in PRoot",
                    status = if (proot.installed) "ready" else if (proot.prootPresent && proot.rootfsPresent) "blocked" else "missing",
                    detail = proot.detail,
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("container-settings") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Termux Bridge",
                    status = if (termux.connected) "connected" else if (termux.configured) "configured" else "not configured",
                    detail = termux.detail,
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("termux") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "SSH Agent",
                    status = if (ssh.configuredTargets > 0) ssh.lastStatus else "not configured",
                    detail = "targets=${ssh.configuredTargets}, fallback=${ssh.fallbackTargets}",
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("ssh") }
                )
            }
            item {
                SubsystemStatusCard(
                    title = "Fallback Order",
                    status = "configured",
                    detail = app.executionRouteManager.installSummary(),
                    actionLabel = "Open",
                    onAction = { onOpenSettingsTarget("fallback") }
                )
            }

            section("Phone Control")
            item { SettingJump("Accessibility", "Device permissions and AccessibilityService controls.", "device", onOpenSettingsTarget) }
            item { SettingJump("Screen Capture", "MediaProjection prompt and screenshot status.", "device", onOpenSettingsTarget) }
            item { SettingJump("Voice", "Android STT/TTS and custom provider fields.", "voice", onOpenSettingsTarget) }
            item { SettingJump("Assistant Mode", "Default assistant, overlay bubble, and quick launch.", "assistant", onOpenSettingsTarget) }

            section("Safety / Approvals")
            item { SettingJump("Approvals", "Risk-gated tool execution and pending grants.", "approvals", onOpenSettingsTarget) }

            section("Developer Tests")
            item {
                GlassCard(title = "Developer Tests", subtitle = "Run provider, local model, PRoot, Termux, SSH, fallback, and Minecraft flow checks.", icon = "TEST", status = "Available") {
                    Button(onClick = { onOpenSettingsTarget("developer") }, modifier = Modifier.fillMaxWidth()) {
                        Text("Open Developer Tests")
                    }
                    OutlinedButton(onClick = onRerunOnboarding, modifier = Modifier.fillMaxWidth()) {
                        Text("Rerun Setup Wizard")
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingJump(title: String, detail: String, target: String, onOpen: (String) -> Unit) {
    SubsystemStatusCard(
        title = title,
        status = "Open",
        detail = detail,
        actionLabel = "Open",
        onAction = { onOpen(target) }
    )
}

private fun androidx.compose.foundation.lazy.LazyListScope.section(title: String) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
    }
}
