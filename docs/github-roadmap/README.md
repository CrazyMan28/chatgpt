# Phone Agent Android App — GitHub Roadmap

**GitHub Repository:** https://github.com/CrazyMan28/phoneagent

**Goal:** Build an Android app that exposes safe AI-agent/MCP-style tools over Tailscale so agents can control a phone only under allowed conditions.

**Status:** Milestone 0 (Audit + Stabilize) — fixing P0 bugs and stabilizing current implementation.

## Project Structure

- `apps/phone-agent/` — Main Android Kotlin/Jetpack Compose project
- `docs/github-roadmap/` — This documentation
- APK output: `apps/phone-agent/app/build/outputs/apk/debug/app-debug.apk`

## Build Commands

```bash
cd apps/phone-agent
./gradlew assembleDebug          # Build debug APK
./gradlew assembleRelease        # Build release APK (requires signing key)
adb install -r app/build/outputs/apk/debug/app-debug.apk  # Install via ADB
```

## Milestones

### Milestone 0 — Audit + Stabilize Current App
- Map current state, list modules
- Fix P0 runtime bugs (compound dispatcher, question resume, multi-tool loop, parser, provider errors)
- Stop regressions
- **Status:** In progress

### Milestone 1 — Safe Phone-Control MVP
- Reliable local app control: screen observation, accessibility tree, tap/type/swipe
- Approval gates, audit logs, emergency stop
- Visible agent-active indicator
- Comprehensive permission setup

### Milestone 2 — MCP/Tailscale Bridge
- Foreground service with persistent notification
- Tailscale-reachable local HTTP/SSE server
- MCP-compatible tool registry
- Bearer token auth + secure middleware

### Milestone 3 — Agent Runtime + Multi-Step Tasks
- Compound task planner and executor
- Question answer resume
- Multi-tool loops without early stopping
- Provider fallback + error classification

### Milestone 4 — Execution Backends
- Termux SSH bridge diagnostics
- SSH agent targets (encrypted credentials, known hosts)
- PRoot/rootfs container setup
- Execution fallback router

### Milestone 5 — UI/UX + Release
- ChatGPT-like mobile UI polish
- Settings screens for all backends
- Complete documentation and install guide
- APK release workflow

## Issues by Priority

**P0 (Critical) — Blocks work:**
- [#1](./issues/1-audit-current-implementation.md) Audit current phone-agent implementation
- [#2](./issues/2-fix-compound-task-dispatcher.md) Fix compound task dispatcher (multi-intent commands)
- [#3](./issues/3-fix-question-answer-continuation.md) Fix question answer continuation
- [#4](./issues/4-fix-multi-tool-agent-loop.md) Fix multi-tool agent loop
- [#5](./issues/5-fix-fuzzy-parser.md) Fix fuzzy parser for messy natural language
- [#6](./issues/6-fix-provider-error-classification.md) Fix provider error classification

**P1 (High) — MVP features:**
- [#7](./issues/7-accessibility-service-hardening.md) Accessibility service hardening
- [#8](./issues/8-accessibility-action-tools.md) Accessibility action tools
- [#9](./issues/9-screen-observation-tool.md) Screen observation tool
- [#10](./issues/10-app-list-open-tools.md) App list/open/search/tap/type tools
- [#11](./issues/11-approval-gate-system.md) Approval gate system
- [#12](./issues/12-audit-logging-system.md) Audit logging system
- [#13](./issues/13-emergency-stop.md) Emergency stop / kill switch
- [#14](./issues/14-visible-agent-indicator.md) Visible agent-active indicator

**P2 (Medium) — MCP bridge:**
- [#15](./issues/15-foreground-service.md) Foreground service + persistent notification
- [#16](./issues/16-tailscale-http-sse-server.md) Tailscale-reachable HTTP/SSE server
- [#17](./issues/17-mcp-tool-registry.md) MCP-compatible tool registry
- [#18](./issues/18-auth-middleware.md) Auth token/security middleware
- [#19](./issues/19-remote-mcp-test.md) Remote MCP/client integration test

## Worker Assignment Rules

All new issues should be:
1. Described in markdown files under `docs/github-roadmap/issues/`
2. Created in GitHub with labels and assignment
3. Assigned to specialized agents:
   - **Codex** — Android/Kotlin, runtime loops, tool execution
   - **Cursor** — UI/UX, Compose components, settings screens
   - **Hermes** — SSH/Termux setup, execution backends, fallback logic
   - **Copilot** — Documentation, testing, CI/CD, build workflows

## Branching Rules

- Never push directly to `main`
- Create feature branch: `agent/issue-<N>-short-name`
- Implement ONLY this issue (no scope creep)
- Run build/tests before committing
- Push branch and open PR
- Comment evidence on issue
- Move issue to In Review
- Do not start another issue until this is merged or blocked

## Safety Rules

- **Approval gates:** All phone control is approval-gated by default
- **Audit logs:** Every tool call, approval, question logged with timestamp/worker
- **Sensitive apps blocked:** Banking, payment, password managers, authenticators
- **Fail closed:** If permission missing, action blocked (not attempted silently)
- **Visible indicators:** Agent active status always visible in UI
- **No hidden capture:** Screen observation, accessibility, mic all require explicit user permission and visible indication

## Known Bugs

See [KNOWN_BUGS.md](./KNOWN_BUGS.md) for detailed P0 bugs with failing examples.

## Labels

- `area:*` — Code area (android, accessibility, screen, mcp, server, auth, etc.)
- `type:*` — Issue type (bug, feature, task, test)
- `priority:p0|p1|p2` — Priority level
- `safety-critical` — Security/safety implications
- `needs-device-test` — Requires real Android device
- `good-first-agent-task` — Beginner-friendly for new workers
- `blocked` — Blocked by another issue

## Resources

- [MILESTONES.md](./MILESTONES.md) — Detailed milestone descriptions
- [ISSUE_INDEX.md](./ISSUE_INDEX.md) — All issues with issue numbers (after creation)
- [KNOWN_BUGS.md](./KNOWN_BUGS.md) — P0 bugs with failing examples
- [WORKER_RULES.md](./WORKER_RULES.md) — Rules for workers (branching, testing, etc.)
- [SAFETY_RULES.md](./SAFETY_RULES.md) — Safety model and approval logic
