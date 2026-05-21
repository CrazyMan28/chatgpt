# Safety Rules for Phone Agent

Phone Agent exposes powerful phone-control capabilities. This document defines how the app enforces safety and privacy.

## Core Safety Model

### 1. Fail-Closed Behavior

**All phone control actions default to blocked unless explicitly approved.**

- Screen observation: Requires MediaProjection permission grant + visible foreground notification
- Accessibility tree read: Requires accessibility service enable + explicit app permission check
- Accessibility actions (tap/type/swipe): Require approval UNLESS marked as "readonly"
- File operations: Require workspace boundaries + approval for non-workspace paths
- Command execution: Require approval unless deterministic/safe
- SSH/Termux: Require credentials stored + test connection first

**Never:**
- Silently attempt a risky action without approval
- Fall back to a less-restrictive method if blocked
- Log full credentials or sensitive data
- Execute unchecked user input as shell commands

### 2. Approval Gates

Every tool call has a risk classification:

| Risk | Action | Approval | Logging |
| --- | --- | --- | --- |
| **readonly** | Screen observe, list apps, read workspace files | None | Yes |
| **low** | Back, home, recents, read permitted files | Once per task | Yes |
| **medium** | Open app, search in app, tap/type/swipe | Once per session | Yes |
| **high** | SSH exec, shell exec, PRoot exec, file delete | Once + re-confirm | Yes |
| **critical** | Access banking/auth apps, system files | Block + log | Yes |

### 3. Sensitive App Blocks

These apps cannot be controlled by the agent, even with approval:

