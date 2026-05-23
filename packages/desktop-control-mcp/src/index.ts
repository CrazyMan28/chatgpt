#!/usr/bin/env node

import { fileURLToPath } from "node:url";

export * from "./controller.js";
export * from "./mcp-server.js";
export * from "./types.js";
export * from "./vision.js";

import { runMcpServer } from "./mcp-server.js";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMcpServer();
}
