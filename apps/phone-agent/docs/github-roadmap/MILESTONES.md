# Milestones

## M1 — Audit and roadmap

- Document the current runtime, parser, UI, tools, and sync surfaces.
- Publish roadmap docs under `docs/github-roadmap/`.

## M2 — Compound command flow

- Keep multi-step prompts running across screen/question boundaries.
- Preserve remaining steps when a question interrupts the flow.

## M3 — Question resume flow

- Route answers back into the waiting task.
- Keep the question card active until the answer is confirmed.

## M4 — Runtime hardening

- Keep model-driven tool loops running until the original goal is explicitly complete.
- Support fuzzy app parsing and current-app control commands.
- Classify provider failures accurately and preserve local deterministic command paths while providers are down.
