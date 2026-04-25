# Launcher

`codex_code` is the global launcher for this repo.

## Install

From the repo root:

```bash
npm install
npm run build:core
npm link
```

After that, `codex_code` can be run from any terminal. The launcher preserves the terminal's current working directory, and the TUI resolves the active project root from that directory.

## Notes

- If `apps/tui/dist/index.js` exists, the launcher uses the built TUI.
- If the build output is missing but local dependencies are installed, it falls back to `tsx` and runs `apps/tui/src/index.ts`.
- If neither entrypoint is available, the launcher exits with a build/install hint.
