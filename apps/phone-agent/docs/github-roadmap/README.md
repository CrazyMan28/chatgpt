# Phone Agent Roadmap

## Build commands

```bash
cd /home/kihi2024/desktop/chatgpt_code_codex_version/apps/phone-agent && ./gradlew assembleDebug
cd /home/kihi2024/desktop/chatgpt_code_codex_version && npm run phone:build
```

## Documentation

- `AUDIT.md` — current module and runtime audit
- `KNOWN_BUGS.md` — tracked runtime issues
- `MILESTONES.md` — delivery milestones
- `WORKER_RULES.md` — worker routing rules
- `SAFETY_RULES.md` — device safety rules

## Issue index

- **#1** — Audit current phone-agent implementation and publish roadmap
- **#2** — Fix compound task dispatcher so multi-intent commands run all steps
- **#3** — Fix question answer continuation so tasks resume after answer
- **#4** — Audit current phone-agent implementation and publish roadmap follow-up
- **#5** — Fix compound task dispatcher so multi-intent commands run all steps
- **#6** — Fix question answer continuation so tasks resume after answer
- **#7** — Fix multi-tool agent loop to not stop after first successful tool
- **#8** — Fix fuzzy parser and generic app-control commands
- **#9** — Fix provider error classification and retry/fallback

## Current verification focus

- Multi-step runtime loops must feed every tool result back into the agent and require an explicit goal-complete final for multi-step goals.
- Parser tests cover typo correction, fuzzy app matching, current-app search, and app-name extraction that stops before follow-up actions.
- Provider tests cover rate limits, auth failures, temporary timeouts, offline endpoints, retry metadata, fallback order, and local command availability while providers are down.
