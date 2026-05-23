# Phone Agent Architecture

`apps/phone-agent` is a native Android phone agent with a ChatGPT/Claude/Gemini-style chat surface plus explicit phone tools. It is separate from the desktop TUI and keeps Android permissions visible.

## Runtime

- Storage: Room sessions, events, tasks, approvals, questions, memory.
- Prompt: `PhoneAgentPrompts.kt` defines the phone-native role, safety rules, tool protocol, Minecraft flow, phone-control flow, container rules, and voice behavior.
- Chat loop: system prompt, recent messages, available tools, subsystem status, worker mode, pending approvals/questions, selected model route, max 8 steps.
- Protocol: JSON `tool_call`, `question`, `approval_request`, `worker_route`, and `final`. Plain text or invalid JSON becomes a normal assistant bubble.
- Safety: registry validation, risk classification, approval cards, duplicate approval suppression, automatic retry after approval, and visible tool result cards.
- Routing: phone-local, laptop, server, or hybrid. Heavy build work should route remote when phone/container capability is missing.

## UI

Main tabs:

- Chat
- Tasks
- Tools
- Files
- Settings

Secondary screens:

- Sessions
- Console
- Device Control
- Models
- Mistral Settings
- Local Model Settings
- Runtime Settings
- Container Settings
- Termux Bridge Settings
- SSH Agent Settings
- Execution Fallback Settings
- Voice
- Assistant Mode
- Container
- MCP
- Approvals
- Questions
- Developer Tests
- Details sheet

Chat includes status chips for worker, model route, voice, screen, accessibility, and remote connection; user/assistant bubbles; tool/approval/question cards; animated assistant avatar states; text input; send, mic, tools, file, screen observe, and stop-voice controls.

## Tool Groups

Implemented registry entries:

- Files: `file_list`, `file_read`, `file_write`, `file_mkdir`, `file_delete_safe`, `file_search`, picker blockers.
- Shell: `shell_exec`, `shell_status`, `shell_stop`, `shell_logs`.
- Container: `container_status`, `container_import_proot`, `container_import_rootfs`, `container_download_assets`, `container_extract_rootfs`, `container_test`, `container_exec`, `container_stop`, `container_logs`, `container_clear`.
- Termux bridge: `termux_status`, `termux_test_connection`, `termux_exec`, `termux_install_hint`, `termux_logs`.
- SSH agent: `ssh_list_targets`, `ssh_test_connection`, `ssh_exec`, `ssh_read_file`, `ssh_write_file`, `ssh_status`, `ssh_logs`.
- Execution fallback: `execution_route_status`, `execution_choose_runtime`, `execution_run_command`.
- Android apps: `phone_list_apps`, `phone_open_app`, `phone_app_status`.
- Accessibility: `phone_accessibility_status`, `phone_accessibility_tree`, `phone_find`, `phone_focus`, `phone_tap_node`, `phone_type`, `phone_back`, `phone_home`, `phone_recents`, `phone_swipe`, `phone_read_active_app`.
- Screen: `phone_screen_status`, `phone_screenshot`, `phone_screen_observe`, `phone_screen_describe`, `phone_screen_watch`.
- Voice: `voice_status`, `voice_start_listening`, `voice_stop_listening`, `voice_transcribe_once`, `voice_speak`, `voice_set_provider`.
- Assistant: `assistant_status`, `assistant_open`, `assistant_set_mode`, `assistant_start_voice`, `assistant_stop_voice`, `assistant_show_bubble`, `assistant_hide_bubble`.
- Model: `model_status`, `model_chat`, `model_switch`.
- Remote: `remote_status`, `remote_list_sessions`, `remote_open_session`, `remote_send_message`, `remote_run_task`.
- MCP: `mcp_status`, `mcp_remote_status`, `mcp_local_status`, `mcp_list`, `mcp_call`, `mcp_start_local`, `mcp_stop_local`.

Every tool result records success, summary, details, stdout/stderr, exit code, error type/message, approval id when blocked, worker, and timestamp.

## Files And Shell

Default workspace:

```text
<app files>/workspace
```

SAF folders persist URI permissions and operations stay inside the selected tree. Shell commands run with `/system/bin/sh -c` in the app-private workspace and capture stdout, stderr, exit code, and timeout.

## PRoot Container

Container setup supports:

