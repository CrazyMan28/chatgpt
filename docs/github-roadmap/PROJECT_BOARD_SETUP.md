# GitHub Project Board Setup — Phone Agent

**Project Name:** Phone Agent Android App — Development Pipeline

**URL:** https://github.com/users/CrazyMan28/projects/

## Project Board Overview

The project board uses a 3-column Kanban workflow to track issues from creation through completion with human verification at each stage.

## Columns

### 1. **📋 Open** (Backlog)
**When Issues Go Here:**
- All new issues start here when created
- Unassigned or awaiting prioritization
- Ready to be picked up by a worker

**Worker Action:**
- Read the issue completely
- Check dependencies (Blocked By)
- Review acceptance criteria
- If ready to work: Move to In Progress

**Example Issues:**
- "Fix compound task dispatcher"
- "Fix question answer continuation"
- "Accessibility service hardening"

---

### 2. **🔨 In Progress** (Active Work)
**When Issues Move Here:**
- Worker assigned and starting work
- Branch created: `agent/N-short-name`
- Active development in progress

**Worker Responsibilities:**
- Update issue comment: "Started work on {date}"
- Commit frequently to branch
- Run build tests regularly
- Post progress updates on issue if > 1 day
- Do NOT work on multiple issues simultaneously

**Example Status Comment:**
```
## Work Started ✓

Started: 2026-05-21T14:00:00Z
Branch: agent/5-compound-task
Status: Investigating agent loop logic
Next: Implement step continuation

Last Update: [date] — working on compound plan parsing
```

---

### 3. **✅ Done** (Completed & Verified)
**When Issues Move Here:**
- PR merged to main
- All acceptance criteria verified on device
- Approved by code reviewer (Copilot/Codex/Cursor)
- Issue closed with completion evidence

**Completion Checklist:**
- [ ] Code merged to main
- [ ] Build succeeds: `./gradlew clean assembleDebug`
- [ ] Manual device test passed
- [ ] Acceptance criteria: all checked
- [ ] PR linked in issue comments
- [ ] No regressions observed
- [ ] Audit log (if applicable) working

**Example Completion Comment:**
```
## Issue Complete ✓

### Evidence
- PR: #123 merged to main
- Device Test: PASS (Issue #5 compound task)
- Build: clean assembleDebug ✓
- Test Cases: 3/3 PASS

### Details
✓ "look at my screen and open youtube" → Both steps run
✓ Question answered → task resumes
✓ Multi-tool chain → all tools execute

Closed by: agent/5-compound-task-dispatcher
```

---

## Workflow

### Step 1: Issue Created → Open Column

```
GitHub Issue Created (#5: "Fix compound task dispatcher")
↓
Status: OPEN (Backlog)
Assignment: Unassigned
Ready: Yes (if all dependencies resolved)
```

### Step 2: Worker Assigned → Move to In Progress

```
Codex Agent reviews issue #5
↓
Accepts assignment
↓
Creates branch: agent/5-compound-task
↓
Move Issue to: IN PROGRESS
↓
Post Comment: "Started work on {date}"
```

### Step 3: Active Development → Updates & Testing

```
Implement fix in branch agent/5-compound-task
↓
Run: ./gradlew clean assembleDebug (daily)
↓
Commit frequently with clear messages
↓
Post progress on issue (if blocked or > 1 day)
↓
Test on real device regularly
```

### Step 4: Ready for Review → Create PR

```
Finish implementation
↓
Rebase: git rebase origin/main
↓
Build final: ./gradlew clean assembleDebug
↓
Push: git push origin agent/5-compound-task
↓
Create PR on GitHub
↓
Post PR link in issue comment
```

### Step 5: Code Review & Verification → Done Column

```
Copilot/Codex reviews PR
↓
Reviews acceptance criteria
↓
Runs manual device test
↓
APPROVED ✓
↓
Merge to main
↓
Move Issue to: DONE
↓
Close Issue with evidence comment
```

---

## Manual Setup Instructions

Since GitHub CLI doesn't support Projects API yet, you must create the project board manually:

### Create Project Board (Manual)

1. Visit: https://github.com/CrazyMan28/phoneagent
2. Click: **Projects** tab
3. Click: **New project** (top right)
4. Select: **Table** or **Board** view
5. Name: **Phone Agent — Development Pipeline**
6. Description: **Kanban board tracking issues from Open → In Progress → Done**
7. Template: **Blank project** (start empty)
8. Click: **Create project**

### Configure Columns (Manual)

1. In new project, click: **Add column** (right side)
2. Column 1:
   - Name: **📋 Open**
   - Type: Backlog (if available) or Status
   - Description: "Issues ready for work or awaiting assignment"
3. Column 2:
   - Name: **🔨 In Progress**
   - Type: In Progress (if available)
   - Description: "Active development in branch"
4. Column 3:
   - Name: **✅ Done**
   - Type: Done (if available)
   - Description: "Merged to main, verified, closed"

