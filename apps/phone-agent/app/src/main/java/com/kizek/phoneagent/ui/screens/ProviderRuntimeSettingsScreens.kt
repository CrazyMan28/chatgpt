package com.kizek.phoneagent.ui.screens

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.models.MistralConnectionState
import com.kizek.phoneagent.models.MistralProvider
import com.kizek.phoneagent.models.HttpChatProvider
import com.kizek.phoneagent.models.HttpEndpointStyle
import com.kizek.phoneagent.models.ModelRoute
import com.kizek.phoneagent.runtime.ExecutionRouteManager
import com.kizek.phoneagent.runtime.ExecutionRuntime
import com.kizek.phoneagent.runtime.SshAgentManager
import com.kizek.phoneagent.runtime.SshTarget
import com.kizek.phoneagent.runtime.TermuxBridgeSettings
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import com.kizek.phoneagent.ui.components.SubsystemStatusCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

@Composable
fun MistralSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val mistral = app.modelRouter.mistral
    var apiKey by remember { mutableStateOf("") }
    var baseUrl by remember { mutableStateOf(mistral.baseUrl) }
    var model by remember { mutableStateOf(mistral.selectedModel) }
    var customModel by remember { mutableStateOf("") }
    var visionModel by remember { mutableStateOf(mistral.selectedVisionModel) }
    var maxTokens by remember { mutableStateOf(mistral.maxTokens.toString()) }
    var temperature by remember { mutableStateOf(mistral.temperature.toString()) }
    var timeout by remember { mutableStateOf(mistral.timeoutSeconds.toString()) }
    var status by remember { mutableStateOf(if (mistral.isConfigured()) "configured" else "missing key") }
    var statusDetail by remember { mutableStateOf("") }

    SettingsScaffold(modifier) {
        GlassCard(title = "Mistral API", subtitle = "Cloud model provider settings stored with Android Keystore for the API key.", icon = "AI", status = status) {
            StatusPill(mistral.maskedApiKey(), if (mistral.isConfigured()) StatusTone.READY else StatusTone.OFFLINE)
        }
        OutlinedTextField(apiKey, { apiKey = it }, label = { Text("API key") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(baseUrl, { baseUrl = it }, label = { Text("Base URL") }, modifier = Modifier.fillMaxWidth())
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (mistral.modelOptions + "custom").forEach { option ->
                FilterChip(
                    selected = model == option || (option == "custom" && customModel.isNotBlank()),
                    onClick = { model = option },
                    label = { Text(option) }
                )
            }
        }
        OutlinedTextField(customModel, {
            customModel = it
            if (it.isNotBlank()) model = it
        }, label = { Text("Custom chat model") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(visionModel, { visionModel = it }, label = { Text("Vision model") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(maxTokens, { maxTokens = it.filter(Char::isDigit) }, label = { Text("Max tokens") }, modifier = Modifier.weight(1f))
            OutlinedTextField(temperature, { temperature = it }, label = { Text("Temperature") }, modifier = Modifier.weight(1f))
            OutlinedTextField(timeout, { timeout = it.filter(Char::isDigit) }, label = { Text("Timeout") }, modifier = Modifier.weight(1f))
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                mistral.baseUrl = baseUrl.ifBlank { MistralProvider.DEFAULT_BASE_URL }
                mistral.selectedModel = model.ifBlank { "mistral-small-latest" }
                mistral.selectedVisionModel = visionModel
                mistral.maxTokens = maxTokens.toIntOrNull() ?: 512
                mistral.temperature = temperature.toDoubleOrNull() ?: 0.2
                mistral.timeoutSeconds = timeout.toLongOrNull() ?: 30L
                if (apiKey.isNotBlank()) {
                    mistral.saveApiKey(apiKey)
                    apiKey = ""
                }
                status = if (mistral.isConfigured()) "configured" else "missing key"
                statusDetail = "Mistral settings saved. Full API key was not logged."
            }) { Text("Save") }
            OutlinedButton(onClick = {
                scope.launch {
                    val result = mistral.testConnectionStatus(model.ifBlank { mistral.selectedModel })
                    status = result.state.label
                    statusDetail = result.detail
                    if (result.state == MistralConnectionState.CONFIGURED) app.modelRouter.selectedMistralModel = model
                }
            }) { Text("Test connection") }
            OutlinedButton(onClick = {
                mistral.removeApiKey()
                status = "missing key"
                statusDetail = "Mistral key removed."
            }) { Text("Remove key") }
        }
        Text(listOf(status, statusDetail).filter { it.isNotBlank() }.joinToString("\n"), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun LocalModelSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var refresh by remember { mutableStateOf(0) }
    var statusText by remember { mutableStateOf(app.localModelManager.runtimeStatus().detail) }
    var prompt by remember { mutableStateOf("Say ok") }
    val status = remember(refresh) { app.localModelManager.runtimeStatus() }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            app.localModelManager.importModel(uri)
            refresh += 1
            statusText = "Imported ${uri.lastPathSegment ?: "model file"}."
        }
    }

    SettingsScaffold(modifier) {
        GlassCard(title = "Local Model", subtitle = "Imported files are tracked. Inference only runs when a real backend is linked.", icon = "LOCAL", status = if (status.ready) "ready" else status.backend.label) {
            Text(status.detail)
            StatusPill("Backend: ${status.backend.label}", if (status.ready) StatusTone.READY else StatusTone.SETUP)
            Text("RAM/storage warning: phone-local models may need several GB of storage and RAM. Use smaller quantized models or route to Termux/SSH/server for heavy work.")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { importLauncher.launch(arrayOf("*/*")) }, modifier = Modifier.weight(1f)) { Text("Import model") }
            OutlinedButton(onClick = {
                val result = app.localModelManager.testPrompt(prompt)
                statusText = result.fold(onSuccess = { it }, onFailure = { it.message ?: "Local model test failed." })
            }, modifier = Modifier.weight(1f)) { Text("Test local prompt") }
        }
        OutlinedTextField(prompt, { prompt = it }, label = { Text("Test prompt") }, modifier = Modifier.fillMaxWidth())
        status.importedModels.forEach { record ->
            GlassCard(
                title = record.name,
                subtitle = if (record.active) "Active local model file" else "Imported model file",
                icon = "AI",
                status = if (record.active) "active" else "imported",
                actions = {
                    OutlinedButton(onClick = {
                        app.localModelManager.setActive(record.uri)
                        refresh += 1
                    }) { Text("Set active") }
                    OutlinedButton(onClick = {
                        app.localModelManager.deleteModel(record.uri)
                        refresh += 1
                    }) { Text("Delete") }
                }
            ) {
                Text(record.uri, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        GlassCard(title = "Backend docs", subtitle = "Supported formats and next steps.", icon = "DOC", status = "honest status") {
            Text(status.supportedFormats.joinToString("\n") { "- $it" })
            Text(status.nextSteps)
            Text(statusText, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun OpenAiCompatibleSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    HttpProviderSettingsScreen(
        title = "OpenAI Compatible",
        subtitle = "Chat Completions-compatible provider. Works with OpenAI, Mistral-compatible endpoints, LM Studio, OpenWebUI, or custom /v1 servers.",
        provider = app.modelRouter.openAiCompatible,
        route = ModelRoute.OPENAI_COMPATIBLE,
        app = app,
        modifier = modifier,
        quickNotes = listOf(
            "Base URL examples: https://api.openai.com/v1, http://127.0.0.1:11434/v1, http://192.168.x.x:11434/v1, http://100.x.x.x:11434/v1.",
            "API key is optional for local APIs and encrypted when saved. Full keys are never logged."
        )
    )
}

@Composable
fun LocalHttpProviderSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    HttpProviderSettingsScreen(
        title = "Local HTTP Provider",
        subtitle = "Quick setup for phone-local, Termux, laptop LAN/Tailscale, LM Studio, OpenWebUI, Ollama, or simple custom chat endpoints.",
        provider = app.modelRouter.localHttp,
        route = ModelRoute.LOCAL_HTTP,
        app = app,
        modifier = modifier,
        quickNotes = localNetworkNotes()
    )
}

@Composable
fun OllamaProviderSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    HttpProviderSettingsScreen(
        title = "Ollama",
        subtitle = "Native /api/chat plus optional OpenAI-compatible /v1 mode if your server exposes it.",
        provider = app.modelRouter.ollama,
        route = ModelRoute.OLLAMA,
        app = app,
        modifier = modifier,
        quickNotes = listOf(
            "Base URL examples: http://127.0.0.1:11434, http://192.168.x.x:11434, http://100.x.x.x:11434.",
            "Use Ollama native for /api/tags and /api/chat, or OpenAI-compatible when the server exposes /v1/chat/completions."
        ) + localNetworkNotes()
    )
}

@Composable
private fun HttpProviderSettingsScreen(
    title: String,
    subtitle: String,
    provider: HttpChatProvider,
    route: ModelRoute,
    app: PhoneAgentApplication,
    modifier: Modifier,
    quickNotes: List<String>
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(provider.providerName) }
    var baseUrl by remember { mutableStateOf(provider.baseUrl) }
    var apiKey by remember { mutableStateOf("") }
    var model by remember { mutableStateOf(provider.model) }
    var timeout by remember { mutableStateOf(provider.timeoutSeconds.toString()) }
    var maxTokens by remember { mutableStateOf(provider.maxTokens.toString()) }
    var temperature by remember { mutableStateOf(provider.temperature.toString()) }
    var style by remember { mutableStateOf(provider.endpointStyle) }
    var vision by remember { mutableStateOf(provider.supportsVision) }
    var tools by remember { mutableStateOf(provider.supportsTools) }
    var enabled by remember { mutableStateOf(provider.enabled) }
    var status by remember { mutableStateOf(if (provider.enabled) "configured" else "not configured") }
    var output by remember { mutableStateOf("") }
    var modelList by remember { mutableStateOf<List<String>>(emptyList()) }

    fun save() {
        provider.providerName = name
        provider.baseUrl = baseUrl
        provider.model = model
        provider.endpointStyle = style
        provider.supportsVision = vision
        provider.supportsTools = tools
        provider.timeoutSeconds = timeout.toLongOrNull() ?: provider.timeoutSeconds
        provider.maxTokens = maxTokens.toIntOrNull() ?: provider.maxTokens
        provider.temperature = temperature.toDoubleOrNull() ?: provider.temperature
        provider.enabled = enabled
        provider.saveApiKey(apiKey)
        apiKey = ""
        status = if (provider.enabled) "configured" else "disabled"
        output = "Settings saved. API key was not logged."
    }

    SettingsScaffold(modifier) {
        GlassCard(title = title, subtitle = subtitle, icon = "AI", status = status) {
            StatusPill(provider.maskedApiKey(), if (provider.hasApiKey()) StatusTone.READY else StatusTone.SETUP)
            Text("Active provider chip will show ${provider.providerName} when this route answers.")
        }
        OutlinedTextField(name, { name = it }, label = { Text("Provider name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(baseUrl, { baseUrl = it }, label = { Text("Base URL") }, modifier = Modifier.fillMaxWidth())
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HttpEndpointStyle.entries.forEach { option ->
                FilterChip(selected = style == option, onClick = { style = option }, label = { Text(option.label) })
            }
        }
        OutlinedTextField(apiKey, { apiKey = it }, label = { Text("API key (optional for local APIs)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(model, { model = it }, label = { Text("Model") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(timeout, { timeout = it.filter(Char::isDigit) }, label = { Text("Timeout") }, modifier = Modifier.weight(1f))
            OutlinedTextField(maxTokens, { maxTokens = it.filter(Char::isDigit) }, label = { Text("Max tokens") }, modifier = Modifier.weight(1f))
            OutlinedTextField(temperature, { temperature = it }, label = { Text("Temperature") }, modifier = Modifier.weight(1f))
        }
        ToggleRow("Enable provider", enabled) { enabled = it }
        ToggleRow("Supports vision", vision) { vision = it }
        ToggleRow("Supports tools", tools) { tools = it }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { save() }) { Text("Save / Add Provider") }
            OutlinedButton(onClick = {
                save()
                app.modelRouter.selectedRoute = route
                output = "Active provider route set to ${route.name.lowercase().replace('_', '-')}"
            }) { Text("Set Active Provider") }
            OutlinedButton(onClick = {
                scope.launch {
                    save()
                    status = "testing"
                    output = provider.testConnection(model).fold(
                        onSuccess = { status = "configured"; it },
                        onFailure = { status = "offline"; "Provider test failed: ${it.message}" }
                    )
                }
            }) { Text("Test Provider") }
            OutlinedButton(onClick = {
                scope.launch {
                    save()
                    modelList = provider.listModels().getOrElse { error ->
                        output = "Model list failed: ${error.message}"
                        emptyList()
                    }
                    if (modelList.isNotEmpty()) output = "Found ${modelList.size} model(s)."
                }
            }) { Text(if (route == ModelRoute.OLLAMA) "List models" else "Models") }
            OutlinedButton(onClick = {
                provider.removeApiKey()
                output = "API key removed."
            }) { Text("Remove key") }
            OutlinedButton(onClick = {
                provider.deleteProvider()
                enabled = false
                status = "deleted"
                output = "Provider settings deleted."
            }) { Text("Delete Provider") }
        }
        if (modelList.isNotEmpty()) {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                modelList.take(30).forEach { option ->
                    FilterChip(selected = model == option, onClick = { model = option }, label = { Text(option) })
                }
            }
        }
        GlassCard(title = "Networking notes", icon = "NET", status = "important") {
            quickNotes.forEach { Text("- $it") }
            Text("Unreachable endpoints show offline/error cards and do not crash the app.")
        }
        Text(listOf(status, output).filter { it.isNotBlank() }.joinToString("\n"), style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun ProviderFallbackSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    var enabled by remember { mutableStateOf(app.modelRouter.fallbackEnabled) }
    var order by remember { mutableStateOf(app.modelRouter.fallbackOrder()) }
    fun save(next: List<ModelRoute>) {
        order = next
        app.modelRouter.saveFallbackOrder(next)
    }
    SettingsScaffold(modifier) {
        GlassCard(title = "AI Provider Fallback Order", subtitle = "If the active provider is missing a key or unreachable, the router tries the next configured provider once.", icon = "AI", status = if (enabled) "enabled" else "disabled") {
            ToggleRow("Enable provider fallback", enabled) {
                enabled = it
                app.modelRouter.fallbackEnabled = it
            }
            Text("Local deterministic phone commands always work without a model provider when a local parser recognizes the command.")
        }
        order.forEachIndexed { index, route ->
            GlassCard(title = "${index + 1}. ${route.name.lowercase().replace('_', '-')}", icon = "AI", status = "priority") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    OutlinedButton(enabled = index > 0, onClick = {
                        val next = order.toMutableList()
                        val item = next.removeAt(index)
                        next.add(index - 1, item)
                        save(next)
                    }) { Text("Up") }
                    OutlinedButton(enabled = index < order.lastIndex, onClick = {
                        val next = order.toMutableList()
                        val item = next.removeAt(index)
                        next.add(index + 1, item)
                        save(next)
                    }) { Text("Down") }
                }
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                app.modelRouter.saveFallbackOrder(com.kizek.phoneagent.models.ModelRouter.DEFAULT_FALLBACK_ORDER)
                order = com.kizek.phoneagent.models.ModelRouter.DEFAULT_FALLBACK_ORDER
            }) { Text("Default order") }
            OutlinedButton(onClick = {
                app.modelRouter.selectedRoute = ModelRoute.HYBRID
            }) { Text("Use Hybrid") }
        }
    }
}

private fun localNetworkNotes(): List<String> {
    return listOf(
        "127.0.0.1 and localhost mean the phone itself.",
        "Android emulator host machine is 10.0.2.2.",
        "A real phone should reach a laptop/server through LAN IP or Tailscale IP.",
        "HTTP endpoints require Android cleartext/network config; this build allows cleartext for local provider setup.",
        "HTTPS/custom endpoints may require valid certificates and reachable DNS."
    )
}

@Composable
fun RuntimeSettingsScreen(app: PhoneAgentApplication, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    var statuses by remember { mutableStateOf(emptyList<com.kizek.phoneagent.runtime.RuntimeEndpointStatus>()) }
    LaunchedEffect(Unit) { statuses = app.executionRouteManager.status() }
    SettingsScaffold(modifier) {
        GlassCard(title = "Runtime / Execution", subtitle = "App shell, PRoot, Termux, SSH, and remote orchestrator readiness.", icon = "RUN", status = "routing") {
            Text("Fallback order:\n${app.executionRouteManager.installSummary()}", fontFamily = FontFamily.Monospace)
        }
        statuses.forEach { endpoint ->
            SubsystemStatusCard(
                title = endpoint.runtime.label,
                status = endpoint.status,
                detail = endpoint.detail,
                actionLabel = when (endpoint.runtime) {
                    ExecutionRuntime.BUILT_IN_PROOT -> "Container"
                    ExecutionRuntime.TERMUX_BRIDGE -> "Termux"
                    ExecutionRuntime.SSH_AGENT -> "SSH"
                    ExecutionRuntime.REMOTE_ORCHESTRATOR -> "Settings"
                    else -> null
                },
                onAction = {
                    when (endpoint.runtime) {
                        ExecutionRuntime.BUILT_IN_PROOT -> onOpen("container-settings")
                        ExecutionRuntime.TERMUX_BRIDGE -> onOpen("termux")
                        ExecutionRuntime.SSH_AGENT -> onOpen("ssh")
                        ExecutionRuntime.REMOTE_ORCHESTRATOR -> onOpen("settings")
                        else -> Unit
                    }
                }
            )
        }
        Button(onClick = { onOpen("fallback") }, modifier = Modifier.fillMaxWidth()) { Text("Edit Fallback Order") }
    }
}

@Composable
fun ContainerSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var output by remember { mutableStateOf(app.prootManager.status().lastTestDetail) }
    var prootUrl by remember { mutableStateOf("") }
    var rootfsUrl by remember { mutableStateOf("") }
    var prootSha by remember { mutableStateOf("") }
    var rootfsSha by remember { mutableStateOf("") }
    var refresh by remember { mutableStateOf(0) }
    val status = remember(refresh) { app.prootManager.status() }
    fun refreshWith(text: String) {
        output = text
        refresh += 1
    }
    val prootLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importProot(uri)
            refreshWith(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
        }
    }
    val rootfsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importRootfs(uri)
            refreshWith(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
        }
    }
    SettingsScaffold(modifier) {
        GlassCard(title = "Built-in PRoot", subtitle = "container_exec is enabled only after PRoot, rootfs, /bin/sh, and the real test command pass.", icon = "RUN", status = if (status.installed) "ready" else "blocked") {
            Text(status.detail)
        }
        SubsystemStatusCard("PRoot binary", if (!status.prootPresent) "missing" else if (status.prootExecutable) "executable" else "blocked", status.prootPath)
        SubsystemStatusCard("Rootfs", if (!status.rootfsPresent) "missing" else if (status.rootfsShellPresent) "extracted" else "invalid", status.rootfsPath)
        SubsystemStatusCard("Shell", if (status.rootfsShellPresent) "found" else "missing", status.rootfsShellPath)
        SubsystemStatusCard("Workspace bind", if (status.rootfsPresent) "ready" else "failed", "Workspace bind is attempted as <app files>/workspace:/workspace.")
        SubsystemStatusCard("Last test", if (status.lastTestPassed) "pass" else "fail", status.lastTestDetail)
        GlassCard(title = "Actions", icon = "SET", status = "manual") {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { prootLauncher.launch(arrayOf("*/*")) }) { Text("Import PRoot binary") }
                Button(onClick = { rootfsLauncher.launch(arrayOf("*/*")) }) { Text("Import rootfs tarball") }
                OutlinedButton(onClick = {
                    val result = app.containerTools.extractRootfs()
                    refreshWith(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
                }) { Text("Extract rootfs") }
            }
            OutlinedTextField(prootUrl, { prootUrl = it }, label = { Text("PRoot custom URL") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(prootSha, { prootSha = it }, label = { Text("PRoot SHA-256 optional") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(rootfsUrl, { rootfsUrl = it }, label = { Text("Rootfs custom URL") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(rootfsSha, { rootfsSha = it }, label = { Text("Rootfs SHA-256 optional") }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    scope.launch {
                        output = "Downloading..."
                        val result = withContext(Dispatchers.IO) { app.containerTools.downloadAssets(prootUrl, rootfsUrl, prootSha, rootfsSha) }
                        refreshWith(listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n"))
                    }
                }) { Text("Download assets") }
                Button(onClick = {
                    val result = app.containerTools.test()
                    refreshWith("exit=${result.exitCode}\nstdout:\n${result.output}\nstderr:\n${result.error.orEmpty()}")
                }) { Text("Run container test") }
                OutlinedButton(onClick = {
                    val result = app.containerTools.clear()
                    refreshWith(result.summary)
                }) { Text("Clear container") }
                OutlinedButton(onClick = { refreshWith(app.containerTools.logs().joinToString("\n").ifBlank { "No logs." }) }) { Text("View logs") }
            }
        }
        GlassCard(title = "Last error / logs", icon = "LOG", status = "details") {
            Text(output.ifBlank { "No container test has run yet." }, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
            Text("If Android blocks imported binary execution, use Termux bridge, SSH agent, or a laptop/server worker.")
        }
    }
}

@Composable
fun TermuxBridgeSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var settings by remember { mutableStateOf(app.termuxBridgeManager.settings()) }
    var password by remember { mutableStateOf("") }
    var output by remember { mutableStateOf(app.termuxBridgeManager.status().detail) }
    val keyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) output = app.termuxBridgeManager.importPrivateKey(uri)
    }
    val status = app.termuxBridgeManager.status()
    SettingsScaffold(modifier) {
        GlassCard(title = "Termux Bridge", subtitle = "Mode A uses SSH localhost. Mode B intent/plugin routing is documented only when practical Android APIs are available.", icon = "SSH", status = if (status.connected) "connected" else if (status.configured) "configured" else "not configured") {
            Text("Termux installed: ${if (status.installed) "yes" else "no"}")
            Text(status.detail)
        }
        OutlinedTextField(settings.host, { settings = settings.copy(host = it) }, label = { Text("SSH host") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(settings.port.toString(), { settings = settings.copy(port = it.filter(Char::isDigit).toIntOrNull() ?: 8022) }, label = { Text("SSH port") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(settings.username, { settings = settings.copy(username = it) }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth())
        AuthChips(settings.authType) { settings = settings.copy(authType = it) }
        OutlinedTextField(password, { password = it }, label = { Text("Password (stored encrypted)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        ToggleRow("Set as fallback runtime", settings.fallbackEnabled) { settings = settings.copy(fallbackEnabled = it) }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                app.termuxBridgeManager.save(settings, password = password)
                password = ""
                output = "Saved Termux bridge settings."
            }) { Text("Save") }
            OutlinedButton(onClick = { keyLauncher.launch(arrayOf("*/*")) }) { Text("Import private key") }
            OutlinedButton(onClick = {
                scope.launch {
                    val result = app.termuxBridgeManager.testConnection()
                    output = "exit=${result.exitCode}\n${result.stdout.ifBlank { result.stderr }}"
                }
            }) { Text("Test connection") }
            OutlinedButton(onClick = {
                scope.launch {
                    val result = app.termuxBridgeManager.exec("pwd && uname -a")
                    output = "exit=${result.exitCode}\n${result.stdout.ifBlank { result.stderr }}"
                }
            }) { Text("Test command") }
        }
        GlassCard(title = "Install instructions", icon = "DOC", status = "setup") {
            Text(app.termuxBridgeManager.installHint(), fontFamily = FontFamily.Monospace)
            Text(output, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun SshAgentSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var targets by remember { mutableStateOf(app.sshAgentManager.listTargets()) }
    var selectedId by remember { mutableStateOf(targets.firstOrNull()?.id.orEmpty()) }
    val selected = targets.firstOrNull { it.id == selectedId }
    var name by remember(selectedId) { mutableStateOf(selected?.name ?: "") }
    var host by remember(selectedId) { mutableStateOf(selected?.host ?: "") }
    var port by remember(selectedId) { mutableStateOf((selected?.port ?: 22).toString()) }
    var username by remember(selectedId) { mutableStateOf(selected?.username ?: "") }
    var authType by remember(selectedId) { mutableStateOf(selected?.authType ?: SshAgentManager.AUTH_PASSWORD) }
    var password by remember(selectedId) { mutableStateOf("") }
    var fingerprint by remember(selectedId) { mutableStateOf(selected?.knownHostFingerprint ?: "") }
    var workingDir by remember(selectedId) { mutableStateOf(selected?.workingDirectory ?: "") }
    var defaultShell by remember(selectedId) { mutableStateOf(selected?.defaultShell ?: "/bin/sh") }
    var fallback by remember(selectedId) { mutableStateOf(selected?.fallbackEnabled ?: false) }
    var caps by remember(selectedId) { mutableStateOf(selected?.capabilities ?: setOf("shell")) }
    var output by remember { mutableStateOf(app.sshAgentManager.status().lastError.ifBlank { "No SSH test has run yet." }) }
    val keyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && selectedId.isNotBlank()) output = app.sshAgentManager.importPrivateKey(selectedId, uri)
    }
    fun save(): SshTarget {
        val target = SshTarget(
            id = selectedId.ifBlank { UUID.randomUUID().toString() },
            name = name.ifBlank { host.ifBlank { "SSH target" } },
            host = host,
            port = port.toIntOrNull() ?: 22,
            username = username,
            authType = authType,
            knownHostFingerprint = fingerprint,
            workingDirectory = workingDir,
            defaultShell = defaultShell,
            capabilities = caps,
            fallbackEnabled = fallback
        )
        val saved = app.sshAgentManager.saveTarget(target, password = password)
        selectedId = saved.id
        password = ""
        targets = app.sshAgentManager.listTargets()
        return saved
    }
    SettingsScaffold(modifier) {
        GlassCard(title = "SSH Agent", subtitle = "Connect only to targets you explicitly configure. Passwords and keys are encrypted.", icon = "SSH", status = if (targets.isEmpty()) "not configured" else "configured") {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                targets.forEach { target ->
                    FilterChip(selected = target.id == selectedId, onClick = { selectedId = target.id }, label = { Text(target.name) })
                }
                OutlinedButton(onClick = {
                    selectedId = ""
                    name = ""
                    host = ""
                    username = ""
                    port = "22"
                }) { Text("New") }
            }
        }
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(host, { host = it }, label = { Text("Host/IP") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(port, { port = it.filter(Char::isDigit) }, label = { Text("Port") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(username, { username = it }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth())
        AuthChips(authType) { authType = it }
        OutlinedTextField(password, { password = it }, label = { Text("Password (stored encrypted)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(fingerprint, { fingerprint = it }, label = { Text("Known host fingerprint") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(workingDir, { workingDir = it }, label = { Text("Working directory") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(defaultShell, { defaultShell = it }, label = { Text("Default shell") }, modifier = Modifier.fillMaxWidth())
        listOf("shell", "files", "container/proot", "build jobs", "MCP", "long tasks").forEach { cap ->
            ToggleRow(cap, caps.contains(cap)) { checked ->
                caps = if (checked) caps + cap else caps - cap
            }
        }
        ToggleRow("Set as fallback", fallback) { fallback = it }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                save()
                output = "Saved SSH target."
            }) { Text("Save") }
            OutlinedButton(onClick = {
                val saved = save()
                app.sshAgentManager.setFallback(saved.id)
                targets = app.sshAgentManager.listTargets()
                output = "Set ${saved.name} as fallback."
            }) { Text("Set as fallback") }
            OutlinedButton(onClick = { keyLauncher.launch(arrayOf("*/*")) }, enabled = selectedId.isNotBlank()) { Text("Import private key") }
            OutlinedButton(onClick = {
                val saved = save()
                scope.launch {
                    val result = app.sshAgentManager.testConnection(saved.id)
                    output = "exit=${result.exitCode}\nfingerprint=${result.fingerprint}\n${result.stdout.ifBlank { result.stderr }}\n${result.warning}"
                    targets = app.sshAgentManager.listTargets()
                }
            }) { Text("Test connection") }
            OutlinedButton(onClick = {
                val saved = save()
                scope.launch {
                    val result = app.sshAgentManager.exec(saved.id, "pwd && uname -a")
                    output = "exit=${result.exitCode}\n${result.stdout.ifBlank { result.stderr }}\n${result.warning}"
                }
            }) { Text("Run test command") }
            OutlinedButton(onClick = {
                if (selectedId.isNotBlank()) {
                    app.sshAgentManager.deleteTarget(selectedId)
                    targets = app.sshAgentManager.listTargets()
                    selectedId = targets.firstOrNull()?.id.orEmpty()
                    output = "Deleted SSH target."
                }
            }) { Text("Delete target") }
        }
        GlassCard(title = "Security", icon = "SEC", status = "required") {
            Text("Credentials are encrypted with Android Keystore. Full passwords and private keys are never logged. Host fingerprints should be pinned; otherwise the app shows a warning. The app does not scan networks or brute force targets.")
            Text(output, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun ExecutionFallbackSettingsScreen(app: PhoneAgentApplication, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var order by remember { mutableStateOf(app.executionRouteManager.fallbackOrder()) }
    var testCommand by remember { mutableStateOf("pwd && uname -a") }
    var output by remember { mutableStateOf("No fallback command has run yet.") }
    fun saveOrder(next: List<ExecutionRuntime>) {
        order = next
        app.executionRouteManager.saveFallbackOrder(next)
    }
    SettingsScaffold(modifier) {
        GlassCard(title = "Execution Fallback", subtitle = "Editable priority list for command and build tasks.", icon = "RUN", status = "configured") {
            Text("Runtime result reports selected runtime, reason, attempts, and final success/failure.")
        }
        order.forEachIndexed { index, runtime ->
            GlassCard(title = "${index + 1}. ${runtime.label}", icon = "RUN", status = "priority") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(enabled = index > 0, onClick = {
                        val next = order.toMutableList()
                        val item = next.removeAt(index)
                        next.add(index - 1, item)
                        saveOrder(next)
                    }) { Text("Up") }
                    OutlinedButton(enabled = index < order.lastIndex, onClick = {
                        val next = order.toMutableList()
                        val item = next.removeAt(index)
                        next.add(index + 1, item)
                        saveOrder(next)
                    }) { Text("Down") }
                }
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                app.executionRouteManager.resetFallbackOrder()
                order = ExecutionRouteManager.DEFAULT_ORDER
            }) { Text("Default order") }
        }
        OutlinedTextField(testCommand, { testCommand = it }, label = { Text("Fallback test command") }, modifier = Modifier.fillMaxWidth())
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                scope.launch {
                    val result = app.executionRouteManager.runCommand(testCommand)
                    output = result.details()
                }
            }) { Text("Test fallback command") }
            OutlinedButton(onClick = {
                scope.launch {
                    val choice = app.executionRouteManager.chooseRuntime(testCommand)
                    output = choice?.let { "Selected ${it.runtime.label}: ${it.detail}" } ?: "No runtime available."
                }
            }) { Text("Choose runtime") }
        }
        GlassCard(title = "Routing result", icon = "LOG", status = "details") {
            Text(output, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun SettingsScaffold(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content
        )
    }
}

@Composable
private fun AuthChips(authType: String, onAuthType: (String) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
            SshAgentManager.AUTH_PASSWORD to "password",
            SshAgentManager.AUTH_PRIVATE_KEY to "private key",
            SshAgentManager.AUTH_NONE to "no auth"
        ).forEach { (value, label) ->
            FilterChip(selected = authType == value, onClick = { onAuthType(value) }, label = { Text(label) })
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Checkbox(checked = checked, onCheckedChange = onChange)
        Text(label, modifier = Modifier.padding(top = 12.dp))
    }
}
