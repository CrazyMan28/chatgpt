package com.kizek.phoneagent.ui.screens

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.kizek.phoneagent.PhoneAgentApplication
import com.kizek.phoneagent.ui.components.AppBackground
import com.kizek.phoneagent.ui.components.DetailsBottomSheet
import com.kizek.phoneagent.ui.components.GlassCard
import com.kizek.phoneagent.ui.components.StatusPill
import com.kizek.phoneagent.ui.components.StatusTone
import kotlinx.coroutines.launch

@Composable
fun DeveloperTestsScreen(
    app: PhoneAgentApplication,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("Tests create visible events in the active chat session.") }
    var results by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
    var detail by remember { mutableStateOf<Pair<String, String>?>(null) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val captureLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        status = if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            app.screenCaptureManager.captureOnce(result.resultCode, result.data!!)
            "Screen capture accepted. Screenshot service started."
        } else {
            app.screenCaptureManager.markPermissionResult(false)
            "Screen capture permission was not granted."
        }
        results = listOf("Screen capture" to status) + results
    }
    val prootLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importProot(uri)
            status = result.summary
            results = listOf("Import PRoot" to listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n")) + results
        }
    }
    val rootfsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val result = app.containerTools.importRootfs(uri)
            status = result.summary
            results = listOf("Import rootfs" to listOf(result.summary, result.details, result.stderr).filter { it.isNotBlank() }.joinToString("\n")) + results
        }
    }
    fun runVoiceStt() {
        app.voiceManager.transcribeOnce(
            onPartial = { status = "partial: $it" },
            onFinal = {
                status = "transcript: $it"
                results = listOf("STT once" to status) + results
            },
            onError = {
                status = it
                results = listOf("STT once" to status) + results
            }
        )
    }
    val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) runVoiceStt() else {
            status = "Microphone permission denied."
            results = listOf("STT once" to status) + results
        }
    }
    val tests = developerTestSections()

    AppBackground(modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            GlassCard(
                title = "Developer Tests",
                subtitle = "Organized checks for runtime features. Each run creates visible cards in the active chat session.",
                icon = "TEST",
                status = "Available"
            ) {
                StatusPill(status, if (status.contains("denied", true) || status.contains("failed", true)) StatusTone.ERROR else StatusTone.READY)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(onClick = {
                        val manager = app.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                        captureLauncher.launch(manager.createScreenCaptureIntent())
                    }) { Text("Capture screenshot") }
                    OutlinedButton(onClick = {
                        status = app.screenCaptureManager.status().detail
                        results = listOf("Screen status" to status) + results
                    }) { Text("Screen status") }
                    OutlinedButton(onClick = { prootLauncher.launch(arrayOf("*/*")) }) { Text("Import PRoot") }
                    OutlinedButton(onClick = { rootfsLauncher.launch(arrayOf("*/*")) }) { Text("Import rootfs") }
                    OutlinedButton(onClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            runVoiceStt()
                        } else {
                            micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    }) { Text("STT once") }
                    OutlinedButton(onClick = {
                        status = app.voiceManager.speak("Phone Agent developer test.")
                        results = listOf("TTS speak" to status) + results
                    }) { Text("TTS speak") }
                }
            }
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                tests.forEach { section ->
                    item {
                        Text(section.title, style = MaterialTheme.typography.titleMedium)
                    }
                    items(section.tests, key = { "${section.title}:${it.id}" }) { test ->
                        GlassCard(
                            title = test.label,
                            subtitle = test.description,
                            icon = "TEST",
                            status = "Ready",
                            actions = {
                                Button(onClick = {
                                    scope.launch {
                                        status = "Running ${test.label}"
                                        app.runtime.runDeveloperTest(test.id)
                                        status = "Created cards for ${test.label}"
                                        results = listOf(test.label to status) + results
                                    }
                                }) { Text("Run") }
                            }
                        )
                    }
                }
                if (results.isNotEmpty()) {
                    item { Text("Results", style = MaterialTheme.typography.titleMedium) }
                    items(results, key = { "${it.first}:${it.second.hashCode()}" }) { (title, body) ->
                        GlassCard(
                            title = title,
                            subtitle = body,
                            icon = if (body.contains("denied", true) || body.contains("failed", true)) "ERR" else "OK",
                            status = if (body.contains("denied", true) || body.contains("failed", true)) "Failed" else "Pass",
                            onClick = { detail = title to body },
                            actions = {
                                OutlinedButton(onClick = { detail = title to body }) { Text("Details") }
                            }
                        )
                    }
                }
            }
        }
    }
    detail?.let { (title, body) ->
        DetailsBottomSheet(title = title, body = body, onDismiss = { detail = null })
    }
}

