export declare function runWithRateLimitRecovery<T>(input: {
    onRetry?: (input: {
        attempt: number;
        delayMs: number;
        error: unknown;
    }) => void | Promise<void>;
    run: () => Promise<T>;
}): Promise<T>;
export declare function isRateLimitError(error: unknown): boolean;
export declare function readErrorMessage(error: unknown): string;
export declare function formatRetryDelay(delayMs: number): string;
export declare function getRateLimitRetryDelays(): number[];
//# sourceMappingURL=rate-limit-recovery.d.ts.map