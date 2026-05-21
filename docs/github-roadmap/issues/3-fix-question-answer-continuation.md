**Title:** Fix question answer continuation so tasks resume after answer

**Issue Type:** Bug
**Priority:** P0
**Milestone:** Milestone 0
**Labels:** `type:bug`, `priority:p0`, `area:agent-runtime`, `needs-device-test`

**Goal:**
When an agent asks a question and the user provides an answer, the task should automatically resume and continue executing (e.g., open the requested app). Currently the answer is shown as "Message Added" and the task never resumes.

**Failing Test Case:**
```
User: "ask me a question"
Model: "Do you want to open Chrome or YouTube?"
Bottom sheet shows: [Chrome] [YouTube] buttons
User taps: YouTube
Expected: phone_open_app youtube runs, "Opened YouTube" returned
Actual: Shows "Message Added", task never resumes
```

**Root Cause:**
- Question answer not routed to pending task continuation
- `rememberQuestionContinuation()` called but answer never injected back into agent loop
- Task remains in "waiting" state indefinitely

**Affected Files:**
- `core/QuestionManager.kt` — Answer callback routing
- `core/AgentRuntime.kt` — `rememberQuestionContinuation()` and task resume logic
- `ui/screens/QuestionsScreen.kt` — Answer submission

**Acceptance Criteria:**
- [ ] User answers question from bottom sheet
- [ ] Answer routed to pending task automatically
- [ ] Task resumes with answer injected into context
- [ ] Agent loop continues and executes next tool/final answer
- [ ] No "Message Added" as final response
- [ ] Question bottom sheet remains active until confirmed
- [ ] Restart restores pending question state

**Safety Rules:**
- Audit log answer submission with timestamp/worker
- Never auto-approve based on answer alone
- Clear pending question if approval rejected

**Evidence to Comment:**
```
✓ Test: Question answered → app opens
✓ Test: Question answered → task resumes
✓ Test: No "Message Added" final response
✓ Build: clean assembleDebug
```

**Agent Suggestion:** Codex

**Branch:** `agent/3-question-resume`
