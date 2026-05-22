package com.kizek.phoneagent.core

import com.kizek.phoneagent.models.ModelMessage
import com.kizek.phoneagent.models.ModelRoute
import com.kizek.phoneagent.models.ModelRouter
import com.kizek.phoneagent.assistant.AssistantManager
import com.kizek.phoneagent.runtime.ExecutionRouteManager
import com.kizek.phoneagent.runtime.ExecutionRuntime
import com.kizek.phoneagent.runtime.SshAgentManager
import com.kizek.phoneagent.runtime.TermuxBridgeManager
import com.kizek.phoneagent.sync.OrchestratorClient
import com.kizek.phoneagent.tools.AccessibilityTools
import com.kizek.phoneagent.tools.AndroidDeviceTools
import com.kizek.phoneagent.tools.ClipboardTools
import com.kizek.phoneagent.tools.ContainerTools
import com.kizek.phoneagent.tools.FileTools
import com.kizek.phoneagent.tools.McpTools
import com.kizek.phoneagent.tools.ScreenTools
import com.kizek.phoneagent.tools.ShellTools
import com.kizek.phoneagent.voice.VoiceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject

data class RuntimeCapabilityStatus(
    val workspaceReady: Boolean,
    val workspaceLabel: String,
    val workspaceDetail: String,
    val mistralConfigured: Boolean,
    val modelRoute: ModelRoute,
    val selectedMistralModel: String,
    val screenCaptureReady: Boolean,
    val screenCaptureDetail: String,
    val hasScreenshot: Boolean,
    val accessibilityEnabled: Boolean,
    val accessibilityStatus: String,
    val prootReady: Boolean,
    val prootDetail: String,
    val termuxInstalled: Boolean,
    val termuxConfigured: Boolean,
    val termuxConnected: Boolean,
    val termuxDetail: String,
    val sshConfiguredTargets: Int,
    val sshFallbackTargets: Int,
    val sshLastStatus: String,
    val sshLastError: String,
    val remoteOnline: Boolean,
    val remoteDetail: String,
    val toolCount: Int
)

