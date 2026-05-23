# Desktop Control

Desktop control adds a local computer-use loop to the agent platform. It is intentionally hybrid:

1. App-specific APIs first, such as browser/Playwright MCP when enabled.
2. Linux accessibility through AT-SPI second.
3. Screenshot plus vision provider fallback third.
4. Raw mouse and keyboard coordinates last.

The vision provider only describes screenshots and suggests actions. It never moves the pointer or types directly. All execution goes through the core desktop executor and the desktop safety mode.

## Core Tools

Desktop control is registered as core tools in the normal tool registry. It does not require `/mcp install desktop-control`.

Core tool names use underscores, for example:

```text
desktop_status
desktop_observe
screen_screenshot
screen_describe
accessibility_tree
accessibility_find
app_open
window_list
keyboard_type
mouse_click
clipboard_read
```

When available, `/desktop status` shows `Desktop Control: core enabled`.

## Optional MCP Wrapper

Build the workspace first:

```sh
npm run build
```

The marketplace entry remains available only as an optional/exportable MCP wrapper:

```text
/mcp marketplace
/mcp info desktop-control
/mcp install desktop-control
/mcp enable desktop-control
```

The server runs over stdio with:

```sh
node packages/desktop-control-mcp/dist/index.js
```

## TUI Commands

```text
/desktop status
/desktop mode readonly|assistive|approve|autopilot
/desktop allow <app>
/desktop block <app>
/desktop allowed
/desktop screenshot
/desktop tree
/desktop tree --full
/desktop observe
/desktop run <task>
/desktop stop
/screen describe [prompt]
/screen watch [summary]
/vision status
/vision provider mistral|ollama|local
/vision model <model>
```

## Fedora/KDE Requirements

Recommended packages:

```sh
sudo dnf install spectacle wmctrl xdotool python3-pyatspi wl-clipboard wtype
```

Optional fallbacks:

```sh
sudo dnf install grim gnome-screenshot ImageMagick scrot xclip xsel
```

Screenshot capture tries `spectacle`, `grim`, `gnome-screenshot`, ImageMagick `import`, then `scrot`.

Window listing/focus uses `wmctrl` and `xdotool` where available. This is best on X11. Wayland compositors often restrict synthetic pointer control; use accessibility actions or app-specific adapters when possible.

## Accessibility

Accessibility inspection uses AT-SPI through `python3-pyatspi`. If AT-SPI is unavailable or disabled, desktop tools return a readable unavailable message instead of crashing.

Returned elements include:

- `id`
- `role`
- `name`
- `description`
- `value`
- `bounds`
- `states`
- `actions`
- `children`

Example:

```text
/desktop tree
```

MCP examples:

```json
{"name":"Search","role":"text"}
```

```json
{"elementId":"0/2/4","text":"hello"}
```

## Vision Providers

Mistral:

```sh
export CHATGPT_CODE_MISTRAL_API_KEY=...
```

```text
/vision provider mistral
/vision model mistral-small-latest
/screen describe
```

Ollama:

```sh
ollama serve
ollama pull llama3.2-vision
```

```text
/vision provider ollama
/vision model llama3.2-vision
/screen describe
```

Ollama vision requests use the REST `/api/chat` `images` field with base64 image data. Mistral vision uses Chat Completions with a base64 `data:image/png;base64,...` image URL.

If no vision provider is configured, accessibility-only mode still works.

References:

- Mistral Vision: https://docs.mistral.ai/capabilities/vision/
- Ollama Vision: https://docs.ollama.com/capabilities/vision

## Safety Modes

Default mode is `approve`.

- `readonly`: screenshots, window list, and accessibility inspection only.
- `assistive`: suggests actions but does not execute them.
- `approve`: medium and dangerous actions require approval.
- `autopilot`: medium actions execute under the desktop allow/block policy; dangerous actions still require explicit approval.

Dangerous actions include submitting messages/forms, purchases, banking, password changes, deleting files, installing software, destructive terminal commands, untrusted remote device control, secret/token exfiltration, and offensive security actions.

Use app policy:

```text
/desktop allow kate
/desktop block browser
/desktop allowed
```

## Known Limitations

- Wayland pointer/keyboard injection is intentionally limited by the compositor. Prefer accessibility and app-specific adapters.
- Browser selector control is exposed as a browser adapter surface, but selector-level control should be handled by Playwright MCP when enabled.
- The `local` OpenAI-compatible vision provider is a placeholder for a later adapter.
- Watchers track screenshot/window progress in-process and are mirrored into the existing watcher list when started from the TUI.
