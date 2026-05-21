package com.kizek.phoneagent.core

import android.util.Log
import com.kizek.phoneagent.models.ModelMessage
import com.kizek.phoneagent.safety.RiskClassifier
import com.kizek.phoneagent.safety.SafetyPolicy
import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.storage.ApprovalEntity
import com.kizek.phoneagent.storage.QuestionEntity
import com.kizek.phoneagent.storage.SessionEntity
import com.kizek.phoneagent.storage.TaskEntity
import com.kizek.phoneagent.sync.OrchestratorClient
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.regex.PatternSyntaxException
import java.util.UUID

private const val TAG = "AgentRuntime"
private const val MODEL_STEP_TIMEOUT_MS = 45_000L
private const val REMOTE_SEND_TIMEOUT_MS = 45_000L
private const val TOOL_STEP_TIMEOUT_MS = 120_000L
private const val STALE_RUNNING_TASK_MS = 2 * 60 * 1000L

class AgentRuntime(
    private val database: AppDatabase,
    val eventLog: EventLog,
    val taskQueue: TaskQueue,
    val approvalManager: ApprovalManager,
    val questionManager: QuestionManager,
    val memoryStore: MemoryStore,
    val toolRegistry: ToolRegistry,
    val workerRouter: WorkerRouter,
    private val localWorker: LocalAgentWorker,
    private val orchestratorClient: OrchestratorClient
) {
    private val console = mutableListOf<String>()
    private val safetyPolicy = SafetyPolicy()
    private val riskClassifier = RiskClassifier()
    private val pendingActions = mutableMapOf<String, PendingToolAction>()
    private val pendingApprovalByKey = mutableMapOf<String, String>()
    var selectedSessionId: String? = null
        private set
    var selectedWorker: WorkerMode = WorkerMode.HYBRID
    var maxAgentSteps: Int = 12

    suspend fun bootstrap() {
        if (database.sessions().listAll().isEmpty()) {
            val session = createLocalSession("Phone local session")
            eventLog.append(
                session.id,
                type = "MessageAdded",
                author = "system",
                summary = "Phone Agent is ready in local/offline mode. Connect the laptop daemon in Settings for shared sessions."
            )
            questionManager.ask(
                session.id,
                "Where should this session run by default?",
                "single",
                WorkerMode.entries.map { it.label }
            )
        } else {
            selectedSessionId = database.sessions().listAll().firstOrNull()?.id
        }
        recoverInterruptedTasks(staleOnly = false)
    }

    suspend fun snapshot(): RuntimeSnapshot {
        recoverInterruptedTasks(staleOnly = true)
        val sessions = database.sessions().listAll()
        val sessionId = selectedSessionId ?: sessions.firstOrNull()?.id
        val remoteStatus = orchestratorClient.getStatus().fold(
            onSuccess = { "connected: ${orchestratorClient.baseUrl}" },
            onFailure = { "offline: ${it.message ?: orchestratorClient.baseUrl}" }
        )
        return RuntimeSnapshot(
            sessions = sessions,
            events = sessionId?.let { database.events().listForSession(it) }.orEmpty(),
            tasks = database.tasks().listAll(),
            approvals = database.approvals().listAll(),
            questions = database.questions().listAll(),
            selectedSessionId = sessionId,
            consoleLines = console.toList(),
            remoteStatus = remoteStatus
        )
    }

    suspend fun recoverInterruptedTasks(staleOnly: Boolean = true): Int {
        val now = System.currentTimeMillis()
        val running = database.tasks().listAll().filter { task ->
            task.state == "running" && (!staleOnly || now - task.updatedAt > STALE_RUNNING_TASK_MS)
        }
        running.forEach { task ->
            val updated = taskQueue.update(task, "failed", "Recovered from interrupted task")
            eventLog.append(
                sessionId = updated.sessionId,
                type = "TaskFailed",
                author = "system",
                summary = "Recovered from interrupted task.",
                payload = JSONObject()
                    .put("source", "startup_recovery")
                    .put("taskId", updated.id)
                    .put("previousTitle", updated.title)
                    .put("previousStep", task.step)
                    .toString(2)
            )
        }
        return running.size
    }

    suspend fun createLocalSession(title: String = "New phone session"): SessionEntity {
        val now = System.currentTimeMillis()
        val session = SessionEntity(
            id = UUID.randomUUID().toString(),
            title = title,
            worker = WorkerMode.PHONE_LOCAL.id,
            mode = "local",
            updatedAt = now,
            remote = false
        )
        database.sessions().upsert(session)
        selectedSessionId = session.id
        return session
    }

    suspend fun selectSession(sessionId: String) {
        selectedSessionId = sessionId
        val session = database.sessions().get(sessionId)
        if (session?.remote == true) {
            refreshRemoteQuestions(sessionId)
        }
    }

    suspend fun refreshRemoteSessions(): Result<Int> {
        return orchestratorClient.listSessions().map { remoteSessions ->
            remoteSessions.forEach { remote ->
                database.sessions().upsert(
                    SessionEntity(
                        id = remote.id,
                        title = remote.title,
                        worker = remote.worker.ifBlank { WorkerMode.LAPTOP.id },
                        mode = "remote",
                        updatedAt = remote.updatedAt.takeIf { it > 0 } ?: System.currentTimeMillis(),
                        remote = true
                    )
                )
            }
            remoteSessions.size
        }
    }

    suspend fun refreshRemoteQuestions(sessionId: String? = selectedSessionId): Result<Int> {
        if (sessionId == null) {
            return Result.success(0)
        }
        return orchestratorClient.listQuestions(sessionId).map { remoteQuestions ->
            remoteQuestions.forEach { question ->
                database.questions().upsert(
                    QuestionEntity(
                        id = question.id,
                        sessionId = sessionId,
                        prompt = question.prompt,
                        type = question.type,
                        optionsCsv = question.options.joinToString("|"),
                        answer = null,
                        status = question.status,
                        createdAt = question.createdAt
                    )
                )
            }
            remoteQuestions.size
        }
    }

    suspend fun sendMessage(text: String) {
        val sessionId = selectedSessionId ?: createLocalSession().id
        var task: TaskEntity? = null
        try {
            val worker = selectedWorker
            val prompt = text.trim()
            val activeQuestion = database.questions().listAll()
                .filter { it.sessionId == sessionId && it.status == "pending" }
                .sortedBy { it.createdAt }
                .firstOrNull()
            if (activeQuestion != null) {
                answerQuestion(activeQuestion.id, prompt)
                return
            }
            eventLog.append(sessionId, "MessageAdded", "user", prompt)

            localCapabilityAnswer(prompt)?.let { answer ->
                eventLog.append(
                    sessionId = sessionId,
                    type = "MessageAdded",
                    author = "assistant",
                    summary = answer,
                    payload = JSONObject()
                        .put("source", "local_capability_answer")
                        .put("modelCalled", false)
                        .toString(2)
                )
                return
            }

            task = taskQueue.start(sessionId, "Handle phone prompt", worker)

            if (prompt.lowercase().contains("minecraft") && (prompt.lowercase().contains("mod") || prompt.lowercase().contains("plugin"))) {
                startMinecraftQuestions(sessionId)
                taskQueue.update(task, "waiting", "Waiting for Minecraft build answers")
                return
            }

            // --- Compound intent detection ---
            val intents = PhoneCommandParser.splitCompoundIntents(prompt)
            val isCompound = intents.size > 1

            if (isScreenAskPrompt(prompt)) {
                runScreenAsk(
                    sessionId = sessionId,
                    task = task,
                    userDraft = "",
                    userPrompt = prompt,
                    appendUserAction = false,
                    markDone = !isCompound
                )
                if (isCompound) {
                    val remaining = intents.drop(1)
                    taskQueue.update(task, "running", "Continuing compound command (${remaining.size} step(s) remaining)")
                    for ((stepIdx, step) in remaining.withIndex()) {
                        taskQueue.update(task, "running", "Compound step ${stepIdx + 2} / ${intents.size}: ${step.take(60)}")
                        val stepPlan = directPlan(step)
                        if (stepPlan != null) {
                            val results = executeDirectPlan(sessionId, task, stepPlan)
                            if (results != null) {
                                eventLog.append(sessionId, "MessageAdded", "assistant", directPlanAnswer(step, stepPlan, results), chainDetails(results))
                                if (!results.all { it.success }) {
                                    taskQueue.update(task, "failed", "Compound step failed: ${step.take(60)}")
                                    return
                                }
                            }
                        } else {
                            runAgentLoop(sessionId, task, step)
                            return
                        }
                    }
                    taskQueue.update(task, "done", "All compound steps completed")
                }
                return
            }

            val structuredPhoneCommand = PhoneCommandParser.parseStructured(prompt)
            if (structuredPhoneCommand.intent != PhoneCommandParser.PhoneIntent.UNKNOWN && structuredPhoneCommand.needsQuestion) {
                askPhoneCommandQuestion(sessionId, task, structuredPhoneCommand)
                return
            }

            directPlan(prompt)?.let { plan ->
                val results = executeDirectPlan(sessionId, task, plan)
                if (results != null) {
                    val answer = directPlanAnswer(prompt, plan, results)
                    eventLog.append(sessionId, "MessageAdded", "assistant", answer, chainDetails(results))
                    taskQueue.update(task, if (results.all { it.success }) "done" else "failed", "Direct phone tool completed")
                }
                return
            }

            if (worker == WorkerMode.LAPTOP || worker == WorkerMode.SERVER) {
                val remoteResult = withTimeoutOrNull(REMOTE_SEND_TIMEOUT_MS) {
                    orchestratorClient.sendMessage(sessionId, prompt)
                } ?: Result.failure(IllegalStateException("Remote model call timed out after ${REMOTE_SEND_TIMEOUT_MS / 1000}s."))
                remoteResult.fold(
                    onSuccess = { content ->
                        eventLog.append(sessionId, "MessageAdded", "assistant", content)
                        taskQueue.update(task, "done", "Remote response received")
                    },
                    onFailure = {
                        val message = "Remote worker unavailable: ${it.message ?: "connect the orchestrator first"}"
                        recordRuntimeError(sessionId, "remote_send", message, it)
                        taskQueue.update(task, "failed", message)
                    }
                )
                return
            }

            runAgentLoop(sessionId, task, prompt)
        } catch (error: Exception) {
            Log.e(TAG, "sendMessage failed for prompt=${text.take(120)}", error)
                val message = if (error is PatternSyntaxException) {
                    "Parser failed but recovered."
                } else {
                    "Phone Agent hit an internal error while handling that message."
                }
                recordRuntimeError(sessionId, "sendMessage", message, error)
                task?.let { taskQueue.update(it, "failed", message) }
        }
    }

    suspend fun askAboutScreen(userDraft: String = "") {
        val sessionId = selectedSessionId ?: createLocalSession().id
        val task = taskQueue.start(sessionId, "Screen ask", WorkerMode.PHONE_LOCAL)
        try {
            runScreenAsk(
                sessionId = sessionId,
                task = task,
                userDraft = userDraft,
                userPrompt = if (userDraft.isBlank()) {
                    "The user tapped Screen."
                } else {
                    "The user tapped Screen with this draft: $userDraft"
                },
                appendUserAction = true
            )
        } catch (error: Exception) {
            val message = "Screen ask failed before it could return an answer."
            recordRuntimeError(sessionId, "screen_ask", message, error)
            taskQueue.update(task, "failed", message)
        }
    }

    suspend fun approve(id: String, scope: String = "once") {
        approvalManager.approve(id, scope)?.let { approval ->
            pendingApprovalByKey.entries.removeAll { it.value == id }
            eventLog.append(approval.sessionId, "ApprovalGranted", "system", "Approved ${approval.tool} for $scope")
            pendingActions.remove(id)?.let { pending ->
                val task = database.tasks().get(pending.taskId)
                val results = runToolChain(
                    sessionId = pending.sessionId,
                    task = task,
                    actions = pending.actions,
                    approvedChain = true
                )
                if (pending.resumePrompt != null && task != null) {
                    val continuation = buildString {
                        appendLine("Original user goal:")
                        appendLine(pending.resumePrompt)
                        appendLine()
                        appendLine("Approved tool chain result:")
                        appendLine(chainResultJson(results).toString(2))
                        appendLine()
                        append("Choose the next JSON directive or final answer. Do not stop only because a tool exited with 0 unless the original goal is complete.")
                    }
                    runAgentLoop(pending.sessionId, task, continuation)
                    return
                }
                val failed = results.firstOrNull { !it.success }
                val summary = if (failed == null) {
                    pending.successMessage ?: "Approved action completed: ${results.lastOrNull()?.summary.orEmpty()}"
                } else {
                    pending.failureMessage ?: "Approved action ran but failed: ${failed.summary}"
                }
                eventLog.append(
                    pending.sessionId,
                    "MessageAdded",
                    "assistant",
                    summary,
                    chainDetails(results)
                )
                if (task != null) {
                    taskQueue.update(task, if (failed == null) "done" else "failed", failed?.summary ?: summary)
                }
            } ?: eventLog.append(
                approval.sessionId,
                "TaskBlocked",
                "system",
                "Approval was granted, but the pending phone action is no longer in memory. Retry the original request.",
                approval.toString()
            )
        }
    }

    suspend fun rejectApproval(id: String) {
        approvalManager.reject(id)?.let {
            pendingApprovalByKey.entries.removeAll { entry -> entry.value == id }
            pendingActions.remove(id)
            eventLog.append(it.sessionId, "ApprovalRejected", "system", "Rejected ${it.tool}")
        }
    }

    suspend fun answerQuestion(id: String, answer: String) {
        val question = database.questions().get(id)
        val session = question?.let { database.sessions().get(it.sessionId) }
        if (question != null) {
            matchQuestionAnswer(question, answer)?.let { corrected ->
                if (session?.remote == true) {
                    orchestratorClient.answerQuestion(question.sessionId, id, corrected)
                }
                questionManager.answer(id, corrected)?.let {
                    eventLog.append(it.sessionId, "QuestionAnswered", "user", corrected)
                    resumeAfterQuestion(it, corrected)
                }
            } ?: run {
                val options = question.optionsCsv.split("|").filter { it.isNotBlank() }
                eventLog.append(
                    question.sessionId,
                    "QuestionRequested",
                    "system",
                    "That answer did not match the available options. Choose: ${options.take(5).joinToString(", ")}"
                )
            }
            return
        }
    }

    suspend fun skipQuestion(id: String) {
        val question = database.questions().get(id)
        val session = question?.let { database.sessions().get(it.sessionId) }
        if (question != null && session?.remote == true) {
            orchestratorClient.skipQuestion(question.sessionId, id)
        }
        questionManager.skip(id)?.let {
            eventLog.append(it.sessionId, "QuestionSkipped", "user", "Skipped question")
        }
    }

    fun appendConsole(line: String) {
        console += line
        if (console.size > 500) {
            console.removeAt(0)
        }
    }

    fun debugParseDirectiveSummary(raw: String): String {
        return when (val directive = parseDirective(raw)) {
            is AgentDirective.Final -> "final:${directive.content.take(80)}"
            is AgentDirective.ToolCall -> "tool_call:${directive.tool}:${directive.args}"
            is AgentDirective.ApprovalRequest -> "approval_request:${directive.tool}:${directive.risk}:${directive.args}"
            is AgentDirective.Question -> "question:${directive.title}:${directive.options.joinToString(",")}"
            is AgentDirective.WorkerRoute -> "worker_route:${directive.worker.id}:${directive.reason}"
            is AgentDirective.ParserError -> "parser_error:${directive.reason}"
        }
    }

    suspend fun reportRuntimeError(source: String, message: String, error: Throwable? = null) {
        val sessionId = selectedSessionId ?: createLocalSession("Recovered phone session").id
        recordRuntimeError(sessionId, source, message, error)
    }

    suspend fun runDeveloperTest(name: String) {
        val sessionId = selectedSessionId ?: createLocalSession("Developer test session").id
        val task = taskQueue.start(sessionId, "Developer test: $name", WorkerMode.PHONE_LOCAL)
        when (name) {
            "what_can_you_do" -> {
                sendMessage("what can you do")
                taskQueue.update(task, "done", "Local capability answer returned")
                return
            }
            "can_write_files" -> {
                sendMessage("can you write files")
                taskQueue.update(task, "done", "Local file capability answer returned")
                return
            }
            "send_button" -> {
                sendMessage("can you write files")
                eventLog.append(sessionId, "MessageAdded", "system", "Send button test: typed text dispatches through the same chat send path.")
                taskQueue.update(task, "done", "Send path dispatched")
                return
            }
            "thinking_timeout" -> {
                val message = "Fake model error stopped thinking and produced this error card."
                recordRuntimeError(sessionId, "developer_test_thinking_timeout", message, IllegalStateException("Fake model timeout"))
                taskQueue.update(task, "failed", message)
                return
            }
            "question_bottom_sheet" -> {
                questionManager.ask(
                    sessionId,
                    "Minecraft project type\nWhat should I build?",
                    "single_choice",
                    listOf("Fabric mod", "Forge mod", "Quilt mod", "Paper plugin", "Something else")
                )
                eventLog.append(sessionId, "QuestionRequested", "system", "Developer question bottom sheet created.")
                taskQueue.update(task, "waiting", "Question bottom sheet created")
                return
            }
            "restart_recovery" -> {
                val stale = TaskEntity(
                    id = UUID.randomUUID().toString(),
                    sessionId = sessionId,
                    title = "Developer stale running task",
                    state = "running",
                    step = "Planning next step",
                    worker = WorkerMode.PHONE_LOCAL.id,
                    createdAt = System.currentTimeMillis() - STALE_RUNNING_TASK_MS - 1_000L,
                    updatedAt = System.currentTimeMillis() - STALE_RUNNING_TASK_MS - 1_000L
                )
                database.tasks().upsert(stale)
                val recovered = recoverInterruptedTasks(staleOnly = true)
                taskQueue.update(task, "done", "Recovered $recovered stale running task(s)")
                return
            }
            "chat_send_typed" -> {
                sendMessage("can you write files")
                taskQueue.update(task, "done", "Typed chat test dispatched")
                return
            }
            "what_files_access" -> {
                sendMessage("what files can you access")
                taskQueue.update(task, "done", "Local file access question dispatched")
                return
            }
            "settings_status" -> {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "system",
                    "Settings remain available through the bottom Settings tab and Tools provider cards."
                )
                taskQueue.update(task, "done", "Settings accessibility check recorded")
                return
            }
            "screen_ask" -> {
                runScreenAsk(
                    sessionId = sessionId,
                    task = task,
                    userDraft = "",
                    userPrompt = "Developer Test: Screen Ask.",
                    appendUserAction = true
                )
                return
            }
            "screen_ask_draft" -> {
                runScreenAsk(
                    sessionId = sessionId,
                    task = task,
                    userDraft = "can you write files",
                    userPrompt = "Developer Test: Screen Ask with draft.",
                    appendUserAction = true
                )
                return
            }
            "details_sheet_tabs" -> {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "system",
                    "Details sheet test: Summary, Args, Output, Error, Approval, Retry, Logs, and Raw tabs are available; raw data stays out of Summary."
                )
                taskQueue.update(task, "done", "Details tab test recorded")
                return
            }
            "chat_no_raw_json" -> {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "system",
                    "Chat raw JSON test: tool cards show compact summaries, and raw payloads remain behind Details."
                )
                taskQueue.update(task, "done", "No raw JSON chat test recorded")
                return
            }
            "responsive_bottom_nav" -> {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "system",
                    "Bottom nav test: Chat, Tasks, Tools, Files, and Settings use fixed equal slots."
                )
                taskQueue.update(task, "done", "Bottom nav layout test recorded")
                return
            }
            "responsive_status_chips" -> {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "system",
                    "Status chip test: top status chips are horizontally scrollable and use compact labels."
                )
                taskQueue.update(task, "done", "Status chip layout test recorded")
                return
            }
            "phone_parse_youtube_search" -> {
                val parsed = PhoneCommandParser.parse("open youtube and search for iron man edits")
                val message = if (parsed?.app == "youtube" &&
                    parsed.followUpType == PhoneCommandParser.FollowUpType.SEARCH &&
                    parsed.query == "iron man edits"
                ) {
                    "Parse command passed: app=youtube, action=search, query=iron man edits."
                } else {
                    "Parse command failed: $parsed"
                }
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (message.contains("passed")) "done" else "failed", message)
                return
            }
            "parser_typo_youtuber_serch" -> {
                val parsed = PhoneCommandParser.parse("open youtuber and serch for iron man")
                val ok = parsed?.app == "youtube" && parsed.followUpType == PhoneCommandParser.FollowUpType.SEARCH && parsed.query == "iron man"
                val message = if (ok) "Parser typo passed: app=youtube, action=search, query=iron man." else "Parser typo failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "parser_typo_yotube_searh" -> {
                val parsed = PhoneCommandParser.parse("open yotube and searh iron man edits")
                val ok = parsed?.app == "youtube" && parsed.followUpType == PhoneCommandParser.FollowUpType.SEARCH && parsed.query == "iron man edits"
                val message = if (ok) "Parser typo passed: app=youtube, action=search, query=iron man edits." else "Parser typo failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "parser_search_in_chrome" -> {
                val parsed = PhoneCommandParser.parse("search minecraft fabric setup in chrome")
                val ok = parsed?.app == "chrome" && parsed.followUpType == PhoneCommandParser.FollowUpType.SEARCH && parsed.query == "minecraft fabric setup"
                val message = if (ok) "Parser search-in-app passed." else "Parser search-in-app failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "parser_settings_tap_display" -> {
                val parsed = PhoneCommandParser.parse("open setings and tap display")
                val ok = parsed?.app == "settings" && parsed.followUpType == PhoneCommandParser.FollowUpType.TAP && parsed.targetText == "display"
                val message = if (ok) "Parser settings tap passed." else "Parser settings tap failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "parser_discord_tap_friends" -> {
                val parsed = PhoneCommandParser.parse("in discord tap friends")
                val ok = parsed?.app == "discord" && parsed.followUpType == PhoneCommandParser.FollowUpType.TAP && parsed.targetText == "friends"
                val message = if (ok) "Parser discord tap passed." else "Parser discord tap failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "regression_never_full_command_app_name" -> {
                val parsed = PhoneCommandParser.parse("open youtuber and serch for iron man")
                val ok = parsed?.appNameRaw == "youtuber" && parsed.app == "youtube" && !parsed.app.contains("serch", ignoreCase = true)
                val message = if (ok) "Regression passed: app extraction stopped before action/query." else "Regression failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "chain_youtube_typo_search" -> {
                sendMessage("open youtuber and serch for iron man")
                taskQueue.update(task, "waiting", "Typo YouTube search chain dispatched")
                return
            }
            "chain_chrome_search" -> {
                sendMessage("open chrome and search minecraft fabric setup")
                taskQueue.update(task, "waiting", "Chrome search chain dispatched")
                return
            }
            "chain_settings_tap" -> {
                sendMessage("open settings and tap display")
                taskQueue.update(task, "waiting", "Settings tap chain dispatched")
                return
            }
            "chain_generic_app_type" -> {
                sendMessage("in chrome type hello")
                taskQueue.update(task, "waiting", "Generic app type chain dispatched")
                return
            }
            "chain_missing_app_suggestions" -> {
                sendMessage("open definitelyfakeapp and search cats")
                taskQueue.update(task, "waiting", "Missing app suggestion chain dispatched")
                return
            }
            "no_provider_local_app_control" -> {
                val parsed = PhoneCommandParser.parse("open youtuber and serch for iron man")
                val ok = parsed?.steps?.map { it.tool } == listOf("phone_open_app", "phone_app_search")
                val message = if (ok) "No-provider deterministic plan passed: ${parsed?.steps.orEmpty().joinToString(" -> ") { it.tool }}." else "No-provider deterministic plan failed: $parsed"
                eventLog.append(sessionId, "MessageAdded", "system", message)
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "provider_429_simulation" -> {
                val message = friendlyModelSetupMessage("MODEL_ERROR_CLASS=rate_limited Mistral rate limited: HTTP 429")
                val ok = message.contains("rate-limited", ignoreCase = true) && !message.contains("not configured", ignoreCase = true)
                eventLog.append(sessionId, "MessageAdded", "system", if (ok) "Provider 429 classification passed: $message" else "Provider 429 classification failed: $message")
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "provider_timeout_simulation" -> {
                val message = friendlyModelSetupMessage("MODEL_ERROR_CLASS=temporary request timeout")
                val ok = message.contains("temporarily unreachable", ignoreCase = true)
                eventLog.append(sessionId, "MessageAdded", "system", if (ok) "Provider timeout classification passed: $message" else "Provider timeout classification failed: $message")
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "provider_auth_simulation" -> {
                val message = friendlyModelSetupMessage("MODEL_ERROR_CLASS=auth HTTP 401 invalid key")
                val ok = message.contains("API key rejected", ignoreCase = true)
                eventLog.append(sessionId, "MessageAdded", "system", if (ok) "Provider auth classification passed: $message" else "Provider auth classification failed: $message")
                taskQueue.update(task, if (ok) "done" else "failed", message)
                return
            }
            "question_resume_simulation" -> {
                val question = questionManager.ask(sessionId, "Developer resume question", "single_choice", listOf("Retry connection", "Stop task"))
                rememberQuestionContinuation(question.id, task.id, "termux_failure", "", "termux_test_connection", JSONObject())
                answerQuestion(question.id, "Stop task")
                taskQueue.update(task, "done", "Question answer resume path executed")
                return
            }
            "typed_answer_routes_question" -> {
                questionManager.ask(sessionId, "Typed answer route question", "single_choice", listOf("Termux", "SSH"))
                sendMessage("Termux")
                taskQueue.update(task, "done", "Typed input routed to active question")
                return
            }
            "termux_setup_missing_simulation" -> {
                eventLog.append(sessionId, "MessageAdded", "assistant", termuxSetupGuide())
                taskQueue.update(task, "done", "Termux setup guide returned")
                return
            }
            "phone_open_youtube_alias" -> {
                val result = executeToolAction(
                    sessionId,
                    task,
                    ToolAction("phone_open_app", JSONObject().put("app", "youtube"), WorkerMode.PHONE_LOCAL),
                    appendAssistantMessage = true
                )
                if (result != null) taskQueue.update(task, if (result.success) "done" else "failed", result.summary)
                return
            }
            "phone_youtube_search" -> {
                val result = executeToolAction(
                    sessionId,
                    task,
                    ToolAction("phone_app_search", JSONObject().put("app", "youtube").put("query", "iron man edits"), WorkerMode.PHONE_LOCAL),
                    appendAssistantMessage = true
                )
                if (result != null) taskQueue.update(task, if (result.success) "done" else "failed", result.summary)
                return
            }
            "phone_chrome_search" -> {
                val result = executeToolAction(
                    sessionId,
                    task,
                    ToolAction("phone_app_search", JSONObject().put("app", "chrome").put("query", "minecraft fabric mod setup"), WorkerMode.PHONE_LOCAL),
                    appendAssistantMessage = true
                )
                if (result != null) taskQueue.update(task, if (result.success) "done" else "failed", result.summary)
                return
            }
            "phone_approval_chain_youtube_search" -> {
                sendMessage("open youtube and search for iron man edits")
                taskQueue.update(task, "waiting", "Approval chain request dispatched")
                return
            }
            "phone_missing_app_search" -> {
                sendMessage("open fakeapp and search cats")
                taskQueue.update(task, "waiting", "Missing app search request dispatched")
                return
            }
            "parser_regex_safety" -> {
                val result = runCatching {
                    val invalidRegexText = "```(?json" + "?)\\s*(\\{.*?})\\s*```"
                    debugParseDirectiveSummary(invalidRegexText)
                }.getOrElse { "failed:${it::class.java.simpleName}:${it.message}" }
                val ok = !result.contains("PatternSyntaxException")
                eventLog.append(sessionId, "MessageAdded", "system", if (ok) "Regex safety passed: parser treated invalid regex text as plain text." else "Regex safety failed: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_raw_json_tool" -> {
                val result = debugParseDirectiveSummary("""{"type":"phone_app_search","app":"Chrome","query":"iron man edits"}""")
                val ok = result.startsWith("tool_call:phone_app_search")
                eventLog.append(sessionId, "MessageAdded", "system", "Raw JSON tool parse: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_fenced_json_tool" -> {
                val raw = "```json\n{\"type\":\"tool_call\",\"tool\":\"phone_app_search\",\"args\":{\"app\":\"Chrome\",\"query\":\"iron man edits\"}}\n```"
                val result = debugParseDirectiveSummary(raw)
                val ok = result.startsWith("tool_call:phone_app_search")
                eventLog.append(sessionId, "MessageAdded", "system", "Fenced JSON tool parse: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_text_before_after_json" -> {
                val result = debugParseDirectiveSummary("""Sure. {"tool":"phone_app_search","arguments":{"app":"Chrome","query":"iron man edits"}} Done.""")
                val ok = result.startsWith("tool_call:phone_app_search")
                eventLog.append(sessionId, "MessageAdded", "system", "Text around JSON parse: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_invalid_json" -> {
                val result = debugParseDirectiveSummary("""before {"type":"tool_call","tool":} after""")
                val ok = result.startsWith("final:")
                eventLog.append(sessionId, "MessageAdded", "system", "Invalid JSON fallback: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_multiple_json" -> {
                val objects = SafeJsonExtractor.parseObjects("""{"type":"final","content":"one"} text {"type":"phone_app_search","app":"Chrome","query":"two"}""")
                val ok = objects.size == 2
                eventLog.append(sessionId, "MessageAdded", "system", "Multiple JSON objects parsed: ${objects.size}")
                taskQueue.update(task, if (ok) "done" else "failed", "objects=${objects.size}")
                return
            }
            "parser_normal_text" -> {
                val result = debugParseDirectiveSummary("hello, no json here")
                val ok = result.startsWith("final:hello")
                eventLog.append(sessionId, "MessageAdded", "system", "Normal text parse: $result")
                taskQueue.update(task, if (ok) "done" else "failed", result)
                return
            }
            "parser_six_turn_stability" -> {
                listOf(
                    "what can you do",
                    "open youtube",
                    "open youtube and search for iron man edits",
                    "hello",
                    "can you write files",
                    "open chrome and search for minecraft fabric setup"
                ).forEach { prompt -> sendMessage(prompt) }
                eventLog.append(sessionId, "MessageAdded", "system", "Six-turn stability sequence dispatched without parser crash.")
                taskQueue.update(task, "done", "Six-turn stability sequence dispatched")
                return
            }
            "phone_generic_app_type" -> {
                sendMessage("open settings and tap search")
                taskQueue.update(task, "waiting", "Generic app tap chain request dispatched")
                return
            }
            "phone_approval_no_duplicate" -> {
                sendMessage("open youtube and search for iron man edits")
                sendMessage("open youtube and search for iron man edits")
                eventLog.append(sessionId, "MessageAdded", "system", "Duplicate approval spam test dispatched; pending approval key should be reused.")
                taskQueue.update(task, "waiting", "Duplicate approval test dispatched")
                return
            }
        }
        val action = when (name) {
            "mistral_chat" -> ToolAction("model_chat", JSONObject().put("prompt", "Reply with exactly: ok"), WorkerMode.PHONE_LOCAL)
            "mistral_status" -> ToolAction("model_provider_test", JSONObject().put("provider", "mistral"), WorkerMode.PHONE_LOCAL)
            "openai_compatible_test" -> ToolAction("model_provider_test", JSONObject().put("provider", "openai-compatible"), WorkerMode.PHONE_LOCAL)
            "local_http_test" -> ToolAction("model_provider_test", JSONObject().put("provider", "local-http"), WorkerMode.PHONE_LOCAL)
            "ollama_status_list_models" -> ToolAction("model_provider_list_models", JSONObject().put("provider", "ollama"), WorkerMode.PHONE_LOCAL)
            "provider_fallback_test" -> ToolAction("model_fallback_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "file_write_read" -> {
                val write = ToolAction("file_write", JSONObject().put("path", "developer-tests/hello.txt").put("content", "hello from phone agent"), WorkerMode.PHONE_LOCAL)
                executeToolAction(sessionId, task, ToolAction("file_mkdir", JSONObject().put("path", "developer-tests"), WorkerMode.PHONE_LOCAL))
                executeToolAction(sessionId, task, write)
                ToolAction("file_read", JSONObject().put("path", "developer-tests/hello.txt"), WorkerMode.PHONE_LOCAL)
            }
            "shell_exec" -> ToolAction("shell_exec", JSONObject().put("command", "pwd"), WorkerMode.PHONE_LOCAL)
            "container_status" -> ToolAction("container_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "container_import_proot" -> ToolAction("container_import_proot", JSONObject(), WorkerMode.PHONE_LOCAL)
            "container_import_rootfs" -> ToolAction("container_import_rootfs", JSONObject(), WorkerMode.PHONE_LOCAL)
            "container_extract_rootfs" -> ToolAction("container_extract_rootfs", JSONObject(), WorkerMode.PHONE_LOCAL)
            "container_test" -> ToolAction("container_test", JSONObject(), WorkerMode.PHONE_LOCAL)
            "container_exec" -> ToolAction("container_exec", JSONObject().put("command", "uname -a || cat /etc/os-release || echo ok"), WorkerMode.PHONE_LOCAL)
            "termux_status" -> ToolAction("termux_status", JSONObject(), WorkerMode.HYBRID)
            "termux_test_connection" -> ToolAction("termux_test_connection", JSONObject(), WorkerMode.HYBRID)
            "ssh_status" -> ToolAction("ssh_status", JSONObject(), WorkerMode.HYBRID)
            "ssh_test_connection" -> ToolAction("ssh_test_connection", JSONObject(), WorkerMode.HYBRID)
            "execution_route_status" -> ToolAction("execution_route_status", JSONObject(), WorkerMode.HYBRID)
            "execution_fallback_command" -> ToolAction("execution_run_command", JSONObject().put("command", "pwd && uname -a"), WorkerMode.HYBRID)
            "local_model_status" -> ToolAction("model_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "phone_list_apps" -> ToolAction("phone_list_apps", JSONObject().put("limit", 20), WorkerMode.PHONE_LOCAL)
            "screen_capture", "screen_status" -> ToolAction("phone_screen_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "screen_screenshot" -> ToolAction("phone_screenshot", JSONObject(), WorkerMode.PHONE_LOCAL)
            "screen_observe" -> ToolAction("phone_screen_observe", JSONObject(), WorkerMode.PHONE_LOCAL)
            "screen_describe" -> ToolAction("phone_screen_describe", JSONObject(), WorkerMode.PHONE_LOCAL)
            "accessibility_status" -> ToolAction("phone_accessibility_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "accessibility_tree" -> ToolAction("phone_accessibility_tree", JSONObject(), WorkerMode.PHONE_LOCAL)
            "phone_back" -> ToolAction("phone_back", JSONObject(), WorkerMode.PHONE_LOCAL)
            "phone_home" -> ToolAction("phone_home", JSONObject(), WorkerMode.PHONE_LOCAL)
            "phone_recents" -> ToolAction("phone_recents", JSONObject(), WorkerMode.PHONE_LOCAL)
            "open_settings" -> ToolAction("phone_open_app", JSONObject().put("query", "settings"), WorkerMode.PHONE_LOCAL)
            "open_missing_app" -> ToolAction("phone_open_app", JSONObject().put("query", "definitely_missing_phone_agent_app"), WorkerMode.PHONE_LOCAL)
            "voice_status", "mic_permission" -> ToolAction("voice_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "voice_stt_once" -> ToolAction("voice_transcribe_once", JSONObject(), WorkerMode.PHONE_LOCAL)
            "voice_tts" -> ToolAction("voice_speak", JSONObject().put("text", "Phone Agent text to speech test."), WorkerMode.PHONE_LOCAL)
            "voice_agent_query" -> ToolAction("assistant_start_voice", JSONObject().put("text", "Say hello from assistant mode."), WorkerMode.PHONE_LOCAL)
            "assistant_status", "default_assistant" -> ToolAction("assistant_status", JSONObject(), WorkerMode.PHONE_LOCAL)
            "assistant_activity", "quick_launch" -> ToolAction("assistant_open", JSONObject(), WorkerMode.PHONE_LOCAL)
            "assistant_bubble" -> ToolAction("assistant_show_bubble", JSONObject(), WorkerMode.PHONE_LOCAL)
            "assistant_wake" -> ToolAction("assistant_set_mode", JSONObject().put("wakePhrase", true), WorkerMode.PHONE_LOCAL)
            "remote_orchestrator" -> ToolAction("remote_status", JSONObject(), WorkerMode.LAPTOP)
            "remote_list_sessions" -> ToolAction("remote_list_sessions", JSONObject(), WorkerMode.LAPTOP)
            "remote_send_message" -> ToolAction("remote_send_message", JSONObject().put("sessionId", selectedSessionId ?: "").put("message", "Phone Agent developer test"), WorkerMode.LAPTOP)
            "remote_questions" -> ToolAction("remote_list_sessions", JSONObject(), WorkerMode.LAPTOP)
            "remote_approvals" -> ToolAction("remote_status", JSONObject(), WorkerMode.LAPTOP)
            "minecraft_flow" -> {
                startMinecraftQuestions(sessionId)
                taskQueue.update(task, "waiting", "Minecraft question cards created")
                return
            }
            "question_card" -> {
                questionManager.ask(sessionId, "Developer test question", "single_choice", listOf("Option A", "Option B", "Custom"))
                eventLog.append(sessionId, "QuestionRequested", "system", "Developer question card created.")
                taskQueue.update(task, "waiting", "Question card created")
                return
            }
            "approval_card" -> {
                requestApproval(sessionId, task, ToolAction("file_delete_safe", JSONObject().put("path", "developer-tests/hello.txt"), WorkerMode.PHONE_LOCAL), "medium")
                return
            }
            else -> ToolAction("model_status", JSONObject(), WorkerMode.PHONE_LOCAL)
        }
        val result = executeToolAction(sessionId, task, action, appendAssistantMessage = name != "screen_observe")
        if (result != null) taskQueue.update(task, if (result.success) "done" else "failed", "Developer test completed")
    }

    private suspend fun runScreenAsk(
        sessionId: String,
        task: TaskEntity,
        userDraft: String,
        userPrompt: String,
        appendUserAction: Boolean,
        markDone: Boolean = true
    ) {
        if (appendUserAction) {
            eventLog.append(
                sessionId,
                "MessageAdded",
                "user",
                if (userDraft.isBlank()) "Screen" else "Screen: ${userDraft.take(180)}"
            )
        }
        taskQueue.update(task, "running", "Observing screen")
        val result = executeToolAction(
            sessionId = sessionId,
            task = task,
            action = ToolAction("phone_screen_observe", JSONObject(), WorkerMode.PHONE_LOCAL),
            appendAssistantMessage = false
        ) ?: return
        val observation = toolRegistry.screenObservation()
        val answer = if (!observation.hasAnyObservation) {
            observation.missingPermissionMessage()
        } else {
            taskQueue.update(task, "running", "Asking model about screen")
            val raw = withTimeoutOrNull(MODEL_STEP_TIMEOUT_MS) {
                localWorker.respond(
                    listOf(
                        ModelMessage("system", screenAskSystemPrompt()),
                        ModelMessage("user", screenAskPrompt(userPrompt, userDraft, observation.modelContext()))
                    )
                )
            }
            val content = if (raw == null) {
                ""
            } else {
                finalTextOnly(raw)
            }
            if (raw == null || isModelNotReady(raw) || content.startsWith("Model chat is not ready", ignoreCase = true)) {
                deterministicScreenAnswer(userDraft, observation)
            } else {
                ensureVisionDisclosure(content, observation)
            }
        }
        eventLog.append(
            sessionId,
            "MessageAdded",
            "assistant",
            answer,
            JSONObject()
                .put("summary", answer)
                .put("userDraft", userDraft)
                .put("screenObservation", observation.compactSummary())
                .put("toolResult", result.toJson())
                .toString(2)
        )
        if (markDone) {
            taskQueue.update(task, "done", "Screen answer returned")
        }
    }

    private fun screenAskSystemPrompt(): String {
        return """
            You answer after the user taps Screen in the Phone Agent Android app.
            Produce a natural-language assistant response only, not JSON.
            Use accessibility labels and active app metadata as the reliable source of truth.
            Do not claim visual image analysis: this build does not upload screenshots to a vision model.
            If userDraft is present, answer the draft using the observed screen context.
            If userDraft is blank, summarize the screen and suggest useful next actions.
            If permissions are missing, name the missing capability exactly.
        """.trimIndent()
    }

    private fun screenAskPrompt(userPrompt: String, userDraft: String, screenContext: String): String {
        return buildString {
            appendLine(userPrompt)
            appendLine()
            appendLine("userDraft=${JSONObject.quote(userDraft)}")
            appendLine()
            appendLine(screenContext)
            appendLine()
            if (userDraft.isBlank()) {
                appendLine("Instruction: The user tapped Screen. Analyze the current phone screen and explain what you see. Summarize the screen and suggest useful next actions.")
            } else {
                appendLine("Instruction: Answer the user's draft using the observed screen context.")
            }
        }.trim()
    }

    private fun finalTextOnly(raw: String): String {
        return when (val directive = parseDirective(raw)) {
            is AgentDirective.Final -> directive.content
            else -> "I observed the screen, but the model returned an action instead of a final answer."
        }.trim()
    }

    private fun ensureVisionDisclosure(content: String, observation: com.kizek.phoneagent.tools.ScreenObservation): String {
        val disclosure = when {
            observation.hasScreenshot -> "I have screen metadata and accessibility text, but visual image analysis is not configured."
            else -> "I have accessibility text from the current screen, but visual image analysis is not configured."
        }
        return if (content.contains("visual image analysis is not configured", ignoreCase = true)) {
            content
        } else {
            "$disclosure\n\n$content"
        }
    }

    private fun deterministicScreenAnswer(userDraft: String, observation: com.kizek.phoneagent.tools.ScreenObservation): String {
        val disclosure = ensureVisionDisclosure("", observation).trim()
        val active = observation.activeApp.replace("\n", " / ")
        val visible = observation.visibleLabels.take(10).joinToString(", ").ifBlank { "no visible labels reported" }
        val draftAnswer = if (userDraft.lowercase().contains("write") && userDraft.lowercase().contains("file")) {
            "Yes. I can create, read, and edit files in the configured Phone Agent workspace. For external locations, deletes, or risky paths, the app should ask for approval first."
        } else if (userDraft.isNotBlank()) {
            "Draft: \"$userDraft\". I can answer it using the accessibility context above, but no chat model provider is currently available for a richer response."
        } else {
            "You appear to be in $active. Visible labels include: $visible. Useful next actions are to send a message, open Tools, attach a file, or run Observe Only from Developer Tests for raw diagnostics."
        }
        return listOf(disclosure, draftAnswer).filter { it.isNotBlank() }.joinToString("\n\n")
    }

    private suspend fun runAgentLoop(sessionId: String, task: TaskEntity, userPrompt: String) {
        val messages = buildContextMessages(sessionId, userPrompt).toMutableList()
        var lastToolResult: PhoneToolResult? = null
        repeat(maxAgentSteps) { step ->
            taskQueue.update(task, "running", "Agent step ${step + 1} / $maxAgentSteps")
            val raw = withTimeoutOrNull(MODEL_STEP_TIMEOUT_MS) {
                localWorker.respond(messages)
            } ?: throw IllegalStateException("Model call timed out after ${MODEL_STEP_TIMEOUT_MS / 1000}s.")
            if (isModelNotReady(raw)) {
                val message = friendlyModelSetupMessage(raw)
                recordRuntimeError(sessionId, "model_call", message, IllegalStateException(raw))
                taskQueue.update(task, "failed", message)
                return
            }
            when (val directive = parseDirective(raw)) {
                is AgentDirective.Final -> {
                    if (lastToolResult != null && isShallowToolCompletion(directive.content, userPrompt)) {
                        messages += ModelMessage(
                            "user",
                            "The last response only summarized a tool status. Original goal: ${sanitizeForPrompt(userPrompt, 1_200)}. Last tool: ${toolResultBrief(lastToolResult!!)}. Continue with another tool_call, question, or a real final answer."
                        )
                        return@repeat
                    }
                    eventLog.append(sessionId, "MessageAdded", "assistant", directive.content)
                    taskQueue.update(task, "done", "Final response")
                    return
                }
                is AgentDirective.Question -> {
                    val prompt = listOf(directive.title, directive.description).filter { it.isNotBlank() }.joinToString("\n")
                    val question = questionManager.ask(sessionId, prompt.ifBlank { "Question" }, directive.type, directive.options)
                    rememberQuestionContinuation(
                        questionId = question.id,
                        taskId = task.id,
                        source = "agent_loop",
                        originalGoal = userPrompt,
                        tool = "",
                        args = JSONObject()
                    )
                    eventLog.append(sessionId, "QuestionRequested", "assistant", directive.title.ifBlank { "Question" }, directive.toJson().toString(2))
                    taskQueue.update(task, "waiting", "Waiting for question answer")
                    return
                }
                is AgentDirective.ToolCall -> {
                    val action = ToolAction(directive.tool, directive.args, workerRouter.routeForTool(directive.tool, selectedWorker))
                    decomposeOpenAppToolAction(action)?.let { plan ->
                        val results = executeDirectPlan(sessionId, task, plan)
                        if (results == null) return
                        messages += ModelMessage("user", "Tool chain result:\n${chainResultJson(results).toString(2)}\nContinue with the next JSON directive or final answer.")
                        return@repeat
                    }
                    val result = executeToolAction(sessionId, task, action, appendAssistantMessage = false)
                    if (result == null) return
                    lastToolResult = result
                    messages += ModelMessage("user", "Tool result:\n${result.toJson().put("args", action.args).toString(2)}\nInterpreter:\n${toolResultBrief(result)}\nContinue with the next JSON directive or final answer.")
                }
                is AgentDirective.ApprovalRequest -> {
                    val action = ToolAction(directive.tool, directive.args, workerRouter.routeForTool(directive.tool, selectedWorker))
                    decomposeOpenAppToolAction(action)?.let { plan ->
                        requestApproval(
                            sessionId = sessionId,
                            task = task,
                            actions = plan.actions,
                            risk = "medium",
                            approvalSummary = plan.approvalSummary,
                            successMessage = plan.successMessage,
                            failureMessage = plan.failureMessage,
                            resumePrompt = userPrompt
                        )
                        eventLog.append(
                            sessionId,
                            "ApprovalRequested",
                            "assistant",
                            directive.reason.ifBlank { "Approval requested for chained phone action." },
                            JSONObject()
                                .put("type", "approval_request")
                                .put("tool", "phone_plan")
                                .put("args", JSONArray(plan.actions.map { it.toJson() }))
                                .toString(2)
                        )
                        return
                    }
                    requestApproval(
                        sessionId,
                        task,
                        action,
                        directive.risk.ifBlank { riskFor(action) },
                        resumePrompt = userPrompt
                    )
                    eventLog.append(
                        sessionId,
                        "ApprovalRequested",
                        "assistant",
                        directive.reason.ifBlank { "Approval requested for ${directive.tool}." },
                        directive.toJson().toString(2)
                    )
                    return
                }
                is AgentDirective.WorkerRoute -> {
                    selectedWorker = directive.worker
                    eventLog.append(sessionId, "WorkerRoute", "assistant", "Worker route changed to ${directive.worker.label}. ${directive.reason}".trim())
                    messages += ModelMessage("user", "Worker route set to ${directive.worker.id}. Continue with a tool_call, question, or final answer.")
                }
                is AgentDirective.ParserError -> {
                    val message = "I could not read the model's tool instruction. The raw response is available in Details."
                    recordRuntimeError(sessionId, "tool_parser", message, IllegalArgumentException(directive.reason))
                    taskQueue.update(task, "failed", message)
                    return
                }
            }
        }
        eventLog.append(
            sessionId,
            "MessageAdded",
            "assistant",
            "I reached the $maxAgentSteps step limit. Send \"continue\" to keep going.",
            JSONObject().put("maxSteps", maxAgentSteps).toString(2)
        )
        taskQueue.update(task, "waiting", "Step limit reached")
    }

    private suspend fun executeDirectPlan(
        sessionId: String,
        task: TaskEntity,
        plan: DirectPlan
    ): List<PhoneToolResult>? {
        val actionsNeedingApproval = plan.actions.filter { action ->
            val risk = riskFor(action)
            requiresApproval(action, risk) && !hasGrant(sessionId, action.tool, risk)
        }
        if (actionsNeedingApproval.isNotEmpty()) {
            val risk = if (actionsNeedingApproval.any { riskFor(it) == "medium" }) "medium" else riskFor(actionsNeedingApproval.first())
            requestApproval(
                sessionId = sessionId,
                task = task,
                actions = plan.actions,
                risk = risk,
                approvalSummary = plan.approvalSummary,
                successMessage = plan.successMessage,
                failureMessage = plan.failureMessage
            )
            return null
        }
        return runToolChain(sessionId, task, plan.actions, approvedChain = false)
    }

    private fun decomposeOpenAppToolAction(action: ToolAction): DirectPlan? {
        if (action.tool != "phone_open_app") return null
        val rawApp = action.args.optString("app", action.args.optString("name", action.args.optString("query")))
        val parsed = PhoneCommandParser.parse("open $rawApp") ?: return null
        if (!parsed.hasFollowUp) return null
        val actions = mutableListOf(
            ToolAction("phone_open_app", JSONObject().put("app", parsed.app), action.worker)
        )
        when (parsed.followUpType) {
            PhoneCommandParser.FollowUpType.SEARCH -> actions += ToolAction(
                "phone_app_search",
                JSONObject()
                    .put("app", parsed.app)
                    .put("query", parsed.query)
                    .put("preferIntent", true)
                    .put("fallbackToAccessibility", true),
                action.worker
            )
            PhoneCommandParser.FollowUpType.TYPE -> actions += ToolAction(
                "phone_app_type",
                JSONObject().put("text", parsed.textToType),
                action.worker
            )
            PhoneCommandParser.FollowUpType.TAP -> actions += ToolAction(
                "phone_app_tap_text",
                JSONObject().put("text", parsed.targetText),
                action.worker
            )
            PhoneCommandParser.FollowUpType.FIND -> actions += ToolAction(
                "phone_app_find_text",
                JSONObject().put("text", parsed.targetText),
                action.worker
            )
            null -> Unit
        }
        return DirectPlan(
            actions = actions,
            approvalSummary = parsed.approvalSummary(),
            successMessage = parsed.successSummary(),
            failureMessage = null
        )
    }

    private suspend fun runToolChain(
        sessionId: String,
        task: TaskEntity?,
        actions: List<ToolAction>,
        approvedChain: Boolean
    ): List<PhoneToolResult> {
        val results = mutableListOf<PhoneToolResult>()
        for ((index, action) in actions.withIndex()) {
            task?.let { taskQueue.update(it, "running", "Running ${action.tool} (${index + 1}/${actions.size})") }
            val result = executeToolNow(sessionId, action, index + 1, actions.size)
            results += result
            if (!result.success) {
                task?.let { taskQueue.update(it, "failed", result.summary) }
                maybeAskToolFollowUp(sessionId, task, result, action)
                break
            }
            if (action.tool == "phone_open_app" && index < actions.lastIndex) {
                delay(750L)
            }
        }
        if (approvedChain && results.isEmpty()) {
            task?.let { taskQueue.update(it, "failed", "Approved action did not contain executable steps") }
        }
        return results
    }

    private suspend fun executeToolNow(
        sessionId: String,
        action: ToolAction,
        stepIndex: Int? = null,
        stepTotal: Int? = null
    ): PhoneToolResult {
        val result = withTimeoutOrNull(TOOL_STEP_TIMEOUT_MS) {
            toolRegistry.execute(action.tool, action.args, action.worker)
        } ?: PhoneToolResult.fail(
            tool = action.tool,
            summary = "${action.tool} timed out.",
            errorType = "timeout",
            errorMessage = "Tool call timed out after ${TOOL_STEP_TIMEOUT_MS / 1000}s.",
            workerUsed = action.worker.id
        )
        appendToolEvent(sessionId, result, action.args, stepIndex, stepTotal)
        return result
    }

    private fun chainResultJson(results: List<PhoneToolResult>): JSONObject {
        return JSONObject()
            .put("type", "tool_chain_result")
            .put("success", results.all { it.success })
            .put("steps", JSONArray(results.map { it.toJson() }))
    }

    private suspend fun maybeAskToolFollowUp(
        sessionId: String,
        task: TaskEntity?,
        result: PhoneToolResult,
        failedAction: ToolAction? = null
    ) {
        when (result.errorType) {
            "search_field_not_found", "no_accessibility_root" -> {
                val question = questionManager.ask(
                    sessionId,
                    "I opened the app, but I could not find search through accessibility. What should I do?",
                    "single_choice",
                    listOf("Retry observe", "Let me tap manually", "Use Chrome web search", "Stop")
                )
                task?.let {
                    rememberQuestionContinuation(question.id, it.id, "tool_failure", "", failedAction?.tool.orEmpty(), failedAction?.args ?: JSONObject())
                }
                eventLog.append(sessionId, "QuestionRequested", "system", "Search field was not found through accessibility.")
            }
            "app_ambiguous" -> {
                val options = result.details.lineSequence()
                    .filter { it.contains("(") && it.contains(")") }
                    .take(5)
                    .toList()
                val question = questionManager.ask(
                    sessionId,
                    "Multiple apps matched. Which one should I use?",
                    "single_choice",
                    options.ifEmpty { listOf("Cancel") }
                )
                task?.let {
                    rememberQuestionContinuation(question.id, it.id, "tool_failure", "", failedAction?.tool.orEmpty(), failedAction?.args ?: JSONObject())
                }
                eventLog.append(sessionId, "QuestionRequested", "system", "Ambiguous app match needs user choice.")
            }
            "termux_settings_missing", "termux_timeout", "termux_auth_failed", "termux_unreachable", "termux_port_closed", "ssh_error", "timeout" -> {
                if (result.tool.startsWith("termux_")) {
                    val question = questionManager.ask(
                        sessionId,
                        "Termux SSH is not reachable. What should I do?",
                        "single_choice",
                        listOf("Show setup guide", "Retry connection", "Use SSH target", "Use laptop/server", "Stop task")
                    )
                    task?.let {
                        rememberQuestionContinuation(question.id, it.id, "termux_failure", "", failedAction?.tool.orEmpty(), failedAction?.args ?: JSONObject())
                    }
                    eventLog.append(sessionId, "QuestionRequested", "system", "Termux SSH needs a recovery choice.")
                }
            }
        }
    }

    private suspend fun executeToolAction(
        sessionId: String,
        task: TaskEntity,
        action: ToolAction,
        appendAssistantMessage: Boolean = true
    ): PhoneToolResult? {
        return try {
            val risk = riskFor(action)
            if (requiresApproval(action, risk) && !hasGrant(sessionId, action.tool, risk)) {
                requestApproval(sessionId, task, action, risk)
                return null
            }
            val result = executeToolNow(sessionId, action)
            if (appendAssistantMessage) {
                eventLog.append(
                    sessionId,
                    "MessageAdded",
                    "assistant",
                    result.summary,
                    result.detailsText()
                )
            }
            if (!result.success) {
                taskQueue.update(task, "failed", result.summary)
                maybeAskToolFollowUp(sessionId, task, result, action)
            }
            result
        } catch (error: Exception) {
            val message = "Tool ${action.tool} failed before it could return a result."
            recordRuntimeError(sessionId, "tool:${action.tool}", message, error)
            taskQueue.update(task, "failed", message)
            null
        }
    }

    private suspend fun requestApproval(
        sessionId: String,
        task: TaskEntity,
        action: ToolAction,
        risk: String,
        resumePrompt: String? = null
    ): ApprovalEntity {
        return requestApproval(
            sessionId = sessionId,
            task = task,
            actions = listOf(action),
            risk = risk,
            approvalSummary = action.args.toString(),
            successMessage = null,
            failureMessage = null,
            resumePrompt = resumePrompt
        )
    }

    private suspend fun requestApproval(
        sessionId: String,
        task: TaskEntity,
        actions: List<ToolAction>,
        risk: String,
        approvalSummary: String,
        successMessage: String?,
        failureMessage: String?,
        resumePrompt: String? = null
    ): ApprovalEntity {
        val primary = actions.first()
        val key = approvalKey(sessionId, actions)
        val existingId = pendingApprovalByKey[key]
        val existing = existingId?.let { database.approvals().get(it) }?.takeIf { it.status == "pending" }
        if (existing != null) {
            taskQueue.update(task, "waiting", "Waiting for existing approval")
            eventLog.append(sessionId, "ApprovalRequested", "system", "Approval already pending for ${primary.tool}.", existing.toString())
            return existing
        }
        val approval = approvalManager.request(
            sessionId = sessionId,
            action = approvalSummary,
            tool = if (actions.size > 1) "phone_plan" else primary.tool,
            risk = risk,
            worker = primary.worker,
            reason = if (actions.size > 1) {
                "Risk $risk for chained phone action. Phone actions require visible user approval."
            } else {
                safetyPolicy.reason(primary.tool, primary.args.toString())
            },
            target = if (actions.size > 1) "Android device" else targetFor(primary)
        )
        pendingActions[approval.id] = PendingToolAction(
            sessionId = sessionId,
            taskId = task.id,
            actions = actions,
            successMessage = successMessage,
            failureMessage = failureMessage,
            resumePrompt = resumePrompt
        )
        pendingApprovalByKey[key] = approval.id
        val blocked = PhoneToolResult.blocked(
            tool = if (actions.size > 1) "phone_plan" else primary.tool,
            summary = if (actions.size > 1) "Approval required for phone plan." else "Approval required for ${primary.tool}.",
            approvalId = approval.id,
            details = approvalDetails(actions, approvalSummary),
            workerUsed = primary.worker.id
        )
        appendToolEvent(sessionId, blocked, JSONObject().put("plan", JSONArray(actions.map { it.toJson() })))
        eventLog.append(sessionId, "ApprovalRequested", "system", "Approval required for ${if (actions.size > 1) "phone plan" else primary.tool}.", approval.toString())
        taskQueue.update(task, "waiting", "Waiting for approval")
        return approval
    }

    private suspend fun appendToolEvent(
        sessionId: String,
        result: PhoneToolResult,
        args: JSONObject,
        stepIndex: Int? = null,
        stepTotal: Int? = null
    ) {
        val payload = result.toJson()
            .put("args", args)
        if (stepIndex != null && stepTotal != null) {
            payload
                .put("stepIndex", stepIndex)
                .put("stepTotal", stepTotal)
                .put("stepLabel", "Step $stepIndex of $stepTotal")
        }
        val payloadText = payload
            .toString(2)
        eventLog.append(
            sessionId = sessionId,
            type = if (result.errorType == "approval_required") "ToolBlocked" else "ToolResult",
            author = "tool",
            summary = result.summary,
            payload = payloadText
        )
    }

    private suspend fun buildContextMessages(sessionId: String, userPrompt: String): List<ModelMessage> {
        val events = database.events().listForSession(sessionId).takeLast(14)
        val subsystem = buildString {
            appendLine("Worker mode: ${selectedWorker.label}")
            appendLine("Max steps: $maxAgentSteps")
            appendLine("Available tools: ${toolRegistry.builtInTools().joinToString(", ")}")
            appendLine("Pending approvals: ${database.approvals().pending().size}")
            appendLine("Pending questions: ${database.questions().pending().size}")
            appendLine("Subsystem status:")
            appendLine(toolRegistry.subsystemStatus())
        }
        val system = ModelMessage(
            "system",
            PhoneAgentPrompts.systemPrompt + "\n\nRUNTIME CONTEXT:\n" + subsystem
        )
        val history = events.mapNotNull { event ->
            val summary = sanitizeForPrompt(event.summary, 1_000)
            when (event.author) {
                "user" -> ModelMessage("user", summary)
                "assistant" -> ModelMessage("assistant", assistantHistoryText(event.type, summary))
                "tool" -> ModelMessage("user", toolHistoryText(event.type, event.payload, summary))
                else -> null
            }
        }
        return listOf(system) + history + ModelMessage("user", sanitizeForPrompt(userPrompt, 2_000))
    }

    private fun parseDirective(raw: String): AgentDirective {
        val cleanRaw = SafeJsonExtractor.sanitizeText(raw, maxChars = 12_000)
        val parsed = SafeJsonExtractor.extractObjects(cleanRaw).asSequence()
            .mapNotNull { candidate ->
                runCatching { directiveFrom(JSONObject(candidate.text), cleanRaw) }
                    .onFailure { Log.w(TAG, "Ignoring invalid model JSON candidate", it) }
                    .getOrNull()
            }
            .firstOrNull { directive ->
                when (directive) {
                    is AgentDirective.Final -> directive.content.isNotBlank()
                    is AgentDirective.ParserError -> false
                    else -> true
                }
            }
        return parsed ?: AgentDirective.Final(cleanRaw)
    }

    private fun directiveFrom(json: JSONObject, raw: String): AgentDirective {
        val rawType = json.optString("type").trim()
        val toolName = normalizeToolName(json)
        return when {
            rawType == "question" -> AgentDirective.Question(
                title = json.optString("title", "Question"),
                description = json.optString("description", json.optString("content")),
                type = json.optString("questionType", json.optString("kind", "single_choice")),
                options = json.optJSONArray("options").strings()
            )
            rawType == "approval_request" -> AgentDirective.ApprovalRequest(
                tool = toolName.ifBlank { json.optString("tool") },
                risk = json.optString("risk", "medium"),
                reason = json.optString("reason", json.optString("content")),
                args = normalizeToolArgs(json, toolName)
            )
            rawType == "worker_route" -> AgentDirective.WorkerRoute(
                worker = WorkerMode.fromId(json.optString("worker", selectedWorker.id)),
                reason = json.optString("reason", json.optString("content"))
            )
            rawType == "tool_call" || (toolName.isNotBlank() && rawType !in setOf("final", "question", "approval_request", "worker_route")) -> {
                AgentDirective.ToolCall(
                    tool = toolName,
                    args = normalizeToolArgs(json, toolName)
                )
            }
            json.has("tool") && toolName.isNotBlank() && rawType.isBlank() -> AgentDirective.ToolCall(
                tool = toolName,
                args = normalizeToolArgs(json, toolName)
            )
            rawType == "final" -> AgentDirective.Final(json.optString("content", raw))
            else -> AgentDirective.Final(json.optString("content", raw))
        }
    }

    private fun normalizeToolName(json: JSONObject): String {
        val type = json.optString("type").trim()
        val tool = json.optString("tool").trim()
        return when {
            type == "tool_call" -> tool
            tool.isNotBlank() -> tool
            type in toolRegistry.builtInTools() -> type
            else -> ""
        }
    }

    private fun normalizeToolArgs(json: JSONObject, toolName: String): JSONObject {
        json.optJSONObject("args")?.let { return it }
        json.optJSONObject("arguments")?.let { return it }
        val args = JSONObject()
        json.keys().forEach { key ->
            if (key !in setOf("type", "tool", "args", "arguments")) {
                args.put(key, json.opt(key))
            }
        }
        if (toolName == "phone_app_search") {
            if (!args.has("app")) args.put("app", json.optString("app"))
            if (!args.has("query")) args.put("query", json.optString("query", json.optString("text")))
            val rawApp = args.optString("app")
            val rawQuery = args.optString("query")
            if (rawApp.isNotBlank() && rawQuery.isBlank()) {
                val parsed = PhoneCommandParser.parse(rawApp) ?: PhoneCommandParser.parse("open $rawApp")
                if (parsed != null && parsed.intent == PhoneCommandParser.PhoneIntent.APP_SEARCH) {
                    args.put("app", parsed.app)
                    args.put("query", parsed.query)
                    args.put("preferIntent", true)
                    args.put("fallbackToAccessibility", true)
                } else {
                    args.put("app", PhoneCommandParser.stripFollowUpFromAppName(rawApp))
                }
            } else if (rawApp.isNotBlank()) {
                args.put("app", PhoneCommandParser.stripFollowUpFromAppName(rawApp))
            }
        }
        return args
    }

    private fun assistantHistoryText(type: String, summary: String): String {
        if (SafeJsonExtractor.isJsonOnly(summary)) {
            val parsed = SafeJsonExtractor.parseObjects(summary, maxObjects = 1).firstOrNull()
            val tool = parsed?.optString("tool", parsed.optString("type")).orEmpty()
            return "[assistant directive ${tool.ifBlank { type }} hidden from chat history]"
        }
        return summary
    }

    private fun toolHistoryText(type: String, payload: String, summary: String): String {
        val json = runCatching { JSONObject(payload) }.getOrNull()
        if (json == null) {
            return "Tool event $type: ${sanitizeForPrompt(summary, 800)}"
        }
        val tool = json.optString("tool", type)
        val success = json.optBoolean("success", type != "ToolBlocked")
        val error = json.optString("errorType")
        return buildString {
            append("Tool event $type: tool=$tool success=$success summary=${sanitizeForPrompt(json.optString("summary", summary), 700)}")
            if (error.isNotBlank()) append(" errorType=$error")
        }
    }

    private fun sanitizeForPrompt(text: String, maxChars: Int): String {
        return SafeJsonExtractor.sanitizeText(text, maxChars = maxChars)
    }

    private fun directToolAnswer(userText: String, result: PhoneToolResult): String {
        if (!result.success) {
            return "That did not complete: ${result.errorMessage ?: result.summary}"
        }
        val output = result.stdout.lineSequence()
            .filter { it.isNotBlank() }
            .take(8)
            .joinToString("\n")
        return buildString {
            append("Done. ${result.summary}")
            if (output.isNotBlank()) {
                appendLine()
                appendLine()
                append(output)
            }
            if (userText.lowercase().contains("write") && userText.lowercase().contains("file")) {
                appendLine()
                appendLine()
                append("I can work with files in the configured workspace and will request approval for risky locations or deletes.")
            }
        }.trim()
    }

    private fun directPlanAnswer(userText: String, plan: DirectPlan, results: List<PhoneToolResult>): String {
        val failed = results.firstOrNull { !it.success }
        if (failed != null) {
            return when (failed.errorType) {
                "app_not_found", "app_ambiguous", "search_field_not_found", "accessibility_disabled", "accessibility_readonly" -> failed.summary
                else -> "That did not complete: ${failed.errorMessage ?: failed.summary}"
            }
        }
        if (plan.actions.size == 1) {
            return directToolAnswer(userText, results.last())
        }
        return plan.successMessage ?: "Done. ${results.lastOrNull()?.summary.orEmpty()}".trim()
    }

    private fun chainDetails(results: List<PhoneToolResult>): String {
        if (results.isEmpty()) return "No tool steps ran."
        return results.mapIndexed { index, result ->
            buildString {
                appendLine("step ${index + 1}: ${result.tool}")
                append(result.detailsText())
            }.trimEnd()
        }.joinToString("\n\n")
    }

    private fun parsedCommandPlan(parsed: PhoneCommandParser.ParsedPhoneCommand): DirectPlan? {
        val actions = mutableListOf<ToolAction>()
        if (parsed.app.isNotBlank() && parsed.intent in setOf(
                PhoneCommandParser.PhoneIntent.OPEN_APP,
                PhoneCommandParser.PhoneIntent.APP_SEARCH,
                PhoneCommandParser.PhoneIntent.APP_TYPE,
                PhoneCommandParser.PhoneIntent.APP_TAP,
                PhoneCommandParser.PhoneIntent.APP_FIND_TEXT
            )
        ) {
            actions += ToolAction("phone_open_app", JSONObject().put("app", parsed.app), WorkerMode.PHONE_LOCAL)
        }
        when (parsed.intent) {
            PhoneCommandParser.PhoneIntent.APP_SEARCH -> actions += ToolAction(
                "phone_app_search",
                JSONObject()
                    .put("app", parsed.app)
                    .put("query", parsed.query)
                    .put("preferIntent", true)
                    .put("fallbackToAccessibility", true),
                WorkerMode.PHONE_LOCAL
            )
            PhoneCommandParser.PhoneIntent.APP_TYPE -> actions += ToolAction(
                "phone_app_type",
                JSONObject().put("text", parsed.textToType),
                WorkerMode.PHONE_LOCAL
            )
            PhoneCommandParser.PhoneIntent.APP_TAP -> actions += ToolAction(
                "phone_app_tap_text",
                JSONObject().put("text", parsed.targetText),
                WorkerMode.PHONE_LOCAL
            )
            PhoneCommandParser.PhoneIntent.APP_FIND_TEXT -> actions += ToolAction(
                "phone_app_find_text",
                JSONObject().put("text", parsed.targetText),
                WorkerMode.PHONE_LOCAL
            )
            PhoneCommandParser.PhoneIntent.APP_BACK -> actions += ToolAction("phone_app_back", JSONObject(), WorkerMode.PHONE_LOCAL)
            PhoneCommandParser.PhoneIntent.APP_HOME -> actions += ToolAction("phone_home", JSONObject(), WorkerMode.PHONE_LOCAL)
            PhoneCommandParser.PhoneIntent.APP_RECENTS -> actions += ToolAction("phone_recents", JSONObject(), WorkerMode.PHONE_LOCAL)
            PhoneCommandParser.PhoneIntent.APP_SUBMIT -> actions += ToolAction("phone_app_submit", JSONObject(), WorkerMode.PHONE_LOCAL)
            PhoneCommandParser.PhoneIntent.OPEN_APP, PhoneCommandParser.PhoneIntent.UNKNOWN -> Unit
        }
        if (actions.isEmpty()) return null
        return DirectPlan(
            actions = actions,
            approvalSummary = parsed.approvalSummary(),
            successMessage = parsed.successSummary(),
            failureMessage = null
        )
    }

    private suspend fun askPhoneCommandQuestion(
        sessionId: String,
        task: TaskEntity,
        parsed: PhoneCommandParser.ParsedPhoneCommand
    ) {
        val prompt = when {
            parsed.appNameRaw.isBlank() -> "Which app should I use?"
            else -> "Which app did you mean for \"${parsed.appNameRaw}\"?"
        }
        val question = questionManager.ask(
            sessionId,
            prompt,
            "single_choice",
            listOf("YouTube", "Chrome", "Google", "Settings", "Discord", "Gmail", "Messages", "Something else", "Stop")
        )
        rememberQuestionContinuation(
            questionId = question.id,
            taskId = task.id,
            source = "phone_parser_clarify",
            originalGoal = parsed.originalText,
            tool = "",
            args = JSONObject()
        )
        eventLog.append(sessionId, "QuestionRequested", "system", prompt)
        taskQueue.update(task, "waiting", "Waiting for app clarification")
    }

    private suspend fun rememberQuestionContinuation(
        questionId: String,
        taskId: String,
        source: String,
        originalGoal: String,
        tool: String,
        args: JSONObject
    ) {
        memoryStore.remember(
            "question_continuation:$questionId",
            JSONObject()
                .put("questionId", questionId)
                .put("taskId", taskId)
                .put("source", source)
                .put("originalGoal", originalGoal)
                .put("tool", tool)
                .put("args", args)
                .toString()
        )
    }

    private suspend fun resumeAfterQuestion(question: QuestionEntity, answer: String) {
        val continuation = memoryStore.get("question_continuation:${question.id}")
            ?.value
            ?.let { runCatching { JSONObject(it) }.getOrNull() }
        val task = continuation?.optString("taskId")
            ?.takeIf { it.isNotBlank() }
            ?.let { database.tasks().get(it) }
            ?: database.tasks().listAll().firstOrNull { it.sessionId == question.sessionId && it.state == "waiting" }

        when (continuation?.optString("source")) {
            "agent_loop" -> {
                if (task != null) {
                    taskQueue.update(task, "running", "Resuming after answer")
                    val prompt = buildString {
                        appendLine("Original goal:")
                        appendLine(continuation.optString("originalGoal"))
                        appendLine()
                        appendLine("User answered pending question:")
                        appendLine(answer)
                        appendLine()
                        append("Continue the task from this answer. Choose one JSON directive or final answer.")
                        compoundContinuationHint(continuation.optString("originalGoal"))?.let { hint ->
                            appendLine()
                            appendLine()
                            append(hint)
                        }
                    }
                    runAgentLoop(question.sessionId, task, prompt)
                }
            }
            "phone_parser_clarify" -> {
                if (task != null) {
                    if (answer.equals("stop", ignoreCase = true)) {
                        taskQueue.update(task, "failed", "App clarification stopped by user")
                    } else {
                        val originalGoal = continuation.optString("originalGoal")
                        val clarified = if (originalGoal.isBlank()) {
                            "open $answer"
                        } else {
                            originalGoal.replace(Regex("""(?i)\b(any app|some app|this app|current app|that app|the app)\b"""), answer)
                        }
                        taskQueue.update(task, "running", "Resuming clarified phone command")
                        val plan = directPlan(clarified)
                        if (plan != null) {
                            val results = executeDirectPlan(question.sessionId, task, plan)
                            if (results != null) {
                                eventLog.append(question.sessionId, "MessageAdded", "assistant", directPlanAnswer(clarified, plan, results), chainDetails(results))
                                taskQueue.update(task, if (results.all { it.success }) "done" else "failed", "Clarified phone command completed")
                            }
                        } else {
                            runAgentLoop(question.sessionId, task, compoundContinuationPrompt(clarified, answer))
                        }
                    }
                }
            }
            "termux_failure" -> resumeTermuxFailure(question, answer, task)
            "tool_failure" -> resumeToolFailure(question, answer, task, continuation)
            else -> {
                if (question.prompt.startsWith("Minecraft")) {
                    maybeResumeMinecraftFlow(question.sessionId)
                } else {
                    if (task != null && task.state == "waiting") {
                        taskQueue.update(task, "done", "Question answered: $answer")
                    }
                }
            }
        }
    }

    private suspend fun resumeTermuxFailure(
        question: QuestionEntity,
        answer: String,
        task: TaskEntity?
    ) {
        val lower = answer.lowercase()
        when {
            lower.contains("setup") || lower.contains("guide") -> {
                eventLog.append(question.sessionId, "MessageAdded", "assistant", termuxSetupGuide())
                task?.let { taskQueue.update(it, "done", "Termux setup guide shown") }
            }
            lower.contains("retry") -> {
                if (task != null) {
                    taskQueue.update(task, "running", "Retrying Termux connection")
                    val result = executeToolAction(question.sessionId, task, ToolAction("termux_test_connection", JSONObject(), WorkerMode.HYBRID), appendAssistantMessage = true)
                    taskQueue.update(task, if (result?.success == true) "done" else "failed", result?.summary ?: "Retry did not run")
                }
            }
            lower.contains("ssh") -> {
                if (task != null) {
                    val result = executeToolAction(question.sessionId, task, ToolAction("ssh_status", JSONObject(), WorkerMode.HYBRID), appendAssistantMessage = true)
                    taskQueue.update(task, if (result?.success == true) "done" else "failed", result?.summary ?: "SSH status did not run")
                }
            }
            lower.contains("laptop") || lower.contains("server") -> {
                eventLog.append(question.sessionId, "MessageAdded", "assistant", "Switch to a configured laptop/server worker or add an SSH target in Settings. I did not claim Termux access because the SSH bridge is not reachable.")
                task?.let { taskQueue.update(it, "done", "Termux fallback guidance shown") }
            }
            else -> task?.let { taskQueue.update(it, "failed", "Termux recovery stopped") }
        }
    }

    private suspend fun resumeToolFailure(
        question: QuestionEntity,
        answer: String,
        task: TaskEntity?,
        continuation: JSONObject?
    ) {
        val lower = answer.lowercase()
        val args = continuation?.optJSONObject("args") ?: JSONObject()
        when {
            lower.contains("retry") && task != null -> {
                val tool = continuation?.optString("tool").orEmpty()
                if (tool.isNotBlank()) {
                    val result = executeToolAction(question.sessionId, task, ToolAction(tool, args, WorkerMode.PHONE_LOCAL), appendAssistantMessage = true)
                    taskQueue.update(task, if (result?.success == true) "done" else "failed", result?.summary ?: "Retry did not run")
                }
            }
            lower.contains("chrome") && task != null -> {
                val query = args.optString("query", args.optString("text"))
                val result = executeToolAction(
                    question.sessionId,
                    task,
                    ToolAction(
                        "phone_app_search",
                        JSONObject().put("app", "chrome").put("query", query).put("preferIntent", true).put("fallbackToAccessibility", true),
                        WorkerMode.PHONE_LOCAL
                    ),
                    appendAssistantMessage = true
                )
                taskQueue.update(task, if (result?.success == true) "done" else "failed", result?.summary ?: "Chrome fallback did not run")
            }
            lower.contains("tap") -> {
                eventLog.append(question.sessionId, "MessageAdded", "assistant", "Tap the search field or target manually, then send the next command and I will continue with accessibility typing/tapping.")
                task?.let { taskQueue.update(it, "done", "Waiting for manual tap outside task") }
            }
            else -> task?.let { taskQueue.update(it, "failed", "Tool recovery stopped") }
        }
    }

    private fun termuxSetupGuide(): String {
        return """
            Termux SSH did not connect. On your phone, open Termux and run:
            pkg update
            pkg install openssh
            passwd
            sshd

            Then in Phone Agent settings use:
            host: 127.0.0.1
            port: 8022
            username: your Termux username
            auth: password or SSH key
        """.trimIndent()
    }

    private fun matchQuestionAnswer(question: QuestionEntity, answer: String): String? {
        val cleaned = answer.trim()
        if (cleaned.isBlank()) return null
        val options = question.optionsCsv.split("|").filter { it.isNotBlank() }
        val free = question.type.contains("free", ignoreCase = true) || options.isEmpty()
        if (free) return cleaned
        options.firstOrNull { it.equals(cleaned, ignoreCase = true) }?.let { return it }
        options.firstOrNull { option ->
            option.contains(cleaned, ignoreCase = true) || cleaned.contains(option, ignoreCase = true)
        }?.let { return it }
        options.firstOrNull { levenshtein(it.lowercase(), cleaned.lowercase()) <= 2 }?.let { return it }
        if (options.any { it.contains("something else", ignoreCase = true) || it.contains("custom", ignoreCase = true) }) return cleaned
        if (question.prompt.lowercase().contains("app")) return cleaned
        return null
    }

    private fun toolResultBrief(result: PhoneToolResult): String {
        return buildString {
            append("tool=${result.tool} success=${result.success} summary=${result.summary}")
            result.exitCode?.let { append(" exitCode=$it") }
            if (result.stdout.isNotBlank()) append(" stdout=${sanitizeForPrompt(result.stdout, 500)}")
            if (result.stderr.isNotBlank()) append(" stderr=${sanitizeForPrompt(result.stderr, 500)}")
            if (result.errorType != null) append(" errorType=${result.errorType}")
        }
    }

    private fun isShallowToolCompletion(content: String, originalGoal: String): Boolean {
        val lower = content.lowercase()
        val goal = originalGoal.lowercase()
        val shallow = lower.contains("exited with 0") ||
            lower.contains("code exited with 0") ||
            lower == "done" ||
            lower.startsWith("approved action completed")
        val goalLooksMultiStep = listOf("make", "create", "write", "edit", "fix", "build", "test", "install", "then", "and run", "check").any { goal.contains(it) }
        return shallow && goalLooksMultiStep
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a == b) return 0
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        val previous = IntArray(b.length + 1) { it }
        val current = IntArray(b.length + 1)
        for (i in a.indices) {
            current[0] = i + 1
            for (j in b.indices) {
                val cost = if (a[i] == b[j]) 0 else 1
                current[j + 1] = minOf(current[j] + 1, previous[j + 1] + 1, previous[j] + cost)
            }
            for (j in previous.indices) previous[j] = current[j]
        }
        return previous[b.length]
    }

    private fun approvalDetails(actions: List<ToolAction>, approvalSummary: String): String {
        return JSONObject()
            .put("summary", approvalSummary)
            .put("steps", JSONArray(actions.map { it.toJson() }))
            .toString(2)
    }

    private fun compoundContinuationPrompt(originalGoal: String, answer: String): String {
        val compoundHint = compoundContinuationHint(originalGoal)
        return buildString {
            appendLine("Original goal:")
            appendLine(originalGoal)
            if (!compoundHint.isNullOrBlank()) {
                appendLine()
                appendLine(compoundHint)
            }
            appendLine()
            appendLine("User answered pending question:")
            appendLine(answer)
            appendLine()
            append("Continue the task from this answer. Choose one JSON directive or final answer.")
        }
    }

    private fun compoundContinuationHint(originalGoal: String): String? {
        val steps = PhoneCommandParser.splitCompoundIntents(originalGoal)
        if (steps.size <= 1) return null
        return buildString {
            appendLine("Compound goal reminder:")
            steps.forEachIndexed { index, step ->
                appendLine("${index + 1}. $step")
            }
            append("Continue with the remaining steps after resolving the answer.")
        }
    }

    private fun isScreenAskPrompt(text: String): Boolean {
        val lower = text.lowercase()
        return lower.contains("look at my screen") ||
            lower.contains("observe my screen") ||
            lower.contains("read the screen") ||
            lower.contains("what is on my screen") ||
            lower.contains("what's on my screen")
    }

    private suspend fun localCapabilityAnswer(text: String): String? {
        val lower = text.lowercase().trim().replace(Regex("\\s+"), " ")
        val asksCapabilities = lower in setOf(
            "what can you do",
            "what can u do",
            "what tools do you have",
            "what tools do u have",
            "what is configured",
            "what's configured",
            "are you online"
        ) || lower.contains("what can you do") ||
            lower.contains("what tools") ||
            lower.contains("what is configured") ||
            lower.contains("what's configured") ||
            lower.contains("are you online")
        val asksFiles = (lower.contains("can you") || lower.contains("are you able")) &&
            lower.contains("file") &&
            (lower.contains("write") || lower.contains("read") || lower.contains("edit")) ||
            lower.contains("what files can you access") ||
            lower.contains("which files can you access") ||
            lower.contains("what folders can you access")
        val asksApps = (lower.contains("can you") || lower.contains("are you able")) &&
            (lower.contains("open apps") || lower.contains("open app") || lower.contains("launch apps") || lower.contains("launch app"))
        val asksContainer = (lower.contains("can you") || lower.contains("are you able")) &&
            (lower.contains("container") || lower.contains("proot"))
        val asksScreen = (lower.contains("can you") || lower.contains("are you able")) &&
            (lower.contains("see my screen") || lower.contains("look at my screen") || lower.contains("read my screen") || lower.contains("screen"))
        val asksStatus = lower in setOf(
            "provider status",
            "runtime status",
            "model status",
            "settings status",
            "accessibility status",
            "shell status",
            "container status"
        )
        if (!asksCapabilities && !asksFiles && !asksApps && !asksContainer && !asksScreen && !asksStatus) return null

        val status = runCatching { toolRegistry.runtimeCapabilityStatus() }.getOrElse { error ->
            Log.e(TAG, "local capability status check failed", error)
            return fallbackCapabilityAnswer(lower, error)
        }
        return when {
            asksFiles -> fileCapabilityAnswer(status)
            asksApps -> appCapabilityAnswer()
            asksContainer -> containerCapabilityAnswer(status)
            asksScreen -> screenCapabilityAnswer(status)
            asksStatus -> toolsCapabilityAnswer(status)
            lower.contains("are you online") -> onlineCapabilityAnswer(status)
            lower.contains("what tools") -> toolsCapabilityAnswer(status)
            else -> generalCapabilityAnswer(status)
        }
    }

    private fun fileCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        return if (status.workspaceReady) {
            "Yes. I can write, read, and edit files in the app workspace right now: ${status.workspaceLabel}. If you pick an external folder, I can work inside that granted folder too. I will ask approval before deleting files or writing outside the approved workspace."
        } else {
            "File tools are installed, but the workspace is not ready: ${status.workspaceDetail}. Pick or reset a workspace before file writes."
        }
    }

    private fun appCapabilityAnswer(): String {
        return "Yes, with approval. I can search for launchable Android apps and open one after you approve the action. I will not silently control other apps."
    }

    private fun containerCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        return if (status.prootReady) {
            "Yes. The built-in PRoot container reports ready, so I can route container commands there with approval for risky commands."
        } else {
            "Container tools are installed, but PRoot is not ready yet: ${status.prootDetail}. Use the PRoot setup/import flow before relying on container commands."
        }
    }

    private fun screenCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        val screen = if (status.screenCaptureReady) {
            "screen capture is configured${if (status.hasScreenshot) " and a recent screenshot exists" else ", but no recent screenshot is stored"}"
        } else {
            "screen capture is not configured"
        }
        val accessibility = if (status.accessibilityEnabled) {
            "accessibility is enabled"
        } else {
            "accessibility is disabled"
        }
        return "I can inspect the screen when permissions are available. Current status: $screen; $accessibility. If vision is not configured, I use accessibility text and screenshot metadata and say so clearly."
    }

    private fun onlineCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        val model = if (status.mistralConfigured) {
            "Mistral is configured (${status.selectedMistralModel})"
        } else {
            "Mistral key is missing"
        }
        val remote = if (status.remoteOnline) status.remoteDetail else status.remoteDetail
        return "Phone-local runtime is online. $model. Remote orchestrator: $remote. Simple capability questions are answered locally without calling the model."
    }

    private fun toolsCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        return buildString {
            appendLine("I have ${status.toolCount} phone tools registered. Main categories:")
            appendLine("- workspace files: ${readyWord(status.workspaceReady)}")
            appendLine("- app shell commands: ready")
            appendLine("- PRoot/container: ${readyWord(status.prootReady)}")
            appendLine("- Termux bridge: ${readyWord(status.termuxConfigured && status.termuxConnected)}")
            appendLine("- SSH fallback: ${readyWord(status.sshConfiguredTargets > 0)}")
            appendLine("- screen capture: ${readyWord(status.screenCaptureReady)}")
            appendLine("- accessibility tree/control: ${readyWord(status.accessibilityEnabled)}")
            appendLine("- Mistral chat: ${readyWord(status.mistralConfigured)}")
            appendLine("- laptop/server orchestrator: ${readyWord(status.remoteOnline)}")
            append("Tool arguments, output, errors, and raw logs stay behind Details.")
        }.trim()
    }

    private fun generalCapabilityAnswer(status: RuntimeCapabilityStatus): String {
        return buildString {
            appendLine("I can help with phone-local tasks like:")
            appendLine("- write/read files in the workspace (${readyWord(status.workspaceReady)})")
            appendLine("- run app shell commands (ready)")
            appendLine("- use PRoot/Termux/SSH fallback if configured (PRoot ${readyWord(status.prootReady)}, Termux ${readyWord(status.termuxConfigured && status.termuxConnected)}, SSH ${readyWord(status.sshConfiguredTargets > 0)})")
            appendLine("- observe the screen with permission (screen ${readyWord(status.screenCaptureReady)}, accessibility ${readyWord(status.accessibilityEnabled)})")
            appendLine("- use accessibility tree/control with approval (${readyWord(status.accessibilityEnabled)})")
            appendLine("- open apps with approval (available)")
            appendLine("- answer questions with Mistral/OpenAI-compatible/Ollama/Local HTTP if configured (active route ${status.modelRoute})")
            appendLine("- continue laptop/server sessions if connected (${readyWord(status.remoteOnline)})")
            if (!status.mistralConfigured) {
                appendLine()
                append("No cloud key is required for local deterministic commands. Add Mistral/OpenAI-compatible/Ollama/Local HTTP in Settings for model chat.")
            }
        }.trim()
    }

    private fun readyWord(ready: Boolean): String = if (ready) "ready" else "not ready"

    private fun fallbackCapabilityAnswer(lower: String, error: Throwable): String {
        val detail = error.message?.take(160).orEmpty().ifBlank { error::class.java.simpleName }
        return when {
            lower.contains("file") -> "File tools are installed, but I could not verify the current workspace status: $detail. Pick or reset a workspace if file writes fail."
            lower.contains("screen") -> "I can inspect the screen when screen capture or accessibility permissions are available, but I could not verify those permissions right now: $detail."
            lower.contains("container") || lower.contains("proot") -> "Container tools are present, but I could not verify PRoot status: $detail. Use Settings > Runtime or the PRoot setup flow before relying on container commands."
            lower.contains("online") -> "The phone app is running locally, but one runtime status check failed: $detail. Model and remote availability may need setup."
            else -> buildString {
                appendLine("I can help with phone-local tasks like:")
                appendLine("- write/read files in the workspace")
                appendLine("- run app shell commands")
                appendLine("- use PRoot/Termux/SSH fallback if configured")
                appendLine("- observe the screen with permission")
                appendLine("- use accessibility tree/control with approval")
                appendLine("- open apps with approval")
                appendLine("- answer questions with configured model providers")
                appendLine("- continue laptop/server sessions if connected")
                appendLine()
                append("I could not verify live runtime status: $detail")
            }.trim()
        }
    }

    private fun isModelNotReady(raw: String): Boolean {
        val lower = raw.lowercase()
        return lower.contains("model_error_class=") ||
            lower.contains("no model provider is configured") ||
            lower.contains("no model provider is available") ||
            lower.contains("mistral api key is not configured")
    }

    private fun friendlyModelSetupMessage(raw: String = ""): String {
        val lower = raw.lowercase()
        return when {
            lower.contains("rate") || lower.contains("429") -> "Provider is rate-limited. Retrying or using fallback provider failed. Local phone commands still work."
            lower.contains("401") || lower.contains("403") || lower.contains("invalid key") || lower.contains("api key rejected") -> "API key rejected. Check provider settings. Local phone commands still work."
            lower.contains("timeout") || lower.contains("temporarily") || lower.contains("503") || lower.contains("502") || lower.contains("504") || lower.contains("500") -> "Provider is temporarily unreachable. Local phone commands still work."
            lower.contains("unreachable") || lower.contains("dns") || lower.contains("offline") || lower.contains("connection") -> "Provider is temporarily unreachable or offline. Local phone commands still work."
            else -> "No model provider is configured. Local phone commands still work. Add Mistral, OpenAI-compatible, Ollama, or Local HTTP in Settings for chat reasoning."
        }
    }

    private suspend fun recordRuntimeError(sessionId: String, source: String, message: String, error: Throwable? = null) {
        if (error != null) {
            Log.e(TAG, "$source failed", error)
        } else {
            Log.e(TAG, "$source failed: $message")
        }
        val payload = JSONObject()
            .put("source", source)
            .put("message", message)
            .put("errorType", error?.javaClass?.simpleName.orEmpty())
            .put("errorMessage", error?.message.orEmpty())
            .toString(2)
        console += "[$source] $message ${error?.message.orEmpty()}".trim()
        if (console.size > 500) {
            console.removeAt(0)
        }
        eventLog.append(
            sessionId = sessionId,
            type = "TaskFailed",
            author = "system",
            summary = message,
            payload = payload
        )
    }

    private fun directPlan(text: String): DirectPlan? {
        val lower = text.lowercase().trim()
        PhoneCommandParser.parse(text)?.let { parsed ->
            if (!parsed.needsQuestion) {
                parsedCommandPlan(parsed)?.let { return it }
            }
        }
        if (lower.contains("minecraft") && (lower.contains("mod") || lower.contains("plugin"))) {
            return null
        }
        if (lower.contains("termux") && (lower.contains("try") || lower.contains("check") || lower.contains("test") || lower.contains("command") || lower.contains("access"))) {
            return DirectPlan(
                actions = listOf(
                    ToolAction("termux_status", JSONObject(), WorkerMode.HYBRID),
                    ToolAction("termux_test_connection", JSONObject(), WorkerMode.HYBRID)
                ),
                approvalSummary = "Check Termux SSH bridge, then run pwd && uname -a if reachable.",
                successMessage = "Termux SSH is reachable and the safe command completed.",
                failureMessage = null
            )
        }
        if ((lower.contains("ssh") || lower.contains("code vm")) && lower.contains("python") && lower.contains("pip")) {
            return DirectPlan.single(
                ToolAction(
                    "ssh_exec",
                    JSONObject().put("command", "python --version && pip --version"),
                    WorkerMode.HYBRID
                ),
                approvalSummary = "Check Python and pip on the configured SSH target."
            )
        }
        if ((lower.contains("ssh") || lower.contains("target")) && (lower.contains("check") || lower.contains("test")) && lower.contains("connection")) {
            return DirectPlan(
                actions = listOf(
                    ToolAction("ssh_status", JSONObject(), WorkerMode.HYBRID),
                    ToolAction("ssh_test_connection", JSONObject(), WorkerMode.HYBRID)
                ),
                approvalSummary = "Check SSH target status, then test the connection.",
                successMessage = "SSH target status and connection test completed.",
                failureMessage = null
            )
        }
        if ((lower.contains("ssh") || lower.contains("code vm")) && (lower.contains("build") || lower.contains("check project") || lower.contains("workspace"))) {
            return DirectPlan(
                actions = listOf(
                    ToolAction("ssh_exec", JSONObject().put("command", "pwd"), WorkerMode.HYBRID),
                    ToolAction("ssh_exec", JSONObject().put("command", "ls"), WorkerMode.HYBRID)
                ),
                approvalSummary = "Inspect the configured SSH workspace.",
                successMessage = "Checked the SSH workspace.",
                failureMessage = null
            )
        }
        if (lower == "phone list apps" || lower == "list apps" || lower == "show apps" || lower == "what apps are installed") {
            return DirectPlan.single(ToolAction("phone_list_apps", JSONObject().put("limit", 80), WorkerMode.PHONE_LOCAL))
        }
        Regex("""(?i)^tap\s+(.+)$""").find(text.trim())?.let { match ->
            return DirectPlan.single(ToolAction("phone_app_tap_text", JSONObject().put("text", match.groupValues[1].trim()), WorkerMode.PHONE_LOCAL))
        }
        Regex("""(?i)^(?:type|enter)\s+(.+)$""").find(text.trim())?.let { match ->
            return DirectPlan.single(ToolAction("phone_app_type", JSONObject().put("text", match.groupValues[1].trim()), WorkerMode.PHONE_LOCAL))
        }
        Regex("""(?i)^(?:find|look for)\s+(.+)$""").find(text.trim())?.let { match ->
            return DirectPlan.single(ToolAction("phone_app_find_text", JSONObject().put("text", match.groupValues[1].trim()), WorkerMode.PHONE_LOCAL))
        }
        if (lower == "go back" || lower == "back" || lower == "press back") {
            return DirectPlan.single(ToolAction("phone_app_back", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower == "press home" || lower == "home" || lower == "go home") {
            return DirectPlan.single(ToolAction("phone_home", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower == "show recent apps" || lower == "recent apps" || lower == "recents" || lower == "show recents") {
            return DirectPlan.single(ToolAction("phone_recents", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower == "submit" || lower == "press enter" || lower == "send it") {
            return DirectPlan.single(ToolAction("phone_app_submit", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower.contains("what to press") || lower.contains("tell me what")) {
            return null
        }
        if (lower == "continue" || lower.contains("continue this laptop session")) {
            return DirectPlan.single(ToolAction("remote_list_sessions", JSONObject(), WorkerMode.LAPTOP))
        }
        Regex("""^(run|execute)\s+(.+)""").find(lower)?.let { match ->
            return DirectPlan.single(ToolAction("shell_exec", JSONObject().put("command", match.groupValues[2]), WorkerMode.PHONE_LOCAL))
        }
        if (lower == "pwd" || lower == "run pwd") {
            return DirectPlan.single(ToolAction("shell_exec", JSONObject().put("command", "pwd"), WorkerMode.PHONE_LOCAL))
        }
        Regex("""create (?:a )?file (?:called|named)\s+([^\s]+)""").find(lower)?.let { match ->
            val content = if (lower.contains("hello")) "hello" else ""
            return DirectPlan.single(ToolAction("file_write", JSONObject().put("path", match.groupValues[1]).put("content", content), WorkerMode.PHONE_LOCAL))
        }
        if (lower.contains("look at my screen") || lower.contains("observe my screen")) {
            return DirectPlan.single(ToolAction("phone_screen_observe", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower.contains("read the screen")) {
            return DirectPlan.single(ToolAction("phone_screen_observe", JSONObject(), WorkerMode.PHONE_LOCAL))
        }
        if (lower.contains("run this locally on phone")) {
            return DirectPlan.single(ToolAction("model_switch", JSONObject().put("route", "MISTRAL"), WorkerMode.PHONE_LOCAL))
        }
        if (lower.contains("install node") && lower.contains("container")) {
            return DirectPlan.single(ToolAction("container_exec", JSONObject().put("command", "apt-get update && apt-get install -y nodejs npm"), WorkerMode.PHONE_LOCAL))
        }
        return null
    }

    private suspend fun maybeResumeMinecraftFlow(sessionId: String) {
        val questions = database.questions().listAll().filter { it.sessionId == sessionId && it.prompt.startsWith("Minecraft") }
        if (questions.isEmpty() || questions.any { it.status == "pending" }) return
        val answers = questions.joinToString("\n") { "${it.prompt.substringBefore('\n')}: ${it.answer ?: "skipped"}" }
        val workerAnswer = questions.lastOrNull()?.answer.orEmpty().lowercase()
        val next = when {
            workerAnswer.contains("phone") -> {
                val status = toolRegistry.execute("container_status", JSONObject(), WorkerMode.PHONE_LOCAL)
                "Minecraft inputs are collected.\n$answers\n\nPhone build path check: ${status.summary}\n${status.details}\nIf JDK/Gradle are missing, import a rootfs/proot container or switch to laptop/server."
            }
            workerAnswer.contains("laptop") || workerAnswer.contains("server") -> "Minecraft inputs are collected.\n$answers\n\nUse the remote session tools to send this build to the laptop/server orchestrator."
            else -> "Minecraft inputs are collected.\n$answers\n\nHybrid mode will use phone tools for files/status and laptop/server for heavy build steps when connected."
        }
        eventLog.append(sessionId, "MessageAdded", "assistant", next)
        val task = database.tasks().listAll().firstOrNull { it.sessionId == sessionId && it.state == "waiting" }
        if (task != null) {
            taskQueue.update(task, "done", "Minecraft build plan determined")
        }
    }

    private suspend fun startMinecraftQuestions(sessionId: String) {
        questionManager.ask(sessionId, "Minecraft project type\nWhat should I build?", "single_choice", listOf("Fabric mod", "Forge mod", "Quilt mod", "Paper plugin", "Something else"))
        questionManager.ask(sessionId, "Minecraft version\nWhich Minecraft version should I target?", "free_text", listOf("1.21.1", "1.20.1", "1.19.4", "Something else"))
        questionManager.ask(sessionId, "Minecraft language", "single_choice", listOf("Java", "Kotlin"))
        questionManager.ask(sessionId, "Minecraft mod behavior\nWhat should the mod add?", "free_text", emptyList())
        questionManager.ask(sessionId, "Minecraft worker route\nWhere should I build/run it?", "single_choice", listOf("Run on phone", "Run on laptop", "Run on server", "Hybrid"))
        eventLog.append(sessionId, "QuestionRequested", "assistant", "I need a few Minecraft build choices before starting.")
    }

    private fun requiresApproval(action: ToolAction, risk: String): Boolean {
        if (action.tool == "phone_open_app") return true
        if (action.tool == "file_delete_safe") return true
        if (action.tool.startsWith("phone_") && action.tool !in setOf("phone_list_apps", "phone_app_status", "phone_app_find_text", "phone_accessibility_status", "phone_accessibility_tree", "phone_find", "phone_read_active_app", "phone_screen_status", "phone_screenshot", "phone_screen_observe", "phone_screen_describe", "phone_screen_watch")) return true
        return safetyPolicy.requiresApproval(action.tool, action.args.toString()) || risk != "low"
    }

    private suspend fun hasGrant(sessionId: String, tool: String, risk: String): Boolean {
        return database.approvals().listAll().any { approval ->
            approval.sessionId == sessionId &&
                approval.status == "approved" &&
                when (approval.scope) {
                    "full-session" -> true
                    "safe-medium" -> risk in setOf("low", "medium")
                    "session", "task" -> approval.tool == tool
                    else -> false
                }
        }
    }

    private fun riskFor(action: ToolAction): String {
        val base = riskClassifier.classify("${action.tool} ${action.args}")
        return when {
            action.tool == "phone_open_app" -> "medium"
            action.tool == "phone_app_search" -> "medium"
            action.tool == "file_delete_safe" -> "medium"
            action.tool == "container_exec" -> "medium"
            action.tool == "container_download_assets" -> "medium"
            action.tool == "termux_exec" -> "medium"
            action.tool == "ssh_exec" || action.tool == "ssh_write_file" -> "medium"
            action.tool == "execution_run_command" -> "medium"
            action.tool == "assistant_show_bubble" -> "medium"
            action.tool == "shell_exec" && base == "low" -> "low"
            action.tool == "shell_exec" -> base
            action.tool.contains("tap") || action.tool.contains("type") || action.tool.contains("swipe") -> "medium"
            else -> base
        }
    }

    private fun targetFor(action: ToolAction): String {
        return when {
            action.tool.startsWith("file_") -> action.args.optString("path", "workspace")
            action.tool.startsWith("shell_") -> "app-private workspace shell"
            action.tool.startsWith("container_") -> "phone PRoot container"
            action.tool.startsWith("termux_") -> "Termux SSH bridge"
            action.tool.startsWith("ssh_") -> "configured SSH target"
            action.tool.startsWith("execution_") -> "execution fallback order"
            action.tool.startsWith("phone_") -> "Android device"
            else -> action.worker.label
        }
    }

    private fun approvalKey(sessionId: String, actions: List<ToolAction>): String {
        return "$sessionId:${actions.joinToString("|") { "${it.tool}:${it.args}" }}"
    }

    private fun JSONArray?.strings(): List<String> {
        if (this == null) return emptyList()
        return buildList {
            for (index in 0 until length()) {
                val item = opt(index)
                val value = when (item) {
                    is JSONObject -> item.optString("label", item.optString("value"))
                    else -> optString(index)
                }
                if (value.isNotBlank()) add(value)
            }
        }
    }
}

private data class ToolAction(
    val tool: String,
    val args: JSONObject,
    val worker: WorkerMode
) {
    fun toJson(): JSONObject = JSONObject()
        .put("tool", tool)
        .put("args", args)
        .put("worker", worker.id)
}

private data class DirectPlan(
    val actions: List<ToolAction>,
    val approvalSummary: String,
    val successMessage: String? = null,
    val failureMessage: String? = null
) {
    companion object {
        fun single(action: ToolAction, approvalSummary: String = action.args.toString()): DirectPlan {
            return DirectPlan(
                actions = listOf(action),
                approvalSummary = approvalSummary,
                successMessage = null,
                failureMessage = null
            )
        }
    }
}

private data class PendingToolAction(
    val sessionId: String,
    val taskId: String,
    val actions: List<ToolAction>,
    val successMessage: String?,
    val failureMessage: String?,
    val resumePrompt: String?
)

private sealed class AgentDirective {
    data class Final(val content: String) : AgentDirective()
    data class ToolCall(val tool: String, val args: JSONObject) : AgentDirective()
    data class ApprovalRequest(
        val tool: String,
        val risk: String,
        val reason: String,
        val args: JSONObject
    ) : AgentDirective() {
        fun toJson(): JSONObject = JSONObject()
            .put("type", "approval_request")
            .put("tool", tool)
            .put("risk", risk)
            .put("reason", reason)
            .put("args", args)
    }
    data class WorkerRoute(
        val worker: WorkerMode,
        val reason: String
    ) : AgentDirective()
    data class Question(
        val title: String,
        val description: String,
        val type: String,
        val options: List<String>
    ) : AgentDirective() {
        fun toJson(): JSONObject = JSONObject()
            .put("type", "question")
            .put("title", title)
            .put("description", description)
            .put("questionType", type)
            .put("options", JSONArray(options))
    }
    data class ParserError(val raw: String, val reason: String) : AgentDirective()
}
