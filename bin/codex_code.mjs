#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(repoRoot, "apps/tui/dist/index.js");
const sourceEntry = resolve(repoRoot, "apps/tui/src/index.ts");
const tsxCli = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

const entrypoint = await selectEntrypoint();
const child = spawn(process.execPath, entrypoint.args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 0;
});

child.once("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function selectEntrypoint() {
  if (await canAccess(builtEntry)) {
    return {
      args: [builtEntry]
    };
  }

  if (await canAccess(tsxCli) && await canAccess(sourceEntry)) {
    return {
      args: [tsxCli, sourceEntry]
    };
  }

  throw new Error(
    [
      "codex_code could not find a runnable TUI entrypoint.",
      "Build the workspace with `npm run build:core` or install dependencies before running the launcher."
    ].join(" ")
  );
}

async function canAccess(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
