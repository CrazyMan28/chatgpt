package com.kizek.phoneagent.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService
import com.kizek.phoneagent.core.RuntimeSnapshot
import com.kizek.phoneagent.core.WorkerMode
import com.kizek.phoneagent.storage.TaskEntity
import com.kizek.phoneagent.ui.components.DetailsSheet
import com.kizek.phoneagent.ui.components.StatusBar
import com.kizek.phoneagent.ui.onboarding.OnboardingFlow
import com.kizek.phoneagent.ui.screens.ApprovalsScreen
import com.kizek.phoneagent.ui.screens.AssistantModeScreen
import com.kizek.phoneagent.ui.screens.ChatScreen
import com.kizek.phoneagent.ui.screens.ContainerScreen
import com.kizek.phoneagent.ui.screens.ContainerSettingsScreen
import com.kizek.phoneagent.ui.screens.ConsoleScreen
import com.kizek.phoneagent.ui.screens.DiagnosticsScreen
import com.kizek.phoneagent.ui.screens.DeveloperTestsScreen
import com.kizek.phoneagent.ui.screens.DeviceControlScreen
import com.kizek.phoneagent.ui.screens.ExecutionFallbackSettingsScreen
import com.kizek.phoneagent.ui.screens.FilesScreen
import com.kizek.phoneagent.ui.screens.HomeDashboardScreen
import com.kizek.phoneagent.ui.screens.LocalModelSettingsScreen
import com.kizek.phoneagent.ui.screens.LocalHttpProviderSettingsScreen
import com.kizek.phoneagent.ui.screens.MistralSettingsScreen
import com.kizek.phoneagent.ui.screens.McpScreen
import com.kizek.phoneagent.ui.screens.ModelsScreen
import com.kizek.phoneagent.ui.screens.OllamaProviderSettingsScreen
import com.kizek.phoneagent.ui.screens.OpenAiCompatibleSettingsScreen
import com.kizek.phoneagent.ui.screens.ProviderFallbackSettingsScreen
import com.kizek.phoneagent.ui.screens.QuestionsScreen
import com.kizek.phoneagent.ui.screens.RuntimeSettingsScreen
import com.kizek.phoneagent.ui.screens.SessionsScreen
import com.kizek.phoneagent.ui.screens.SettingsScreen
import com.kizek.phoneagent.ui.screens.SshAgentSettingsScreen
import com.kizek.phoneagent.ui.screens.TasksScreen
import com.kizek.phoneagent.ui.screens.TermuxBridgeSettingsScreen
import com.kizek.phoneagent.ui.screens.ToolsScreen
import com.kizek.phoneagent.ui.screens.VoiceScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class AppScreen(val title: String) {
    HOME("Home"),
    SESSIONS("Sessions"),
    CHAT("Chat"),
    TASKS("Tasks"),
    APPROVALS("Approvals"),
    QUESTIONS("Questions"),
    TOOLS("Tools"),
    FILES("Files"),
    CONSOLE("Console"),
    DEVICE("Device"),
    MCP("MCP"),
    MODELS("Models"),
    VOICE("Voice"),
    ASSISTANT("Assistant"),
    CONTAINER("Container"),
    SETTINGS("Settings"),
    MISTRAL_SETTINGS("Mistral Settings"),
    OPENAI_COMPAT_SETTINGS("OpenAI Compatible"),
    LOCAL_HTTP_SETTINGS("Local HTTP"),
    OLLAMA_SETTINGS("Ollama"),
    PROVIDER_FALLBACK_SETTINGS("AI Fallback"),
    LOCAL_MODEL_SETTINGS("Local Model"),
    RUNTIME_SETTINGS("Runtime"),
    CONTAINER_SETTINGS("PRoot Settings"),
    TERMUX_SETTINGS("Termux Bridge"),
    SSH_SETTINGS("SSH Agent"),
    FALLBACK_SETTINGS("Fallback Order"),
    DIAGNOSTICS("Diagnostics"),
    DEVELOPER("Developer Tests")
}

private val mainTabs = listOf(
    AppScreen.CHAT,
    AppScreen.TASKS,
    AppScreen.TOOLS,
    AppScreen.FILES,
    AppScreen.SETTINGS
)