class ToolRegistry(
    private val fileTools: FileTools,
    private val shellTools: ShellTools,
    private val containerTools: ContainerTools,
    private val accessibilityTools: AccessibilityTools,
    private val androidDeviceTools: AndroidDeviceTools,
    private val screenTools: ScreenTools,
    private val clipboardTools: ClipboardTools,
    private val modelRouter: ModelRouter,
    private val orchestratorClient: OrchestratorClient,
    private val mcpTools: McpTools,
    private val voiceManager: VoiceManager,
    private val assistantManager: AssistantManager,
    private val termuxBridgeManager: TermuxBridgeManager,
    private val sshAgentManager: SshAgentManager,
    private val executionRouteManager: ExecutionRouteManager
) {
    val phoneCapabilities = WorkerCapability(
        workerId = "phone-local",
        type = "phone",
        status = "online",
        capabilities = listOf(
            "phone.local.chat",
            "phone.files",
            "phone.shell",
            "phone.container",
            "phone.accessibility",
            "phone.apps",
            "phone.screen",
            "phone.clipboard",
            "phone.voice.android",
            "phone.assistant.entrypoints",
            "phone.model.mistral",
            "phone.model.local.status",
            "phone.termux.ssh",
            "phone.ssh.agent",
            "phone.execution.fallback"
        )
    )

    fun builtInTools(): List<String> = listOf(
        "file_list",
        "file_read",
        "file_write",
        "file_mkdir",
        "file_delete_safe",
        "file_search",
        "file_pick_file",
        "file_pick_folder",
        "shell_exec",
        "shell_status",
        "shell_stop",
        "shell_logs",
        "container_status",
        "container_install_status",
        "container_import_rootfs",
        "container_import_proot",
        "container_download_assets",
        "container_extract_rootfs",
        "container_test",
        "container_exec",
        "container_stop",
        "container_logs",
        "container_clear",
        "termux_status",
        "termux_test_connection",
        "termux_exec",
        "termux_install_hint",
        "termux_logs",
        "ssh_list_targets",
        "ssh_test_connection",
        "ssh_exec",
        "ssh_read_file",
        "ssh_write_file",
        "ssh_status",
        "ssh_logs",
        "execution_route_status",
        "execution_choose_runtime",
        "execution_run_command",
        "phone_list_apps",
        "phone_open_app",
        "phone_app_search",
        "phone_app_type",
        "phone_app_tap_text",
        "phone_app_find_text",
        "phone_app_back",
        "phone_app_submit",
        "phone_app_status",
        "phone_accessibility_status",
        "phone_accessibility_tree",
        "phone_find",
        "phone_focus",
        "phone_tap_node",
        "phone_type",
        "phone_back",
        "phone_home",
        "phone_recents",
        "phone_swipe",
        "phone_read_active_app",
        "phone_screen_status",
        "phone_screenshot",
        "phone_screen_observe",
        "phone_screen_describe",
        "phone_screen_watch",
        "voice_status",
        "voice_start_listening",
        "voice_stop_listening",
        "voice_transcribe_once",
        "voice_speak",
        "voice_set_provider",
        "assistant_status",
        "assistant_open",
        "assistant_set_mode",
        "assistant_start_voice",
        "assistant_stop_voice",
        "assistant_show_bubble",
        "assistant_hide_bubble",
        "model_status",
        "model_chat",
        "model_switch",
        "model_provider_test",
        "model_provider_list_models",
        "model_fallback_status",
        "remote_status",
        "remote_list_sessions",
        "remote_open_session",
        "remote_send_message",
        "remote_run_task",
        "mcp_status",
        "mcp_remote_status",
        "mcp_local_status",
        "mcp_list",
        "mcp_call",
        "mcp_start_local",
        "mcp_stop_local"
    )

    fun screenObservation() = screenTools.observation()

    suspend fun runtimeCapabilityStatus(): RuntimeCapabilityStatus {
        val workspace = fileTools.workspaceManager.status()
        val screen = screenTools.status()
        val accessibility = accessibilityTools.status()
        val container = containerTools.status()
        val termux = termuxBridgeManager.status()
        val ssh = sshAgentManager.status()
        val remote = withTimeoutOrNull(1_500L) { orchestratorClient.getStatus() }
        return RuntimeCapabilityStatus(
            workspaceReady = workspace.ready,
            workspaceLabel = workspace.label,
            workspaceDetail = workspace.detail,
            mistralConfigured = modelRouter.mistral.isConfigured(),
            modelRoute = modelRouter.selectedRoute,
            selectedMistralModel = modelRouter.selectedMistralModel,
            screenCaptureReady = screen.configured,
            screenCaptureDetail = screen.detail,
            hasScreenshot = screen.lastScreenshotPath != null,
            accessibilityEnabled = accessibility.startsWith("enabled", ignoreCase = true),
            accessibilityStatus = accessibility,
            prootReady = container.installed && container.lastTestPassed,
            prootDetail = container.detail,
            termuxInstalled = termux.installed,
            termuxConfigured = termux.configured,
            termuxConnected = termux.connected,
            termuxDetail = termux.detail,
            sshConfiguredTargets = ssh.configuredTargets,
            sshFallbackTargets = ssh.fallbackTargets,
            sshLastStatus = ssh.lastStatus,
            sshLastError = ssh.lastError,
            remoteOnline = remote?.isSuccess == true,
            remoteDetail = remote?.fold(
                onSuccess = { "connected: ${orchestratorClient.baseUrl}" },
                onFailure = { "offline: ${it.message ?: orchestratorClient.baseUrl}" }
            ) ?: "offline: status check timed out",
            toolCount = builtInTools().size
        )
    }

    suspend fun subsystemStatus(): String {
        val container = containerTools.status()
        val voice = voiceManager.status()
        val assistant = assistantManager.status()
        val screen = screenTools.status()
        val models = modelRouter.states().joinToString("; ") { "${it.id}:available=${it.available},model=${it.selectedModel}" }
        val termux = termuxBridgeManager.status()
        val ssh = sshAgentManager.status()
        val route = executionRouteManager.installSummary()
        return buildString {
            appendLine("model_route=${modelRouter.selectedRoute}")
            appendLine("models=$models")
            appendLine("container=installed:${container.installed}, prootPresent:${container.prootPresent}, prootExecutable:${container.prootExecutable}, rootfsPresent:${container.rootfsPresent}, shell:${container.rootfsShellPresent}, lastTest:${container.lastTestPassed}, detail:${container.detail}")
            appendLine("termux=installed:${termux.installed}, configured:${termux.configured}, connected:${termux.connected}, detail:${termux.detail}")
            appendLine("ssh=targets:${ssh.configuredTargets}, fallbackTargets:${ssh.fallbackTargets}, lastStatus:${ssh.lastStatus}, lastError:${ssh.lastError}")
            appendLine("execution_fallback_order=$route")
            appendLine("accessibility=${accessibilityTools.status()}")
            appendLine("screen=configured:${screen.configured}, active:${screen.active}, last:${screen.lastScreenshotPath ?: "none"}")
            appendLine("voice=enabled:${voice.voiceEnabled}, stt:${voice.sttProvider}, tts:${voice.ttsProvider}, mic:${voice.micPermissionGranted}, recognizer:${voice.speechRecognizerAvailable}, ttsReady:${voice.ttsReady}")
            appendLine("assistant=overlay:${assistant.overlayPermission}, bubble:${assistant.bubbleEnabled}, wake:${assistant.wakePhraseEnabled}")
        }.trim()
    }

    suspend fun execute(tool: String, args: JSONObject, worker: WorkerMode = WorkerMode.PHONE_LOCAL): PhoneToolResult {
        if (tool !in builtInTools()) {
            return PhoneToolResult.fail(
                tool = tool,
                summary = "Unknown tool: $tool",
                errorType = "unknown_tool",
                errorMessage = "The phone tool registry does not contain \"$tool\".",
                workerUsed = worker.id
            )
        }

        return runCatching {
            when (tool) {
                "file_list" -> fileTools.list(args.path()).toResult(tool, worker)
                "file_read" -> fileTools.read(args.path()).toResult(tool, worker)
                "file_write" -> fileTools.write(args.path(), args.optString("content")).toResult(tool, worker)
                "file_mkdir" -> fileTools.mkdir(args.path()).toResult(tool, worker)
                "file_delete_safe" -> fileTools.deleteSafe(args.path()).toResult(tool, worker)
                "file_search" -> fileTools.search(args.optString("query", args.path())).toResult(tool, worker)
                "file_pick_file" -> PhoneToolResult.fail(
                    tool,
                    "File picking needs the visible Android document picker.",
                    "user_interaction_required",
                    "Open the Files tab and tap Pick file; Android does not allow a hidden picker from an agent turn.",
                    workerUsed = worker.id
                )
                "file_pick_folder" -> PhoneToolResult.fail(
                    tool,
                    "Folder picking needs the visible Android folder picker.",
                    "user_interaction_required",
                    "Open the Files tab and tap Pick folder; writes outside app-private storage stay inside the selected SAF folder.",
                    workerUsed = worker.id
                )
                "shell_exec" -> executionRouteManager.runCommand(args.optString("command")).toResult(tool, worker)
                "shell_status" -> PhoneToolResult.ok(tool, "Shell is ${shellTools.status()}.", details = "Working directory: app-private workspace.", workerUsed = worker.id)
                "shell_stop" -> {
                    shellTools.stop()
                    PhoneToolResult.ok(tool, "Stop requested for app shell.", workerUsed = worker.id)
                }
                "shell_logs" -> PhoneToolResult.ok(tool, "Shell logs returned.", details = shellTools.logs().joinToString("\n"), workerUsed = worker.id)
                "container_status", "container_install_status" -> {
                    val status = containerTools.status()
                    PhoneToolResult.ok(
                        tool,
                        if (status.installed && status.lastTestPassed) "Container is ready." else "Container is not ready.",
                        details = "arch=${status.architecture}\nproot=${status.prootPath}\nprootPresent=${status.prootPresent}\nprootExecutable=${status.prootExecutable}\nrootfs=${status.rootfsPath}\nrootfsPresent=${status.rootfsPresent}\nrootfsShellPresent=${status.rootfsShellPresent}\nrootfsShell=${status.rootfsShellPath}\nlastTestPassed=${status.lastTestPassed}\nlastTest=${status.lastTestDetail}\ninstalled=${status.installed}\n${status.detail}",
                        workerUsed = worker.id
                    )
                }
                "container_import_rootfs", "container_import_proot" -> PhoneToolResult.fail(
                    tool,
                    "Container imports require a visible Android file picker.",
                    "user_interaction_required",
                    "Open Settings > Container, then import an ABI-matched proot binary or rootfs tarball. Chat cannot silently read arbitrary phone files.",
                    workerUsed = worker.id
                )
                "container_download_assets" -> {
                    val result = containerTools.downloadAssets(
                        prootUrl = args.optString("prootUrl"),
                        rootfsUrl = args.optString("rootfsUrl"),
                        prootSha256 = args.optString("prootSha256"),
                        rootfsSha256 = args.optString("rootfsSha256")
                    )
                    result.toPhoneResult(tool, worker)
                }
                "container_extract_rootfs" -> containerTools.extractRootfs().toPhoneResult(tool, worker)
                "container_test" -> containerTools.test().toResult(tool, worker)
                "container_exec" -> containerTools.exec(args.optString("command")).toResult(tool, worker)
                "container_stop" -> {
                    containerTools.stop()
                    PhoneToolResult.ok(tool, "Stop requested for container command.", workerUsed = worker.id)
                }
                "container_logs" -> PhoneToolResult.ok(tool, "Container logs returned.", details = containerTools.logs().joinToString("\n"), workerUsed = worker.id)
                "container_clear" -> containerTools.clear().toPhoneResult(tool, worker)
                "termux_status" -> {
                    val status = termuxBridgeManager.status()
                    PhoneToolResult.ok(
                        tool,
                        "Termux bridge status returned.",
                        details = "installed=${status.installed}\nconfigured=${status.configured}\nconnected=${status.connected}\nlastError=${status.lastError}\n${status.detail}",
                        workerUsed = worker.id
                    )
                }
                "termux_test_connection" -> termuxBridgeManager.testConnection().toPhoneResult(tool, WorkerMode.HYBRID)
                "termux_exec" -> termuxBridgeManager.exec(args.optString("command")).toPhoneResult(tool, WorkerMode.HYBRID)
                "termux_install_hint" -> PhoneToolResult.ok(tool, "Termux setup instructions returned.", details = termuxBridgeManager.installHint(), workerUsed = worker.id)
                "termux_logs" -> PhoneToolResult.ok(tool, "Termux logs returned.", details = termuxBridgeManager.logs().joinToString("\n"), workerUsed = worker.id)
                "ssh_list_targets" -> {
                    val targets = sshAgentManager.listTargets()
                    PhoneToolResult.ok(
                        tool,
                        "SSH targets returned.",
                        details = targets.joinToString("\n") { "${it.name} ${it.username}@${it.host}:${it.port} fallback=${it.fallbackEnabled} caps=${it.capabilities.joinToString(",")}" }.ifBlank { "No SSH targets configured." },
                        workerUsed = WorkerMode.HYBRID.id
                    )
                }
                "ssh_test_connection" -> {
                    val targetId = args.optString("targetId").ifBlank { sshAgentManager.fallbackTarget()?.id.orEmpty() }
                    sshAgentManager.testConnection(targetId).toPhoneResult(tool, WorkerMode.HYBRID)
                }
                "ssh_exec" -> {
                    val targetId = args.optString("targetId").ifBlank { sshAgentManager.fallbackTarget()?.id.orEmpty() }
                    sshAgentManager.exec(targetId, args.optString("command")).toPhoneResult(tool, WorkerMode.HYBRID)
                }
                "ssh_read_file" -> sshAgentManager.readFile(args.optString("targetId").ifBlank { sshAgentManager.fallbackTarget()?.id.orEmpty() }, args.path()).toPhoneResult(tool, WorkerMode.HYBRID)
                "ssh_write_file" -> sshAgentManager.writeFile(args.optString("targetId").ifBlank { sshAgentManager.fallbackTarget()?.id.orEmpty() }, args.path(), args.optString("content")).toPhoneResult(tool, WorkerMode.HYBRID)
                "ssh_status" -> {
                    val status = sshAgentManager.status()
                    PhoneToolResult.ok(
                        tool,
                        "SSH status returned.",
                        details = "targets=${status.configuredTargets}\nfallbackTargets=${status.fallbackTargets}\nlastStatus=${status.lastStatus}\nlastError=${status.lastError}",
                        workerUsed = WorkerMode.HYBRID.id
                    )
                }
                "ssh_logs" -> PhoneToolResult.ok(tool, "SSH logs returned.", details = sshAgentManager.logs().joinToString("\n"), workerUsed = WorkerMode.HYBRID.id)
                "execution_route_status" -> {
                    val endpoints = executionRouteManager.status()
                    PhoneToolResult.ok(
                        tool,
                        "Execution route status returned.",
                        details = buildString {
                            appendLine("fallbackOrder:")
                            appendLine(executionRouteManager.installSummary())
                            appendLine("runtimes:")
                            endpoints.forEach { endpoint ->
                                appendLine("${endpoint.runtime.label}: ready=${endpoint.ready}, status=${endpoint.status}, detail=${endpoint.detail}")
                            }
                        }.trimEnd(),
                        workerUsed = WorkerMode.HYBRID.id
                    )
                }
                "execution_choose_runtime" -> {
                    val command = args.optString("command")
                    val choice = executionRouteManager.chooseRuntime(command)
                    if (choice != null) {
                        PhoneToolResult.ok(
                            tool,
                            "Selected runtime: ${choice.runtime.label}.",
                            details = "why=${choice.detail}\norder:\n${executionRouteManager.installSummary()}",
                            workerUsed = WorkerMode.HYBRID.id
                        )
                    } else {
                        PhoneToolResult.fail(tool, "No runtime is available for this command.", "runtime_unavailable", "All configured runtime checks failed.", workerUsed = WorkerMode.HYBRID.id)
                    }
                }
                "execution_run_command" -> executionRouteManager.runCommand(
                    command = args.optString("command"),
                    allowRemoteRequest = args.optBoolean("allowRemoteRequest", false)
                ).toResult(tool, WorkerMode.HYBRID)
                "phone_list_apps" -> {
                    val apps = androidDeviceTools.listApps(args.optString("query"), args.optInt("limit", 100))
                    PhoneToolResult.ok(
                        tool,
                        "Found ${apps.size} launchable app(s).",
                        details = apps.joinToString("\n") { "${it.label} (${it.packageName})" },
                        workerUsed = worker.id
                    )
                }
                "phone_open_app" -> {
                    val result = androidDeviceTools.openApp(args.optString("app", args.optString("name", args.optString("query"))))
                    if (result.opened) {
                        PhoneToolResult.ok(
                            tool,
                            result.summary,
                            details = buildString {
                                appendLine("requestedApp=${result.requestedApp}")
                                appendLine("parsedApp=${result.parsedApp}")
                                appendLine("package=${result.packageName.orEmpty()}")
                            }.trimEnd(),
                            workerUsed = worker.id
                        )
                    } else {
                        PhoneToolResult.fail(
                            tool,
                            result.summary,
                            errorType = result.error ?: "app_open_failed",
                            errorMessage = result.summary,
                            details = buildString {
                                appendLine("requestedApp=${result.requestedApp}")
                                appendLine("parsedApp=${result.parsedApp}")
                                appendLine("toolFailedAt=open")
                                appendLine("reason=${result.summary}")
                                if (result.suggestions.isNotEmpty()) {
                                    appendLine("suggestions:")
                                    result.suggestions.forEach { appendLine("${it.label} (${it.packageName})") }
                                }
                            }.trimEnd(),
                            workerUsed = worker.id
                        )
                    }
                }
                "phone_app_search" -> {
                    val result = androidDeviceTools.searchApp(
                        app = args.optString("app", args.optString("name", args.optString("queryApp"))),
                        query = args.optString("query", args.optString("text")),
                        preferIntent = args.optBoolean("preferIntent", true),
                        fallbackToAccessibility = args.optBoolean("fallbackToAccessibility", true),
                        accessibilityTools = accessibilityTools
                    )
                    if (result.success) {
                        PhoneToolResult.ok(
                            tool,
                            result.summary,
                            details = buildString {
                                appendLine("method=${result.method}")
                                append(result.details)
                            }.trimEnd(),
                            workerUsed = worker.id
                        )
                    } else {
                        PhoneToolResult.fail(
                            tool,
                            result.summary,
                            errorType = result.error ?: "app_search_failed",
                            errorMessage = result.summary,
                            details = buildString {
                                appendLine("method=${result.method}")
                                append(result.details)
                                if (result.suggestions.isNotEmpty()) {
                                    if (result.details.isNotBlank()) appendLine()
                                    appendLine("suggestions:")
                                    result.suggestions.forEach { appendLine("${it.label} (${it.packageName})") }
                                }
                            }.trimEnd(),
                            workerUsed = worker.id
                        )
                    }
                }
                "phone_app_status" -> PhoneToolResult.ok(tool, "App status returned.", details = androidDeviceTools.appStatus(args.optString("app", args.optString("name", args.optString("query")))), workerUsed = worker.id)
                "phone_accessibility_status" -> PhoneToolResult.ok(tool, "Accessibility status returned.", details = accessibilityTools.status(), workerUsed = worker.id)
                "phone_accessibility_tree" -> PhoneToolResult.ok(tool, "Accessibility tree returned.", details = accessibilityTools.treeSummary(), workerUsed = worker.id)
                "phone_find" -> PhoneToolResult.ok(tool, "Accessibility search completed.", details = accessibilityTools.find(args.optString("text", args.optString("query"))), workerUsed = worker.id)
                "phone_app_find_text" -> PhoneToolResult.ok(tool, "Accessibility text search completed.", details = accessibilityTools.find(args.optString("text", args.optString("query"))), workerUsed = worker.id)
                "phone_focus" -> accessibilityBool(tool, accessibilityTools.focus(args.optString("text", args.optString("query")), args.optString("path", args.optString("id"))), "Focused node.", "Could not focus a matching node.", worker)
                "phone_tap_node" -> accessibilityBool(tool, accessibilityTools.tapNode(args.optString("text", args.optString("query")), args.optString("path", args.optString("id"))), "Tapped node.", "Could not tap a matching node, readonly mode is active, or sensitive app control is blocked.", worker)
                "phone_app_tap_text" -> accessibilityBool(tool, accessibilityTools.tapNode(args.optString("text", args.optString("query")), args.optString("path", args.optString("id"))), "Tapped matching text.", "Could not tap matching text, readonly mode is active, or sensitive app control is blocked.", worker)
                "phone_type" -> accessibilityBool(tool, accessibilityTools.typeText(args.optString("text")), "Typed into focused editable node.", "Could not type; focus an editable node and enable approved control.", worker)
                "phone_app_type" -> accessibilityBool(tool, accessibilityTools.typeText(args.optString("text")), "Typed into focused editable node.", "Could not type; focus an editable node and enable approved control.", worker)
                "phone_back" -> accessibilityBool(tool, accessibilityTools.back(), "Pressed Back.", "Back failed because Accessibility is disabled or Android rejected the action.", worker)
                "phone_app_back" -> accessibilityBool(tool, accessibilityTools.back(), "Pressed Back.", "Back failed because Accessibility is disabled or Android rejected the action.", worker)
                "phone_home" -> accessibilityBool(tool, accessibilityTools.home(), "Pressed Home.", "Home failed because Accessibility is disabled or Android rejected the action.", worker)
                "phone_recents" -> accessibilityBool(tool, accessibilityTools.recents(), "Opened Recents.", "Recents failed because Accessibility is disabled or Android rejected the action.", worker)
                "phone_app_submit" -> accessibilityBool(tool, accessibilityTools.submitFocusedInput(), "Submitted focused input.", "Submit failed because no editable field is focused, Accessibility is disabled, or Android rejected the action.", worker)
                "phone_swipe" -> accessibilityBool(
                    tool,
                    accessibilityTools.swipe(
                        args.optDouble("startX", 0.0).toFloat(),
                        args.optDouble("startY", 0.0).toFloat(),
                        args.optDouble("endX", 0.0).toFloat(),
                        args.optDouble("endY", 0.0).toFloat()
                    ),
                    "Swipe dispatched.",
                    "Swipe failed because Accessibility is disabled, readonly mode is active, coordinates are invalid, or sensitive app control is blocked.",
                    worker
                )
                "phone_read_active_app" -> PhoneToolResult.ok(tool, "Active app returned.", details = accessibilityTools.activeApp(), workerUsed = worker.id)
                "phone_screen_status" -> screenTools.status().toResult(tool, worker)
                "phone_screenshot" -> screenTools.screenshot().toResult(tool, worker)
                "phone_screen_observe" -> {
                    val observation = screenTools.observation()
                    if (observation.hasAnyObservation) {
                        PhoneToolResult.ok(tool, "Screen observed.", details = observation.rawDetails(), workerUsed = worker.id)
                    } else {
                        PhoneToolResult.fail(
                            tool = tool,
                            summary = "Screen observation needs setup.",
                            errorType = "permission_required",
                            errorMessage = observation.missingPermissionMessage(),
                            details = observation.rawDetails(),
                            workerUsed = worker.id
                        )
                    }
                }
                "phone_screen_describe" -> PhoneToolResult.ok(tool, "Screen description status returned.", details = screenTools.describe(), workerUsed = worker.id)
                "phone_screen_watch" -> PhoneToolResult.fail(
                    tool,
                    "Continuous screen watch is not implemented.",
                    "not_implemented",
                    screenTools.watch(),
                    workerUsed = worker.id
                )
                "voice_status" -> {
                    val status = voiceManager.status()
                    PhoneToolResult.ok(
                        tool,
                        "Voice status returned.",
                        details = "enabled=${status.voiceEnabled}\nstt=${status.sttProvider}\ntts=${status.ttsProvider}\nmicPermission=${status.micPermissionGranted}\nrecognizer=${status.speechRecognizerAvailable}\nttsReady=${status.ttsReady}\nlistening=${status.listening}\nspeaking=${status.speaking}\nautoSend=${status.autoSendTranscript}\n${status.detail}",
                        workerUsed = worker.id
                    )
                }
                "voice_start_listening", "voice_transcribe_once" -> PhoneToolResult.fail(
                    tool,
                    "Voice listening requires the visible mic button.",
                    "user_interaction_required",
                    "Android SpeechRecognizer must be started from a user-visible push-to-talk control after RECORD_AUDIO permission. Use the Chat or Voice screen mic button.",
                    workerUsed = worker.id
                )
                "voice_stop_listening" -> {
                    voiceManager.stopListening()
                    PhoneToolResult.ok(tool, "Voice listening stopped.", workerUsed = worker.id)
                }
                "voice_speak" -> {
                    val message = voiceManager.speak(args.optString("text", args.optString("content")))
                    if (message.startsWith("Speaking")) PhoneToolResult.ok(tool, message, workerUsed = worker.id)
                    else PhoneToolResult.fail(tool, message, "voice_unavailable", message, workerUsed = worker.id)
                }
                "voice_set_provider" -> {
                    voiceManager.setProviders(args.optString("stt", voiceManager.sttProvider), args.optString("tts", voiceManager.ttsProvider))
                    PhoneToolResult.ok(tool, "Voice providers updated.", details = voiceManager.status().detail, workerUsed = worker.id)
                }
                "assistant_status" -> {
                    val status = assistantManager.status()
                    PhoneToolResult.ok(
                        tool,
                        "Assistant mode status returned.",
                        details = "defaultCandidate=${status.defaultAssistantCandidate}\noverlayPermission=${status.overlayPermission}\nbubble=${status.bubbleEnabled}\nwakePhrase=${status.wakePhraseEnabled}\n${status.detail}",
                        workerUsed = worker.id
                    )
                }
                "assistant_open" -> PhoneToolResult.ok(tool, assistantManager.openAssistant(args.optString("text", args.optString("prompt"))), workerUsed = worker.id)
                "assistant_set_mode" -> {
                    val wake = args.optBoolean("wakePhrase", assistantManager.status().wakePhraseEnabled)
                    val message = assistantManager.setWakePhraseEnabled(wake)
                    PhoneToolResult.ok(tool, message, details = assistantManager.status().detail, workerUsed = worker.id)
                }
                "assistant_start_voice" -> PhoneToolResult.ok(tool, assistantManager.openAssistant(args.optString("text")), details = "Use the visible mic button; hidden listening is not started.", workerUsed = worker.id)
                "assistant_stop_voice" -> {
                    voiceManager.stopListening()
                    voiceManager.stopSpeaking()
                    PhoneToolResult.ok(tool, "Assistant voice stopped.", workerUsed = worker.id)
                }
                "assistant_show_bubble" -> {
                    val message = assistantManager.showBubble()
                    if (message.startsWith("Visible")) PhoneToolResult.ok(tool, message, workerUsed = worker.id)
                    else PhoneToolResult.fail(tool, message, "permission_required", message, workerUsed = worker.id)
                }
                "assistant_hide_bubble" -> PhoneToolResult.ok(tool, assistantManager.hideBubble(), workerUsed = worker.id)
                "model_status" -> {
                    val states = modelRouter.states()
                    PhoneToolResult.ok(
                        tool,
                        "Model status returned.",
                        details = states.joinToString("\n") { "${it.label}: available=${it.available}, selected=${it.selectedModel}, ${it.detail}" },
                        workerUsed = worker.id
                    )
                }
                "model_chat" -> {
                    val prompt = args.optString("prompt", args.optString("message"))
                    modelRouter.chat(listOf(ModelMessage("user", prompt))).fold(
                        onSuccess = { PhoneToolResult.ok(tool, "Model response returned.", details = "provider=${it.provider}\nmodel=${it.model}\n\n${it.content}", workerUsed = worker.id) },
                        onFailure = {
                            val info = com.kizek.phoneagent.models.ModelErrorClassifier.classify(it, "Model provider")
                            PhoneToolResult.fail(tool, info.userMessage, info.kind.id, it.message ?: "No model provider completed the request.", workerUsed = worker.id)
                        }
                    )
                }
                "model_switch" -> {
                    val route = runCatching { ModelRoute.valueOf(args.optString("route").uppercase()) }.getOrNull()
                        ?: return@runCatching PhoneToolResult.fail(tool, "Unknown model route.", "invalid_args", "Use MISTRAL, OPENAI_COMPATIBLE, LOCAL_HTTP, OLLAMA, LOCAL, REMOTE, or HYBRID.", workerUsed = worker.id)
                    modelRouter.selectedRoute = route
                    PhoneToolResult.ok(tool, "Model route switched to ${route.name}.", workerUsed = worker.id)
                }
                "model_provider_test" -> {
                    val provider = args.optString("provider")
                    val result = when (provider) {
                        "mistral" -> modelRouter.mistral.testConnection()
                        "openai-compatible" -> modelRouter.openAiCompatible.testConnection()
                        "local-http" -> modelRouter.localHttp.testConnection()
                        "ollama" -> modelRouter.ollama.testConnection()
                        else -> Result.failure(IllegalArgumentException("Unknown provider: $provider"))
                    }
                    result.fold(
                        onSuccess = { PhoneToolResult.ok(tool, "Provider test succeeded.", details = it, workerUsed = worker.id) },
                        onFailure = { PhoneToolResult.fail(tool, "Provider test failed.", "provider_unavailable", it.message ?: "No provider response.", workerUsed = worker.id) }
                    )
                }
                "model_provider_list_models" -> {
                    val provider = args.optString("provider")
                    val result = when (provider) {
                        "openai-compatible" -> modelRouter.openAiCompatible.listModels()
                        "local-http" -> modelRouter.localHttp.listModels()
                        "ollama" -> modelRouter.ollama.listModels()
                        else -> Result.failure(IllegalArgumentException("Provider does not support model listing: $provider"))
                    }
                    result.fold(
                        onSuccess = { models -> PhoneToolResult.ok(tool, "Provider models returned.", details = models.joinToString("\n").ifBlank { "No models returned." }, workerUsed = worker.id) },
                        onFailure = { PhoneToolResult.fail(tool, "Provider model list failed.", "provider_unavailable", it.message ?: "Model list failed.", workerUsed = worker.id) }
                    )
                }
                "model_fallback_status" -> {
                    val states = modelRouter.states()
                    PhoneToolResult.ok(
                        tool,
                        "Model fallback status returned.",
                        details = buildString {
                            appendLine("enabled=${modelRouter.fallbackEnabled}")
                            appendLine("active=${modelRouter.selectedRoute}")
                            appendLine("lastProvider=${modelRouter.lastProviderLabel}")
                            appendLine("order=${modelRouter.fallbackOrder().joinToString(" > ") { it.name }}")
                            appendLine()
                            states.forEach { state ->
                                appendLine("${state.id}: available=${state.available}, model=${state.selectedModel}, detail=${state.detail}")
                            }
                        }.trimEnd(),
                        workerUsed = worker.id
                    )
                }
                "remote_status" -> orchestratorClient.getStatus().fold(
                    onSuccess = { PhoneToolResult.ok(tool, "Remote orchestrator is reachable.", details = it.toString(2), workerUsed = WorkerMode.LAPTOP.id) },
                    onFailure = { PhoneToolResult.fail(tool, "Remote orchestrator is unavailable.", "remote_unavailable", it.message ?: "No remote status.", workerUsed = WorkerMode.LAPTOP.id) }
                )
                "remote_list_sessions" -> orchestratorClient.listSessions().fold(
                    onSuccess = { sessions -> PhoneToolResult.ok(tool, "Remote sessions returned.", details = sessions.joinToString("\n") { "${it.id} ${it.title} ${it.worker}" }, workerUsed = WorkerMode.LAPTOP.id) },
                    onFailure = { PhoneToolResult.fail(tool, "Remote sessions unavailable.", "remote_unavailable", it.message ?: "List failed.", workerUsed = WorkerMode.LAPTOP.id) }
                )
                "remote_open_session" -> orchestratorClient.openSession(args.optString("sessionId")).fold(
                    onSuccess = { PhoneToolResult.ok(tool, "Remote session opened.", details = it.toString(2), workerUsed = WorkerMode.LAPTOP.id) },
                    onFailure = { PhoneToolResult.fail(tool, "Remote session open failed.", "remote_unavailable", it.message ?: "Open failed.", workerUsed = WorkerMode.LAPTOP.id) }
                )
                "remote_send_message", "remote_run_task" -> orchestratorClient.sendMessage(args.optString("sessionId"), args.optString("message", args.optString("prompt"))).fold(
                    onSuccess = { PhoneToolResult.ok(tool, "Remote message sent.", details = it, workerUsed = WorkerMode.LAPTOP.id) },
                    onFailure = { PhoneToolResult.fail(tool, "Remote send failed.", "remote_unavailable", it.message ?: "Send failed.", workerUsed = WorkerMode.LAPTOP.id) }
                )
                "mcp_status" -> PhoneToolResult.ok(tool, "MCP status returned.", details = "remote=${mcpTools.remoteStatus()}\nlocal=${mcpTools.localStatus()}", workerUsed = worker.id)
                "mcp_remote_status" -> PhoneToolResult.ok(tool, "Remote MCP status returned.", details = mcpTools.remoteStatus(), workerUsed = WorkerMode.LAPTOP.id)
                "mcp_local_status" -> PhoneToolResult.ok(tool, "Local MCP status returned.", details = mcpTools.localStatus(), workerUsed = worker.id)
                "mcp_list" -> PhoneToolResult.ok(tool, "Built-in phone tools returned.", details = builtInTools().joinToString("\n"), workerUsed = worker.id)
                "mcp_call" -> PhoneToolResult.fail(tool, "Local MCP calls are unavailable on phone.", "not_implemented", "Local MCP requires the container plus a JSON-RPC stdio/http bridge. Remote MCP calls must go through the orchestrator.", workerUsed = worker.id)
                "mcp_start_local" -> {
                    val message = mcpTools.startLocal(args.optString("command"))
                    if (message.startsWith("Container can run")) PhoneToolResult.fail(tool, "Local MCP bridge is not linked.", "not_implemented", message, workerUsed = worker.id)
                    else PhoneToolResult.fail(tool, "Local MCP did not start.", "container_required", message, workerUsed = worker.id)
                }
                "mcp_stop_local" -> PhoneToolResult.ok(tool, "No local MCP process is running.", details = "Nothing to stop.", workerUsed = worker.id)
                else -> PhoneToolResult.fail(tool, "Tool is registered but not implemented.", "not_implemented", workerUsed = worker.id)
            }
        }.getOrElse { error ->
            PhoneToolResult.fail(
                tool = tool,
                summary = "$tool failed.",
                errorType = error::class.java.simpleName,
                errorMessage = error.message ?: "Unknown tool failure.",
                workerUsed = worker.id
            )
        }
    }

    private fun accessibilityBool(
        tool: String,
        ok: Boolean,
        successSummary: String,
        failureSummary: String,
        worker: WorkerMode
    ): PhoneToolResult {
        return if (ok) {
            PhoneToolResult.ok(tool, successSummary, workerUsed = worker.id)
        } else {
            PhoneToolResult.fail(tool, failureSummary, "accessibility_action_failed", failureSummary, workerUsed = worker.id)
        }
    }

    private fun JSONObject.path(): String = optString("path", optString("relativePath", ""))
}

