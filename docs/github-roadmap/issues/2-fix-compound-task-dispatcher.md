**Title:** Fix compound task dispatcher so multi-intent commands run all steps

**Issue Type:** Bug

**Priority:** P0

**Milestone:** Milestone 0 — Audit + Stabilize

**Labels:** `type:bug`, `priority:p0`, `area:agent-runtime`, `area:parser`, `safety-critical`, `needs-device-test`

**Goal:**

Enable multi-step commands to execute all steps instead of stopping after the first. For example, `"look at my screen and open youtube"` should:
1. Observe the screen
2. Get context from the observation
3. Open the YouTube app

Currently only step 1 (screen observe) executes and the task stops.

**Context:**

Users expect natural multi-step commands to work. The app has all the underlying tools but lacks a compound task dispatcher that can:
- Parse multi-intent commands (commands with "and", "then", compound verbs)
- Execute steps in sequence
- Feed results between steps
- Resume the agent loop after each step
- Stop only when all steps complete or an error occurs

**Failing Test Cases:**

```
Command: "look at my screen and open youtube"
Expected:
1. phone_screen_observe → get screen data
2. phone_open_app youtube → open app
3. Final summary: "Observed screen and opened YouTube"

Actual:
1. phone_screen_observe runs
2. Task marked DONE
3. Function returns
4. YouTube never opens
```

```
Command: "look at my screen ask me a question and open youtube"
Expected:
1. phone_screen_observe
2. Model asks question (based on screen context)
3. Wait for answer
4. Resume task
5. phone_open_app youtube
6. Final: "Observed screen, asked and answered question, opened YouTube"

Actual:
1. Screen observe only
2. Task stops
3. Rest never runs
```

**Root Cause Analysis:**

1. **`runScreenAsk()` function** (AgentRuntime.kt lines 871-930):
   - Always marks task as "done" after screen observation
   - Does not check if there are more steps to execute
   - Returns without feeding result back to agent loop

2. **Parser does not detect multi-intent commands** (PhoneCommandParser.kt):
   - `parseStructured()` treats whole command as single intent
   - No "and" / "then" / compound command detection
   - No plan generation for multi-step execution

3. **Main message handler** (AgentRuntime.kt lines 200-240):
   - Line 214-223 detects screen ask prompts and calls `runScreenAsk()`
   - No follow-up mechanism if compound command has more steps

**Affected Files:**

- `core/AgentRuntime.kt`:
  - Line 214-223: Screen ask detection
  - Line 871-930: `runScreenAsk()` function
  - Line 993-1111: `runAgentLoop()` — needs to handle multi-step continuation
- `core/PhoneCommandParser.kt`:
  - `parseStructured()` — needs compound intent detection
  - New: compound plan generation logic
- `ui/screens/ChatScreen.kt` — No changes needed

**Acceptance Criteria:**

- [ ] Compound task parser detects "and" / "then" / commas in commands
- [ ] Parser generates multi-step plan with ordered actions
- [ ] Screen observe does NOT auto-complete task if more steps follow
- [ ] Result from step N feeds into agent loop for step N+1 decision
- [ ] Agent loop continues executing plans until all steps done
- [ ] Question handling preserves remaining steps (shows pending steps in UI)
- [ ] Test case: `"look at my screen and open youtube"` — PASS
- [ ] Test case: `"look at my screen ask me a question and open youtube"` — PASS
- [ ] Test case: `"ask me a question then open youtube"` — PASS
- [ ] Final summary includes all executed steps with results
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] No new permissions required

**Safety Rules:**

- [ ] If approval required: show full compound plan before execution
- [ ] Audit log each step execution separately (not one bulk entry)
- [ ] Allow user to cancel/stop at each step boundary
- [ ] Rate-limited or expensive operations: get per-step approval (e.g., search → open → search)
- [ ] Fail gracefully: if step N fails, stop gracefully and explain which step failed

**Testing & Evidence:**

### Local Test Commands

```bash
cd apps/phone-agent
./gradlew assembleDebug

# Install on device
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.kizek.phoneagent 1  # Launch app
```

### Real Device Test Matrix

Test on actual phone with chat input:

| Input | Expected | Result | Notes |
| --- | --- | --- | --- |
| "look at my screen and open youtube" | Screen observe + YouTube opens | ❌ FAIL | Currently stops after screen |
| "look at my screen ask me a question and open youtube" | Screen + question asked + user answers + YouTube opens | ❌ FAIL | Stops after screen |
| "ask me a question then open youtube" | Question asked, answered, YouTube opens | ❌ FAIL | Likely stops after question |
| "open chrome and search fabric minecraft" | Chrome opens, search runs | ❌ FAIL | Might stop after open |

### Evidence to Comment

```
## Fix Complete ✓

### Implementation
- [x] PhoneCommandParser detects multi-intent (parseCompoundCommand)
- [x] Compound plan generated with ordered steps
- [x] runScreenAsk() no longer auto-completes if > 1 step
- [x] runAgentLoop() handles step continuation
- [x] Question answer preserves remaining steps
- [x] Final summary includes all steps

### Testing
✓ Test: "look at my screen and open youtube"
  - Screen observe: SUCCESS
  - YouTube opens: SUCCESS
  - Final summary: "Observed screen. Opened YouTube."

✓ Test: "ask me a question then open youtube"
  - Question asked: "Do you want to open Chrome or YouTube?"
  - User answers: "Open YouTube"
  - YouTube opens: SUCCESS

✓ Local tests pass: 3/3
✓ Device tests pass: 3/4 (one test skipped - no Mistral key)
✓ Build: clean assembleDebug ✓
✓ No new permissions needed

### Audit Log Sample
```
Event: ToolCalled, tool=phone_screen_observe, step=1/3
Event: ToolResult, tool=phone_screen_observe, success=true, step=1/3
Event: ToolCalled, tool=phone_open_app, args={app:"youtube"}, step=2/3
Event: ToolResult, tool=phone_open_app, success=true, step=2/3
Event: TaskCompleted, summary="Compound task completed: 2 steps, all successful"
```

Commit: abc123def
```

**Out of Scope:**

- Do not add remote orchestrator multi-task support (Milestone 2)
- Do not change approval logic (separate issue #11)
- Do not refactor entire AgentRuntime (only add compound handling)

**Blocked By:**

None. This is a core bug fix.

**Blocks:**

- Issue #3 (Question resume) — needs compound task support to work correctly
- Issue #4 (Multi-tool loop) — related but separate
- All Milestone 1 work depends on this

**Agent Suggestion:** Codex (Android/Kotlin agent runtime expert)

**Branch:** `agent/2-compound-task-dispatcher`
