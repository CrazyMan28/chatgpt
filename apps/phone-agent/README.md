# Phone Agent

Native Android Kotlin/Jetpack Compose phone agent for this repo. It is isolated under `apps/phone-agent` and does not replace the desktop TUI/runtime.

## Build APK

```sh
cd apps/phone-agent
./gradlew assembleDebug
```

APK output:

```text
apps/phone-agent/app/build/outputs/apk/debug/app-debug.apk
```

Manual install after copying the APK to a phone: open the APK from Android Files, allow install from that source, then launch **Phone Agent**.

ADB is optional:

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.kizek.phoneagent 1
```

## What Works Now

- Chat-first Compose UI with main tabs: Chat, Tasks, Tools, Files, Settings.
- Secondary screens: Sessions, Console, Device Control, Models, Voice, Assistant Mode, Container, MCP, Approvals, Questions, Developer Tests, Details.
- Strong phone-agent system prompt in `PhoneAgentPrompts.kt`.
- Real chat loop with recent history, subsystem status, model routing, JSON `tool_call` / `question` / `approval_request` / `worker_route` / `final`, max 8 steps, invalid JSON fallback, approval cards, question cards, and tool-result feedback.
- Dedicated Settings panes for AI Providers, Runtime / Execution, Phone Control, Safety / Approvals, and Developer Tests.
- Mistral chat via the configured OpenAI-compatible Mistral base URL when an API key is saved.
- App-private workspace and optional SAF-selected workspace.
- File tools, `/system/bin/sh` shell tools, app listing/opening, accessibility tree/control tools, MediaProjection screenshot status/observe, Android STT/TTS UI, assistant activity, visible overlay bubble, quick settings tile, and remote orchestrator calls.
- Built-in PRoot setup plus Termux SSH, SSH agent, and execution fallback configuration.
- Minecraft mod flow asks platform, version, Java/Kotlin, behavior, and worker target before attempting build work.

## Setup

### Mistral

Open Settings > AI Providers > Mistral API:

1. Enter a Mistral API key.
2. Keep the default base URL `https://api.mistral.ai/v1` or enter a compatible endpoint.
3. Choose `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest`, or a custom chat model.
4. Optionally record a vision model.
5. Set max tokens, temperature, and timeout.
6. Tap Test connection.

The key is encrypted with Android Keystore-backed storage, shown only as masked text, and never logged in full. Test status distinguishes configured, missing key, invalid key, network error, and model error. Chat runtime uses these saved settings.

### Android STT/TTS

Open Tools > Voice:

1. Keep STT provider as Android SpeechRecognizer.
2. Keep TTS provider as Android TextToSpeech.
3. Grant `RECORD_AUDIO` from the mic button or Test STT.
4. Use Test STT and Test TTS.

Mistral audio is marked unavailable unless a real audio endpoint is implemented. Custom STT/TTS endpoint fields are stored for future integration; they are not silently called.

### Accessibility

Open Tools > Device > Setup, enable **Phone Agent Control**, then return.

The service can read the active window tree and perform approved actions. Tap/type/swipe/open-app actions are approval-gated. Banking, payment, password-manager, and authenticator apps are blocked from automatic control.

### Screen Capture

Open Settings or Developer Tests and tap Capture screenshot. Android shows the MediaProjection prompt and the app starts a visible foreground service for one screenshot. Results include path, width, height, and timestamp. There is no hidden capture and no continuous watch in this build.

### PRoot Container

Open Settings > Runtime / Execution > Built-in PRoot or Tools > PRoot:

1. Import an ABI-matched Android `proot` binary, or provide a trusted URL plus optional SHA-256.
2. Import a Linux rootfs `.tar`, `.tar.gz`, or `.tgz`, or provide a trusted URL plus optional SHA-256.
3. Tap Extract if a tarball was downloaded but not extracted.
4. Tap Run test.

Storage paths:

```text
<app files>/containers/default/bin/proot
<app files>/containers/default/rootfs/
<app files>/workspace/
```

Execution:

```text
proot -R <rootfs> -w /root -b <workspace>:/workspace /bin/sh -lc "<command>"
```

If `-R` fails, the app retries with `-r`. `container_exec` is enabled only when PRoot exists, rootfs exists, `/bin/sh` exists, and the real test command passes:

```text
uname -a || cat /etc/os-release || echo ok
```

If Android blocks imported binary execution, the exact chmod/exec/stderr is shown and `container_exec` remains blocked. Normal APKs can hit this on stock Android because device policy, mount flags, SELinux, or OEM hardening may prevent executing imported app-private binaries. Use Termux bridge, SSH agent, or a laptop/server worker instead.

### Termux Bridge

Open Settings > Runtime / Execution > Termux Bridge.

Mode A is Termux SSH localhost:

1. Install Termux.
2. In Termux:

   ```sh
   pkg update
   pkg install openssh proot-distro
   passwd
   sshd
   ```

3. Use host `127.0.0.1` or `localhost`.
4. Use port `8022` unless Termux reports a custom port.
5. Enter the Termux username and password or private key.
6. Tap Test connection or Test command.

