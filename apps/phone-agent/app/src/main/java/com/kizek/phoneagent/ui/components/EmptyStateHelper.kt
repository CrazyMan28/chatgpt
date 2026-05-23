package com.kizek.phoneagent.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.core.RuntimeCapabilityStatus

enum class EmptyStateType {
    NO_PROVIDER_CONFIGURED,
    PROVIDER_OFFLINE,
    TERMUX_NOT_CONFIGURED,
    TERMUX_UNREACHABLE,
    NO_SSH_TARGETS,
    PROOT_MISSING,
    ACCESSIBILITY_DISABLED,
    SCREEN_CAPTURE_NOT_CONFIGURED
}

data class EmptyStateInfo(
    val type: EmptyStateType,
    val title: String,
    val whatIsMissing: String,
    val whatWorksLocally: String,
    val nextAction: String?,
    val actionTarget: String?
)

fun computeEmptyStates(capability: RuntimeCapabilityStatus): List<EmptyStateInfo> {
    val states = mutableListOf<EmptyStateInfo>()

    if (!capability.mistralConfigured || capability.modelRoute == com.kizek.phoneagent.models.ModelRoute.MISTRAL && !capability.mistralConfigured) {
        states.add(
            EmptyStateInfo(
                type = EmptyStateType.NO_PROVIDER_CONFIGURED,
                title = "No model provider configured",
                whatIsMissing = "An AI model provider (Mistral, OpenAI, Ollama, or local) is not set up yet.",
                whatWorksLocally = "Local phone tools still work: open apps, file management, shell commands, screen observation (if configured).",
                nextAction = "Configure provider",
                actionTarget = "settings"
            )
        )
    }

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.ACCESSIBILITY_DISABLED,
            title = "Accessibility not enabled",
            whatIsMissing = "Phone Agent's AccessibilityService is not running. This is needed for app control (tap, type, scroll).",
            whatWorksLocally = "File tools, shell commands, Termux, and SSH still work. Screen observation still works.",
            nextAction = "Open accessibility settings",
            actionTarget = "device"
        )
    )

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.SCREEN_CAPTURE_NOT_CONFIGURED,
            title = "Screen capture not configured",
            whatIsMissing = "Screen capture permission (MediaProjection) has not been granted yet.",
            whatWorksLocally = "App control, file tools, shell, Termux, and SSH work. Accessibility-based observation provides limited text info.",
            nextAction = "Configure screen capture",
            actionTarget = "device"
        )
    )

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.NO_SSH_TARGETS,
            title = "No SSH targets configured",
            whatIsMissing = "No SSH servers have been added yet.",
            whatWorksLocally = "File tools, shell, app control, Termux, and PRoot work.",
            nextAction = "Configure SSH",
            actionTarget = "ssh"
        )
    )

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.TERMUX_NOT_CONFIGURED,
            title = "Termux not configured",
            whatIsMissing = "Termux bridge is not configured on this device.",
            whatWorksLocally = "File tools, shell, app control, PRoot, and SSH work.",
            nextAction = "Configure Termux",
            actionTarget = "termux"
        )
    )

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.TERMUX_UNREACHABLE,
            title = "Termux SSH unreachable",
            whatIsMissing = "Termux is configured but its SSH connection cannot be reached (wrong host, port, or sshd not running).",
            whatWorksLocally = "File tools, shell, app control, PRoot, and other SSH targets work.",
            nextAction = "Check Termux settings",
            actionTarget = "termux"
        )
    )

    states.add(
        EmptyStateInfo(
            type = EmptyStateType.PROOT_MISSING,
            title = "PRoot/rootfs missing",
            whatIsMissing = "Built-in PRoot runtime is not installed or rootfs is missing.",
            whatWorksLocally = "File tools, shell, app control, Termux, and SSH work.",
            nextAction = "Set up container",
            actionTarget = "container-settings"
        )
    )

    return states
}

@Composable
fun EmptyStateDetailCard(
    info: EmptyStateInfo,
    onAction: () -> Unit,
    modifier: Modifier = Modifier
) {
    GlassCard(
        title = info.title,
        subtitle = info.whatIsMissing,
        icon = statusIconForState(info.type),
        status = "Needs setup",
        tone = StatusTone.SETUP,
        modifier = modifier,
        actions = {
            if (info.nextAction != null) {
                Button(onClick = onAction) {
                    Text(info.nextAction)
                }
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                info.whatIsMissing,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                info.whatWorksLocally,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.85f)
            )
        }
    }
}

@Composable
fun EmptyStatesList(
    capability: RuntimeCapabilityStatus,
    onAction: () -> Unit,
    modifier: Modifier = Modifier
) {
    val states = computeEmptyStates(capability)
    if (states.isEmpty()) return
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        states.forEach { info ->
            EmptyStateDetailCard(info = info, onAction = onAction)
        }
    }
}

private fun statusIconForState(type: EmptyStateType): String {
    return when (type) {
        EmptyStateType.NO_PROVIDER_CONFIGURED -> "AI"
        EmptyStateType.PROVIDER_OFFLINE -> "OFF"
        EmptyStateType.TERMUX_NOT_CONFIGURED -> "SET"
        EmptyStateType.TERMUX_UNREACHABLE -> "OFF"
        EmptyStateType.NO_SSH_TARGETS -> "SET"
        EmptyStateType.PROOT_MISSING -> "SET"
        EmptyStateType.ACCESSIBILITY_DISABLED -> "OFF"
        EmptyStateType.SCREEN_CAPTURE_NOT_CONFIGURED -> "OFF"
    }
}