private fun com.kizek.phoneagent.tools.FileToolResult.toResult(tool: String, worker: WorkerMode): PhoneToolResult {
    val detail = buildString {
        appendLine("path: $path")
        if (entries.isNotEmpty()) {
            appendLine("entries:")
            entries.forEach { appendLine(it) }
        }
        if (content.isNotBlank()) {
            appendLine("content:")
            appendLine(content.take(20_000))
        }
    }.trimEnd()
    return if (ok) {
        PhoneToolResult.ok(tool, "$tool completed for $path.", details = detail, workerUsed = worker.id)
    } else {
        PhoneToolResult.fail(tool, error ?: "$tool failed.", "file_error", error ?: "$tool failed.", details = detail, workerUsed = worker.id)
    }
}

private fun com.kizek.phoneagent.tools.ShellResult.toResult(tool: String, worker: WorkerMode): PhoneToolResult {
    val ok = exitCode == 0 && !timedOut
    return PhoneToolResult(
        tool = tool,
        success = ok,
        summary = if (timedOut) "Command timed out." else "Command exited with ${exitCode ?: "unknown"}.",
        details = "command: $command",
        stdout = stdout,
        stderr = stderr,
        exitCode = exitCode,
        errorType = if (ok) null else if (timedOut) "timeout" else "non_zero_exit",
        errorMessage = if (ok) null else stderr.ifBlank { if (timedOut) "Command timed out." else "Command failed." },
        workerUsed = worker.id
    )
}

