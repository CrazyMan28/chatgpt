# Phone Agent Milestones

## Milestone 0 — Audit + Stabilize Current App

**Goal:** Map current state, fix P0 runtime bugs, establish clean foundation for future work.

**Target Date:** 2-3 weeks

**Issues:** #4-#9 (P0 bugs)

**Deliverables:**
- [x] GitHub repo created and initialized
- [x] Roadmap documentation published
- [ ] All P0 bugs fixed and tested on real devices
- [ ] No regressions in working features
- [ ] Clean build output: `./gradlew clean assembleDebug`

**What's Included:**
1. Audit of current implementation (101 Kotlin files, 6 core modules)
2. Fix 5 P0 bugs:
   - Compound task dispatcher (multi-intent commands)
   - Question answer continuation
   - Multi-tool agent loop
   - Fuzzy parser with typo correction
   - Provider error classification and retry logic
3. Documentation (README, KNOWN_BUGS, WORKER_RULES, SAFETY_RULES)
4. Build verification

**Success Criteria:**
- [ ] No P0 bugs remain
- [ ] All test cases in KNOWN_BUGS.md pass on real device
- [ ] Compound tasks execute all steps
- [ ] Questions resume tasks correctly
- [ ] Multi-tool loops continue until goal complete
- [ ] Typos corrected (youtuber → YouTube, serch → search)
- [ ] Provider errors distinguished (429 vs 401 vs timeout)
- [ ] Build succeeds
- [ ] No new permissions added

---

## Milestone 1 — Safe Phone-Control MVP

**Goal:** Reliable, safe local phone control with approval gates, audit logs, and emergency stop.

**Target Date:** 3-4 weeks (after Milestone 0)

**Issues:** #7-#14 (MVP features)

**Deliverables:**

### Accessibility Hardening (#7)
- Service status checker
- Active app/package detection
- Node tree serializer (text, contentDescription, class, bounds, clickable, editable)
- Safe failure if disabled

### Accessibility Action Tools (#8)
- `phone_tap_accessibility` — Tap node by id/path
- `phone_type_accessibility` — Type text in focused input
- `phone_swipe_accessibility` — Swipe start/end points
- `phone_back` — Press back button
- `phone_home` — Press home button
- `phone_recents` — Show recent apps
- All require approval unless readonly
- Sensitive app protections (banking, auth, etc. blocked)

### Screen Observation Tool (#9)
- MediaProjection permission flow
- Screenshot capture with metadata (path, size, timestamp)
- Accessibility summary fallback
- No hidden capture (visible foreground service + notification)

### App List/Open/Search/Tap/Type Tools (#10)
- `phone_list_apps` — List installed apps
- `phone_open_app` — Open app by name (fuzzy matching)
- `phone_app_search` — Search within app
- `phone_app_type` — Type in app
- App not found → suggest fuzzy matches

### Approval Gate System (#11)
- Classify tools by risk: readonly, low, medium, high, critical
- Approval scope: once, task, session
- Approval chains for compound tasks
- Reject reason tracking
- No duplicate approval spam

### Audit Logging System (#12)
- Log every tool call with timestamp, worker, args
- Log approvals/rejections
- Log questions/answers
- Log errors and outcomes
- Export audit log to user-readable format

### Emergency Stop / Kill Switch (#13)
- Visible STOP button in UI
- Long-press volume down (configurable)
- Cancels running task
- Clears pending approvals
- Disables autopilot for 10s
- Logs stop event

### Visible Agent Active Indicator (#14)
- Foreground notification when agent active
- Shows current task/tool
- Shows pending approvals
- Shows emergency stop button
- Never hidden background control

**Success Criteria:**
- [ ] All 8 issues completed
- [ ] Screen observation, accessibility, app control tools work end-to-end
- [ ] Approval gates block risky actions
- [ ] Audit log captures all activities
- [ ] Emergency stop responsive (< 1s)
- [ ] Foreground notification always visible during tasks
- [ ] No sensitive app access permitted
- [ ] Manual device test: all features work
- [ ] Build succeeds
- [ ] No new dangerous permissions added

---

## Milestone 2 — MCP/Tailscale Bridge

**Goal:** Expose safe, authenticated phone tools over Tailscale/MCP for remote agents.

**Target Date:** 3 weeks (parallel with Milestone 1 features)

**Issues:** #15-#19 (MCP & server)

**Deliverables:**

### Foreground Service + Persistent Notification (#15)
- Service skeleton with lifecycle management
- Persistent notification with task status
- Stop button in notification
- Android permission handling for foreground service
- Survives app background where allowed

### Tailscale HTTP/SSE Server (#16)
- Local HTTP server binds to configured host/port
- `/status` endpoint — returns agent status
- `/tools` endpoint — lists available tools
- `/tool_call` endpoint — executes tool
- Fails closed if auth missing
- SSE events for long-running operations

### MCP Tool Registry (#17)
- Tool list schema (name, description, args, return type)
- Tool call schema (tool, args)
- Result schema (success, result, error)
- Phone tools registered (15+ tools)
- Errors standardized

### Auth Middleware (#18)
- Bearer token required on all endpoints
- Token validation on every request
- Unauthorized requests denied with 401
- Rate limiting per token
- Audit log auth failures
- No open unauthenticated endpoints

### Remote MCP Integration Test (#19)
- Test from laptop/other agent over Tailscale
- Can list tools
- Can call safe tool (phone_screen_observe)
- Risky tool requires approval
- Auth failure test passes