- User-imported PRoot binary through Android document picker.
- User-imported rootfs tarball through Android document picker.
- Optional user-provided download URLs plus optional SHA-256.
- Rootfs extraction into app-private storage.
- Real `container_test`.
- Real `container_exec` when assets and Android execution policy allow it.

Paths:

```text
<app files>/containers/default/bin/proot
<app files>/containers/default/rootfs/
<app files>/workspace/
```

Execution:

```text
proot -R <rootfs> -w /root -b <workspace>:/workspace /bin/sh -lc "<command>"
```

If `-R` fails, the runtime retries:

```text
proot -r <rootfs> -w /root -b <workspace>:/workspace /bin/sh -lc "<command>"
```

`container_test` runs:

```text
uname -a || cat /etc/os-release || echo ok
```

`container_exec` is enabled only when PRoot exists, rootfs exists, `/bin/sh` exists, and the test command passed. Status distinguishes proot missing/present/executable/blocked, rootfs missing/present/extracted/invalid, shell found/missing, workspace bind, last test pass/fail, exact stderr, duration, timeout, and invocation.

Normal APKs can fail here even with valid assets because Android/OEM policy can block executing imported app-private binaries. When that happens, the APK marks built-in PRoot blocked and points the user to Termux bridge, SSH agent, or laptop/server workers.

## Termux Bridge

Termux fallback is configured under Settings > Runtime / Execution > Termux Bridge.

Supported mode today is Termux SSH localhost:

```sh
pkg update
pkg install openssh proot-distro
passwd
sshd
```

The Phone Agent connects only to the user-entered host, port, username, and auth settings. The default host is `127.0.0.1` and the common Termux SSH port is `8022`. Passwords and private keys are stored encrypted. If Termux is missing, setup instructions are shown and the app does not fail.

Intent/plugin bridge support is documented as a future path only if a stable documented Termux API is practical; the app does not rely on undocumented hacks.

## SSH Agent

SSH fallback is configured under Settings > Runtime / Execution > SSH Agent.

Targets include name, host/IP, port, username, auth type, private key import, known host fingerprint, working directory, default shell, and capability toggles for shell, files, container/proot, build jobs, MCP, and long tasks. A working SSH target can be registered as a worker with type `ssh` and those configured capabilities.

Security rules:

- Credentials are encrypted with Android Keystore-backed storage.
- Passwords and private keys are not logged.
- A saved known host fingerprint must match or the command fails.
- If no fingerprint is pinned, the UI and tool output show a warning.
- The app does not brute force, scan networks, or connect to unconfigured targets.
- Risky SSH execution is approval-gated.

## Execution Fallback

The default command/build order is:

```text
1. app shell
2. built-in PRoot
3. Termux bridge
4. SSH agent
5. laptop/server orchestrator
```

`shell_exec` now uses the fallback route for command execution. For each run the result records selected runtime, selection reason, every fallback attempt, stdout/stderr, exit code, and final success/failure. Remote orchestrator requests are not counted as command success unless a remote tool result proves the command completed.

For Minecraft mod builds the runtime asks platform, version, language, behavior, and worker target first. If phone is selected, it checks Java/Gradle availability in the selected runtime before building. If tools are missing, it asks whether to install tools, switch fallback, or create files only.

## Accessibility

The AccessibilityService must be manually enabled. It serializes useful nodes with path, text, content description, class name, package, bounds, clickable/editable/enabled/focused/focusable/scrollable flags. Actions can target node path or text.

Modes:

- Readonly: observe only.
- Approve: actions are approval-gated.
- Autopilot: requires an explicit session grant.

Sensitive apps such as banking, wallet/payment, password manager, and authenticator packages are blocked from automatic tap/type/swipe.

## Screen Capture

MediaProjection capture is real and visible:

- Android system prompt is required.
- Foreground service runs for one screenshot.
- PNG is saved under app cache.
- Tool status returns path, width, height, timestamp.

`phone_screen_observe` combines screen capture metadata, active app, and accessibility tree summary. `phone_screen_describe` is honest: it reports screenshot metadata/accessibility unless an explicit vision-capable route is added. No screenshot is uploaded automatically.

## Voice

Android-native voice support:

- `RECORD_AUDIO` permission.
- SpeechRecognizer push-to-talk one-shot STT from visible mic controls.
- TextToSpeech replies/status when enabled.
- Provider abstraction for Android, custom API fields, and Mistral audio unavailable status.
- Rate/pitch controls and voice list when Android TTS exposes voices.