private fun com.kizek.phoneagent.container.ContainerCommandResult.toResult(tool: String, worker: WorkerMode): PhoneToolResult {
    val ok = exitCode == 0 && !timedOut
    return PhoneToolResult(
        tool = tool,
        success = ok,
        summary = if (timedOut) "Container command timed out." else if (exitCode == null) "Container command did not run." else "Container command exited with $exitCode.",
        details = "command: $command\ndurationMs: $durationMs\ninvocation: $invocation",
        stdout = output,
        stderr = error.orEmpty(),
        exitCode = exitCode,
        errorType = if (ok) null else if (timedOut) "timeout" else "container_error",
        errorMessage = if (ok) null else error ?: "Container command failed.",
        workerUsed = worker.id
    )
}

private fun com.kizek.phoneagent.container.ContainerInstallResult.toPhoneResult(tool: String, worker: WorkerMode): PhoneToolResult {
    return if (success) {
        PhoneToolResult.ok(
            tool = tool,
            summary = summary,
            details = listOf(details, stdout, stderr).filter { it.isNotBlank() }.joinToString("\n"),
            workerUsed = worker.id
        )
    } else {
        PhoneToolResult.fail(
            tool = tool,
            summary = summary,
            errorType = error ?: "container_install_error",
            errorMessage = stderr.ifBlank { details.ifBlank { summary } },
            details = listOf(details, stdout, stderr).filter { it.isNotBlank() }.joinToString("\n"),
            workerUsed = worker.id
        )
    }
}

