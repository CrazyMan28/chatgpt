package com.kizek.phoneagent.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AnimatedAssistantOrb
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.AssistantVisualState
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import com.kizek.phoneagent.voice.VoiceManager

@Composable
fun VoiceScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf(app.voiceManager.status().detail) }
    var customStt by remember { mutableStateOf(app.voiceManager.customSttEndpoint) }
    var customTts by remember { mutableStateOf(app.voiceManager.customTtsEndpoint) }
    var refreshKey by remember { mutableStateOf(0) }
    val voiceStatus = remember(refreshKey) { app.voiceManager.status() }
    fun refresh(message: String = app.voiceManager.status().detail) {
        refreshKey += 1
        status = message
    }
    fun startStt() {
        app.voiceManager.transcribeOnce(
            onPartial = { status = "Listening: $it" },
            onFinal = { refresh("Transcript: $it") },
            onError = { refresh(it) }
        )
    }
    val micPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startStt() else refresh("Microphone permission denied.")
    }
    val orbState = when {
        voiceStatus.listening -> AssistantVisualState.LISTENING
        voiceStatus.speaking -> AssistantVisualState.SPEAKING
        !voiceStatus.micPermissionGranted -> AssistantVisualState.BLOCKED
        else -> AssistantVisualState.IDLE
    }

    AppBackground(modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(
                title = "Voice",
                subtitle = "Push-to-talk input and Android TTS output. Hidden listening is not started.",
                icon = "MIC",
                status = if (voiceStatus.voiceEnabled) "Ready" else "Setup needed"
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AnimatedAssistantOrb(state = orbState, size = 62.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusPill(if (voiceStatus.listening) "Listening" else if (voiceStatus.speaking) "Speaking" else "Idle")
                        Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            VoiceToggleCard("Voice mode", app.voiceManager.voiceEnabled) {
                app.voiceManager.voiceEnabled = it
                refresh()
            }
            VoiceToggleCard("Speak assistant replies", app.voiceManager.speakAssistantReplies) {
                app.voiceManager.speakAssistantReplies = it
                refresh()
            }
            VoiceToggleCard("Auto-send transcript", app.voiceManager.autoSendTranscript) {
                app.voiceManager.autoSendTranscript = it
                refresh()
            }
            GlassCard(title = "STT provider", subtitle = "Choose the real speech-to-text path.", icon = "STT", status = app.voiceManager.sttProvider) {
                ProviderChips(
                    selected = app.voiceManager.sttProvider,
                    providers = listOf(
                        VoiceManager.PROVIDER_ANDROID_STT to "Android",
                        VoiceManager.PROVIDER_CUSTOM to "Custom API",
                        VoiceManager.PROVIDER_MISTRAL to "Mistral"
                    ),
                    onSelected = {
                        app.voiceManager.sttProvider = it
                        refresh()
                    }
                )
                OutlinedTextField(
                    value = customStt,
                    onValueChange = {
                        customStt = it
                        app.voiceManager.customSttEndpoint = it
                    },
                    label = { Text("Custom STT endpoint") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            GlassCard(title = "TTS provider", subtitle = "Choose the real text-to-speech path.", icon = "TTS", status = app.voiceManager.ttsProvider) {
                ProviderChips(
                    selected = app.voiceManager.ttsProvider,
                    providers = listOf(
                        VoiceManager.PROVIDER_ANDROID_TTS to "Android",
                        VoiceManager.PROVIDER_CUSTOM to "Custom API",
                        VoiceManager.PROVIDER_MISTRAL to "Mistral"
                    ),
                    onSelected = {
                        app.voiceManager.ttsProvider = it
                        refresh()
                    }
                )
                OutlinedTextField(
                    value = customTts,
                    onValueChange = {
                        customTts = it
                        app.voiceManager.customTtsEndpoint = it
                    },
                    label = { Text("Custom TTS endpoint") },
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Speech rate ${"%.2f".format(app.voiceManager.speechRate)}")
                Slider(value = app.voiceManager.speechRate, onValueChange = {
                    app.voiceManager.speechRate = it
                    refresh()
                }, valueRange = 0.5f..1.8f)
                Text("Speech pitch ${"%.2f".format(app.voiceManager.speechPitch)}")
                Slider(value = app.voiceManager.speechPitch, onValueChange = {
                    app.voiceManager.speechPitch = it
                    refresh()
                }, valueRange = 0.5f..1.8f)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        startStt()
                    } else {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }, modifier = Modifier.weight(1f)) { Text("Test mic") }
                OutlinedButton(onClick = { refresh(app.voiceManager.speak("Phone Agent text to speech test.")) }, modifier = Modifier.weight(1f)) { Text("Test speak") }
                OutlinedButton(onClick = {
                    app.voiceManager.stopSpeaking()
                    app.voiceManager.stopListening()
                    refresh("Voice stopped.")
                }, modifier = Modifier.weight(1f)) { Text("Stop") }
            }
            GlassCard(
                title = "Provider status",
                subtitle = "mic=${voiceStatus.micPermissionGranted} recognizer=${voiceStatus.speechRecognizerAvailable} tts=${voiceStatus.ttsReady}",
                icon = "INFO",
                status = if (voiceStatus.micPermissionGranted) "Ready" else "Missing permission"
            ) {
                val voices = app.voiceManager.voiceNames().take(10)
                if (voices.isNotEmpty()) {
                    Text("Android voices: ${voices.joinToString(", ")}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun VoiceToggleCard(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    GlassCard(title = label, icon = "SET", status = if (checked) "Ready" else "Off") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            StatusPill(if (checked) "Enabled" else "Disabled", if (checked) StatusTone.READY else StatusTone.OFFLINE)
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

@Composable
private fun ProviderChips(
    selected: String,
    providers: List<Pair<String, String>>,
    onSelected: (String) -> Unit
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
    ) {
        providers.forEach { (id, label) ->
            FilterChip(selected = selected == id, onClick = { onSelected(id) }, label = { Text(label) })
        }
    }
}
