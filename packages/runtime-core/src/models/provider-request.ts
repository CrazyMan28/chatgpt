export type ProviderErrorKind =
  | "network"
  | "auth"
  | "bad_request"
  | "rate_limit"
  | "timeout"
  | "unknown";

export class ProviderRequestError extends Error {
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
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ProviderRequestError";
    this.kind = input.kind;
    this.provider = input.provider;
    this.retryable = input.retryable ?? false;
    this.statusCode = input.statusCode;
  }
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

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;

export async function requestJson<T>({
  body,
  fetchFn = globalThis.fetch,
  headers,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  method = "POST",
  provider,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  url
}: RequestJsonOptions): Promise<T> {
  const validatedUrl = validateProviderUrl(url, provider);
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchFn(validatedUrl, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const detail = await readResponseDetail(response);
        const classifiedError = classifyHttpError({
          detail,
          provider,
          response
        });

        if (classifiedError.retryable && attempt < attempts) {
          emitProviderDebugLog(
            provider,
            `retrying ${classifiedError.kind} failure after HTTP ${response.status} (${attempt}/${attempts})`
          );
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw classifiedError;
      }

      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new ProviderRequestError({
          cause: error,
          kind: "bad_request",
          message: `${provider} returned an invalid JSON response.`,
          provider
        });
      }
    } catch (error) {
      clearTimeout(timeout);

      const classifiedError = classifyTransportError(error, provider, timeoutMs);

      if (classifiedError.retryable && attempt < attempts) {
        emitProviderDebugLog(
          provider,
          `retrying ${classifiedError.kind} failure (${attempt}/${attempts}): ${classifiedError.message}`
        );
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }

      throw classifiedError;
    }
  }

  throw new ProviderRequestError({
    kind: "unknown",
    message: `${provider} request failed unexpectedly.`,
    provider
  });
}

export function isProviderRequestError(
  error: unknown
): error is ProviderRequestError {
  return error instanceof ProviderRequestError;
}

export function isRateLimitProviderError(error: unknown): boolean {
  return isProviderRequestError(error) && error.kind === "rate_limit";
}

function validateProviderUrl(url: string, provider: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new ProviderRequestError({
      cause: error,
      kind: "bad_request",
      message: `${provider} endpoint is invalid: ${url}`,
      provider
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ProviderRequestError({
      kind: "bad_request",
      message: `${provider} endpoint must use http or https: ${url}`,
      provider
    });
  }

  return parsed.toString();
}

function classifyHttpError(input: {
  detail: string;
  provider: string;
  response: Response;
}): ProviderRequestError {
  const { detail, provider, response } = input;
  const suffix = detail.length > 0 ? `: ${detail}` : "";
  const statusCode = response.status;

  if (statusCode === 401 || statusCode === 403) {
    return new ProviderRequestError({
      kind: "auth",
      message: `${provider} authentication failed (${statusCode} ${response.statusText})${suffix}`,
      provider,
      statusCode
    });
  }

  if (statusCode === 429) {
    return new ProviderRequestError({
      kind: "rate_limit",
      message: `${provider} rate limit reached (${statusCode} ${response.statusText})${suffix}`,
      provider,
      statusCode
    });
  }

  if (statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422) {
    return new ProviderRequestError({
      kind: "bad_request",
      message: `${provider} rejected the request (${statusCode} ${response.statusText})${suffix}`,
      provider,
      statusCode
    });
  }

  return new ProviderRequestError({
    kind: "unknown",
    message: `${provider} request failed (${statusCode} ${response.statusText})${suffix}`,
    provider,
    retryable: statusCode >= 500,
    statusCode
  });
}

function classifyTransportError(
  error: unknown,
  provider: string,
  timeoutMs: number
): ProviderRequestError {
  if (error instanceof ProviderRequestError) {
    return error;
  }

  const message = readErrorMessage(error).toLowerCase();

  if (
    message.includes("aborted") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return new ProviderRequestError({
      cause: error,
      kind: "timeout",
      message: `${provider} request timed out after ${Math.round(timeoutMs / 1_000)}s.`,
      provider,
      retryable: true
    });
  }

  if (
    error instanceof TypeError ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econnrefused")
  ) {
    return new ProviderRequestError({
      cause: error,
      kind: "network",
      message: `${provider} network request failed. Check connectivity and provider endpoint configuration.`,
      provider,
      retryable: true
    });
  }

  return new ProviderRequestError({
    cause: error,
    kind: "unknown",
    message: `${provider} request failed: ${readErrorMessage(error)}`,
    provider
  });
}

async function readResponseDetail(response: Response): Promise<string> {
  try {
    const detail = (await response.text()).trim().replace(/\s+/g, " ");

    if (detail.length === 0) {
      return "";
    }

    return detail.slice(0, 240);
  } catch {
    return "";
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emitProviderDebugLog(provider: string, message: string): void {
  if (process.env.CHATGPT_CODE_DEBUG !== "1") {
    return;
  }

  process.stderr.write(`[provider:${provider.toLowerCase()}] ${message}\n`);
}

async function delay(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