private fun com.kizek.phoneagent.runtime.SshCommandResult.toPhoneResult(tool: String, worker: WorkerMode): PhoneToolResult {
    val isTermux = tool.startsWith("termux_")
    val classified = classifySshFailure(stderr, timedOut, isTermux)
    val detail = buildString {
        appendLine("targetId=$targetId")
        appendLine("target=$targetName")
        appendLine("command=$command")
        appendLine("fingerprint=${fingerprint.ifBlank { "not returned" }}")
        if (warning.isNotBlank()) appendLine("warning=$warning")
        if (!success) {
            appendLine("reason=${classified.first}")
            if (isTermux) {
                appendLine()
                appendLine(termuxRecoveryGuide())
            }
        }
    }.trimEnd()
    return if (success) {
        PhoneToolResult.ok(
            tool = tool,
            summary = "$targetName exited with ${exitCode ?: "unknown"}.",
            details = detail,
            stdout = stdout,
            stderr = stderr,
            exitCode = exitCode,
            workerUsed = worker.id
        )
    } else {
        PhoneToolResult.fail(
            tool = tool,
            summary = if (isTermux) {
                "Termux SSH did not connect: ${classified.second}"
            } else if (timedOut) {
                "$targetName timed out."
            } else {
                "$targetName command failed."
            },
            errorType = classified.first,
            errorMessage = stderr.ifBlank { classified.second },
            details = detail,
            stdout = stdout,
            stderr = stderr,
            exitCode = exitCode,
            workerUsed = worker.id
        )
    }
}

