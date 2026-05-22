package com.kizek.phoneagent.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.core.WorkerMode
import com.kizek.phoneagent.ui.components.AnimatedAssistantOrb
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.ApprovalActionCard
import com.kizek.phoneagent.ui.components.AssistantBubble
import com.kizek.phoneagent.ui.components.AssistantVisualState
import com.kizek.phoneagent.ui.components.ChatInputBar
import com.kizek.phoneagent.ui.components.EmptyStateCard
import com.kizek.phoneagent.ui.components.ErrorMessageCard
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.GlassSurface
import com.kizek.phoneagent.ui.components.ModelChip
import com.kizek.phoneagent.ui.components.PhoneUiDensity
import com.kizek.phoneagent.ui.components.QuestionBottomSheet
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import com.kizek.phoneagent.ui.components.ThinkingCard
import com.kizek.phoneagent.ui.components.ToolCallCard
import com.kizek.phoneagent.ui.components.WorkerChip
import com.kizek.phoneagent.ui.components.statusToneFor
import com.kizek.phoneagent.ui.components.visibleReasoningSummary

@Composable
fun ChatScreen(
    app: PhoneAgentApplication,
    snapshot: RuntimeSnapshot,
    workerMode: WorkerMode,
    onWorkerSelected: (WorkerMode) -> Unit,
    onSend: (String) -> Unit,
    onOpenSessions: () -> Unit,
    onOpenTools: () -> Unit,
    onOpenFiles: () -> Unit,
    onOpenSettings: () -> Unit,
    onNewChat: () -> Unit,
    onScreenObserve: (String) -> Unit,
    onApprove: (String, String) -> Unit,
    onRejectApproval: (String) -> Unit,
    onAnswerQuestion: (String, String) -> Unit,
    onSkipQuestion: (String) -> Unit,
    onDetails: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var input by rememberSaveable { mutableStateOf("") }
    var voiceLine by rememberSaveable { mutableStateOf("") }
    var showWorkerPicker by rememberSaveable { mutableStateOf(false) }
    val currentSession = snapshot.selectedSessionId
    val pendingApprovals = snapshot.approvals
        .filter { it.sessionId == currentSession && it.status == "pending" }
        .sortedBy { it.createdAt }
    val pendingQuestions = snapshot.questions
        .filter { it.sessionId == currentSession && it.status == "pending" }
        .sortedBy { it.createdAt }
    val activeQuestion = pendingQuestions.firstOrNull()
    val hasRunningTask = snapshot.tasks.any { it.sessionId == currentSession && it.state == "running" }
    val activeTask = snapshot.tasks.firstOrNull { it.sessionId == currentSession && it.state == "running" }
    val voiceStatus = app.voiceManager.status()
    val screenStatus = app.screenCaptureManager.status()
    val assistantState = when {
        voiceStatus.listening -> AssistantVisualState.LISTENING
        voiceStatus.speaking -> AssistantVisualState.SPEAKING
        pendingApprovals.isNotEmpty() -> AssistantVisualState.BLOCKED
        pendingQuestions.isNotEmpty() -> AssistantVisualState.THINKING
        hasRunningTask -> AssistantVisualState.RUNNING_TOOL
        else -> AssistantVisualState.IDLE
    }
    val statusLabel = when {
        snapshot.remoteStatus.startsWith("offline", ignoreCase = true) && workerMode != WorkerMode.PHONE_LOCAL -> "Offline"
        pendingApprovals.isNotEmpty() -> "Approval"
        pendingQuestions.isNotEmpty() -> "Question"
        hasRunningTask -> "Tool"
        voiceStatus.listening -> "Listening"
        voiceStatus.speaking -> "Speaking"
        else -> "Ready"
    }

    fun startVoice() {
        app.voiceManager.transcribeOnce(
            onPartial = { voiceLine = "Listening: $it" },
            onFinal = { transcript ->
                voiceLine = "Transcript ready"
                if (app.voiceManager.autoSendTranscript) {
                    onSend(transcript)
                } else {
                    input = transcript
                }
            },
            onError = { voiceLine = it }
        )
    }
    val micPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startVoice() else voiceLine = "Microphone permission denied"
    }

    AppBackground(modifier = modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = PhoneUiDensity.screenPadding, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ChatTopBar(
                model = app.modelRouter.activeProviderLabel(),
                workerMode = workerMode,
                statusLabel = statusLabel,
                assistantState = assistantState,
                remoteStatus = snapshot.remoteStatus,
                screenStatus = if (screenStatus.lastScreenshotPath != null) "last shot" else if (screenStatus.configured) "ready" else "off",
                onOpenSessions = onOpenSessions,
                onNewChat = onNewChat,
                onOpenSettings = onOpenSettings,
                onWorkerClick = { showWorkerPicker = !showWorkerPicker },
                onOpenTools = onOpenTools,
                onStopVoice = {
                    app.voiceManager.stopSpeaking()
                    app.voiceManager.stopListening()
                    voiceLine = "Voice stopped"
                }
            )

            AnimatedVisibility(
                visible = showWorkerPicker,
                enter = fadeIn() + slideInVertically(initialOffsetY = { -it / 3 })
            ) {
                GlassCard(title = "Worker route", subtitle = "Choose where this task should run.", icon = "RUN", status = workerMode.label) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        WorkerMode.entries.forEach { mode ->
                            WorkerChip(workerMode = mode, selected = mode == workerMode, onClick = {
                                onWorkerSelected(mode)
                                showWorkerPicker = false
                            })
                        }
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (snapshot.events.isEmpty()) {
                    item {
                        EmptyStateCard(
                            title = "What should we build?",
                            detail = "Ask for file work, shell commands, phone control, screen understanding, or a larger task routed to laptop/server.",
                            actionLabel = "Open tools",
                            onAction = onOpenTools
                        )
                    }
                }
                items(snapshot.events, key = { it.id }) { event ->
                    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically(initialOffsetY = { it / 6 })) {
                        when (event.type) {
                            "ToolResult", "ToolBlocked" -> ToolCallCard(event = event, onDetails = onDetails)
                            "TaskFailed" -> ErrorMessageCard(event = event, onDetails = onDetails, onSetup = onOpenSettings)
                            else -> AssistantBubble(event = event, onDetails = onDetails)
                        }
                    }
                }
                if (activeTask != null) {
                    item {
                        ThinkingCard(status = visibleReasoningSummary(activeTask.step), state = AssistantVisualState.RUNNING_TOOL)
                    }
                }
                items(pendingApprovals, key = { it.id }) { approval ->
                    ApprovalActionCard(
                        approval = approval,
                        onApprove = { scope -> onApprove(approval.id, scope) },
                        onReject = { onRejectApproval(approval.id) },
                        onDetails = onDetails
                    )
                }
            }

            ChatInputBar(
                input = input,
                onInputChange = { input = it },
                enabled = currentSession != null,
                workerMode = workerMode,
                onWorkerClick = { showWorkerPicker = !showWorkerPicker },
                onSend = { text ->
                    val message = text.trim()
                    if (message.isNotBlank()) {
                        input = ""
                        voiceLine = ""
                        if (activeQuestion != null) {
                            onAnswerQuestion(activeQuestion.id, message)
                        } else {
                            onSend(message)
                        }
                    }
                },
                onMic = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        startVoice()
                    } else {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                },
                onTools = onOpenTools,
                onAttach = onOpenFiles,
                onScreenObserve = { draft -> onScreenObserve(draft.trim()) },
                voiceLine = voiceLine
            )
        }
    }

    activeQuestion?.let { question ->
        QuestionBottomSheet(
            question = question,
            index = pendingQuestions.indexOf(question),
            total = pendingQuestions.size,
            onAnswer = { answer ->
                voiceLine = "Answered question"
                onAnswerQuestion(question.id, answer)
            },
            onSkip = {
                voiceLine = "Skipped question"
                onSkipQuestion(question.id)
            }
        )
    }
}

