import { ProviderError, type ProviderClock, type ProviderRequestOptions, type ProviderResponseMeta } from "@/lib/types/provider";

const clock: ProviderClock = {
  now: () => Date.now()
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function pickFirstRecord(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = source[key];
    if (isRecord(candidate)) {
      return candidate;
    }
  }
  return source;
}

export function pickString(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return fallback;
}

export function pickNumber(source: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

export function toIsoString(input: string | number | Date): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof input === "number") {
    return new Date(input < 1_000_000_000_000 ? input * 1000 : input).toISOString();
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendQuery(url: URL, query?: ProviderRequestOptions["query"]) {
  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function createAbortController(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  return { controller, timeout };
}

export async function fetchJson<T>(
  provider: string,
  input: string | URL,
  init: RequestInit & ProviderRequestOptions = {},
  validate: (value: unknown) => T
): Promise<{ data: T; meta: ProviderResponseMeta }> {
  const retries = init.retries ?? 2;
  const retryDelayMs = init.retryDelayMs ?? 250;
  const timeoutMs = init.timeoutMs ?? 10_000;
  const baseUrl = typeof input === "string" ? new URL(input) : new URL(input.toString());
  const url = appendQuery(baseUrl, init.query);
  const headers = new Headers(init.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const startedAt = clock.now();
    const { controller, timeout } = createAbortController(timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal
      });

      const elapsedMs = clock.now() - startedAt;
      const text = await response.text();

      if (!response.ok) {
        if (attempt < retries && isRetryableStatus(response.status)) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        throw new ProviderError(`Request failed with status ${response.status}`, {
          provider,
          url: url.toString(),
          status: response.status,
          body: text || null
        });
      }

      let parsed: unknown = null;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch (cause) {
          throw new ProviderError("Invalid JSON response", {
            provider,
            url: url.toString(),
            status: response.status,
            body: text,
            cause
          });
        }
      }

      return {
        data: validate(parsed),
        meta: {
          status: response.status,
          url: response.url || url.toString(),
          elapsedMs
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      if (error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError("Provider request failed", {
        provider,
        url: url.toString(),
        body: null,
        cause: error
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderError("Provider request failed after retries", {
    provider,
    url: url.toString(),
    cause: lastError ?? undefined
  });
}