private fun classifySshFailure(stderr: String, timedOut: Boolean, termux: Boolean): Pair<String, String> {
    val lower = stderr.lowercase()
    return when {
        timedOut || lower.contains("timeout") || lower.contains("timed out") -> (if (termux) "termux_timeout" else "timeout") to "connection timed out"
        lower.contains("username is required") || lower.contains("host and username") -> (if (termux) "termux_settings_missing" else "ssh_settings_missing") to "host or username is missing"
        lower.contains("auth fail") || lower.contains("authentication") || lower.contains("permission denied") -> (if (termux) "termux_auth_failed" else "ssh_auth_failed") to "authentication failed"
        lower.contains("connection refused") -> (if (termux) "termux_port_closed" else "ssh_port_closed") to "port is closed or sshd is not running"
        lower.contains("no route") || lower.contains("unreachable") || lower.contains("unknownhost") || lower.contains("unable to resolve") -> (if (termux) "termux_unreachable" else "ssh_unreachable") to "host is unreachable"
        else -> (if (termux) "termux_unreachable" else "ssh_error") to stderr.ifBlank { "SSH command failed" }.take(160)
    }
}

private fun termuxRecoveryGuide(): String {
    return """
        Termux setup:
        pkg update
        pkg install openssh
        passwd
        sshd

        Phone Agent settings:
        host: 127.0.0.1
        port: 8022
        username: your Termux username
        auth: password or SSH key
    """.trimIndent()
}