The tool registry blocks hidden `voice_transcribe_once`; the real STT path is the visible Chat/Voice/Assistant mic button.

## Assistant Mode

Implemented:

- `AssistantActivity` for lightweight assistant UI.
- ACTION_ASSIST intent filter.
- Share sheet / selected text entry through SEND and PROCESS_TEXT.
- `VoiceInteractionService` and session service declarations so Android/OEM settings may list Phone Agent as a default assistant candidate.
- Quick settings tile that opens AssistantActivity.
- Visible overlay bubble service after overlay permission. Tap opens AssistantActivity; long press hides it.

Limits:

- Default assistant behavior is Android/OEM-dependent.
- Power button/home long-press behavior is not guaranteed.
- Always-on arbitrary wake phrase is not implemented. No hidden mic listener starts.

## Models

Mistral settings live at Settings > AI Providers > Mistral API. The key is stored via Android Keystore-backed encrypted storage and never logged in full. Base URL defaults to `https://api.mistral.ai/v1`. Chat model, custom model, optional vision model, max tokens, temperature, and timeout are configurable. Test connection sends a tiny chat request and reports configured, missing key, invalid key, network error, or model error.

Local model settings live at Settings > AI Providers > Local Model. Imported files can be tracked, selected, and deleted. Supported future formats are GGUF/llama.cpp, ONNX, and LiteRT/TFLite when a real backend is linked. No llama.cpp/GGUF, ONNX Runtime Mobile, LiteRT/TFLite, or JNI backend is linked in this APK, so local inference is unavailable and reported honestly as `Local inference backend not linked yet.` Test prompt fails with `Model file exists, but no runtime backend is available.`

Mistral vision/audio are not faked. Vision upload is not automatic. Mistral STT/TTS are marked unavailable unless a real audio endpoint is implemented later.

## MCP

Phone core tools are built in and do not depend on MCP. Remote MCP should route through the laptop/server orchestrator. Local MCP requires a passing container test plus a future JSON-RPC stdio/http bridge; this APK reports that blocker instead of faking a running MCP server.

## Remote Continuity

The phone client uses:

- `GET /status`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{id}`
- `POST /sessions/{id}/input`
- `GET /sessions/{id}/questions`
- `POST /sessions/{id}/questions/{questionId}/answer`
- `POST /sessions/{id}/questions/{questionId}/skip`
- `POST /sessions/{id}/questions/{questionId}/cancel`
- `GET /tasks`
- `GET /approvals`
- `POST /approvals/{id}/approve`
- `POST /approvals/{id}/reject`
- `GET /workers`
- `POST /auth/pairings`

Use `http://10.0.2.2:4017` in an emulator and a LAN/Tailscale IP on a real phone. Offline daemon failures remain offline-safe.

## Developer Tests

Tools > Developer Tests includes:

- Core: Mistral chat, file write/read, shell exec, question card, approval card.
- Provider/runtime: Mistral key, local model status, built-in PRoot, Termux SSH, SSH target, fallback order, fallback command.
- Container: status, import proot/rootfs picker buttons, test, exec.
- Phone control: list apps, open Settings, missing app, accessibility status/tree, back/home/recents.
- Screen: MediaProjection permission button, screenshot, observe, describe.
- Voice: mic permission/status, real STT once, real TTS speak, voice agent query.
- Assistant: AssistantActivity, floating bubble, default assistant status/instructions, quick launch/intent, wake phrase status.
- Remote: orchestrator status, list sessions, send message, questions, approvals.

Each test produces visible cards/status with pass/fail, exact error, output, or details.

## Verification Commands

```sh
cd apps/phone-agent
./gradlew assembleDebug
ls -l app/build/outputs/apk/debug/app-debug.apk
adb devices
```

ADB install/launch are optional and require a connected device:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.kizek.phoneagent 1
```

Desktop TUI checks from repo root:

```sh
npm run build --workspace @chatgpt-code/tui
npm run start --workspace @chatgpt-code/tui
```

## Still Requires Phone Runtime Testing

- Android permission prompts: mic, accessibility, MediaProjection, overlay, default assistant.
- Imported PRoot/rootfs compatibility and Android execution policy.
- Real SpeechRecognizer availability and Android TTS voice list.
- OEM default-assistant listing and quick-settings tile availability.
- Real remote daemon URL from LAN/Tailscale.
- Termux SSH username/auth and localhost reachability.
- SSH target credentials, host fingerprint, shell, working directory, and capability toggles.