@Composable
private fun ChatTopBar(
    model: String,
    workerMode: WorkerMode,
    statusLabel: String,
    assistantState: AssistantVisualState,
    remoteStatus: String,
    screenStatus: String,
    onOpenSessions: () -> Unit,
    onNewChat: () -> Unit,
    onOpenSettings: () -> Unit,
    onWorkerClick: () -> Unit,
    onOpenTools: () -> Unit,
    onStopVoice: () -> Unit
) {
    GlassSurface(
        modifier = Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        tonalAlpha = 0.82f
    ) {
        Column(Modifier.padding(horizontal = 8.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onOpenSessions, modifier = Modifier.size(PhoneUiDensity.iconButton)) {
                    Icon(Icons.Filled.Menu, contentDescription = "Sessions")
                }
                Column(
                    Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(1.dp)
                ) {
                    Text(
                        "Phone Agent",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        model.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = onNewChat, modifier = Modifier.size(PhoneUiDensity.iconButton)) {
                    Icon(Icons.Filled.Add, contentDescription = "New chat")
                }
                IconButton(onClick = onOpenSettings, modifier = Modifier.size(PhoneUiDensity.iconButton)) {
                    Icon(Icons.Filled.Settings, contentDescription = "Settings")
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AnimatedAssistantOrb(state = assistantState, size = 20.dp)
                StatusPill(statusLabel, statusToneFor(statusLabel), modifier = Modifier.widthIn(max = 86.dp))
                ModelChip(model.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() })
                WorkerChip(workerMode = workerMode, onClick = onWorkerClick)
                StatusPill("Remote: ${remoteStatus.substringBefore(":")}", statusToneFor(remoteStatus))
                StatusPill("Screen: $screenStatus", statusToneFor(screenStatus))
                OutlinedButton(onClick = onOpenTools) { Text("Tools") }
                Button(onClick = onStopVoice) { Text("Stop") }
            }
        }
    }
}
