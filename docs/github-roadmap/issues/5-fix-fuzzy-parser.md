**Title:** Fix fuzzy parser and generic app-control commands

**Issue Type:** Bug
**Priority:** P0
**Milestone:** Milestone 0
**Labels:** `type:bug`, `priority:p0`, `area:parser`, `area:phone-control`

**Goal:**
The parser should handle typos and natural language variations so commands like "open youtuber and serch for iron man" are understood and corrected to "open YouTube and search for iron man edits".

**Failing Test Cases:**
```
"open youtuber and serch for iron man"
→ Expected: YouTube app + search for "iron man"
→ Actual: App not found for "youtuber"

"open chrome and search minecraft fabric setup"
→ Expected: Chrome + search "minecraft fabric setup"
→ Actual: Might pass full text as app name

"search iron man edits in youtube"
→ Expected: Open YouTube, search "iron man edits"
→ Actual: Parsing fails or misinterprets
```

**Root Cause:**
- No fuzzy string matching (Levenshtein distance, etc.)
- No typo correction
- App name extraction too greedy
- No natural language template matching

**Affected Files:**
- `core/PhoneCommandParser.kt` — parseStructured() and app name extraction
- `core/ToolRegistry.kt` — app matching and suggestions

**Acceptance Criteria:**
- [ ] Typo detection: "youtuber" → YouTube, "serch" → search
- [ ] Fuzzy app name matching (Levenshtein or similar)
- [ ] Multi-word commands split correctly
- [ ] Intent extraction: OPEN_APP, APP_SEARCH, APP_TYPE, APP_TAP
- [ ] No model required for basic phone commands
- [ ] "app not found" includes fuzzy match suggestions
- [ ] All 5 test cases above PASS

**Evidence to Comment:**
```
✓ Test 1: "open youtuber..." → YouTube recognized
✓ Test 2: "open chrome and search..." → Chrome + search
✓ Test 3: "search iron man edits in youtube" → YouTube search
✓ Build: clean assembleDebug
```

**Agent Suggestion:** Codex

**Branch:** `agent/5-fuzzy-parser`
