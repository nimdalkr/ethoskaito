import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/ethos_alpha"),
  ETHOS_API_BASE_URL: z.string().url().default("https://api.ethos.network/api/v2"),
  ETHOS_CLIENT_NAME: z.string().min(1).default("ethosalpha"),
  FXTWITTER_API_BASE_URL: z.string().url().default("https://api.fxtwitter.com"),
  PRICE_API_BASE_URL: z.string().url().default("https://api.coingecko.com/api/v3"),
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
