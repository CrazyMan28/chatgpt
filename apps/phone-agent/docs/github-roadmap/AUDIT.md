# Phone Agent Audit

## Runtime

- `core/AgentRuntime.kt` orchestrates message handling, task execution, approvals, and question resume.
- `core/PhoneCommandParser.kt` parses open/search/tap/type/follow-up phone commands.
- `core/QuestionManager.kt` persists question cards and answers.
- `core/TaskQueue.kt` tracks task state transitions.

## UI

- `ui/AppRoot.kt` routes between chat, tasks, questions, tools, files, and settings.
- `ui/screens/ChatScreen.kt` shows the current conversation and bottom-sheet question flow.
- `ui/screens/QuestionsScreen.kt` lists pending and answered questions.

## Tools and integrations

- `core/ToolRegistry.kt` centralizes local tool execution.
- `tools/AccessibilityTools.kt`, `tools/ScreenTools.kt`, and `tools/ScreenCaptureManager.kt` support device actions.
- `models/ModelRouter.kt` and provider classes manage local/remote model routes.
- `sync/OrchestratorClient.kt` handles remote session and question syncing.

## Current state

- Compound prompts are parsed and can carry follow-up steps through question resumes.
- Question answers are persisted and routed back into the runtime continuation path.
- The app builds a debug APK from the Android Gradle project.
