# Current Phone Agent Implementation Audit

**Date:** May 21, 2026
**Repo:** https://github.com/CrazyMan28/phoneagent
**Status:** Milestone 0 - Audit & Stabilize

## Executive Summary

The Phone Agent Android app is a sophisticated multi-module Kotlin/Jetpack Compose application with:
- **101 Kotlin source files** across 8 feature areas
- **6 core runtime modules** (Agent, Parser, Tools, Tasks, Approvals, Questions)
- **Partial implementation** of safe phone-control MVP
- **5 critical bugs** identified from real device testing
- **Ready for Milestone 1** after P0 bugs fixed

---

## Architecture Overview

### Module Organization

```
com.kizek.phoneagent/
├── core/                    # Agent runtime (16 files)
│   ├── AgentRuntime.kt      # Main orchestration loop (1800+ lines)
│   ├── LocalAgentWorker.kt  # Model communication wrapper
│   ├── PhoneCommandParser.kt # Command parsing (639 lines)
│   ├── ToolRegistry.kt       # Tool registration + discovery
│   ├── TaskQueue.kt          # Task state management
│   ├── ApprovalManager.kt    # Approval gates + chains
│   ├── QuestionManager.kt    # Question/answer system
│   ├── EventLog.kt           # Audit logging
│   ├── MemoryStore.kt        # Session state
│   ├── OnboardingManager.kt
│   ├── WorkerRouter.kt       # Route to phone/laptop/SSH/Termux
│   ├── RuntimeModels.kt
│   ├── SafeJsonExtractor.kt  # JSON directive parsing
│   └── LocalAgentForegroundService.kt
├── models/                  # AI provider support (8 files)
│   ├── ModelRouter.kt        # Route to provider + fallback
│   ├── MistralProvider.kt    # Mistral API integration
│   ├── HttpChatProviders.kt  # OpenAI-compatible endpoint
│   ├── LocalModelProvider.kt # Stub for local inference
│   ├── RemoteProvider.kt     # Laptop/server agent
│   └── SecureApiKeyStore.kt  # Keystore-backed key storage
├── tools/                   # Phone tools (18 files)
│   ├── ToolAction.kt
│   ├── PhoneToolResult.kt
│   ├── FileTools.kt          # File read/write/list
│   ├── PhoneTools.kt         # App list/open/search/tap/type
│   ├── SSHTools.kt           # SSH execution
│   ├── TermuxTools.kt        # Termux SSH bridge
│   ├── ScreenTools.kt        # Screen observation
│   ├── AccessibilityTools.kt # A11y tree + actions
│   ├── ContainerTools.kt     # PRoot container
│   ├── DeviceTools.kt        # Device info + permissions
│   └── ...
├── safety/                  # Safety & approval (4 files)
│   ├── RiskClassifier.kt     # Classify tool risk levels
│   ├── SafetyPolicy.kt       # Approval + sensitive app rules
│   └── ...
├── storage/                 # Database & persistence (8 files)
│   ├── AppDatabase.kt        # Room database
│   ├── SessionEntity.kt
│   ├── TaskEntity.kt
│   ├── ApprovalEntity.kt
│   ├── QuestionEntity.kt
│   └── ...
├── sync/                    # Remote orchestrator (4 files)
│   ├── OrchestratorClient.kt # HTTP client for laptop daemon
│   ├── SyncModels.kt
│   └── ...
├── ui/                      # Jetpack Compose UI (40+ files)
│   ├── screens/             # Main screens (18 files)
│   │   ├── ChatScreen.kt
│   │   ├── TasksScreen.kt
│   │   ├── ToolsScreen.kt
│   │   ├── FilesScreen.kt
│   │   ├── SettingsScreen.kt
│   │   ├── ProviderRuntimeSettingsScreens.kt
│   │   ├── DeveloperTestsScreen.kt
│   │   ├── DeviceControlScreen.kt
│   │   ├── AssistantModeScreen.kt
│   │   ├── VoiceScreen.kt
│   │   ├── ContainerScreen.kt
│   │   ├── McpScreen.kt
│   │   ├── SessionsScreen.kt
│   │   ├── ApprovalsScreen.kt
│   │   ├── QuestionsScreen.kt
│   │   ├── ModelsScreen.kt
│   │   ├── ConsoleScreen.kt
│   │   └── HomeDashboardScreen.kt
│   ├── components/          # Reusable UI components (10+ files)
│   │   ├── MessageBubble.kt
│   │   ├── ToolCard.kt
│   │   ├── ApprovalCard.kt
│   │   ├── QuestionCard.kt
│   │   ├── StatusBar.kt
│   │   ├── DetailsSheet.kt
│   │   ├── PremiumComponents.kt
│   │   └── ...
│   ├── theme/
│   │   └── Theme.kt
│   └── AppRoot.kt
└── MainActivity.kt
```

