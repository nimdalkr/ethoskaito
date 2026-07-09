import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime secret authorization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects placeholder secrets in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INGEST_API_KEY", "replace-me");
    vi.stubEnv("CRON_SECRET", "replace-me");

    const { authorizeCronSecret, authorizeIngestApiKey, isPlaceholderSecret } = await import("@/lib/env");

    expect(isPlaceholderSecret("replace-me")).toBe(true);
    expect(authorizeIngestApiKey("replace-me")).toEqual({
      ok: false,
      status: 503,
      error: "Server misconfigured: INGEST_API_KEY"
    });
    expect(authorizeCronSecret("Bearer replace-me")).toEqual({
      ok: false,
      status: 503,
      error: "Server misconfigured: CRON_SECRET"
    });
  });

  it("accepts matching non-placeholder secrets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INGEST_API_KEY", "production-ingest-key-32chars!!");
    vi.stubEnv("CRON_SECRET", "production-cron-secret-32chars!!");

    const { authorizeCronSecret, authorizeIngestApiKey } = await import("@/lib/env");

    expect(authorizeIngestApiKey("production-ingest-key-32chars!!")).toEqual({ ok: true });
    expect(authorizeCronSecret("Bearer production-cron-secret-32chars!!")).toEqual({ ok: true });
    expect(authorizeIngestApiKey("wrong")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized"
    });
  });
});