@Composable
fun AppRoot(app: PhoneAgentApplication) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf(AppScreen.CHAT) }
    var snapshot by remember { mutableStateOf(emptySnapshot()) }
    var detail by remember { mutableStateOf<Pair<String, String>?>(null) }
    var workerMode by remember { mutableStateOf(app.runtime.selectedWorker) }
    var lastSpokenEventId by remember { mutableStateOf<String?>(null) }
    var showOnboarding by remember {
        mutableStateOf(
            !app.onboardingManager.status(
                mistralConfigured = app.modelRouter.mistral.isConfigured(),
                orchestratorConfigured = app.pairingManager.orchestratorUrl.isNotBlank(),
                accessibilityEnabled = PhoneAccessibilityService.instance != null,
                notificationsAllowed = notificationsAllowed(context),
                workspaceSelected = app.workspaceManager.status().ready,
                containerInstalled = app.prootManager.status().installed,
                localModelConfigured = app.localModelManager.configured(),
                screenCaptureConfigured = app.screenCaptureManager.status().configured
            ).firstRunCompleted
        )
    }

    fun applySnapshot(next: RuntimeSnapshot, speak: Boolean = false) {
        snapshot = next
        workerMode = app.runtime.selectedWorker
        if (speak) {
            val event = next.events.lastOrNull { it.type == "MessageAdded" && it.author == "assistant" }
            if (event != null && event.id != lastSpokenEventId) {
                lastSpokenEventId = event.id
                app.voiceManager.speakAssistantReply(event.summary)
            }
        }
    }

    fun refresh() {
        scope.launch {
            runCatching { app.runtime.snapshot() }
                .onSuccess { applySnapshot(it) }
                .onFailure {
                    app.runtime.reportRuntimeError("snapshot", "Phone Agent could not refresh status.", it)
                    runCatching { app.runtime.snapshot() }.onSuccess { recovered ->
                        applySnapshot(recovered)
                    }
                }
        }
    }

    fun runAndRefresh(speak: Boolean = true, block: suspend () -> Unit) {
        scope.launch {
            val job = launch {
                try {
                    block()
                } catch (error: Exception) {
                    app.runtime.reportRuntimeError(
                        source = "ui_action",
                        message = "Phone Agent stopped that action after an internal error.",
                        error = error
                    )
                }
            }
            while (job.isActive) {
                delay(700)
                runCatching { app.runtime.snapshot() }.onSuccess {
                    applySnapshot(it, speak = false)
                }
            }
            job.join()
            runCatching { app.runtime.snapshot() }
                .onSuccess { applySnapshot(it, speak = speak) }
                .onFailure {
                    app.runtime.reportRuntimeError("snapshot", "Phone Agent could not refresh status.", it)
                    runCatching { app.runtime.snapshot() }.onSuccess { recovered ->
                        applySnapshot(recovered, speak = false)
                    }
                }
        }
    }

    LaunchedEffect(Unit) {
        runCatching {
            app.runtime.bootstrap()
            app.runtime.snapshot()
        }.onSuccess {
            applySnapshot(it)
        }.onFailure {
            app.runtime.reportRuntimeError("startup", "Phone Agent recovered from a startup error.", it)
            runCatching { app.runtime.snapshot() }.onSuccess { recovered ->
                applySnapshot(recovered)
            }
        }
    }

    if (showOnboarding) {
        OnboardingFlow(app = app, onComplete = {
            showOnboarding = false
            refresh()
        })
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (screen != AppScreen.CHAT) {
                StatusBar(
                    title = screen.title,
                    remoteStatus = snapshot.remoteStatus,
                    workerMode = workerMode,
                    modelProvider = "model ${app.modelRouter.selectedRoute.name.lowercase()}",
                    voiceStatus = "voice ${if (app.voiceManager.status().micPermissionGranted) "ready" else "mic off"}",
                    deviceStatus = "screen ${if (app.screenCaptureManager.status().configured) "ready" else "off"} / access ${app.accessibilityTools.status().substringBefore(" / ")}"
                )
            }
        },
        bottomBar = {
            NavigationBar(modifier = Modifier.height(64.dp)) {
                mainTabs.forEach { item ->
                    NavigationBarItem(
                        selected = screen == item,
                        onClick = { screen = item },
                        icon = {
                            Icon(
                                imageVector = when (item) {
                                    AppScreen.CHAT -> Icons.Filled.Chat
                                    AppScreen.TASKS -> Icons.Filled.Assignment
                                    AppScreen.TOOLS -> Icons.Filled.Build
                                    AppScreen.FILES -> Icons.Filled.Folder
                                    AppScreen.SETTINGS -> Icons.Filled.Settings
                                    else -> Icons.Filled.Chat
                                },
                                contentDescription = item.title
                            )
                        },
                        label = {
                            Text(
                                item.title,
                                maxLines = 1,
                                overflow = TextOverflow.Clip,
                                textAlign = TextAlign.Center
                            )
                        },
                        alwaysShowLabel = true
                    )
                }
            }
        }
    ) { padding ->
        val modifier = Modifier.padding(padding)
        when (screen) {
            AppScreen.HOME -> HomeDashboardScreen(
                app = app,
                remoteStatus = snapshot.remoteStatus,
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.SESSIONS -> SessionsScreen(
                snapshot = snapshot,
                onCreate = { runAndRefresh { app.runtime.createLocalSession() } },
                onRefreshRemote = {
                    runAndRefresh {
                        app.runtime.refreshRemoteSessions().onFailure {
                            app.runtime.appendConsole("Remote sync failed: ${it.message}")
                        }
                    }
                },
                onOpen = { id -> runAndRefresh { app.runtime.selectSession(id); screen = AppScreen.CHAT } },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.CHAT -> ChatScreen(
                app = app,
                snapshot = snapshot,
                workerMode = workerMode,
                onWorkerSelected = {
                    app.runtime.selectedWorker = it
                    workerMode = it
                    refresh()
                },
                onSend = { text -> runAndRefresh { app.runtime.sendMessage(text) } },
                onOpenSessions = { screen = AppScreen.SESSIONS },
                onOpenTools = { screen = AppScreen.TOOLS },
                onOpenFiles = { screen = AppScreen.FILES },
                onOpenSettings = { screen = AppScreen.SETTINGS },
                onNewChat = {
                    runAndRefresh(speak = false) {
                        app.runtime.createLocalSession("New phone session")
                    }
                    screen = AppScreen.CHAT
                },
                onScreenObserve = { draft -> runAndRefresh { app.runtime.askAboutScreen(draft) } },
                onApprove = { id, scopeName -> runAndRefresh { app.runtime.approve(id, scopeName) } },
                onRejectApproval = { id -> runAndRefresh { app.runtime.rejectApproval(id) } },
                onAnswerQuestion = { id, answer -> runAndRefresh { app.runtime.answerQuestion(id, answer) } },
                onSkipQuestion = { id -> runAndRefresh { app.runtime.skipQuestion(id) } },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.TASKS -> TasksScreen(
                snapshot = snapshot,
                onTaskAction = { action, task -> runAndRefresh { mutateTask(app, action, task) } },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.APPROVALS -> ApprovalsScreen(
                snapshot = snapshot,
                onApprove = { id, scopeName -> runAndRefresh { app.runtime.approve(id, scopeName) } },
                onReject = { id -> runAndRefresh { app.runtime.rejectApproval(id) } },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.QUESTIONS -> QuestionsScreen(
                snapshot = snapshot,
                onAnswer = { id, answer -> runAndRefresh { app.runtime.answerQuestion(id, answer) } },
                onSkip = { id -> runAndRefresh { app.runtime.skipQuestion(id) } },
                onRefreshRemote = {
                    runAndRefresh {
                        app.runtime.refreshRemoteQuestions().onFailure {
                            app.runtime.appendConsole("Remote question sync failed: ${it.message}")
                        }
                    }
                },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.TOOLS -> ToolsScreen(
                app = app,
                onOpenSecondary = { target ->
                    screen = when (target) {
                        "home" -> AppScreen.HOME
                        "sessions" -> AppScreen.SESSIONS
                        "approvals" -> AppScreen.APPROVALS
                        "questions" -> AppScreen.QUESTIONS
                        "console" -> AppScreen.CONSOLE
                        "files" -> AppScreen.FILES
                        "device" -> AppScreen.DEVICE
                        "models" -> AppScreen.MODELS
                        "mcp" -> AppScreen.MCP
                        "voice" -> AppScreen.VOICE
                        "assistant" -> AppScreen.ASSISTANT
                        "container" -> AppScreen.CONTAINER
                        "container-settings" -> AppScreen.CONTAINER_SETTINGS
                        "mistral" -> AppScreen.MISTRAL_SETTINGS
                        "openai-compatible" -> AppScreen.OPENAI_COMPAT_SETTINGS
                        "local-http" -> AppScreen.LOCAL_HTTP_SETTINGS
                        "ollama" -> AppScreen.OLLAMA_SETTINGS
                        "provider-fallback" -> AppScreen.PROVIDER_FALLBACK_SETTINGS
                        "local-model" -> AppScreen.LOCAL_MODEL_SETTINGS
                        "runtime" -> AppScreen.RUNTIME_SETTINGS
                        "diagnostics" -> AppScreen.DIAGNOSTICS
                        "termux" -> AppScreen.TERMUX_SETTINGS
                        "ssh" -> AppScreen.SSH_SETTINGS
                        "fallback" -> AppScreen.FALLBACK_SETTINGS
                        "developer" -> AppScreen.DEVELOPER
                        "settings" -> AppScreen.SETTINGS
                        else -> AppScreen.TOOLS
                    }
                },
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.FILES -> FilesScreen(app = app, modifier = modifier)
            AppScreen.CONSOLE -> ConsoleScreen(app = app, modifier = modifier)
            AppScreen.DEVICE -> DeviceControlScreen(app = app, modifier = modifier)
            AppScreen.MCP -> McpScreen(
                app = app,
                onDetails = { title, body -> detail = title to body },
                modifier = modifier
            )
            AppScreen.MODELS -> ModelsScreen(app = app, modifier = modifier)
            AppScreen.VOICE -> VoiceScreen(app = app, modifier = modifier)
            AppScreen.ASSISTANT -> AssistantModeScreen(app = app, modifier = modifier)
            AppScreen.CONTAINER -> ContainerScreen(app = app, modifier = modifier)
            AppScreen.CONTAINER_SETTINGS -> ContainerSettingsScreen(app = app, modifier = modifier)
            AppScreen.MISTRAL_SETTINGS -> MistralSettingsScreen(app = app, modifier = modifier)
            AppScreen.OPENAI_COMPAT_SETTINGS -> OpenAiCompatibleSettingsScreen(app = app, modifier = modifier)
            AppScreen.LOCAL_HTTP_SETTINGS -> LocalHttpProviderSettingsScreen(app = app, modifier = modifier)
            AppScreen.OLLAMA_SETTINGS -> OllamaProviderSettingsScreen(app = app, modifier = modifier)
            AppScreen.PROVIDER_FALLBACK_SETTINGS -> ProviderFallbackSettingsScreen(app = app, modifier = modifier)
            AppScreen.LOCAL_MODEL_SETTINGS -> LocalModelSettingsScreen(app = app, modifier = modifier)
            AppScreen.RUNTIME_SETTINGS -> RuntimeSettingsScreen(
                app = app,
                onOpen = { target ->
                    screen = when (target) {
                        "container-settings" -> AppScreen.CONTAINER_SETTINGS
                        "termux" -> AppScreen.TERMUX_SETTINGS
                        "ssh" -> AppScreen.SSH_SETTINGS
                        "fallback" -> AppScreen.FALLBACK_SETTINGS
                        "settings" -> AppScreen.SETTINGS
                        else -> AppScreen.RUNTIME_SETTINGS
                    }
                },
                modifier = modifier
            )
            AppScreen.TERMUX_SETTINGS -> TermuxBridgeSettingsScreen(app = app, modifier = modifier)
            AppScreen.SSH_SETTINGS -> SshAgentSettingsScreen(app = app, modifier = modifier)
            AppScreen.FALLBACK_SETTINGS -> ExecutionFallbackSettingsScreen(app = app, modifier = modifier)
            AppScreen.DIAGNOSTICS -> DiagnosticsScreen(
                app = app,
                onOpenTarget = { target ->
                    screen = when (target) {
                        "mistral" -> AppScreen.MISTRAL_SETTINGS
                        "openai-compatible" -> AppScreen.OPENAI_COMPAT_SETTINGS
                        "local-http" -> AppScreen.LOCAL_HTTP_SETTINGS
                        "ollama" -> AppScreen.OLLAMA_SETTINGS
                        "provider-fallback" -> AppScreen.PROVIDER_FALLBACK_SETTINGS
                        "local-model" -> AppScreen.LOCAL_MODEL_SETTINGS
                        "runtime" -> AppScreen.RUNTIME_SETTINGS
                        "container-settings" -> AppScreen.CONTAINER_SETTINGS
                        "termux" -> AppScreen.TERMUX_SETTINGS
                        "ssh" -> AppScreen.SSH_SETTINGS
                        "fallback" -> AppScreen.FALLBACK_SETTINGS
                        "device" -> AppScreen.DEVICE
                        "voice" -> AppScreen.VOICE
                        "assistant" -> AppScreen.ASSISTANT
                        "approvals" -> AppScreen.APPROVALS
                        "developer" -> AppScreen.DEVELOPER
                        "settings" -> AppScreen.SETTINGS
                        else -> AppScreen.DIAGNOSTICS
                    }
                },
                modifier = modifier
            )
            AppScreen.SETTINGS -> SettingsScreen(
                app = app,
                onOpenSettingsTarget = { target ->
                    screen = when (target) {
                        "mistral" -> AppScreen.MISTRAL_SETTINGS
                        "openai-compatible" -> AppScreen.OPENAI_COMPAT_SETTINGS
                        "local-http" -> AppScreen.LOCAL_HTTP_SETTINGS
                        "ollama" -> AppScreen.OLLAMA_SETTINGS
                        "provider-fallback" -> AppScreen.PROVIDER_FALLBACK_SETTINGS
                        "local-model" -> AppScreen.LOCAL_MODEL_SETTINGS
                        "runtime" -> AppScreen.RUNTIME_SETTINGS
                        "container-settings" -> AppScreen.CONTAINER_SETTINGS
                        "termux" -> AppScreen.TERMUX_SETTINGS
                        "ssh" -> AppScreen.SSH_SETTINGS
                        "fallback" -> AppScreen.FALLBACK_SETTINGS
                        "device" -> AppScreen.DEVICE
                        "voice" -> AppScreen.VOICE
                        "assistant" -> AppScreen.ASSISTANT
                        "approvals" -> AppScreen.APPROVALS
                        "developer" -> AppScreen.DEVELOPER
                        "diagnostics" -> AppScreen.DIAGNOSTICS
                        else -> AppScreen.SETTINGS
                    }
                },
                onRerunOnboarding = {
                    app.onboardingManager.reset()
                    showOnboarding = true
                },
                modifier = modifier
            )
            AppScreen.DEVELOPER -> DeveloperTestsScreen(app = app, modifier = modifier)
        }
    }

    detail?.let { (title, body) ->
        DetailsSheet(title = title, body = body, onDismiss = { detail = null })
    }
}

private fun notificationsAllowed(context: android.content.Context): Boolean {
    return Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
}

private suspend fun mutateTask(app: PhoneAgentApplication, action: String, task: TaskEntity) {
    when (action) {
        "pause" -> app.runtime.taskQueue.pause(task.id)
        "resume" -> app.runtime.taskQueue.resume(task.id)
        "retry" -> app.runtime.taskQueue.retry(task.id)
        "cancel" -> app.runtime.taskQueue.cancel(task.id)
    }
}

private fun emptySnapshot(): RuntimeSnapshot {
    return RuntimeSnapshot(
        sessions = emptyList(),
        events = emptyList(),
        tasks = emptyList(),
        approvals = emptyList(),
        questions = emptyList(),
        selectedSessionId = null,
        consoleLines = emptyList(),
        remoteStatus = "checking"
    )
}
