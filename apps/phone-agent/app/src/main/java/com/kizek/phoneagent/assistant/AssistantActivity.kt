package com.kizek.phoneagent.assistant

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.storage.EventEntity
import com.kizek.phoneagent.ui.components.AnimatedAssistantOrb
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.ApprovalActionCard
import com.kizek.phoneagent.ui.components.AssistantBubble
import com.kizek.phoneagent.ui.components.AssistantVisualState
import com.kizek.phoneagent.ui.components.ChatInputBar
import com.kizek.phoneagent.ui.components.ErrorMessageCard
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.QuestionBottomSheet
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.ThinkingCard
import com.kizek.phoneagent.ui.components.ToolCallCard
import com.kizek.phoneagent.ui.theme.PhoneAgentTheme
import kotlinx.coroutines.launch

class AssistantActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as PhoneAgentApplication
        val initial = initialText(intent)
        setContent {
            PhoneAgentTheme {
                AssistantActivityScreen(app = app, initialText = initial, onClose = { finish() })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    private fun initialText(intent: Intent?): String {
        intent ?: return ""
        return intent.getStringExtra(EXTRA_INITIAL_TEXT)
            ?: intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            ?: ""
    }

    companion object {
        const val EXTRA_INITIAL_TEXT = "initialText"
    }
}

@Composable
private fun AssistantActivityScreen(
    app: PhoneAgentApplication,
    initialText: String,
    onClose: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var snapshot by remember { mutableStateOf<RuntimeSnapshot?>(null) }
    var input by rememberSaveable { mutableStateOf(initialText) }
    var status by rememberSaveable { mutableStateOf("Assistant ready") }
    var avatarState by remember { mutableStateOf(AssistantVisualState.IDLE) }

    fun refresh() {
        scope.launch {
            runCatching { app.runtime.snapshot() }
                .onSuccess { snapshot = it }
                .onFailure {
                    app.runtime.reportRuntimeError("assistant_snapshot", "Assistant window could not refresh status.", it)
                }
        }
    }

    fun send(text: String) {
        if (text.isBlank()) return
        scope.launch {
            try {
                avatarState = AssistantVisualState.THINKING
                status = "Planning next step"
                app.runtime.bootstrap()
                app.runtime.sendMessage(text)
            } catch (error: Exception) {
                app.runtime.reportRuntimeError(
                    source = "assistant_send",
                    message = "Assistant window stopped that message after an internal error.",
                    error = error
                )
            } finally {
                runCatching { app.runtime.snapshot() }
                    .onSuccess { snapshot = it }
                    .onFailure {
                        app.runtime.reportRuntimeError("assistant_snapshot", "Assistant window could not refresh status.", it)
                    }
                avatarState = AssistantVisualState.IDLE
                status = "Ready"
            }
        }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            avatarState = AssistantVisualState.LISTENING
            status = "Listening"
            app.voiceManager.transcribeOnce(
                onPartial = { status = "Listening: $it" },
                onFinal = {
                    avatarState = AssistantVisualState.THINKING
                    input = it
                    send(it)
                },
                onError = {
                    avatarState = AssistantVisualState.BLOCKED
                    status = it
                }
            )
        } else {
            avatarState = AssistantVisualState.BLOCKED
            status = "Microphone permission denied."
        }
    }

    LaunchedEffect(Unit) {
        runCatching {
            app.runtime.bootstrap()
            app.runtime.snapshot()
        }.onSuccess {
            snapshot = it
        }.onFailure {
            app.runtime.reportRuntimeError("assistant_startup", "Assistant window recovered from a startup error.", it)
            runCatching { app.runtime.snapshot() }.onSuccess { recovered ->
                snapshot = recovered
            }
        }
        if (initialText.isNotBlank()) {
            send(initialText)
            input = ""
        }
    }

    val currentSession = snapshot?.selectedSessionId
    val pendingQuestions = snapshot?.questions.orEmpty()
        .filter { it.sessionId == currentSession && it.status == "pending" }
        .sortedBy { it.createdAt }
    val activeQuestion = pendingQuestions.firstOrNull()
    val pendingApprovals = snapshot?.approvals.orEmpty()
        .filter { it.sessionId == currentSession && it.status == "pending" }
        .sortedBy { it.createdAt }
    val runningTask = snapshot?.tasks.orEmpty().firstOrNull { it.sessionId == currentSession && it.state == "running" }

    AppBackground(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard(title = "Phone Agent", subtitle = "Compact assistant", icon = "AI", status = status) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    AnimatedAssistantOrb(state = avatarState, size = 60.dp)
                    Column(Modifier.weight(1f)) {
                        StatusPill(status)
                        Text("Screen observe, mic, tool cards, questions, and approvals stay visible.")
                    }
                    OutlinedButton(onClick = onClose) { Text("Close") }
                }
            }
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val events: List<EventEntity> = snapshot?.events.orEmpty().takeLast(18)
                items(events, key = { it.id }) { event ->
                    when (event.type) {
                        "ToolResult", "ToolBlocked" -> ToolCallCard(event = event, onDetails = { _, body -> status = body.take(160) })
                        "TaskFailed" -> ErrorMessageCard(
                            event = event,
                            onDetails = { _, body -> status = body.take(160) },
                            onSetup = { status = "Open the main app Settings tab to finish setup." }
                        )
                        else -> AssistantBubble(event = event, onDetails = { _, body -> status = body.take(160) })
                    }
                }
                if (runningTask != null) {
                    item { ThinkingCard(status = runningTask.step, state = AssistantVisualState.RUNNING_TOOL) }
                }
                items(pendingApprovals, key = { it.id }) { approval ->
                    ApprovalActionCard(
                        approval = approval,
                        onApprove = { grant ->
                            scope.launch {
                                app.runtime.approve(approval.id, grant)
                                snapshot = app.runtime.snapshot()
                            }
                        },
                        onReject = {
                            scope.launch {
                                app.runtime.rejectApproval(approval.id)
                                snapshot = app.runtime.snapshot()
                            }
                        },
                        onDetails = { _, body -> status = body.take(180) }
                    )
                }
            }
            ChatInputBar(
                input = input,
                onInputChange = { input = it },
                enabled = currentSession != null,
                workerMode = app.runtime.selectedWorker,
                onWorkerClick = {},
                onSend = { text ->
                    input = ""
                    if (activeQuestion != null) {
                        scope.launch {
                            app.runtime.answerQuestion(activeQuestion.id, text.trim())
                            snapshot = app.runtime.snapshot()
                        }
                    } else {
                        send(text)
                    }
                },
                onMic = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    } else {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                },
                onTools = { status = app.runtime.toolRegistry.builtInTools().take(12).joinToString(", ") },
                onAttach = { status = "Open the main app Files tab for attachment picking." },
                onScreenObserve = { draft ->
                    scope.launch {
                        avatarState = AssistantVisualState.THINKING
                        status = "Observing screen"
                        app.runtime.bootstrap()
                        app.runtime.askAboutScreen(draft)
                        snapshot = app.runtime.snapshot()
                        avatarState = AssistantVisualState.IDLE
                        status = "Ready"
                    }
                },
                voiceLine = if (status.startsWith("Listening")) status else ""
            )
        }
    }

    activeQuestion?.let { question ->
        QuestionBottomSheet(
            question = question,
            index = pendingQuestions.indexOf(question),
            total = pendingQuestions.size,
            onAnswer = { answer ->
                scope.launch {
                    app.runtime.answerQuestion(question.id, answer)
                    snapshot = app.runtime.snapshot()
                }
            },
            onSkip = {
                scope.launch {
                    app.runtime.skipQuestion(question.id)
                    snapshot = app.runtime.snapshot()
                }
            }
        )
    }
}
