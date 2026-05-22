package com.kizek.phoneagent.ui.onboarding

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.accessibility.AccessibilityNodeSerializer
import com.kizek.phoneagent.accessibility.PhoneAccessibilityService
import com.kizek.phoneagent.ui.components.AnimatedAssistantOrb
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.AssistantVisualState
import com.kizek.phoneagent.ui.components.GlassCard
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class OnboardingStep(val label: String) {
    SPLASH("Startup"),
    INTRO("Intro"),
    API("Mistral"),
    ORCHESTRATOR("Laptop"),
    LOCAL_MODEL("Local model"),
    CONTAINER("Container"),
    ACCESSIBILITY("Accessibility"),
    NOTIFICATIONS("Notifications"),
    FILES("Files"),
    SCREEN_CAPTURE("Screen"),
    COMPLETE("Finish")
}

@Composable
fun OnboardingFlow(
    app: PhoneAgentApplication,
    onComplete: () -> Unit
) {
    var step by remember { mutableStateOf(OnboardingStep.SPLASH) }
    val steps = OnboardingStep.entries
    val next = {
        val index = steps.indexOf(step)
        step = steps.getOrElse(index + 1) { OnboardingStep.COMPLETE }
    }
    val back = {
        val index = steps.indexOf(step)
        step = steps.getOrElse((index - 1).coerceAtLeast(1)) { OnboardingStep.INTRO }
    }

    AnimatedContent(targetState = step, label = "onboarding") { current ->
        when (current) {
            OnboardingStep.SPLASH -> SplashScreen(onDone = { step = OnboardingStep.INTRO })
            OnboardingStep.INTRO -> OnboardingIntroScreen(
                progress = progress(current),
                onNext = next
            )
            OnboardingStep.API -> ApiKeySetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.ORCHESTRATOR -> OrchestratorSetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.LOCAL_MODEL -> LocalModelSetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.CONTAINER -> ContainerSetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.ACCESSIBILITY -> AccessibilitySetupScreen(progress(current), onBack = back, onNext = next)
            OnboardingStep.NOTIFICATIONS -> NotificationPermissionScreen(progress(current), onBack = back, onNext = next)
            OnboardingStep.FILES -> FilePermissionSetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.SCREEN_CAPTURE -> ScreenCaptureSetupScreen(app, progress(current), onBack = back, onNext = next)
            OnboardingStep.COMPLETE -> OnboardingCompleteScreen(
                progress = progress(current),
                onFinish = {
                    app.onboardingManager.complete()
                    onComplete()
                }
            )
        }
    }
}

@Composable
fun SplashScreen(onDone: () -> Unit) {
    val transition = rememberInfiniteTransition(label = "splash")
    val pulse by transition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing), RepeatMode.Reverse),
        label = "pulse"
    )
    val alpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "alpha"
    )
    var activeCheck by remember { mutableIntStateOf(0) }
    val checks = listOf("local runtime", "model provider", "files", "accessibility", "container", "orchestrator")

    LaunchedEffect(Unit) {
        repeat(checks.size) {
            activeCheck = it
            delay(220)
        }
        delay(350)
        onDone()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Box(
                modifier = Modifier
                    .scale(pulse)
                    .alpha(alpha),
                contentAlignment = Alignment.Center
            ) {
                AnimatedAssistantOrb(state = AssistantVisualState.THINKING, size = 92.dp)
            }
            Text("Phone Agent", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                checks.forEachIndexed { index, label ->
                    StatusLine(label = label, active = index == activeCheck, done = index < activeCheck)
                }
            }
        }
    }
}

@Composable
fun OnboardingIntroScreen(
    progress: Float,
    onNext: () -> Unit
) {
    OnboardingFrame("Your agent, on your phone", progress, onNext = onNext, nextLabel = "Start setup") {
        Text("Continue laptop sessions, run phone-local tasks, approve actions, answer question cards, and control your own device with explicit Android permissions.")
        FeatureCard("Remote continue", "Connect to your laptop/server daemon and keep working in the same sessions.")
        FeatureCard("Phone local mode", "Use phone storage, shell, approvals, questions, and device tools inside Android limits.")
        FeatureCard("Hybrid routing", "Choose phone, laptop, server, or hybrid auto per task.")
    }
}