- Banking apps (Chase, Bank of America, Wells Fargo, etc.)
- Payment apps (Venmo, PayPal, Apple Pay, Google Pay)
- Password managers (1Password, Bitwarden, LastPass, Dashlane)
- Authenticators (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- Health/Medical apps (if device-specific; user configurable)

**In code:**

```kotlin
private val BLOCKED_APP_PATTERNS = listOf(
    "bank", "payment", "paypal", "venmo", "stripe",
    "authenticator", "google", "microsoft", "authy",
    "1password", "bitwarden", "lastpass",
    "health", "medical" // configurable by user
)
```

### 4. Visible Agent Status

Users must always know when the agent is active and accessing phone capabilities.

**Implementation:**
- Foreground service with persistent notification showing "Phone Agent Active"
- Notification includes: current task, active approvals, emergency stop button
- Screen observation: Red circle indicator in UI or system overlay (if permitted)
- Accessibility service active: Indicator in notification
- Command execution: Status update in chat UI

**Never hide:**
- Background screen observation (not implemented; honestly stated in docs)
- Hidden accessibility access (all state changes visible)
- Background network calls without notification (foreground service required)

### 5. Audit Logging

Every significant event is logged with:
- Timestamp
- Event type (tool_called, tool_result, approval_granted, approval_rejected, question_asked, question_answered, error)
- User/worker (if applicable)
- Tool name and args (sanitized)
- Result/outcome
- Risk classification
- Duration

**Audit log entry format:**

```json
{
  "timestamp": "2026-05-21T14:32:15Z",
  "event": "tool_called",
  "task_id": "abc123",
  "tool": "phone_open_app",
  "args": {"app": "youtube"},
  "risk": "medium",
  "requires_approval": true,
  "approval_status": "pending",
  "worker": "phone_local"
}
```

**Export:** Users can export full audit log from Settings.

### 6. Authentication & Authorization

**Bearer Token Security:**
- Token stored in Android Keystore (encrypted at rest)
- Token shown only once after generation
- Token rotatable from Settings
- Token expires after 90 days (configurable)
- Invalid token blocks all API access

**Remote Access (Tailscale/MCP):**
- All remote calls require valid bearer token
- Token validated on every request
- Rate limiting: 100 requests/minute per token
- Failed auth attempts logged and counted
- After 5 failed attempts in 10 minutes: block for 1 hour

### 7. Data Privacy

**What is never logged:**
- Full API keys (only "key present: yes/no")
- SSH passwords (only "auth: password/key")
- User chat input with sensitive data (recommend users sanitize)
- Full file contents (only file path and operation)
- Full screenshot data (only accessibility text and bounds)

**What is logged:**
- Tool calls and results (sanitized)
- Approval decisions
- Error messages and stack traces (never include user data)
- Audit trail for all actions

**Audit log retention:**
- Last 30 days stored locally
- Older logs archived to device storage (optional)
- Users can delete logs manually
- No automatic cloud upload (explicit user action only)

### 8. Emergency Stop

**Kill Switch Available:**
- Red "STOP" button prominently in UI
- Hotkey: Long-press volume down (if configured)
- Effect: Immediately cancels running task, clears pending approvals, disables agent for 10 seconds
- Behavior: No questions asked, instant stop
- Logging: Stop event logged with reason "user_stop"

### 9. Update & Rollback

- APK updates signed with same key
- Update notification in app
- Rollback available (previous APK required)
- No forced updates
- Changelog reviewed before install

### 10. Permissions Model

| Permission | Purpose | When Asked | Revocable |
| --- | --- | --- | --- |
| RECORD_AUDIO | STT voice input | On first use of Voice | Yes (settings) |
| CAMERA | Future vision mode | Not yet | N/A |
| READ_EXTERNAL_STORAGE | File workspace | On first use | Yes (settings) |
| WRITE_EXTERNAL_STORAGE | File workspace | On first use | Yes (settings) |
| BIND_ACCESSIBILITY_SERVICE | Phone control | On Device > Setup | Yes (settings) |
| SYSTEM_ALERT_WINDOW | Overlay bubble | On Assistant > Setup | Yes (settings) |
| INTERNET | Remote orchestrator, Mistral API | Always (required) | No |
| FOREGROUND_SERVICE | Persistent agent notification | On first task | No (required) |

**Never requested:**
- GET_ACCOUNTS
- CONTACTS
- CALENDAR
- LOCATION
- PHONE_STATE
- SMS (unless explicitly added for future use)

### 11. Config & Credentials Security

**Secure Storage (Android Keystore):**
- Mistral API keys
- SSH private keys
- SSH passwords
- OpenAI-compatible API keys
- Ollama credentials (if custom auth)
- Bearer tokens for remote access

**Encrypted Shared Preferences:**
- Provider settings (but not keys)
- SSH target metadata
- Orchestrator URL
- User preferences

**Never in plain text:**
- Any credentials
- API keys
- Tokens
- Private keys

### 12. Testing & Validation

**Before Each Release:**
- [ ] No hardcoded credentials in logs or code
- [ ] Audit log works end-to-end
- [ ] Approval gates block risky actions
- [ ] Sensitive apps are blocked
- [ ] Emergency stop works
- [ ] Foreground notification always visible during tasks
- [ ] Build signed with release key
- [ ] No new permissions added without justification

**Denial of Service (DoS) Prevention:**
- Max 12 agent steps per task (configurable)
- Max 60 seconds per model call
- Max 30 second tool timeout
- Rate limiting on remote API calls
- No infinite loops in tool registry

### 13. Known Limitations & Honest Claims

The following are NOT implemented and are not faked:

- [ ] Local model inference (LLaMA, ONNX, TFLite) — backend not linked, status shows honest unavailable message
- [ ] Continuous screen watch (not implemented; one-shot observation only)
- [ ] Automatic vision upload (not implemented; users must explicitly send screenshots)
- [ ] Hidden background operation (not possible; foreground service always visible)
- [ ] Wake word (not implemented; "Hey Phone Agent" is not available)
- [ ] System-level interception (not implemented; accessibility service only)

## Compliance Checklist

For each issue/PR, verify:

- [ ] No credentials hardcoded
- [ ] No silent failures (all errors user-visible)
- [ ] Approval gates work
- [ ] Audit logs added
- [ ] Sensitive apps blocked (if applicable)
- [ ] Foreground notification (if applicable)
- [ ] No new dangerous permissions
- [ ] Error messages are honest (not "working on it" if disabled)
- [ ] Rollback tested (manual)

## Incident Response

If a security issue is discovered:

1. Do not commit to main
2. Create private security issue (if public repo, use GitHub security advisory)
3. Fix in private branch
4. Test thoroughly
5. Patch release with security label
6. Publish advisory with:
   - Issue description
   - Affected versions
   - Mitigation steps
   - Patch version available

## References

- Android Security & Privacy Principles: https://developer.android.com/privacy
- OWASP Mobile Top 10: https://owasp.org/www-project-mobile-top-10/
- Phone Agent Safety Philosophy: See KNOWN_BUGS.md for honest state of implementation