private fun com.kizek.phoneagent.runtime.ExecutionRouteResult.toResult(tool: String, worker: WorkerMode): PhoneToolResult {
    return if (success) {
        PhoneToolResult.ok(
            tool = tool,
            summary = "${selectedRuntime?.label ?: "Runtime"} completed the command.",
            details = details(),
            stdout = stdout,
            stderr = stderr,
            exitCode = exitCode,
            workerUsed = worker.id
        )
    } else {
        PhoneToolResult.fail(
            tool = tool,
            summary = "Execution fallback failed.",
            errorType = "runtime_unavailable",
            errorMessage = reason,
            details = details(),
            stdout = stdout,
            stderr = stderr,
            exitCode = exitCode,
            workerUsed = worker.id
        )
    }
}

private fun com.kizek.phoneagent.tools.ScreenCaptureStatus.toResult(tool: String, worker: WorkerMode): PhoneToolResult {
    val detail = buildString {
        appendLine(detail)
        lastScreenshotPath?.let { appendLine("path: $it") }
        width?.let { appendLine("width: $it") }
        height?.let { appendLine("height: $it") }
        timestamp?.let { appendLine("timestamp: $it") }
    }.trimEnd()
    if (tool == "phone_screenshot" && lastScreenshotPath == null) {
        return PhoneToolResult.fail(
            tool,
            "No screenshot has been captured yet.",
            "permission_or_capture_required",
            "Use the visible MediaProjection prompt in Settings or Developer Tests; phone_screenshot never captures hidden screens.",
            details = detail,
            workerUsed = worker.id
        )
    }
    return if (tool == "phone_screen_status" || lastScreenshotPath != null || configured) {
        PhoneToolResult.ok(tool, detail.lineSequence().firstOrNull().orEmpty().ifBlank { "Screen status returned." }, details = detail, workerUsed = worker.id)
    } else {
        PhoneToolResult.fail(tool, "Screen capture is not configured.", "permission_required", detail, workerUsed = worker.id)
    }
}
