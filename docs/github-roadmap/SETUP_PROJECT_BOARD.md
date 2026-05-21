# Quick Setup: GitHub Project Board

**Project Name:** Phone Agent — Development Pipeline

## 5-Minute Setup

### Step 1: Create Project Board
1. Go: https://github.com/CrazyMan28/phoneagent
2. Click: **Projects** tab (top menu)
3. Click: **New project** button
4. Select: **Board** template
5. Name: `Phone Agent — Development Pipeline`
6. Click: **Create project**

### Step 2: Configure Columns
Delete default columns and add these 3:

**Column 1: 📋 Open**
- Status: Backlog
- Automated: Newly opened issues

**Column 2: 🔨 In Progress**
- Status: In Progress
- Automated: Issues assigned to a person

**Column 3: ✅ Done**
- Status: Done
- Automated: Issues closed

### Step 3: Add Issues

1. Click: **Add items** in the project
2. Select: Issues #1-9 from dropdown
3. Click: **Add selected**
4. All should appear in **📋 Open** column

### Step 4: Enable Automation (Optional)

In project settings:
- ✓ Auto-add issues when they're opened
- ✓ Auto-move when issues are assigned (to In Progress)
- ✓ Auto-move when issues are closed (to Done)

## Workflow

```
Issue Created in GitHub
  ↓
Auto-adds to Project → 📋 Open column
  ↓
Worker assigned & starts work
  ↓
Auto-moves to 🔨 In Progress column
  ↓
PR submitted, worker updates issue
  ↓
Code reviewer approves, PR merged
  ↓
Worker moves to ✅ Done column
  ↓
Issue closed with evidence comment
```

## Worker Actions

### When Picking Up an Issue:
1. Click issue in **📋 Open** column
2. Assign yourself
3. Create branch: `agent/N-short-name`
4. Post comment: "Started work"
5. Issue auto-moves to **🔨 In Progress**

### When Work is Done:
1. Merge PR to main
2. Post completion evidence on issue
3. Manually move to **✅ Done** column
4. Close issue

### If Stuck:
1. Post comment in issue: "@Copilot help — blocker: [description]"
2. Request code review
3. Don't leave in In Progress > 3 days without update

## Links

- **Issues:** https://github.com/CrazyMan28/phoneagent/issues
- **Pull Requests:** https://github.com/CrazyMan28/phoneagent/pulls
- **Full Setup Guide:** PROJECT_BOARD_SETUP.md

---

**Status:** ✅ Ready to set up project board manually

**Recommendation:** Set up after reviewing roadmap and understanding workflow.