@Composable
fun ApiKeySetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var key by remember { mutableStateOf("") }
    var customModel by remember { mutableStateOf("") }
    var model by remember { mutableStateOf(app.modelRouter.selectedMistralModel) }
    var status by remember { mutableStateOf(if (app.modelRouter.mistral.isConfigured()) "configured" else "missing key") }
    OnboardingFrame("Mistral API", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Set up later") {
        Text("Add a key if you want the phone-local worker to call Mistral directly. The full key is stored with Android Keystore and is never shown in logs.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            app.modelRouter.mistral.modelOptions.forEach { option ->
                FilterChip(selected = model == option, onClick = { model = option }, label = { Text(option.removeSuffix("-latest")) })
            }
        }
        OutlinedTextField(
            value = customModel,
            onValueChange = {
                customModel = it
                if (it.isNotBlank()) model = it
            },
            label = { Text("Custom model") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = key,
            onValueChange = { key = it },
            label = { Text("Mistral API key") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                enabled = key.isNotBlank(),
                onClick = {
                    app.modelRouter.selectedMistralModel = model
                    app.modelRouter.mistral.saveApiKey(key)
                    key = ""
                    status = "configured"
                }
            ) { Text("Save") }
            OutlinedButton(onClick = {
                app.modelRouter.selectedMistralModel = model
                if (key.isNotBlank()) app.modelRouter.mistral.saveApiKey(key)
                scope.launch {
                    status = app.modelRouter.mistral.testConnection(model).fold(
                        onSuccess = { "configured: $it" },
                        onFailure = { error ->
                            when {
                                error.message?.contains("HTTP 401") == true -> "invalid key"
                                error.message?.contains("HTTP") == true -> error.message ?: "network error"
                                else -> "network error: ${error.message}"
                            }
                        }
                    )
                }
            }) { Text("Test API key") }
            OutlinedButton(onClick = {
                app.modelRouter.mistral.removeApiKey()
                status = "missing key"
            }) { Text("Remove") }
        }
        StatusPill(status)
    }
}

@Composable
fun OrchestratorSetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(app.pairingManager.orchestratorUrl) }
    var status by remember { mutableStateOf("not tested") }
    OnboardingFrame("Laptop or server agent", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Use phone offline") {
        Text("Connect to the desktop daemon to continue sessions, stream events, approve actions, and route larger tasks to your laptop/server.")
        OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("Orchestrator URL") }, modifier = Modifier.fillMaxWidth())
        Text("Examples: http://127.0.0.1:4017, http://192.168.x.x:4017, http://100.x.x.x:4017")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                app.pairingManager.orchestratorUrl = url
                scope.launch {
                    val statusResult = app.orchestratorClient.getStatus()
                    val sessions = app.orchestratorClient.listSessions().getOrNull()?.size
                    status = statusResult.fold(
                        onSuccess = { json ->
                            "daemon online / sessions=${sessions ?: "unknown"} / version=${json.optString("version", "unknown")}"
                        },
                        onFailure = { "not reachable: ${it.message}. Check daemon, firewall, LAN/Tailscale IP." }
                    )
                }
            }) { Text("Test connection") }
            OutlinedButton(onClick = {
                app.pairingManager.orchestratorUrl = url
                scope.launch {
                    status = app.orchestratorClient.createPairing("Android phone").fold(
                        onSuccess = { "pairing created: ${it.optString("code", it.toString())}" },
                        onFailure = { "pairing failed: ${it.message}" }
                    )
                }
            }) { Text("Pair device") }
        }
        StatusPill(status)
    }
}