**Success Criteria:**
- [ ] All 5 issues completed
- [ ] Server runs in foreground service
- [ ] Tools accessible over Tailscale (HTTP)
- [ ] Auth token required
- [ ] Rate limiting works
- [ ] Remote test passes
- [ ] No hidden network access
- [ ] Build succeeds

---

## Milestone 3 — Agent Runtime + Multi-Step Tasks

**Goal:** Robust multi-tool task execution with planning, approvals, and error recovery.

**Target Date:** 2-3 weeks (parallel with Milestone 2)

**Issues:** #20-#27 (Runtime & multi-step)

**Deliverables:**

### Task Planning & Compound Execution
- Plan generation for complex goals (screen + search + open)
- Step ordering and dependencies
- Result propagation between steps
- Approval chains for compound plans

### Question Resume & Continuation
- Questions preserve task context
- Answers injected back into agent loop
- Agent continues until goal complete or max steps

### Provider Fallback & Error Handling
- Provider fallback chain (Mistral → OpenAI → Ollama → Local)
- Error classification (429 vs 401 vs timeout vs offline)
- Automatic retry with backoff for transient errors
- User guidance per error type
- Local commands work while provider down

### Agent Loop Robustness
- Tool result → model input feedback
- Agent continues looping until goal complete or max steps
- Stop reason logged (goal complete, max steps, error, user cancel)
- Timeout handling for long-running steps
- Graceful degradation if model unavailable

**Success Criteria:**
- [ ] Compound tasks execute all steps
- [ ] Multi-tool chains work (SSH → file → app → screen)
- [ ] Provider fallback tested
- [ ] Error handling covers all cases
- [ ] Manual device test with complex scenarios
- [ ] Build succeeds

---

## Milestone 4 — Execution Backends

**Goal:** Multiple command execution backends (local, Termux, SSH, PRoot) with safe fallback.

**Target Date:** 2-3 weeks (parallel with Milestone 3)

**Issues:** #20-#23 (Execution backends)

**Deliverables:**

### Termux SSH Bridge (#20)
- Settings for host/port/user/auth
- Test connection with diagnostics
- Setup guide in app
- Failure reasons: timeout, auth, port closed
- Run safe command if connected

### SSH Agent Targets (#21)
- Multiple SSH targets (phone, laptop, server)
- Encrypted credentials (Keystore)
- Known host fingerprint verification
- Test connection
- `ssh_exec` tool with approvals

### PRoot Container Setup (#22)
- Import proot binary or URL+SHA256
- Import rootfs tarball
- Extract and mount
- Test command in container
- Honest blocked state if Android prevents exec
- No fake success

### Execution Fallback Router (#23)
- Configurable fallback order:
  1. App shell
  2. Built-in PRoot
  3. Termux bridge
  4. SSH agent targets
  5. Remote orchestrator
- Tool result shows runtime used
- Fallback attempts summarized
- Worker routing in UI

**Success Criteria:**
- [ ] All 4 issues completed
- [ ] SSH connection test works
- [ ] PRoot container creation works
- [ ] Fallback router tries all backends
- [ ] Honest error messages if backends unavailable
- [ ] Manual test: command executes in at least 2 backends
- [ ] Build succeeds

---

## Milestone 5 — UI/UX + Release

**Goal:** Polish UI, complete documentation, prepare for public release.

**Target Date:** 2-3 weeks (final polish)

**Issues:** #28-#35 (UI, docs, CI/CD)

**Deliverables:**

### UI Polish (#28-#31)
- ChatGPT-like chat UI cleanup
- Compact composer, readable bubbles
- Bottom nav fits on small screens
- Question/approval card UX
- Settings screens for all backends
- Tool/approval details readable
- Raw JSON hidden by default

### Documentation & Install Guide (#32-#34)
- Install APK guide (manual + ADB)
- Permission setup walkthrough
- Accessibility service setup
- Screen capture permission flow
- Tailscale + MCP setup
- Termux + SSH setup instructions
- Safety model explained
- Known bugs documented

### Security Review (#35)
- Security checklist
- Permission model documented
- Fail-closed behavior documented
- Audit log expectations
- Known risks/limitations
- No false claims

### Build & Release Workflow (#32)
- Gradle debug build works
- APK path documented
- Optional GitHub Actions CI
- Artifact upload
- Release notes template

**Success Criteria:**
- [ ] All 8 issues completed
- [ ] UI responsive and polished
- [ ] Installation guide complete and tested
- [ ] Build workflow automated
- [ ] Security review passed
- [ ] Documentation reviewed
- [ ] Public release ready

---

## Timeline Summary

| Milestone | Target Duration | Parallel With |
| --- | --- | --- |
| 0 — Audit + Stabilize | 2-3 weeks | — |
| 1 — MVP | 3-4 weeks | (starts after M0) |
| 2 — MCP Bridge | 3 weeks | M1 (middle weeks) |
| 3 — Agent Runtime | 2-3 weeks | M1-M2 (end weeks) |
| 4 — Backends | 2-3 weeks | M3 (parallel) |
| 5 — UI + Release | 2-3 weeks | M4 (final) |

**Total Estimated:** 12-16 weeks for full scope

## Rollback & Hotfix Process

If a critical bug is found after release:

1. Create issue in GitHub with `type:hotfix` label
2. Fix in private branch `hotfix/issue-N`
3. Test thoroughly
4. Merge to main + create release tag
5. Publish new APK build

## Success Metrics

By the end of Milestone 5:

- Phone Agent app fully functional for multi-step agent tasks
- Safe approval gates prevent risky actions
- Audit log tracks all activities
- Remote agents can control phone over Tailscale
- Documentation complete and user-tested
- Build automated and reliable
- Security review passed
- Ready for beta testing with trusted users
