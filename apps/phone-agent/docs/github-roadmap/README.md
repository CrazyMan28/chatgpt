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
- **#4** — Audit/roadmap follow-up
- **#5** — Task queue/runtime hardening
- **#6** — Build/deployment verification