private data class DeveloperTestSection(val title: String, val tests: List<DeveloperTestItem>)
private data class DeveloperTestItem(val id: String, val label: String, val description: String)

private fun developerTestSections(): List<DeveloperTestSection> {
    return listOf(
        DeveloperTestSection(
            "Parser and multi-turn",
            listOf(
                DeveloperTestItem("parser_regex_safety", "1 Regex safety", "No PatternSyntaxException from invalid regex-looking text."),
                DeveloperTestItem("parser_raw_json_tool", "2 Raw JSON tool call", "Parses Format B into an internal tool call."),
                DeveloperTestItem("parser_fenced_json_tool", "3 Fenced JSON tool call", "Parses fenced json into an internal tool call."),
                DeveloperTestItem("parser_text_before_after_json", "4 Text before/after JSON", "Finds balanced JSON inside surrounding assistant text."),
                DeveloperTestItem("parser_invalid_json", "5 Invalid JSON fallback", "Invalid JSON becomes plain final text, not a crash."),
                DeveloperTestItem("parser_multiple_json", "6 Multiple JSON objects", "Brace scanner extracts multiple JSON objects."),
                DeveloperTestItem("parser_normal_text", "7 Normal text", "Normal assistant text remains normal text."),
                DeveloperTestItem("chat_no_raw_json", "8 No raw JSON rendered", "Checks raw payloads stay behind Details."),
                DeveloperTestItem("parser_six_turn_stability", "9 Six-turn stability", "Runs the real multi-turn sequence without parser crash."),
                DeveloperTestItem("what_can_you_do", "Test what can you do", "Must not crash and must return a local capability answer."),
                DeveloperTestItem("can_write_files", "Test can you write files", "Answers from real local workspace/file status."),
                DeveloperTestItem("send_button", "Test send button", "Typed text dispatches through the chat send path."),
                DeveloperTestItem("thinking_timeout", "Test thinking timeout", "Fake model error stops thinking and creates an error card."),
                DeveloperTestItem("question_bottom_sheet", "Test question sheet", "Shows slide-up multiple-choice question choices."),
                DeveloperTestItem("minecraft_flow", "Test Minecraft flow", "Creates platform/version/worker route question sheets."),
                DeveloperTestItem("screen_ask", "Test screen ask", "Runs screen observe and creates an assistant answer."),
                DeveloperTestItem("restart_recovery", "Test restart recovery", "Stale running task becomes recovered/failed."),
                DeveloperTestItem("responsive_bottom_nav", "Test bottom nav labels", "Checks Chat/Tasks/Tools/Files/Settings labels fit."),
                DeveloperTestItem("details_sheet_tabs", "Test details tab labels", "Checks Summary/Args/Output/Error/Approval/Retry/Logs/Raw labels.")
            )
        ),
        DeveloperTestSection(
            "Providers",
            listOf(
                DeveloperTestItem("mistral_status", "10 Mistral status", "Runs a tiny Mistral provider test or a clean missing-key card."),
                DeveloperTestItem("openai_compatible_test", "11 OpenAI-compatible test", "Runs configured OpenAI-compatible provider test or clean setup/error card."),
                DeveloperTestItem("local_http_test", "12 Local HTTP test", "Runs configured local HTTP provider test or offline card."),
                DeveloperTestItem("ollama_status_list_models", "13 Ollama list models", "Calls Ollama /api/tags or shows an offline card."),
                DeveloperTestItem("provider_fallback_test", "14 Provider fallback", "Shows AI provider fallback order and configured states.")
            )
        ),
        DeveloperTestSection(
            "Core",
            listOf(
                DeveloperTestItem("chat_send_typed", "Send typed chat", "Types 'can you write files' through the chat path."),
                DeveloperTestItem("mistral_chat", "Mistral chat", "Checks configured model routing."),
                DeveloperTestItem("question_card", "Question card", "Creates a pending question bottom sheet."),
                DeveloperTestItem("approval_card", "Approval card", "Creates a medium-risk approval card.")
            )
        ),
        DeveloperTestSection(
            "Files",
            listOf(DeveloperTestItem("file_write_read", "File write/read", "Writes and reads a workspace file."))
        ),
        DeveloperTestSection(
            "Shell",
            listOf(DeveloperTestItem("shell_exec", "App shell", "Runs pwd through phone-local shell."))
        ),
        DeveloperTestSection(
            "Container",
            listOf(
                DeveloperTestItem("container_status", "Container status", "Checks PRoot/rootfs state."),
                DeveloperTestItem("container_test", "Container test", "Runs a minimal container command when assets exist."),
                DeveloperTestItem("container_exec", "Container exec", "Runs uname/os-release in the container.")
            )
        ),
        DeveloperTestSection(
            "Fallback runtimes",
            listOf(
                DeveloperTestItem("local_model_status", "Local model status", "Shows local model files and backend availability."),
                DeveloperTestItem("termux_status", "Termux status", "Checks Termux install/configuration state."),
                DeveloperTestItem("termux_test_connection", "Termux SSH", "Runs pwd && uname -a through Termux SSH when configured."),
                DeveloperTestItem("ssh_status", "SSH targets", "Lists configured SSH fallback targets."),
                DeveloperTestItem("ssh_test_connection", "SSH test command", "Runs pwd && uname -a on the fallback SSH target."),
                DeveloperTestItem("execution_route_status", "Fallback order", "Shows runtime execution order and readiness."),
                DeveloperTestItem("execution_fallback_command", "Fallback command", "Runs pwd && uname -a using fallback routing.")
            )
        ),
        DeveloperTestSection(
            "Accessibility",
            listOf(
                DeveloperTestItem("accessibility_status", "Accessibility status", "Reads Android accessibility service state."),
                DeveloperTestItem("accessibility_tree", "Accessibility tree", "Summarizes the active window tree."),
                DeveloperTestItem("phone_back", "Back action", "Requests phone Back through the safety layer."),
                DeveloperTestItem("phone_home", "Home action", "Requests phone Home through the safety layer."),
                DeveloperTestItem("phone_recents", "Recents action", "Requests Android Recents through the safety layer.")
            )
        ),
        DeveloperTestSection(
            "Phone app commands",
            listOf(
                DeveloperTestItem("phone_parse_youtube_search", "15 Parse YouTube search", "Parses app=youtube, action=search, query=iron man edits."),
                DeveloperTestItem("parser_typo_youtuber_serch", "15a Typo YouTube search", "Parses youtuber/serch into app=youtube and query=iron man."),
                DeveloperTestItem("parser_typo_yotube_searh", "15b Typo yotube searh", "Parses yotube/searh into YouTube search."),
                DeveloperTestItem("parser_search_in_chrome", "15c Search in Chrome", "Parses search query in/on app patterns."),
                DeveloperTestItem("parser_settings_tap_display", "15d Settings tap", "Parses setings typo and tap target."),
                DeveloperTestItem("parser_discord_tap_friends", "15e Discord tap", "Parses in-app tap syntax."),
                DeveloperTestItem("regression_never_full_command_app_name", "15f App extraction regression", "Never passes the full command as the app name."),
                DeveloperTestItem("phone_open_youtube_alias", "16 Open YouTube", "Opens YouTube by alias or shows a clear missing-app result."),
                DeveloperTestItem("phone_youtube_search", "17 YouTube search", "Runs direct intent or accessibility search for iron man edits."),
                DeveloperTestItem("phone_chrome_search", "18 Chrome search", "Runs Chrome search for minecraft fabric mod setup."),
                DeveloperTestItem("phone_generic_app_type", "19 Generic app tap/type", "Checks generic app action chain through accessibility fallback."),
                DeveloperTestItem("phone_missing_app_search", "20 Missing app suggestions", "Checks fake app search suggestions/question handling."),
                DeveloperTestItem("phone_approval_chain_youtube_search", "21 Approval chain once", "Requests one approval for open YouTube then search."),
                DeveloperTestItem("phone_approval_no_duplicate", "22 No duplicate approval spam", "Repeated same chain should reuse a pending approval."),
                DeveloperTestItem("chain_youtube_typo_search", "22a Typo search chain", "Dispatches phone_open_app then phone_app_search for typo input."),
                DeveloperTestItem("chain_chrome_search", "22b Chrome search chain", "Dispatches open Chrome then app search."),
                DeveloperTestItem("chain_settings_tap", "22c Settings tap chain", "Dispatches open Settings then tap Display."),
                DeveloperTestItem("chain_generic_app_type", "22d Generic app type chain", "Dispatches open app then phone_app_type."),
                DeveloperTestItem("chain_missing_app_suggestions", "22e Missing app suggestions", "Checks missing app recovery/question path.")
            )
        ),
        DeveloperTestSection(
            "Local no-model",
            listOf(
                DeveloperTestItem("what_can_you_do", "23 What can you do", "Local deterministic capability answer without a model call."),
                DeveloperTestItem("can_write_files", "24 Can write files", "Local deterministic file capability answer."),
                DeveloperTestItem("what_files_access", "25 What files can you access", "Uses local capability routing for file/workspace status."),
                DeveloperTestItem("no_provider_local_app_control", "25a App control no provider", "Confirms app control plan generation does not require a model provider.")
            )
        ),
        DeveloperTestSection(
            "Provider/question recovery",
            listOf(
                DeveloperTestItem("provider_429_simulation", "Provider 429 classification", "Rate limit is not shown as not configured."),
                DeveloperTestItem("provider_timeout_simulation", "Provider timeout classification", "Temporary failure stays distinct from setup."),
                DeveloperTestItem("provider_auth_simulation", "Provider auth classification", "Invalid key is classified as auth."),
                DeveloperTestItem("question_resume_simulation", "Question resume", "Answering a stored question resumes its continuation path."),
                DeveloperTestItem("typed_answer_routes_question", "Typed answer routing", "Normal chat text answers the active question first."),
                DeveloperTestItem("issue6_question_creates_pending", "Issue 6 pending question", "ask me a question then open youtube creates a real pending Question."),
                DeveloperTestItem("issue6_typed_answer_routes_active", "Issue 6 answer routing", "Typed text answers the active question instead of normal chat."),
                DeveloperTestItem("issue6_no_message_added_final", "Issue 6 no Message Added", "Assistant final text is never exactly Message Added."),
                DeveloperTestItem("issue6_typo_question_resume", "Issue 6 typo resume", "Typo question flow resumes, runs YouTube, then asks again."),
                DeveloperTestItem("issue6_step_advances_runs_tool", "Issue 6 step advance", "Answer advances currentStepIndex and runs phone_open_app."),
                DeveloperTestItem("issue6_missing_continuation_recovery", "Issue 6 recovery card", "Missing continuation creates Retry task / Start over / Open YouTube anyway."),
                DeveloperTestItem("termux_setup_missing_simulation", "Termux setup recovery", "Shows exact Termux SSH setup guidance.")
            )
        ),
        DeveloperTestSection(
            "Screen",
            listOf(
                DeveloperTestItem("screen_ask", "Screen Ask", "Observes the screen and asks the AI for a useful answer."),
                DeveloperTestItem("screen_ask_draft", "Screen Ask with draft", "Answers 'can you write files' using screen context."),
                DeveloperTestItem("screen_status", "Screen status", "Checks screen-capture permission/config."),
                DeveloperTestItem("screen_screenshot", "Screenshot", "Runs the screenshot tool."),
                DeveloperTestItem("screen_observe", "Observe Only", "Runs phone_screen_observe for raw debug details without an AI answer."),
                DeveloperTestItem("screen_describe", "Describe screen", "Runs screen description status.")
            )
        ),
        DeveloperTestSection(
            "Chat UX",
            listOf(
                DeveloperTestItem("responsive_status_chips", "26 Chat screen fit", "Header/status chips are compact and horizontally scrollable."),
                DeveloperTestItem("responsive_status_chips", "27 Header compact", "Top bar uses compact title/actions and minimal status row."),
                DeveloperTestItem("responsive_bottom_nav", "28 Bottom nav labels fit", "Checks fixed Chat/Tasks/Tools/Files/Settings slots."),
                DeveloperTestItem("send_button", "29 Composer send button", "Composer is compact and send arrow appears with text."),
                DeveloperTestItem("details_sheet_tabs", "30 Details tabs readable", "Checks Summary/Args/Output/Error/Approval/Retry/Logs/Raw labels."),
                DeveloperTestItem("question_bottom_sheet", "31 Question sheet clean", "Shows compact slide-up multiple-choice choices."),
                DeveloperTestItem("screen_ask_draft", "32 Keyboard/send path", "Typed draft path remains usable with the composer."),
                DeveloperTestItem("settings_status", "33 Settings usable", "Settings screen remains visible through Tools/Settings links."),
                DeveloperTestItem("restart_recovery", "34 Developer Tests accessible", "Developer Tests remains accessible and can run recovery.")
            )
        ),
        DeveloperTestSection(
            "Voice",
            listOf(
                DeveloperTestItem("voice_status", "Voice status", "Checks STT/TTS providers."),
                DeveloperTestItem("voice_stt_once", "STT tool", "Runs visible STT blocker/tool path."),
                DeveloperTestItem("voice_tts", "TTS speak", "Speaks a short test phrase."),
                DeveloperTestItem("voice_agent_query", "Voice agent query", "Opens assistant voice query flow.")
            )
        ),
        DeveloperTestSection(
            "Assistant Mode",
            listOf(
                DeveloperTestItem("assistant_activity", "Assistant activity", "Launches AssistantActivity."),
                DeveloperTestItem("assistant_bubble", "Floating bubble", "Checks overlay bubble behavior."),
                DeveloperTestItem("default_assistant", "Default assistant", "Checks default assistant setup status."),
                DeveloperTestItem("quick_launch", "Quick launch", "Checks quick launch intent path."),
                DeveloperTestItem("assistant_wake", "Wake phrase status", "Shows honest Android limitations.")
            )
        ),
        DeveloperTestSection(
            "Remote",
            listOf(
                DeveloperTestItem("remote_orchestrator", "Orchestrator", "Checks remote daemon status."),
                DeveloperTestItem("remote_list_sessions", "Remote sessions", "Lists remote sessions."),
                DeveloperTestItem("remote_send_message", "Remote message", "Sends a test message to remote worker."),
                DeveloperTestItem("remote_questions", "Remote questions", "Checks remote question sync route."),
                DeveloperTestItem("remote_approvals", "Remote approvals", "Checks remote approval status route.")
            )
        ),
        DeveloperTestSection(
            "Minecraft flow",
            listOf(DeveloperTestItem("minecraft_flow", "Minecraft flow", "Creates the multi-question Minecraft build flow."))
        )
    )
}