### Add Issues to Project (Manual)

1. Open Project board
2. Click: **Add items** or **Add from repository**
3. Select all 9 issues (#1-9, or just P0 bugs #5-9)
4. Add to: **📋 Open** column

### Automate Issue Linking (Optional)

In project settings, enable:
- "Link issues automatically when added to pull requests"
- "Automatically update issues when commits reference them"

---

## Project Board Management Rules

### For Workers
- ✅ **DO**: Check project board before starting work
- ✅ **DO**: Move issue to In Progress when starting
- ✅ **DO**: Update status comment every 24 hours if > 1 day
- ✅ **DO**: Move to Done when PR merged and verified
- ❌ **DON'T**: Leave issues in In Progress when not working
- ❌ **DON'T**: Work on multiple issues simultaneously
- ❌ **DON'T**: Close issue until merged and verified

### For Reviewers (Copilot/Codex)
- ✅ **DO**: Review PRs for issues in In Progress
- ✅ **DO**: Verify acceptance criteria before approving
- ✅ **DO**: Test on device before approving risky changes
- ✅ **DO**: Approve and move to Done when verified
- ❌ **DON'T**: Approve without testing on device (P0 bugs)
- ❌ **DON'T**: Merge PRs that fail build

### For Project Owner
- ✅ **DO**: Regularly review Open issues for blockers
- ✅ **DO**: Unblock issues that are stalled
- ✅ **DO**: Prioritize issues based on dependencies
- ✅ **DO**: Archive old completed issues to keep board clean
- ❌ **DON'T**: Create duplicate issues
- ❌ **DON'T**: Close issues without verification

---

## Current Board Status

### 📋 Open Issues (9 total)
- #1: Audit current implementation
- #2: Fix compound task dispatcher (duplicate)
- #3: Fix question answer continuation (duplicate)
- #4: Audit current implementation (duplicate)
- #5: Fix compound task dispatcher ← **START HERE**
- #6: Fix question answer continuation ← **NEXT**
- #7: Fix multi-tool agent loop ← **PARALLEL**
- #8: Fix fuzzy parser ← **PARALLEL**
- #9: Fix provider error classification ← **PARALLEL**

### 🔨 In Progress Issues
*(None yet — waiting for first assignment)*

### ✅ Done Issues
*(None yet — work hasn't started)*

---

## Next Steps

1. **Create GitHub Project board** (manual, see instructions above)
2. **Add all 9 issues** to the board in "Open" column
3. **Assign Issue #5** to Codex Agent
4. **Codex moves #5** to "In Progress" and starts work
5. **Monitor project board** for progress updates
6. **Review PR** when submitted (in In Progress)
7. **Move to Done** when merged and verified on device

---

## Templates for Issue Comments

### Status Update (In Progress)

```markdown
## Progress Update

**Status:** In Progress
**Branch:** agent/N-short-name
**Last Update:** {date}

### Completed
- [ ] Task 1
- [ ] Task 2

### Current Work
- Working on: [description]
- Blocker: [if any]

### Next Steps
- [ ] Next task
- [ ] Testing

ETA: [estimated date]
```

### Completion Evidence (Ready for Done)

```markdown
## Implementation Complete ✓

**PR:** #XXX (link)
**Status:** Ready for review

### Acceptance Criteria
- [x] Requirement 1
- [x] Requirement 2
- [x] Requirement 3

### Testing Evidence
- ✓ Build: clean assembleDebug
- ✓ Device test: PASS
- ✓ Test case 1: PASS
- ✓ Test case 2: PASS

### Safety Verification
- [x] No credentials committed
- [x] Audit logs working
- [x] No new dangerous permissions

Commit: abc123def
```

---

## Success Metrics

The project board is working well when:
- ✅ All new issues start in "Open"
- ✅ Workers move issues to "In Progress" within 1 day of assignment
- ✅ "In Progress" issues have update comments every 24 hours (if > 1 day)
- ✅ "In Progress" issues move to "Done" within 5-7 days (for P0 bugs)
- ✅ All "Done" issues are merged, tested, and verified
- ✅ No duplicate issues in multiple columns

---

## Escalation & Blockers

If an issue is stuck in "In Progress" > 3 days:
1. Comment on issue: "@Copilot review blocker"
2. Describe the blocker in issue comment
3. Ask for code review or pair programming
4. Consider: Is this blocking other work?
5. If blocked → move back to Open or mark "blocked" label

---

## Archive & Cleanup

Once per month:
1. Archive completed issues that are > 2 weeks old
2. Close duplicate issues (like #2-4)
3. Review Open issues for stale/duplicate items
4. Update project board description if process changes

---

## Links

- **Project Board:** [Create manually per instructions above]
- **Issues:** https://github.com/CrazyMan28/phoneagent/issues
- **Roadmap:** https://github.com/CrazyMan28/phoneagent/tree/main/docs/github-roadmap
- **PR:** https://github.com/CrazyMan28/phoneagent/pulls
