# Known P0 Bugs — Phone Agent Android App

These bugs must be fixed before Milestone 1 is considered "done". All have been verified on a real Android phone.

## P0 BUG 1 — Compound Task Dispatcher Stops After One Step

**Symptom:** When a user issues a multi-step command like `"look at my screen and ask me a question and open youtube"`, only the first step (screen observation) runs, then the task stops.

**Failing Test Cases:**
```
"look at my screen and open youtube"
"look at my screen ask me a question and open youtube"
"ask me a question then open youtube"
```

**Expected Behavior:**
1. Parse multi-intent command into a compound task plan
2. Execute step 1: `phone_screen_observe` → get screen context
3. Model reads result and decides next step
4. Execute step 2 (question or open app)
5. Resume loop if more steps needed
6. Final summary includes all steps and results

**Actual Behavior:**
1. `phone_screen_observe` runs
2. Task immediately marked as "done"
3. Function returns without continuing
4. YouTube never opens
5. No final summary with both steps

**Root Cause:**
- `runScreenAsk()` function (lines 871-930 in AgentRuntime.kt) unconditionally marks task as done after screen observation
- No mechanism to detect "and" / compound intents in the parser
- Task returns early without feeding result back to agent loop

**Affected Files:**
- `core/AgentRuntime.kt` — `runScreenAsk()` and main message handler (lines 200-270)
- `core/PhoneCommandParser.kt` — Parser does not handle compound intents

**Acceptance Criteria:**
- [ ] Compound intents (multi-intent commands with "and") are parsed correctly
- [ ] Screen observation does not auto-complete task if more steps follow
- [ ] Result is fed back into agent loop for next decision
- [ ] "look at my screen and open youtube" runs both steps
- [ ] "ask me a question then open youtube" resumes after answer and opens app
- [ ] Final summary includes all executed steps
- [ ] No task marked done until final step complete

**Safety Rules:**
- Compound task approval: if approval needed, show full chain before execution
- Audit log each step execution separately
- Allow user to cancel at each step boundary

---

## P0 BUG 2 — Question Answer Does Not Resume Task

**Symptom:** When a user is asked a question and provides an answer, the task does not continue. Instead, the app shows something like "Message Added" and stops.

**Failing Test Cases:**
```
User: "ask me a question"
Model: "Do you want to open Chrome or Firefox?"
User (answers): "Open the YouTube app"
Expected: Task resumes and executes phone_open_app youtube
Actual: Shows "Message Added" and stops
```

**Expected Behavior:**
1. Agent asks question with options (or free-form)
2. Question stored in pending state with originalGoal = user prompt
3. Bottom sheet shows on phone waiting for answer
4. User selects option or types answer
5. Answer automatically routes to pending question
6. Task resumes with: original goal + question answer as context
7. Agent loop continues and executes next tool/final answer
8. No "Message Added" as the final response

**Actual Behavior:**
1. Question asked, stored
2. User answers
3. App shows "Message Added" notification
4. Question answer is never consumed by the pending task
5. Task remains in waiting state
6. Agent loop never resumes

**Root Cause:**
- Question answer not routed to `rememberQuestionContinuation` callback
- No mechanism to inject answer back into task context
- Task continues in waiting state but never gets woken up

**Affected Files:**
- `core/QuestionManager.kt` — Question storage and answer callback
- `core/AgentRuntime.kt` — `rememberQuestionContinuation()` and question answer handler
- `ui/screens/QuestionsScreen.kt` — Question UI and answer submission

**Acceptance Criteria:**
- [ ] User answers question from bottom sheet
- [ ] Answer is routed to pending task automatically
- [ ] Task state changes from "waiting" to "running"
- [ ] Agent loop resumes with answer in context
- [ ] Tool call or final answer follows answer
- [ ] No "Message Added" as the final response
- [ ] Question bottom sheet remains active until confirmed/cancelled
- [ ] Restart restores pending question if possible

**Safety Rules:**
- Audit log answer submission with timestamp
- Never auto-approve based on question answer alone
- Clear pending question if approval is rejected

---

