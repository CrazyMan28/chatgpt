package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.core.RuntimeCapabilityStatus
import com.kizek.phoneagent.models.ModelProviderState
import com.kizek.phoneagent.models.ModelRoute
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.SubsystemStatusCard

private data class DiagnosticsSnapshot(
    val capability: RuntimeCapabilityStatus,
    val activeProviderLabel: String,
    val selectedRoute: ModelRoute,
    val providerConfigured: Boolean,
    val providerDetail: String,
    val providerActionTarget: String?
)

@Composable
fun DiagnosticsScreen(
    app: PhoneAgentApplication,
    onOpenTarget: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var snapshot by remember { mutableStateOf<DiagnosticsSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(app) {
        loading = true
        error = null
        snapshot = runCatching {
            val capability = app.runtime.toolRegistry.runtimeCapabilityStatus()
            val states = app.modelRouter.states()
            val selectedRoute = app.modelRouter.selectedRoute
            val providerState = providerStateForRoute(app, selectedRoute, states)
            DiagnosticsSnapshot(
                capability = capability,
                activeProviderLabel = app.modelRouter.activeProviderLabel(),
                selectedRoute = selectedRoute,
                providerConfigured = providerState?.available == true,
                providerDetail = providerState?.detail ?: "No provider state available.",
                providerActionTarget = settingsTargetForRoute(selectedRoute)
            )
        }.onFailure { error = it.message ?: "Unable to load diagnostics." }.getOrNull()
        loading = false
    }

    AppBackground(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                GlassCard(
                    title = "Diagnostics",
                    subtitle = "Real readiness snapshot for providers and runtime paths.",
                    icon = "DIA",
                    status = if (error == null) "Ready" else "Error"
                ) {
                    Text(
                        "This screen reads live state from the app's providers and runtime helpers.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    RowButtons(onOpenTarget)
                }
            }

            if (loading) {
                item {
                    SubsystemStatusCard(
                        title = "Loading",
                        status = "Working",
                        detail = "Gathering provider and runtime status..."
                    )
                }
            }

            error?.let { message ->
                item {
                    SubsystemStatusCard(
                        title = "Diagnostics error",
                        status = "Error",
                        detail = message
                    )
                }
            }

            snapshot?.let { data ->
                section("Providers")
                item {
                    SubsystemStatusCard(
                        title = "Active provider",
                        status = if (data.activeProviderLabel.isNotBlank()) "Ready" else "Missing",
                        detail = "Route ${data.selectedRoute.name.lowercase().replace('_', '-')} is pointing at ${data.activeProviderLabel.ifBlank { "no active provider" }}",
                        actionLabel = data.providerActionTarget?.let { "Open" },
                        onAction = data.providerActionTarget?.let { { onOpenTarget(it) } }
                    )
                }
                item {
                    SubsystemStatusCard(
                        title = "Provider configured",
                        status = if (data.providerConfigured) "Ready" else "Missing",
                        detail = data.providerDetail,
                        actionLabel = data.providerActionTarget?.let { "Settings" },
                        onAction = data.providerActionTarget?.let { { onOpenTarget(it) } }
                    )
                }

                section("Phone control")
                item {
                    SubsystemStatusCard(
                        title = "Screen capture configured",
                        status = if (data.capability.screenCaptureReady) "Ready" else "Missing",
                        detail = data.capability.screenCaptureDetail,
                        actionLabel = "Device",
                        onAction = { onOpenTarget("device") }
                    )
                }
                item {
                    SubsystemStatusCard(
                        title = "Accessibility enabled",
                        status = if (data.capability.accessibilityEnabled) "Ready" else "Missing",
                        detail = data.capability.accessibilityStatus,
                        actionLabel = "Device",
                        onAction = { onOpenTarget("device") }
                    )
                }
                item {
                    val termuxStatus = when {
                        !data.capability.termuxInstalled -> "Skipped"
                        data.capability.termuxConnected -> "Ready"
                        data.capability.termuxConfigured -> "Error"
                        else -> "Missing"
                    }
                    SubsystemStatusCard(
                        title = "Termux configured",
                        status = termuxStatus,
                        detail = data.capability.termuxDetail,
                        actionLabel = "Termux",
                        onAction = { onOpenTarget("termux") }
                    )
                }
                item {
                    SubsystemStatusCard(
                        title = "SSH targets count",
                        status = if (data.capability.sshConfiguredTargets > 0) "Ready" else "Missing",
                        detail = "targets=${data.capability.sshConfiguredTargets}, fallback=${data.capability.sshFallbackTargets}, lastStatus=${data.capability.sshLastStatus}",
                        actionLabel = "SSH",
                        onAction = { onOpenTarget("ssh") }
                    )
                }

                section("Runtime")
                item {
                    val prootStatus = when {
                        data.capability.prootReady -> "Ready"
                        data.capability.prootDetail.contains("missing", ignoreCase = true) -> "Missing"
                        data.capability.prootDetail.contains("blocked", ignoreCase = true) -> "Error"
                        data.capability.prootDetail.contains("permission", ignoreCase = true) -> "Error"
                        else -> "Missing"
                    }
                    SubsystemStatusCard(
                        title = "PRoot/rootfs status",
                        status = prootStatus,
                        detail = data.capability.prootDetail,
                        actionLabel = "PRoot settings",
                        onAction = { onOpenTarget("container-settings") }
                    )
                }
                item {
                    SubsystemStatusCard(
                        title = "Local deterministic commands",
                        status = if (data.capability.toolCount > 0) "Ready" else "Missing",
                        detail = "${data.capability.toolCount} phone-local tools are registered; they do not depend on a cloud key.",
                        actionLabel = "Developer Tests",
                        onAction = { onOpenTarget("developer") }
                    )
                }
            }
        }
    }
}

@Composable
private fun RowButtons(onOpenTarget: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { onOpenTarget("settings") }, modifier = Modifier.fillMaxWidth()) {
            Text("Open Settings")
        }
        OutlinedButton(onClick = { onOpenTarget("developer") }, modifier = Modifier.fillMaxWidth()) {
            Text("Developer Tests")
        }
    }
}

private fun providerStateForRoute(
    app: PhoneAgentApplication,
    route: ModelRoute,
    states: List<ModelProviderState>
): ModelProviderState? {
    val selectedId = when (route) {
        ModelRoute.MISTRAL -> app.modelRouter.mistral.id
        ModelRoute.OPENAI_COMPATIBLE -> app.modelRouter.openAiCompatible.id
        ModelRoute.LOCAL_HTTP -> app.modelRouter.localHttp.id
        ModelRoute.OLLAMA -> app.modelRouter.ollama.id
        ModelRoute.LOCAL -> app.modelRouter.local.id
        ModelRoute.REMOTE -> app.modelRouter.remote.id
        ModelRoute.HYBRID -> null
    }
    return when {
        selectedId != null -> states.firstOrNull { it.id == selectedId }
        else -> states.firstOrNull { it.available } ?: states.firstOrNull()
    }
}

private fun settingsTargetForRoute(route: ModelRoute): String? {
    return when (route) {
        ModelRoute.MISTRAL -> "mistral"
        ModelRoute.OPENAI_COMPATIBLE -> "openai-compatible"
        ModelRoute.LOCAL_HTTP -> "local-http"
        ModelRoute.OLLAMA -> "ollama"
        ModelRoute.LOCAL -> "local-model"
        ModelRoute.REMOTE -> "runtime"
        ModelRoute.HYBRID -> "provider-fallback"
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.section(title: String) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
    }
}
