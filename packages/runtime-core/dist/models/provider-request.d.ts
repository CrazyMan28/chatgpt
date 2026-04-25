export type ProviderErrorKind = "network" | "auth" | "bad_request" | "rate_limit" | "timeout" | "unknown";
export declare class ProviderRequestError extends Error {
    readonly kind: ProviderErrorKind;
    readonly provider: string;
    readonly retryable: boolean;
    readonly statusCode?: number;
    constructor(input: {
        kind: ProviderErrorKind;
        message: string;
        provider: string;
        retryable?: boolean;
        statusCode?: number;
        cause?: unknown;
    });
}
export interface RequestJsonOptions {
    body?: unknown;
    fetchFn?: typeof fetch;
    headers?: HeadersInit;
    maxAttempts?: number;
    method?: string;
    provider: string;
    timeoutMs?: number;
    url: string;
}
export declare function requestJson<T>({ body, fetchFn, headers, maxAttempts, method, provider, timeoutMs, url }: RequestJsonOptions): Promise<T>;
export declare function isProviderRequestError(error: unknown): error is ProviderRequestError;
export declare function isRateLimitProviderError(error: unknown): boolean;
//# sourceMappingURL=provider-request.d.ts.map