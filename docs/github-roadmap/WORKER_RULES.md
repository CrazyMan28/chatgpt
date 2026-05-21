# Worker Rules for Phone Agent Project

## Branch Workflow

**Never push directly to main.** Always create a feature branch.

### Creating a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b agent/issue-N-short-name
```

**Branch naming:**
- Format: `agent/N-short-name` (e.g., `agent/2-compound-task`)
- N = GitHub issue number
- short-name = kebab-case summary (2-4 words max)

## Implementing an Issue

### Before Starting

1. Assign the issue to yourself in GitHub
2. Read the full issue description, acceptance criteria, safety rules
3. Check Blocked By and Blocks sections
4. Move issue to "In Progress" (if project board configured)

### During Implementation

1. **Implement ONLY this issue** — no scope creep, no "while I'm here" changes
2. **Follow acceptance criteria exactly** — don't interpret loosely
3. **Run build frequently:**
   ```bash
   cd apps/phone-agent
   ./gradlew clean assembleDebug
   ```
4. **Test on device:**
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   adb shell monkey -p com.kizek.phoneagent 1
   ```
5. **Commit frequently with clear messages:**
   ```bash
   git commit -m "issue-N: Brief description of change"
   ```

### Safety Checks

Before committing:
- [ ] No hardcoded credentials or API keys
- [ ] No debug logging left in (use Log.d but ensure it's removed for production)
- [ ] No unused imports
- [ ] No breaking changes to public APIs
- [ ] All acceptance criteria met
- [ ] Build succeeds: `./gradlew clean assembleDebug`
- [ ] No new runtime errors in device logs: `adb logcat | grep phoneagent`

## Opening a Pull Request

### Before Pushing

```bash
# Ensure you're up to date
git fetch origin main
git rebase origin/main

# Run final build
./gradlew clean assembleDebug

# Push branch
git push origin agent/N-short-name
```

### Creating the PR

1. Visit https://github.com/CrazyMan28/phoneagent
2. GitHub will show a "Compare & pull request" button for your branch
3. Fill in PR title and description:

```markdown
## Issue #N: [Issue Title]

### Implementation Summary
[Describe what you changed and why]

### Files Modified
- app/src/main/java/com/kizek/phoneagent/core/AgentRuntime.kt
- app/src/main/java/com/kizek/phoneagent/core/TaskQueue.kt

### Testing
- [x] Local build: assembleDebug succeeds
- [x] Device test: Installed APK, ran manual tests
- [x] Test case 1: [describe result]
- [x] Test case 2: [describe result]

### Safety Verification
- [x] No credentials committed
- [x] No debug logging left
- [x] Acceptance criteria met
- [x] No new permissions required
- [x] Audit log entries added (if applicable)

### Related Issues
Fixes #N
Depends on #M (if applicable)
Blocks #X (if applicable)
```

## After PR Review

1. **Address feedback:** Make requested changes and push commits to same branch
2. **Move issue to In Review** in project board
3. **Do not merge your own PR** — wait for approval from Copilot/Codex/Cursor
4. **After merge:**
   - Close the issue with comment linking to merged PR
   - Delete feature branch: `git push origin --delete agent/N-short-name`
   - Do not start another issue until this is fully merged

## Handling Blockers

If you get stuck:
1. Comment on the issue with what you've tried and where you're stuck
2. Tag the appropriate agent (@Codex for runtime, @Cursor for UI, etc.)
3. Request code review or pair programming
4. Do not abandon the branch

## Code Style

### Kotlin Conventions

- Use 4-space indentation (Android Studio default)
- Prefer `val` over `var`
- Use meaningful variable names (avoid single letters except iterators)
- Add comments only for non-obvious logic
- Keep functions under 50 lines where practical
- Use data classes for immutable value objects

### Example Commit Message

```
issue-7: Add accessibility action tools for tap/type/swipe

- Implement phone_tap_accessibility tool
- Add approval gating for sensitive actions
- Block access to banking/payment apps
- Add audit log entries per action
- Verify tool args in tool registry

Fixes #7
```

## Testing Requirements by Issue Type

### Bug Fix (type:bug)
- [ ] Failing test case from issue now passes
- [ ] No regressions in related features
- [ ] Manual device test with failing scenario
- [ ] Build succeeds

### Feature (type:feature)
- [ ] All acceptance criteria met
- [ ] Build succeeds
- [ ] Manual device test
- [ ] No new permissions required (or justification added)
- [ ] UI responsive and not blocked
- [ ] Audit logs working (if applicable)

### Task (type:task)
- [ ] Deliverables listed in issue created
- [ ] Documentation accurate
- [ ] Build succeeds
- [ ] No broken references

## Asking for Help

- **Code question?** Comment on the issue
- **Architecture question?** Create a discussion or comment on issue
- **Stuck for > 2 hours?** Tag the appropriate agent and explain

## After Completing an Issue

Comment on the issue with:

```markdown
## Implementation Complete ✓

### Changes
- [List main changes]
- [Affected files]

### Testing
- ✓ Failing test case now passes
- ✓ Build succeeds  
- ✓ Device test: [describe result]
- ✓ No regressions

### PR Link
[Link to merged PR]

Ready to close.
```

## Checklist Before Marking Done

- [ ] Issue requirements met
- [ ] All acceptance criteria checked
- [ ] Build succeeds
- [ ] Device test passed
- [ ] PR merged
- [ ] Feature branch deleted
- [ ] Issue comment with evidence added
