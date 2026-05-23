# ChatGPT Code Pro TUI

`apps/tui-pro` is a new optional TypeScript terminal client for the existing daemon/orchestrator. It does not replace `apps/tui`, does not run agent logic locally, and does not add backend behavior.

Run the daemon first:

```bash
npm run start:daemon
```

Run the pro TUI:

```bash
npm run tui:pro
```

The client connects to `CHATGPT_CODE_API_URL` when set, otherwise `http://127.0.0.1:4017`.

