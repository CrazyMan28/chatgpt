import { isRateLimitProviderError } from "../models/provider-request.js";
const RATE_LIMIT_RETRY_DELAYS_MS = [60_000, 120_000, 300_000];
export async function runWithRateLimitRecovery(input) {
    const retryDelays = getRateLimitRetryDelays();
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
        try {
            return await input.run();
        }
        catch (error) {
            if (!isRateLimitError(error)) {
                throw error;
            }
            if (attempt >= retryDelays.length) {
                throw new Error(`Provider rate limit persisted after ${retryDelays.length} retries. ${readErrorMessage(error)}`);
            }
            const delayMs = retryDelays[attempt];
            await input.onRetry?.({
                attempt: attempt + 1,
                delayMs,
                error
            });
            await delay(delayMs);
        }
    }
    throw new Error("Rate limit recovery failed unexpectedly.");
}
export function isRateLimitError(error) {
    if (isRateLimitProviderError(error)) {
        return true;
    }
    const message = readErrorMessage(error).toLowerCase();
    return (message.includes("429") ||
        message.includes("rate limit") ||
        message.includes("rate-limit") ||
        message.includes("too many requests"));
}
export function readErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function formatRetryDelay(delayMs) {
    if (delayMs % 60_000 === 0) {
        return `${delayMs / 60_000} minute${delayMs === 60_000 ? "" : "s"}`;
    }
    if (delayMs >= 1_000) {
        return `${Math.round(delayMs / 1_000)} seconds`;
    }
    return `${delayMs}ms`;
}
export function getRateLimitRetryDelays() {
    const scale = Number(process.env.CHATGPT_CODE_RATE_LIMIT_BACKOFF_SCALE ?? "1");
    if (!Number.isFinite(scale) || scale <= 0) {
        return [...RATE_LIMIT_RETRY_DELAYS_MS];
    }
    return RATE_LIMIT_RETRY_DELAYS_MS.map((delay) => Math.max(1, Math.round(delay * scale)));
}
async function delay(durationMs) {
    await new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });
}
//# sourceMappingURL=rate-limit-recovery.js.map