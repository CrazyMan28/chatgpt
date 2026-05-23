import { execFile } from "node:child_process";

import type { CopilotAuthMode } from "./model-client.js";
import type {
  ProviderConnectionStatus,
  ProviderRuntimeStatus,
  StoredProviderSettings
} from "../providers/provider-types.js";

const COPILOT_COMMAND = "copilot";
const COPILOT_STATUS_TIMEOUT_MS = 5_000;

export interface CopilotAuthAvailability {
  authMode: CopilotAuthMode;
  cliAvailable: boolean;
  cliVersion?: string;
  envTokenAvailable: boolean;
  message: string;
  status: ProviderConnectionStatus;
}

export async function getCopilotProviderStatus(
  settings: StoredProviderSettings | undefined
): Promise<ProviderRuntimeStatus> {
  const availability = await detectCopilotAuthAvailability(settings);

  return {
    authMode: availability.authMode,
    checkedAt: Date.now(),
    limitations: getCopilotLimitations(),
    message: availability.message,
    provider: "copilot",
    providerLabel: "Copilot",
    status: availability.status
  };
}

export async function assertCopilotLoginAvailable(
  settings: StoredProviderSettings | undefined
): Promise<void> {
  const availability = await detectCopilotAuthAvailability(settings);

  if (availability.status === "unreachable") {
    throw new Error(availability.message);
  }
}

export async function detectCopilotAuthAvailability(
  settings: StoredProviderSettings | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<CopilotAuthAvailability> {
  const requestedAuthMode = resolveCopilotAuthMode(settings, env);
  const envTokenAvailable = hasCopilotEnvironmentToken(env);
  const cli = await inspectCopilotCli();

  if (!cli.available) {
    return {
      authMode: "unavailable",
      cliAvailable: false,
      envTokenAvailable,
      message:
        "Copilot CLI is not installed or not logged in. Install/login first, then retry /login.",
      status: "unreachable"
    };
  }

  if (requestedAuthMode === "env" && !envTokenAvailable) {
    return {
      authMode: "env",
      cliAvailable: true,
      cliVersion: cli.version,
      envTokenAvailable: false,
      message:
        "Copilot environment token is missing. Set COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN, then retry /login.",
      status: "unreachable"
    };
  }

  if (requestedAuthMode === "oauth") {
    return {
      authMode: "oauth",
      cliAvailable: true,
      cliVersion: cli.version,
      envTokenAvailable,
      message:
        "GitHub OAuth/device login is handled by Copilot CLI. Run `copilot login`, then retry /login.",
      status: "unknown"
    };
  }

  return {
    authMode: requestedAuthMode,
    cliAvailable: true,
    cliVersion: cli.version,
    envTokenAvailable,
    message:
      requestedAuthMode === "env"
        ? "Copilot CLI is installed and a supported Copilot token environment variable is present."
        : "Copilot CLI is installed. Stored Copilot login will be used if available.",
    status: requestedAuthMode === "env" ? "reachable" : "unknown"
  };
}

export function resolveCopilotAuthMode(
  settings: StoredProviderSettings | undefined,
  env: NodeJS.ProcessEnv = process.env
): CopilotAuthMode {
  if (settings?.authMode) {
    return settings.authMode;
  }

  return hasCopilotEnvironmentToken(env) ? "env" : "cli";
}

export function hasCopilotEnvironmentToken(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(
    normalizeOptionalString(env.COPILOT_GITHUB_TOKEN) ??
      normalizeOptionalString(env.GH_TOKEN) ??
      normalizeOptionalString(env.GITHUB_TOKEN)
  );
}

export function getCopilotLimitations(): readonly string[] {
  return [
    "Uses the supported GitHub Copilot CLI path; no VS Code token files are read.",
    "Native tool calling is unavailable through this model-only integration.",
    "Model listing is static/manual unless the Copilot CLI exposes a stable list API.",
    "Auth and quota details are reported by the Copilot CLI when a request runs."
  ];
}

async function inspectCopilotCli(): Promise<{
  available: boolean;
  version?: string;
}> {
  try {
    const result = await execCopilot(["version"], COPILOT_STATUS_TIMEOUT_MS);
    const version = normalizeOptionalString(result.stdout) ?? "installed";

    return {
      available: true,
      version
    };
  } catch {
    return {
      available: false
    };
  }
}

function execCopilot(
  args: readonly string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      COPILOT_COMMAND,
      [...args],
      {
        env: process.env,
        timeout: timeoutMs,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout,
          stderr
        });
      }
    );
  });
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : undefined;
}
