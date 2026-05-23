import { execFile } from "node:child_process";
const COPILOT_COMMAND = "copilot";
const COPILOT_STATUS_TIMEOUT_MS = 5_000;
export async function getCopilotProviderStatus(settings) {
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
export async function assertCopilotLoginAvailable(settings) {
    const availability = await detectCopilotAuthAvailability(settings);
    if (availability.status === "unreachable") {
        throw new Error(availability.message);
    }
}
export async function detectCopilotAuthAvailability(settings, env = process.env) {
    const requestedAuthMode = resolveCopilotAuthMode(settings, env);
    const envTokenAvailable = hasCopilotEnvironmentToken(env);
    const cli = await inspectCopilotCli();
    if (!cli.available) {
        return {
            authMode: "unavailable",
            cliAvailable: false,
            envTokenAvailable,
            message: "Copilot CLI is not installed or not logged in. Install/login first, then retry /login.",
            status: "unreachable"
        };
    }
    if (requestedAuthMode === "env" && !envTokenAvailable) {
        return {
            authMode: "env",
            cliAvailable: true,
            cliVersion: cli.version,
            envTokenAvailable: false,
            message: "Copilot environment token is missing. Set COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN, then retry /login.",
            status: "unreachable"
        };
    }
    if (requestedAuthMode === "oauth") {
        return {
            authMode: "oauth",
            cliAvailable: true,
            cliVersion: cli.version,
            envTokenAvailable,
            message: "GitHub OAuth/device login is handled by Copilot CLI. Run `copilot login`, then retry /login.",
            status: "unknown"
        };
    }
    return {
        authMode: requestedAuthMode,
        cliAvailable: true,
        cliVersion: cli.version,
        envTokenAvailable,
        message: requestedAuthMode === "env"
            ? "Copilot CLI is installed and a supported Copilot token environment variable is present."
            : "Copilot CLI is installed. Stored Copilot login will be used if available.",
        status: requestedAuthMode === "env" ? "reachable" : "unknown"
    };
}
export function resolveCopilotAuthMode(settings, env = process.env) {
    if (settings?.authMode) {
        return settings.authMode;
    }
    return hasCopilotEnvironmentToken(env) ? "env" : "cli";
}
export function hasCopilotEnvironmentToken(env = process.env) {
    return Boolean(normalizeOptionalString(env.COPILOT_GITHUB_TOKEN) ??
        normalizeOptionalString(env.GH_TOKEN) ??
        normalizeOptionalString(env.GITHUB_TOKEN));
}
export function getCopilotLimitations() {
    return [
        "Uses the supported GitHub Copilot CLI path; no VS Code token files are read.",
        "Native tool calling is unavailable through this model-only integration.",
        "Model listing is static/manual unless the Copilot CLI exposes a stable list API.",
        "Auth and quota details are reported by the Copilot CLI when a request runs."
    ];
}
async function inspectCopilotCli() {
    try {
        const result = await execCopilot(["version"], COPILOT_STATUS_TIMEOUT_MS);
        const version = normalizeOptionalString(result.stdout) ?? "installed";
        return {
            available: true,
            version
        };
    }
    catch {
        return {
            available: false
        };
    }
}
function execCopilot(args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(COPILOT_COMMAND, [...args], {
            env: process.env,
            timeout: timeoutMs,
            windowsHide: true
        }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({
                stdout,
                stderr
            });
        });
    });
}
function normalizeOptionalString(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}
//# sourceMappingURL=copilot-auth.js.map