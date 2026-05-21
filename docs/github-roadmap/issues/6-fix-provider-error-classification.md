**Title:** Fix provider error classification and retry/fallback logic

**Issue Type:** Bug
**Priority:** P0
**Milestone:** Milestone 0
**Labels:** `type:bug`, `priority:p0`, `area:provider`, `area:agent-runtime`

**Goal:**
Distinguish different error types (rate limit, auth failure, timeout, network offline) and show appropriate user guidance. Local phone-control commands should work even when provider is down.

**Failing Examples:**
```
429 (Rate Limited) → shown as "No provider configured"
401 (Auth Failed) → shown as "missing key"
Timeout → shown as "model error"
Network offline → shown as "provider unavailable"
```

**Expected Behavior:**
- Classify HTTP status codes: 429 → rate limited, 401/403 → auth failed, 500+ → server error, timeout → timeout, offline → offline
- Show specific guidance: "Rate limited. Retry in 60s" or "Invalid API key. Check Settings > AI Providers"
- Retry logic: 429 → backoff (1s, 10s, 60s), 401 → require re-entry, timeout → quick retry
- Local deterministic commands (file, app, screen) still work while provider down
- Fallback providers attempted if enabled

**Affected Files:**
- `models/MistralProvider.kt` — HTTP error handling
- `models/HttpChatProviders.kt` — Error mapping
- `models/ModelRouter.kt` — Routing and fallback
- `core/AgentRuntime.kt` — Error handling in agent loop

**Acceptance Criteria:**
- [ ] HTTP 429 classified as "rate limited" with backoff retry
- [ ] HTTP 401/403 classified as "auth failed" with re-entry prompt
- [ ] HTTP 500+ classified as "provider error"
- [ ] Timeout classified separately
- [ ] Local commands work while provider down
- [ ] Fallback provider attempted if enabled
- [ ] Error message shows: type, guidance, retry option
- [ ] Audit log includes error classification + retry count

**Evidence to Comment:**
```
✓ Simulate 429: Rate limit error classified correctly, retried
✓ Simulate 401: Auth error prompts for new key
✓ Local command (file read): Works without provider
✓ Fallback to 2nd provider: Attempted and used
✓ Build: clean assembleDebug
```

**Agent Suggestion:** Codex

**Branch:** `agent/6-provider-errors`
