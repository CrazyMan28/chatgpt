package com.kizek.phoneagent

import android.app.Application
import com.kizek.phoneagent.assistant.AssistantManager
import com.kizek.phoneagent.container.ContainerTerminal
import com.kizek.phoneagent.container.ProotManager
import com.kizek.phoneagent.core.AgentRuntime
import com.kizek.phoneagent.core.ApprovalManager
import com.kizek.phoneagent.core.EventLog
import com.kizek.phoneagent.core.LocalAgentWorker
import com.kizek.phoneagent.core.MemoryStore
import com.kizek.phoneagent.core.OnboardingManager
import com.kizek.phoneagent.core.QuestionManager
import com.kizek.phoneagent.core.TaskQueue
import com.kizek.phoneagent.core.ToolRegistry
import com.kizek.phoneagent.core.WorkerRouter
import com.kizek.phoneagent.models.LocalModelManager
import com.kizek.phoneagent.models.LocalModelProvider
import com.kizek.phoneagent.models.MistralProvider
import com.kizek.phoneagent.models.ModelRouter
import com.kizek.phoneagent.models.OllamaProvider
import com.kizek.phoneagent.models.OpenAiCompatibleProvider
import com.kizek.phoneagent.models.LocalHttpProvider
import com.kizek.phoneagent.models.RemoteProvider
import com.kizek.phoneagent.runtime.ExecutionRouteManager
import com.kizek.phoneagent.runtime.SshAgentManager
import com.kizek.phoneagent.runtime.TermuxBridgeManager
import com.kizek.phoneagent.storage.AppDatabase
import com.kizek.phoneagent.sync.OrchestratorClient
import com.kizek.phoneagent.sync.PairingManager
import com.kizek.phoneagent.tools.ClipboardTools
import com.kizek.phoneagent.tools.ContainerTools
import com.kizek.phoneagent.tools.FileTools
import com.kizek.phoneagent.tools.AccessibilityTools
import com.kizek.phoneagent.tools.AndroidDeviceTools
import com.kizek.phoneagent.tools.McpTools
import com.kizek.phoneagent.tools.ScreenCaptureManager
import com.kizek.phoneagent.tools.ScreenTools
import com.kizek.phoneagent.tools.ShellTools
import com.kizek.phoneagent.tools.WorkspaceManager
import com.kizek.phoneagent.voice.VoiceManager

class PhoneAgentApplication : Application() {
    lateinit var database: AppDatabase
        private set
    lateinit var pairingManager: PairingManager
        private set
    lateinit var orchestratorClient: OrchestratorClient
        private set
    lateinit var modelRouter: ModelRouter
        private set
    lateinit var prootManager: ProotManager
        private set
    lateinit var onboardingManager: OnboardingManager
        private set
    lateinit var workspaceManager: WorkspaceManager
        private set
    lateinit var localModelManager: LocalModelManager
        private set
    lateinit var screenCaptureManager: ScreenCaptureManager
        private set
    lateinit var runtime: AgentRuntime
        private set
    lateinit var fileTools: FileTools
        private set
    lateinit var shellTools: ShellTools
        private set
    lateinit var containerTools: ContainerTools
        private set
    lateinit var clipboardTools: ClipboardTools
        private set
    lateinit var screenTools: ScreenTools
        private set
    lateinit var accessibilityTools: AccessibilityTools
        private set
    lateinit var androidDeviceTools: AndroidDeviceTools
        private set
    lateinit var mcpTools: McpTools
        private set
    lateinit var voiceManager: VoiceManager
        private set
    lateinit var assistantManager: AssistantManager
        private set
    lateinit var termuxBridgeManager: TermuxBridgeManager
        private set
    lateinit var sshAgentManager: SshAgentManager
        private set
    lateinit var executionRouteManager: ExecutionRouteManager
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.get(this)
        pairingManager = PairingManager(this)
        orchestratorClient = OrchestratorClient(pairingManager)
        prootManager = ProotManager(this)
        onboardingManager = OnboardingManager(this)
        workspaceManager = WorkspaceManager(this)
        localModelManager = LocalModelManager(this)
        screenCaptureManager = ScreenCaptureManager(this)
        voiceManager = VoiceManager(this)
        assistantManager = AssistantManager(this)
        termuxBridgeManager = TermuxBridgeManager(this)
        sshAgentManager = SshAgentManager(this)

        val mistral = MistralProvider(this)
        modelRouter = ModelRouter(
            context = this,
            mistral = mistral,
            openAiCompatible = OpenAiCompatibleProvider(this),
            localHttp = LocalHttpProvider(this),
            ollama = OllamaProvider(this),
            local = LocalModelProvider(localModelManager),
            remote = RemoteProvider(orchestratorClient)
        )

        fileTools = FileTools(this, workspaceManager)
        shellTools = ShellTools(this)
        containerTools = ContainerTools(prootManager, ContainerTerminal(prootManager))
        clipboardTools = ClipboardTools(this)
        accessibilityTools = AccessibilityTools(this)
        androidDeviceTools = AndroidDeviceTools(this)
        screenTools = ScreenTools(screenCaptureManager, accessibilityTools)
        mcpTools = McpTools(orchestratorClient, containerTools)
        executionRouteManager = ExecutionRouteManager(
            context = this,
            shellTools = shellTools,
            containerTools = containerTools,
            prootManager = prootManager,
            termuxBridgeManager = termuxBridgeManager,
            sshAgentManager = sshAgentManager,
            orchestratorClient = orchestratorClient
        )

        val eventLog = EventLog(database)
        val taskQueue = TaskQueue(database)
        val toolRegistry = ToolRegistry(
            fileTools = fileTools,
            shellTools = shellTools,
            containerTools = containerTools,
            accessibilityTools = accessibilityTools,
            androidDeviceTools = androidDeviceTools,
            screenTools = screenTools,
            clipboardTools = clipboardTools,
            modelRouter = modelRouter,
            orchestratorClient = orchestratorClient,
            mcpTools = mcpTools,
            voiceManager = voiceManager,
            assistantManager = assistantManager,
            termuxBridgeManager = termuxBridgeManager,
            sshAgentManager = sshAgentManager,
            executionRouteManager = executionRouteManager
        )
        runtime = AgentRuntime(
            database = database,
            eventLog = eventLog,
            taskQueue = taskQueue,
            approvalManager = ApprovalManager(database),
            questionManager = QuestionManager(database),
            memoryStore = MemoryStore(database),
            toolRegistry = toolRegistry,
            workerRouter = WorkerRouter(prootManager, executionRouteManager),
            localWorker = LocalAgentWorker(modelRouter),
            orchestratorClient = orchestratorClient
        )
    }
}
