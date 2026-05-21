**Title:** Audit current phone-agent implementation and publish roadmap

**Issue Type:** Task

**Priority:** P0

**Milestone:** Milestone 0 — Audit + Stabilize Current App

**Labels:** `type:task`, `priority:p0`, `area:docs`

**Goal:**

Inspect the current Android phone-agent app implementation, document what works, identify gaps, and create a comprehensive public roadmap in GitHub for future work.

**Context:**

This is the foundational issue for Phone Agent. Before fixing bugs or adding features, we must have:
1. Clear understanding of current state (architecture, modules, capabilities)
2. List of known bugs with failing examples
3. Public roadmap with milestones, issues, and acceptance criteria
4. Worker assignment guidelines
5. Branch/PR workflow rules

**Deliverables:**

- [x] GitHub repository created: https://github.com/CrazyMan28/phoneagent
- [ ] Current implementation audit document listing:
  - [ ] 101 Kotlin files organized by feature (UI, core, tools, models, storage, safety, sync)
  - [ ] Main modules: AgentRuntime, LocalAgentWorker, ToolRegistry, TaskQueue, PhoneCommandParser, ApprovalManager, QuestionManager
  - [ ] Working features: Chat UI, Mistral provider, screen observation, accessibility tree, approval system, question system, execution backends (Termux, SSH, PRoot)
  - [ ] Partial/scaffolded features: Local model inference backend, MCP bridge, continuous screen watch, provider fallback
  - [ ] Known bugs: 5 P0 bugs documented with failing examples
- [ ] GitHub roadmap documentation created under `docs/github-roadmap/`:
  - [ ] README.md — Overview, build commands, milestone summary, issue index, labels, rules
  - [ ] KNOWN_BUGS.md — P0 bugs with failing test cases and root causes
  - [ ] MILESTONES.md — Detailed description of each milestone goal
  - [ ] ISSUE_INDEX.md — All issues after creation (issue numbers + titles)
  - [ ] WORKER_RULES.md — Branching, testing, PR submission rules
  - [ ] SAFETY_RULES.md — Safety model, approval logic, audit requirements
  - [ ] issues/ — Individual issue markdown files (ready to paste into GitHub)
- [ ] GitHub issue #1 created in phoneagent repo with link to roadmap
- [ ] Milestones created (6 total) in GitHub or documented in MILESTONES.md
- [ ] Labels created (27 total) in GitHub
- [ ] All P0 issues created in GitHub (#2-#6)

**Affected Files/Modules:**

Core modules audited:
- `core/AgentRuntime.kt` (1800+ lines) — Main agent orchestration and loop
- `core/LocalAgentWorker.kt` — Model communication wrapper
- `core/PhoneCommandParser.kt` (639 lines) — Command parsing
- `core/ToolRegistry.kt` — Tool registration and discovery
- `core/TaskQueue.kt` — Task state management
- `core/ApprovalManager.kt` — Approval gates and chains
- `core/QuestionManager.kt` — Question/answer system
- UI screens (18 total) — Chat, Settings, Developer Tests, etc.
- Provider modules: `MistralProvider.kt`, `HttpChatProviders.kt`, `LocalModelProvider.kt`
- Tool modules: FileTools, PhoneTools, SSHTools, TermuxTools, ContainerTools
- Safety modules: `RiskClassifier.kt`, `SafetyPolicy.kt`

**Acceptance Criteria:**

- [ ] Audit summary document created (see Deliverables above)
- [ ] README.md complete with all sections filled
- [ ] KNOWN_BUGS.md lists all 5 P0 bugs with failing examples and root causes
- [ ] MILESTONES.md describes all 6 milestones with goals and estimated scope
- [ ] WORKER_RULES.md explains branching strategy, PR process, testing requirements
- [ ] SAFETY_RULES.md documents approval model, audit requirements, fail-closed behavior
- [ ] GitHub labels created (27 total): area:*, type:*, priority:*, safety-critical, needs-device-test, good-first-agent-task, blocked
- [ ] GitHub milestones created (6 total) or documented in roadmap
- [ ] Individual issue markdown files created for all planned issues (35+ issues)
- [ ] All P0 issues (#2-#6) created in GitHub with:
  - [ ] Correct labels (priority:p0, area:*, type:bug)
  - [ ] Failing test cases in description
  - [ ] Affected files listed
  - [ ] Acceptance criteria checkboxes
  - [ ] Safety rules section
- [ ] Issue #1 updated with links to roadmap and all P0 issues

**Out of Scope:**

- Do not fix any bugs (issues #2-#6 are separate tasks)
- Do not rewrite any code
- Do not delete or move current work
- Do not add new features beyond documenting current state

**Safety Rules:**

- No credentials committed to repo
- No sensitive paths exposed in documentation
- Roadmap reflects honest, current state (no false claims of working features)

**Build/Test Commands:**

```bash
cd apps/phone-agent
./gradlew assembleDebug  # Verify build still works
```

**Evidence Required:**

Comment on issue with:
```
## Audit Complete ✓

### Deliverables Created
- [x] docs/github-roadmap/README.md — Overview and milestones
- [x] docs/github-roadmap/KNOWN_BUGS.md — P0 bugs (5 total)
- [x] docs/github-roadmap/MILESTONES.md — Milestone details
- [x] docs/github-roadmap/WORKER_RULES.md — Branch/PR rules
- [x] docs/github-roadmap/SAFETY_RULES.md — Safety model
- [x] docs/github-roadmap/issues/*.md — Individual issue files

### GitHub Setup
- [x] Labels created (27 total)
- [x] Milestones created (6 total)
- [x] P0 issues created (#2-#6)
- [x] GitHub URLs verified

### Current Implementation Summary
- 101 Kotlin files in 8 main feature areas
- 6 key core modules (Agent, Parser, Tools, Tasks, Approvals, Questions)
- 5 P0 bugs identified and documented
- 35+ planned issues across 5 Milestones

## Roadmap Link
https://github.com/CrazyMan28/phoneagent/docs/github-roadmap/README.md
```

**Agent Suggestion:** Copilot (documentation + organization)

**Branch:** `agent/1-audit-roadmap`
