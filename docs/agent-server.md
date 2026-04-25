# Agent Server Bootstrap

This repository already includes a daemon and orchestrator server. The files in this directory turn that into a repeatable node bootstrap path instead of an ad hoc local-only setup.

## Quick Start

1. Copy `.env.agent-server.example` to `.env.agent-server`.
2. Set `CHATGPT_CODE_WORKSPACE_ROOT`, `CHATGPT_CODE_DAEMON_HOST`, and `CHATGPT_CODE_DAEMON_PORT`.
3. Optionally set `CHATGPT_CODE_REGISTER_URL` if this node should register itself with a primary orchestrator.
4. Run `./scripts/install-agent-server.sh`.
5. Verify health with `curl http://HOST:PORT/health`.

## What The Installer Does

- installs workspace dependencies with `npm install`
- builds the daemon/orchestrator stack with `npm run build:core`
- creates a systemd unit from `deploy/chatgpt-code-daemon.service` when systemd is available and writable
- starts the daemon service
- checks `/health`
- optionally registers the node against `POST /workers` on a primary orchestrator

## Environment File

`.env.agent-server` controls daemon binding and optional worker registration.

- `CHATGPT_CODE_WORKSPACE_ROOT`: workspace the node should operate on
- `CHATGPT_CODE_DAEMON_HOST`: bind host for the daemon
- `CHATGPT_CODE_DAEMON_PORT`: bind port for the daemon
- `CHATGPT_CODE_REGISTER_URL`: base URL of the controlling orchestrator, for example `http://controller.example.com:4017`
- `CHATGPT_CODE_REGISTER_ID`: stable worker id exposed to the controller
- `CHATGPT_CODE_REGISTER_NAME`: display name shown in the controller
- `CHATGPT_CODE_REGISTER_HOST`: externally reachable host name or IP for the node
- `CHATGPT_CODE_REGISTER_PORT`: externally reachable daemon port
- `CHATGPT_CODE_REGISTER_USERNAME`: SSH username stored in the controller worker registry

## Continuity And Handoff

The orchestrator already persists:

- sessions
- session registry entries
- attachments
- tasks
- approvals
- watchers
- fleet state
- memory

Current attach/detach continuity is available through:

- `POST /sessions/:id/attach`
- `POST /sessions/:id/detach`
- `POST /sessions/:id/background/start`
- `POST /sessions/:id/background/stop`
- `POST /sessions/:id/background/resume`

That gives app-to-daemon continuity today. Full cross-node live session migration still needs explicit export/import or shared backing storage; that remains a follow-up rather than a completed claim.

## Operations

- Start manually: `npm run start -w @chatgpt-code/daemon`
- Tail logs: `journalctl -u chatgpt-code-daemon -f`
- Health: `curl http://127.0.0.1:4017/health`
- Doctor: `curl http://127.0.0.1:4017/doctor`
- Fleet status: `curl http://127.0.0.1:4017/fleet`
- Tasks: `curl http://127.0.0.1:4017/tasks`
- Agents: `curl http://127.0.0.1:4017/agents`

