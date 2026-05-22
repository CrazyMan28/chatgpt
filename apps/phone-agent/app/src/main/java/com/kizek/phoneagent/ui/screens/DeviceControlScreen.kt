package com.kizek.phoneagent.ui.screens

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.accessibility.AccessibilityActionExecutor
import com.kizek.phoneagent.accessibility.AccessibilityControlMode
import com.kizek.phoneagent.accessibility.AccessibilityNodeSerializer
import com.kizek.phoneagent.accessibility.AccessibilitySafetyMode
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone

@Composable
fun DeviceControlScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var tree by remember { mutableStateOf("") }
    val safety = remember { AccessibilitySafetyMode(context) }
    var mode by remember { mutableStateOf(safety.mode) }
    val service = PhoneAccessibilityService.instance
    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Device Control",
                subtitle = "Observe and control Android through explicit permissions and approval-gated actions.",
                icon = "PH",
                status = if (service == null) "Missing permission" else "Ready"
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    StatusPill("Accessibility: ${if (service == null) "disabled" else "enabled"}", if (service == null) StatusTone.SETUP else StatusTone.READY)
                    StatusPill("App: ${service?.activePackage ?: "unknown"}")
                    StatusPill("Window: ${service?.activeWindow ?: "unknown"}")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    AccessibilityControlMode.entries.forEach { entry ->
                        FilterChip(
                            selected = mode == entry,
                            onClick = {
                                safety.mode = entry
                                mode = entry
                            },
                            label = { Text(entry.name.lowercase()) }
                        )
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }, modifier = Modifier.weight(1f)) {
                    Text("Setup")
                }
                OutlinedButton(onClick = {
                    tree = service?.rootInActiveWindow?.let { AccessibilityNodeSerializer.serialize(it, 4) }
                        ?: "Enable Phone Agent Control in Android Accessibility settings."
                }, modifier = Modifier.weight(1f)) { Text("Observe") }
                OutlinedButton(onClick = { tree = app.accessibilityTools.status() }, modifier = Modifier.weight(1f)) { Text("Status") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                OutlinedButton(onClick = { AccessibilityActionExecutor.globalBack() }) { Text("Back") }
                OutlinedButton(onClick = { AccessibilityActionExecutor.globalHome() }) { Text("Home") }
                OutlinedButton(onClick = { AccessibilityActionExecutor.globalRecents() }) { Text("Recents") }
            }
            GlassCard(
                title = "Safety",
                subtitle = "Tap/type/swipe actions are routed through approval cards before autonomous use.",
                icon = "!",
                status = "Approval gated"
            )
            if (tree.isNotBlank()) {
                GlassCard(title = "Observation", icon = "INFO", status = "Details") {
                    Text(tree, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