Mode B, an intent/plugin bridge, is not relied on unless a practical documented Android/Termux API is available. If Termux is not installed, the app shows setup instructions and keeps running.

Tools: `termux_status`, `termux_test_connection`, `termux_exec`, `termux_install_hint`, and `termux_logs`.

### SSH Agent

Open Settings > Runtime / Execution > SSH Agent.

Add explicit targets such as `Termux phone shell`, `Laptop`, or `R710 server` with host/IP, port, username, auth type, working directory, default shell, known host fingerprint, and capability toggles. Passwords and private keys are encrypted with Android Keystore-backed storage and never logged. The app does not scan networks, brute force, or connect to anything you did not configure.

Pin the known host fingerprint when possible. If no fingerprint is saved, SSH tests show a warning; if a saved fingerprint mismatches, execution fails.

Tools: `ssh_list_targets`, `ssh_test_connection`, `ssh_exec`, `ssh_read_file`, `ssh_write_file`, `ssh_status`, and `ssh_logs`.

### Execution Fallback

Open Settings > Runtime / Execution > Fallback Order.

Default order:

```text
1. App shell
2. Built-in PRoot
3. Termux bridge
4. SSH agent
5. Laptop/server orchestrator
```

`shell_exec` and `execution_run_command` report selected runtime, why it was selected, fallback attempts, stdout/stderr/exit code, and final success/failure. Remote orchestrator command requests are not treated as local command success unless a remote tool result proves it.

### Local MCP

Built-in phone tools do not require MCP. Local MCP is blocked until `container_test` passes. Even with a working container, this APK does not yet include the JSON-RPC stdio/http bridge, so it reports that limitation instead of faking a tool list. Remote MCP should route through the laptop/server orchestrator.

### Laptop/Server

Set the orchestrator URL in onboarding or Settings:

```text
http://10.0.2.2:4017      # emulator
http://192.168.x.x:4017   # LAN phone
http://100.x.x.x:4017     # Tailscale
```

Use Test, Pair, Tools > Sessions, or Developer Tests > Remote to verify. Offline daemon failures are shown as cards/status, not crashes.

### Assistant Mode

Open Tools > Assistant:

- Test `AssistantActivity`.
- Open Android default assistant settings. Android/OEM decides whether Phone Agent appears as a digital assistant candidate.
- Grant overlay permission before showing the floating bubble.
- Add the quick settings tile from Android Quick Settings edit mode if available.

Always-on “Hey Arjvice” wake phrase is not implemented. Stock Android does not allow a hidden arbitrary hotword listener for this app. Any future wake mode must use a visible foreground microphone service and clear battery/privacy warnings.

## Local Model Status

Open Settings > AI Providers > Local Model.

Local model files can be imported and selected. Supported future formats are GGUF for llama.cpp, ONNX if ONNX Runtime Mobile is linked, and TFLite/LiteRT if LiteRT is linked. This APK does not link a real local inference backend yet, so status says:

```text
Local inference backend not linked yet.
```

Imported models can be tracked, activated, and deleted. Test local prompt fails honestly with:

```text
Model file exists, but no runtime backend is available.
```

## Developer Tests

Tools > Developer Tests includes visible tests for:

- Core: Mistral chat, file write/read, shell exec, question card, approval card.
- Provider/runtime: Mistral key, local model status, built-in PRoot, Termux SSH, SSH target, fallback command.
- Container: status, import picker blockers, test, exec.
- Phone control: list apps, open Settings, missing app suggestions, accessibility status/tree, back/home/recents.
- Screen: MediaProjection prompt, screenshot status, observe, describe.
- Voice: mic status, real STT button, real TTS button, voice agent query.
- Assistant: activity, bubble, default assistant status, quick launch, wake phrase status.
- Remote: orchestrator status, sessions, send message, questions, approvals.

Each test creates visible cards or status output with pass/fail/error details.

## Premium Mobile UI

The Android app now uses a dark glass/liquid Compose UI centered on Chat. Questions appear as modal bottom sheets, approvals use action cards, tool calls render as compact expandable cards, and Details uses tabs for summary, args, output, error, approval, retry, and logs. Visible assistant status text is limited to short summaries such as planning, running a command, waiting for approval, or waiting for an answer; hidden reasoning is not displayed.

The Tools, Dashboard, Files, Console, Voice, Assistant Mode, Developer Tests, Sessions, Questions, Approvals, Models, Container, and Settings screens share the same glass card/status pill system. Runtime behavior, developer tests, permissions, and honest unsupported states are unchanged.

## Honest Limits

- No ADB/device proof is required for this pass; install and permission flows must be tested on your phone.
- No hidden mic, hidden screenshot, hidden accessibility control, or private app data access.
- No local model inference backend is linked.
- Local MCP bridge is not linked.
- Continuous screen watch and automatic vision upload are not implemented.
- Container success depends on user-supplied compatible assets and whether the Android build permits executing imported binaries.
- SSH and Termux success depends on user-configured credentials and host reachability; the APK does not fake connection or command success.