@Composable
fun LocalModelSetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf("Local model runtime not installed yet.") }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            app.localModelManager.importModel(uri)
            status = "Model file selected. Inference still requires a future GGUF/ONNX runtime."
        }
    }
    OnboardingFrame("Local model", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Skip local model") {
        Text("Phone-local model inference is prepared but not installed. You can import a model file now so the manager knows about it later.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { launcher.launch(arrayOf("*/*")) }) { Text("Import model file") }
            OutlinedButton(onClick = { app.modelRouter.selectedRoute = com.kizek.phoneagent.models.ModelRoute.MISTRAL; status = "Using Mistral API route." }) {
                Text("Use Mistral")
            }
            OutlinedButton(onClick = { app.modelRouter.selectedRoute = com.kizek.phoneagent.models.ModelRoute.REMOTE; status = "Using laptop/server model route." }) {
                Text("Use remote")
            }
        }
        app.localModelManager.listModels().forEach { record ->
            FeatureCard(record.name, if (record.active) "Selected, runtime not installed" else "Imported, not active")
        }
        StatusPill(status)
    }
}

@Composable
fun ContainerSetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    var status by remember { mutableStateOf(app.prootManager.status().detail) }
    OnboardingFrame("Local Linux container", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Skip container") {
        val proot = app.prootManager.status()
        Text("A phone container can run richer local commands later. It is only enabled when both an ABI-matched proot binary and rootfs are present.")
        FeatureCard("Architecture", proot.architecture)
        FeatureCard("PRoot", if (proot.prootPresent) proot.prootPath else "missing")
        FeatureCard("Rootfs", if (proot.installed) proot.rootfsPath else "not installed")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { status = app.prootManager.status().detail }) { Text("Check existing") }
            OutlinedButton(onClick = { status = app.prootManager.installRootfsInstructions() }) { Text("Install steps") }
        }
        StatusPill(status)
    }
}

@Composable
fun AccessibilitySetupScreen(
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf("disabled") }
    OnboardingFrame("Phone control", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Set up later") {
        Text("Accessibility lets the agent observe the active window and perform approved actions. Readonly mode observes only; tap/type/swipe require approve/autopilot mode.")
        Text("Banking, payment, password, and authenticator apps are blocked from automatic control.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) { Text("Open settings") }
            OutlinedButton(onClick = {
                val service = PhoneAccessibilityService.instance
                val nodes = AccessibilityNodeSerializer.countNodes(service?.rootInActiveWindow)
                status = if (service == null) "disabled" else "enabled / app=${service.activePackage} / nodes=$nodes"
            }) { Text("Check tree") }
        }
        StatusPill(status)
    }
}

@Composable
fun NotificationPermissionScreen(
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    var status by remember { mutableStateOf(if (Build.VERSION.SDK_INT < 33) "not required before Android 13" else "not requested") }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        status = if (granted) "allowed" else "not allowed"
    }
    OnboardingFrame("Notifications", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Set up later") {
        Text("Long-running phone-local tasks use a visible foreground-service notification. The app does not run hidden background agent work.")
        Button(onClick = {
            if (Build.VERSION.SDK_INT >= 33) {
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                status = "allowed on this Android version"
            }
        }) { Text("Request permission") }
        StatusPill(status)
    }
}

@Composable
fun FilePermissionSetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf(app.workspaceManager.status().detail) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            app.workspaceManager.useTree(uri)
            status = "Workspace folder selected."
        }
    }
    OnboardingFrame("Project workspace", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue") {
        Text("Choose where the phone agent stores projects. App-private storage works immediately; external folders need Android's document picker.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                app.workspaceManager.usePrivateWorkspace()
                status = app.workspaceManager.status().detail
            }) { Text("Use app workspace") }
            OutlinedButton(onClick = { launcher.launch(null) }) { Text("Pick folder") }
            OutlinedButton(onClick = {
                app.workspaceManager.markAllFilesAdvancedRequested()
                status = app.workspaceManager.status().detail
            }) { Text("Advanced") }
        }
        FeatureCard("Current workspace", app.workspaceManager.status().label)
        StatusPill(status)
    }
}

@Composable
fun ScreenCaptureSetupScreen(
    app: PhoneAgentApplication,
    progress: Float,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf(app.screenCaptureManager.status().detail) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val granted = result.resultCode == Activity.RESULT_OK
        if (granted && result.data != null) {
            app.screenCaptureManager.captureOnce(result.resultCode, result.data!!)
            status = "Permission granted. One-shot screenshot capture service started."
        } else {
            app.screenCaptureManager.markPermissionResult(false)
            status = "Permission not granted."
        }
    }
    OnboardingFrame("Screen understanding", progress, onBack = onBack, onNext = onNext, nextLabel = "Continue", skipLabel = "Skip screen capture") {
        Text("Screen capture is optional and always uses the Android system prompt. A visible foreground service captures one screenshot after you approve.")
        Button(onClick = {
            val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            launcher.launch(manager.createScreenCaptureIntent())
        }) { Text("Request screen capture") }
        StatusPill(status)
    }
}

@Composable
fun OnboardingCompleteScreen(
    progress: Float,
    onFinish: () -> Unit
) {
    OnboardingFrame("Ready", progress, onNext = onFinish, nextLabel = "Open app") {
        Text("Phone Agent is set up. You can revisit every permission and provider from Settings, including resetting this setup wizard.")
        FeatureCard("Local mode", "Ready with app storage, tasks, questions, approvals, and shell.")
        FeatureCard("Remote mode", "Available when your laptop/server daemon is reachable.")
        FeatureCard("Device control", "Only after you manually enable AccessibilityService.")
    }
}

@Composable
private fun OnboardingFrame(
    title: String,
    progress: Float,
    onBack: (() -> Unit)? = null,
    onNext: () -> Unit,
    nextLabel: String = "Continue",
    skipLabel: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    AppBackground(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AnimatedAssistantOrb(state = AssistantVisualState.IDLE, size = 42.dp)
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                    Text("Step ${(progress * OnboardingStep.entries.size).toInt()} of ${OnboardingStep.entries.size}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
            GlassCard(status = "Setup", icon = "AI") {
                content()
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                if (onBack != null) {
                    OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Back") }
                }
                if (skipLabel != null) {
                    OutlinedButton(onClick = onNext, modifier = Modifier.weight(1f)) { Text(skipLabel) }
                }
                Button(onClick = onNext, modifier = Modifier.weight(1f)) { Text(nextLabel) }
            }
        }
    }
}

@Composable
private fun FeatureCard(title: String, detail: String) {
    GlassCard(title = title, subtitle = detail, icon = "OK", status = "Ready") {
    }
}

@Composable
private fun StatusLine(label: String, active: Boolean, done: Boolean) {
    val color = when {
        done -> MaterialTheme.colorScheme.primary
        active -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.55f)
    }
    Text("${if (done) "OK" else if (active) "..." else "--"}  $label", color = color)
}

@Composable
private fun StatusPill(status: String) {
    GlassCard(icon = "INFO", status = status) {
        Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun progress(step: OnboardingStep): Float {
    return (OnboardingStep.entries.indexOf(step) + 1).toFloat() / OnboardingStep.entries.size.toFloat()
}