## P0 BUG 3 — Multi-Tool Agent Loop Stops Too Early

**Symptom:** When an agent should execute multiple tools (e.g., "search for iron man, then open a different app"), the agent loop stops after the first tool succeeds, even if the original goal is not complete.

**Failing Test Cases:**
```
"look at my screen, open chrome, search iron man edits"
"open youtube, search minecraft fabric, then open settings"
SSH exec → returns 0 → agent stops instead of checking results and continuing
```

**Expected Behavior:**
1. User gives multi-tool goal
2. Agent creates a plan: tool1 → tool2 → tool3
3. Execute tool1, get result
4. Inspect result, decide if goal is complete
5. If not complete, continue to tool2
6. Repeat until goal complete or max steps reached
7. Final summary includes all tool results and outcomes

**Actual Behavior:**
1. Agent executes tool1
2. Tool returns exit code 0 (success)
3. Agent assumes goal complete
4. Task marked as done
5. Remaining tools (tool2, tool3) never execute
6. Final summary only mentions tool1

**Root Cause:**
- Agent loop stopping condition unclear (line ~1009 in AgentRuntime.kt checks `isShallowToolCompletion()`)
- Model might be returning "Final" directive too early
- No continuation prompt to agent telling it to check if goal is actually complete

**Affected Files:**
- `core/AgentRuntime.kt` — `runAgentLoop()` loop logic and continuation prompts
- `core/SafeJsonExtractor.kt` — Directive parsing (tool vs final vs question)

**Acceptance Criteria:**
- [ ] Tool result feeds back into agent loop
- [ ] Agent does not stop after 1 successful tool unless goal is complete
- [ ] Multi-tool flows (SSH → file → app → screen) work end-to-end
- [ ] Max step limit enforced (currently 12)
- [ ] Stop reason logged (goal complete, max steps, user cancel, error)
- [ ] Final summary includes all tool results in order

**Safety Rules:**
- Each tool result requires approval if risky
- Audit log tool execution order and results
- Stop sequence: user cancel > error > goal complete > max steps

---

## P0 BUG 4 — Fuzzy Parser Cannot Handle Messy Natural Language

**Symptom:** The parser fails or misinterprets common typos and natural language patterns that humans use.

**Failing Examples:**
```
"open youtuber and serch for iron man"              # Typo: "youtuber" → YouTube, "serch" → search
"open chrome and search minecraft fabric setup"      # Correct: Chrome, search
"search iron man edits in youtube"                   # Correct: YouTube, search
"open settings and tap display"                      # Correct: Settings, tap
"look at my screen and open youtube"                 # Should: screen observe, then open
```

**Expected Behavior:**
- Normalize typos ("youtuber" → YouTube, "serch" → search)
- Never pass full sentence as app name
- Support variations: "open", "launch", "run", "start"
- Recognize search operators: "search", "look for", "find"
- Recognize actions: "tap", "click", "type", "fill", "submit"
- Handle compound commands with "and", then", commas
- Return normalized intent + app + action

**Actual Behavior:**
- Parser passes typos as literal app names
- Parser sometimes extracts full sentences as app name
- Parser fails on natural language variations
- No typo correction or fuzzy matching
- App not found errors instead of helping

**Root Cause:**
- `PhoneCommandParser.kt` line 225+ uses strict matching
- No fuzzy string distance or typo correction
- App name extraction too greedy (captures trailing text)
- No natural language template matching for intent

**Affected Files:**
- `core/PhoneCommandParser.kt` — `parseStructured()` and app name extraction
- `core/ToolRegistry.kt` — `listInstalledApps()` and fuzzy app matching

**Acceptance Criteria:**
- [ ] Typo detection: "youtuber" recognized as YouTube, "serch" as search
- [ ] Fuzzy app name matching with Levenshtein distance or similar
- [ ] Multi-word commands split correctly ("chrome and search" not one app)
- [ ] Intent extraction: OPEN_APP, APP_SEARCH, APP_TYPE, APP_TAP, APP_FIND
- [ ] No local model required for basic phone commands (deterministic parsing)
- [ ] "app not found" includes suggestions (fuzzy matches)
- [ ] Test matrix: pass all 5 failing examples above

