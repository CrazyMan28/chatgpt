# GitHub Copilot Provider

The `copilot` provider lets the desktop TUI use GitHub Copilot as a model-response source while keeping this app's existing agent runtime in charge of tools, approvals, desktop control, memory, retries, task state, and question cards.

## How It Works

This integration uses the supported GitHub Copilot CLI path. It does not scrape VS Code tokens, read VS Code extension storage, or call private Copilot endpoints.

The current GitHub Copilot SDK and CLI expose an agent runtime, not a stable raw model-only API. To keep this TUI's runtime as the owner of tool execution, the provider calls Copilot CLI in prompt mode with Copilot tools disabled and returns assistant text only.

## Login

Run `/login`, choose `Copilot`, then choose one of these setup modes:

- `Logged-in CLI`: use credentials managed by `copilot login`.
- `OAuth/device`: complete `copilot login` in a terminal, then rerun `/login`.
- `Environment token`: set `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`.

No Copilot token is stored in plain JSON. The TUI persists only safe metadata such as provider, selected model, and auth mode. Runtime auth state is stored by Copilot CLI or provided through environment variables.

## Selecting Models

Use `/models` to see static/manual Copilot model entries and `/model <name>` to select a model.

Copilot model availability depends on your GitHub Copilot plan and organization policy. If the Copilot CLI rejects a model, choose another model with `/model <name>`.

## Supported

- Chat generation through GitHub Copilot CLI.
- Non-streaming response fallback.
- System prompt content folded into the prompt sent to Copilot CLI.
- Manual model name entry.
- Clean errors for missing CLI, missing auth, missing subscription, quota/rate limits, unavailable models, and network failures.

## Not Supported

- Native Copilot tool calls in this TUI provider.
- Dynamic model listing from Copilot, unless GitHub exposes a stable model-list API for this use case.
- Direct quota/rate-limit inspection before a request runs.
- Vision input through this provider.
- Reading or reusing VS Code Copilot extension tokens.

## Troubleshooting

- `Copilot CLI is not installed or not logged in`: install GitHub Copilot CLI and run `copilot login`.
- `Copilot environment token is missing`: set `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`.
- `Copilot request was rejected`: check that your account has an active Copilot subscription and that your organization allows Copilot CLI.
- `Copilot model unavailable`: run `/model <name>` with a model your plan exposes.
- `Copilot quota or rate limit was reached`: check your Copilot usage and retry later.

## References

- GitHub Copilot CLI documentation: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli
- GitHub Copilot CLI command reference: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
- GitHub Copilot SDK repository: https://github.com/github/copilot-sdk
