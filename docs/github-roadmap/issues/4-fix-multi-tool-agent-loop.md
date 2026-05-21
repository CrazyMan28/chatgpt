**Title:** Fix multi-tool agent loop so it doesn't stop after first successful tool

**Issue Type:** Bug
**Priority:** P0
**Milestone:** Milestone 0
**Labels:** `type:bug`, `priority:p0`, `area:agent-runtime`, `needs-device-test`

**Goal:**
When executing a multi-tool task (e.g., "search for X, then open app Y"), the agent should continue looping through all tools until the goal is complete. Currently it stops after the first tool succeeds.

**Failing Test Case:**
```
Command: "SSH exec 'ls /tmp', then if files exist open the Files app"
Expected:
1. SSH exec runs → returns stdout list
2. Agent reads result, decides next step needed
3. phone_open_app files runs
4. Final: "Executed SSH, opened Files app"

Actual:
1. SSH exec returns exit code 0
2. Agent assumes goal complete
3. Task marked DONE
4. phone_open_app never runs
```

**Root Cause:**
- Agent loop stopping condition too eager (line ~1009 in AgentRuntime.kt)
- Model might be returning Final directive too early
- No continuation prompt to agent saying "check if goal actually complete"

**Affected Files:**
- `core/AgentRuntime.kt` — `runAgentLoop()` and `isShallowToolCompletion()` check
- `core/SafeJsonExtractor.kt` — Directive parsing

**Acceptance Criteria:**
- [ ] Tool result feeds back into agent loop
- [ ] Agent continues unless goal explicitly marked complete
- [ ] Multi-tool flows work: SSH → file → app → screen
- [ ] Max step limit enforced (currently 12)
- [ ] Stop reason logged (goal complete, max steps, user cancel, error)
- [ ] Final summary includes all tool results in order

**Evidence to Comment:**
```
✓ Multi-tool task: SSH exec → open app (both steps run)
✓ Max steps limit: Task stops after 12 steps
✓ Build: clean assembleDebug
```

**Agent Suggestion:** Codex

**Branch:** `agent/4-multi-tool-loop`