---

## What Works Now (Verified on Device)

### ✅ Core Features

- **Chat Interface** — Jetpack Compose chat UI with message history, status pills
- **Mistral API Integration** — Chat completions with configurable model, temperature, tokens
- **Screen Observation** — MediaProjection permission flow, one-shot screenshot with metadata
- **Accessibility Service** — Tree serialization, node text/bounds/class, safe failure if disabled
- **App Control** — List installed apps, fuzzy matching, open app by intent
- **File Tools** — Workspace read/write, optional SAF-selected workspace
- **Approval System** — Risk classification, approval scope (once/task/session), audit logging
- **Question System** — Bottom sheet questions, multi-choice + free-form answers
- **Task Management** — Task queue, state transitions, recovery from crashes
- **Audit Logging** — Event log with tool calls, approvals, questions, errors
- **Foreground Service** — Visible persistent notification during agent tasks
- **Emergency Stop** — User can stop running task, clears pending approvals
- **Provider Settings** — Mistral key setup with Keystore encryption, model picker, test connection
- **Developer Tests** — Comprehensive test matrix (30+ test cases)

### ✅ Execution Backends

- **App Shell** — `/system/bin/sh` with file I/O
- **Termux SSH Bridge** — SSH to localhost:8022, test connection, exec command
- **SSH Agent** — Multiple SSH targets with encrypted credentials, known host pinning
- **PRoot Container** — Import proot binary, import/extract rootfs, test command
- **Execution Fallback Router** — Try app shell → PRoot → Termux → SSH in order

### ✅ Safety Features

- **Sensitive App Blocks** — Banking, payment, password managers, authenticators blocked
- **Approval Gates** — Risky actions require approval
- **Audit Log** — Every tool call logged with timestamp, worker, args, result
- **Visible Status** — Foreground notification, status bar indicator
- **Secure Credentials** — Keystore storage for API keys, SSH keys, passwords (encrypted)
- **Fail-Closed** — Permissions required before action (no silently failing)

---

## What's Partial/Scaffolded (Not Production-Ready)

### ⚠️ Partial Implementation

- **Local Model Inference** — Backend not linked. Imports model UI but shows honest "not available" message. No false claims.
- **MCP Bridge** — JSON-RPC stdio/HTTP not yet implemented. Status shows limitation message.
- **Continuous Screen Watch** — Not implemented. One-shot observation only. No hidden capture.
- **Vision Upload** — Not implemented. Accessibility text only (no visual image analysis).
- **Assistant Mode** — "Hey Phone Agent" wake word not implemented. Can't be done on stock Android without visible mic service.

### ⚠️ UI Polish Needed

- Raw JSON sometimes shown in details (should be tabs)
- Composer input could be more compact
- Settings screens have too many options on one screen
- Developer Tests screen is long and cluttered

---

## Known P0 Bugs (Real Device Failures)

All 5 bugs have been tested and reproduced on Android device.

### P0 BUG 1 — Compound Task Dispatcher Stops After One Step
**Status:** ❌ FAILING
- Command: `"look at my screen and open youtube"`
- Expected: Screen observe + YouTube opens
- Actual: Only screen observe runs, task stops
- Root Cause: `runScreenAsk()` marks task done immediately

### P0 BUG 2 — Question Answer Does Not Resume Task
**Status:** ❌ FAILING
- Command: `"ask me a question"` → user answers
- Expected: Task resumes, next tool/final answer executes
- Actual: Shows "Message Added", task never resumes
- Root Cause: Answer not routed to pending task continuation

### P0 BUG 3 — Multi-Tool Loop Stops Too Early
**Status:** ❌ FAILING
- Command: `"SSH exec, then open app"`
- Expected: Both tools run
- Actual: SSH runs, exit code 0, task stops
- Root Cause: Agent assumes goal complete after first tool