**Safety Rules:**
- Ask for confirmation if fuzzy match score < 0.8
- Never execute on low-confidence parse
- Log parse confidence score in audit

---

## P0 BUG 5 — Provider Error Classification Confusion

**Symptom:** When a provider (Mistral, OpenAI-compatible, Ollama) is rate-limited or misconfigured, the app shows confusing error messages that don't distinguish the root cause.

**Failing Examples:**
```
Rate limit 429 → shown as "No provider configured"
Timeout (5s) → shown as "missing key"
Auth failure 401 → shown as "model error"
Network offline → shown as "provider unavailable"
Wrong base URL → shown as "API key invalid"
```

**Expected Behavior:**
- Distinguish: missing config, invalid key, auth error (401/403), rate limit (429), timeout, offline, model error, provider unavailable
- Show specific guidance per error (e.g., "Rate limit. Retry in 60s" or "Invalid API key. Check Settings > AI Providers")
- Retry logic per error type (429 → backoff, 401 → require re-entry, timeout → quick retry)
- Local deterministic commands (file, app, screen) still work while provider is down
- Fallback providers attempted if enabled

**Actual Behavior:**
- Generic "No provider configured" shown for multiple error types
- No distinction between temporary (retry) vs permanent (reconfigure)
- No retry logic; task fails immediately
- User has to manually check Settings to diagnose
- No fallback attempt to alternate provider

**Root Cause:**
- `MistralProvider.kt` and `HttpChatProviders.kt` do not classify HTTP status codes
- `ModelRouter.kt` does not handle retries or fallback
- Provider test connection shows only pass/fail, not specific error

**Affected Files:**
- `models/MistralProvider.kt` — HTTP error handling
- `models/HttpChatProviders.kt` — OpenAI-compatible error mapping
- `models/ModelProvider.kt` — Interface for error classification
- `models/ModelRouter.kt` — Routing logic and fallback

**Acceptance Criteria:**
- [ ] HTTP 429 classified as "rate limited" + backoff retry
- [ ] HTTP 401/403 classified as "auth failed" + prompt for new key
- [ ] HTTP 500+ classified as "provider error" + show status page suggestion
- [ ] Timeout classified separately from network offline
- [ ] Local commands (file, screen, app) work while provider down
- [ ] Fallback provider attempted if enabled in settings
- [ ] Error message shows: error type, guidance, and retry option
- [ ] Audit log includes error classification + retry count

**Safety Rules:**
- Never retry auth errors more than 3 times in 1 hour
- Rate limit backoff: 1s, 10s, 60s, then fail
- Clear user guidance: what went wrong, how to fix

---

## Testing P0 Bugs

### Real Phone Test Matrix

| Bug | Command | Expected | Status |
| --- | --- | --- | --- |
| 1 | "look at my screen and open youtube" | Both steps run | ❌ FAIL |
| 1 | "ask me a question then open youtube" | Question asked, answered, app opens | ❌ FAIL |
| 2 | User answers question | Task resumes, no "Message Added" | ❌ FAIL |
| 3 | SSH exec → tool returns 0 | Continue to next tool if goal incomplete | ❌ FAIL |
| 4 | "open youtuber and serch iron man" | Recognized and corrected | ❌ FAIL |
| 5 | Rate limit 429 response | Shown as "Rate limited, retrying..." | ❌ FAIL |

### Local Test Commands

```bash
cd apps/phone-agent
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.kizek.phoneagent 1  # Launch app
# Then test each bug scenario on device
```

---

## Blocked By

None. These are independent fixes.

## Blocks

- All Milestone 1 work depends on P0 bugs fixed
- Cannot move to MCP bridge (Milestone 2) until compound tasks work
- Cannot test multi-step approval chains until multi-tool loop works

## Notes

- All P0 bugs have been reproduced on real devices
- No timing-dependent or intermittent issues observed
- Bugs are logic/architecture issues, not crashes
- Fixes do not require new permissions or API level changes
