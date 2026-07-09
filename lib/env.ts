import { z } from "zod";

const PLACEHOLDER_SECRETS = new Set(["replace-me", "changeme", "secret", "test", "password"]);

export function isPlaceholderSecret(value: string | undefined | null) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length < 8 || PLACEHOLDER_SECRETS.has(normalized);
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/ethos_alpha"),
  ETHOS_API_BASE_URL: z.string().url().default("https://api.ethos.network/api/v2"),
  ETHOS_CLIENT_NAME: z.string().min(1).default("ethosalpha"),
  FXTWITTER_API_BASE_URL: z.string().url().default("https://api.fxtwitter.com"),
  PRICE_API_BASE_URL: z.string().url().default("https://api.coingecko.com/api/v3"),
  // Dev defaults only. Production auth rejects placeholders at request time (see authorize* helpers).
  INGEST_API_KEY: z.string().min(1).default("replace-me"),
  CRON_SECRET: z.string().min(1).default("replace-me"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  COLLECTOR_PRIMARY: z.enum(["vercel-cron", "worker"]).default("vercel-cron")
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  ETHOS_API_BASE_URL: process.env.ETHOS_API_BASE_URL,
  ETHOS_CLIENT_NAME: process.env.ETHOS_CLIENT_NAME,
  FXTWITTER_API_BASE_URL: process.env.FXTWITTER_API_BASE_URL,
  PRICE_API_BASE_URL: process.env.PRICE_API_BASE_URL,
  INGEST_API_KEY: process.env.INGEST_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  APP_URL: process.env.APP_URL,
  COLLECTOR_PRIMARY: process.env.COLLECTOR_PRIMARY
});

const isProductionRuntime = () => process.env.NODE_ENV === "production";

export type AuthCheckResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Fail-closed secret check for protected routes.
 * In production, placeholder/default secrets never authorize (503 misconfigured).
 */
export function authorizeIngestApiKey(apiKey: string | null): AuthCheckResult {
  if (isProductionRuntime() && isPlaceholderSecret(env.INGEST_API_KEY)) {
    return { ok: false, status: 503, error: "Server misconfigured: INGEST_API_KEY" };
  }

  if (!apiKey || apiKey !== env.INGEST_API_KEY) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

export function authorizeCronSecret(authorizationHeader: string | null): AuthCheckResult {
  if (isProductionRuntime() && isPlaceholderSecret(env.CRON_SECRET)) {
    return { ok: false, status: 503, error: "Server misconfigured: CRON_SECRET" };
  }

  if (authorizationHeader !== `Bearer ${env.CRON_SECRET}`) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