### P0 BUG 4 — Fuzzy Parser Fails on Typos
**Status:** ❌ FAILING
- Command: `"open youtuber and serch for iron man"`
- Expected: Recognized as YouTube + search
- Actual: "App not found for youtuber"
- Root Cause: No typo correction, no fuzzy matching

### P0 BUG 5 — Provider Error Classification
**Status:** ❌ FAILING
- Rate limit 429 → Shown as "No provider configured"
- Auth error 401 → Shown as "Model error"
- Expected: Specific error types with guidance
- Root Cause: No HTTP status code classification

---

## Build & Deployment

### Build Command
```bash
cd apps/phone-agent
./gradlew clean assembleDebug
```

### Output
```
apps/phone-agent/app/build/outputs/apk/debug/app-debug.apk (5-8 MB)
```

### Installation
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.kizek.phoneagent 1  # Launch
```

### Permissions Required
- RECORD_AUDIO (STT, optional)
- READ_EXTERNAL_STORAGE (file workspace, optional)
- WRITE_EXTERNAL_STORAGE (file workspace, optional)
- BIND_ACCESSIBILITY_SERVICE (enabled in settings)
- SYSTEM_ALERT_WINDOW (assistant bubble, optional)
- INTERNET (required for Mistral, orchestrator)
- FOREGROUND_SERVICE (required for agent tasks)

---

## Developer Notes

### Key Files to Know

| File | Purpose | Size | Notes |
| --- | --- | --- | --- |
| `AgentRuntime.kt` | Main agent loop + task execution | 1800+ lines | Needs refactoring; compound task logic needed |
| `PhoneCommandParser.kt` | Natural language parsing | 639 lines | No fuzzy matching; typo correction needed |
| `ChatScreen.kt` | Main UI | ~400 lines | Functional, UI polish needed |
| `ToolRegistry.kt` | Tool discovery + execution | ~300 lines | Works well, complete coverage |
| `MistralProvider.kt` | Mistral API integration | ~200 lines | No error classification; retry logic needed |

### Testing Approach

- **Unit tests:** Minimal (mainly UI tests needed)
- **Integration tests:** Manual device testing (no simulator)
- **Test coverage:** ~30% (mainly happy path)
- **CI/CD:** None yet (manual builds)

### Dependencies

Main libraries:
- Jetpack Compose (UI)
- Room (database)
- Retrofit (HTTP)
- OkHttp (HTTP client)
- Coroutines (async)
- Androidx Security (Keystore)

---

## Recommended Next Steps (Milestone 0)

### Priority: Fix P0 Bugs (Issues #5-#9)

1. **Issue #5:** Fix compound task dispatcher (dependency for other fixes)
2. **Issue #6:** Fix question answer continuation (depends on #5)
3. **Issue #7:** Fix multi-tool agent loop (depends on #5)
4. **Issue #8:** Fix fuzzy parser (independent)
5. **Issue #9:** Fix provider error classification (independent)

### After P0 Bugs Fixed

Proceed to Milestone 1 (safe MVP):
- Accessibility hardening
- Approval system completion
- Audit logging completion
- Emergency stop robustness
- Visible agent status

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| P0 bugs block MVP | High | High (5 bugs active) | Fix in Milestone 0 |
| Permission issues | Medium | Low | Handled in setup flow |
| Provider unavailable | Low | Medium | Fallback to local commands |
| Crashed task recovery | Medium | Low | Recovery logic in place |
| Sensitive app access | High | Low | Blocked list maintained |

---

## Honest Limitations

The following are **NOT** implemented and **NOT** faked:

- [ ] Local model inference backend (LLaMA, ONNX, TFLite)
- [ ] MCP/JSON-RPC stdio bridge
- [ ] Continuous background screen watching
- [ ] Visual image analysis (vision uploads)
- [ ] Wake word listening ("Hey Phone Agent" not available)
- [ ] System-level app interception
- [ ] Hidden background operation

All of the above show honest "unavailable" messages to users instead of pretending to work.

---

## Conclusion

The Phone Agent app is a well-architected, feature-rich implementation with clear safety rules and honest limitations. After fixing 5 P0 bugs, it will be ready for Milestone 1 (safe MVP). The codebase is maintainable and well-documented.

**Readiness:**
- ✅ Architecture solid
- ✅ Safety model well-defined
- ✅ Audit logging in place
- ✅ Multiple backends supported
- ❌ P0 bugs must be fixed before MVP
- ⚠️ UI needs polish (Milestone 5)
- ⚠️ Local model/MCP bridge pending (optional)
