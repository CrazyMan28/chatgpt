package com.kizek.phoneagent.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AnimatedAssistantOrb
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.AssistantVisualState
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import kotlinx.coroutines.launch

@Composable
fun AssistantModeScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var refreshKey by remember { mutableStateOf(0) }
    val status = remember(refreshKey) { app.assistantManager.status() }
    var output by remember { mutableStateOf(status.detail) }
    fun refresh(message: String = app.assistantManager.status().detail) {
        refreshKey += 1
        output = message
    }
    AppBackground(modifier.fillMaxSize()) {
        Column(
            modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Assistant Mode",
                subtitle = "Fullscreen and compact entry points with honest Android/OEM limitations.",
                icon = "AI",
                status = if (status.bubbleEnabled) "Ready" else "Setup needed"
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AnimatedAssistantOrb(state = if (status.bubbleEnabled) AssistantVisualState.IDLE else AssistantVisualState.BLOCKED, size = 66.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusPill("Default: ${if (status.defaultAssistantCandidate) "candidate" else "unavailable"}", StatusTone.NEUTRAL)
                        StatusPill("Overlay: ${if (status.overlayPermission) "granted" else "missing"}", if (status.overlayPermission) StatusTone.READY else StatusTone.SETUP)
                        StatusPill("Bubble: ${if (status.bubbleEnabled) "enabled" else "disabled"}", if (status.bubbleEnabled) StatusTone.READY else StatusTone.OFFLINE)
                    }
                }
            }
            GlassCard(title = "Quick launch", subtitle = "Open the compact assistant, default assistant settings, or floating bubble controls.", icon = "RUN", status = "Available") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(onClick = { refresh(app.assistantManager.openAssistant()) }, modifier = Modifier.weight(1f)) { Text("Launch") }
                    OutlinedButton(onClick = { refresh(app.assistantManager.openDefaultAssistantSettings()) }, modifier = Modifier.weight(1f)) { Text("Default setup") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = { refresh(app.assistantManager.openOverlaySettings()) }, modifier = Modifier.weight(1f)) { Text("Overlay") }
                    OutlinedButton(onClick = { refresh(app.assistantManager.showBubble()) }, modifier = Modifier.weight(1f)) { Text("Show bubble") }
                    OutlinedButton(onClick = { refresh(app.assistantManager.hideBubble()) }, modifier = Modifier.weight(1f)) { Text("Hide") }
                }
            }
            GlassCard(title = "Wake phrase", subtitle = "No hidden microphone starts. Push-to-talk remains the supported path unless a foreground detector is added.", icon = "MIC", status = if (status.wakePhraseEnabled) "Experimental" else "Off") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        StatusPill("OEM/Android limitation", StatusTone.SETUP)
                    }
                    Switch(checked = status.wakePhraseEnabled, onCheckedChange = { enabled ->
                        refresh(app.assistantManager.setWakePhraseEnabled(enabled))
                    })
                }
            }
            GlassCard(title = "Assistant tools", subtitle = "Run visible test flows through the existing runtime.", icon = "TEST", status = "Ready") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = {
                        scope.launch {
                            app.runtime.runDeveloperTest("voice_agent_query")
                            refresh("Voice assistant test opened AssistantActivity. Use its visible mic button.")
                        }
                    }, modifier = Modifier.weight(1f)) { Text("Voice query") }
                    OutlinedButton(onClick = {
                        scope.launch {
                            app.runtime.runDeveloperTest("screen_observe")
                            refresh("Screen observe developer test created a visible tool card.")
                        }
                    }, modifier = Modifier.weight(1f)) { Text("Screen observe") }
                }
            }
            GlassCard(title = "Status", subtitle = output, icon = "INFO", status = if (output.contains("permission", true)) "Setup needed" else "Ready")
        }
    }
}
