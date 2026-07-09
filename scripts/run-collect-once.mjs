/**
 * Run a single collector batch in-process against DATABASE_URL.
 * Loads .env.local then .env (local wins for Next-style override when we reverse - we want data DB).
 *
 * Usage:
 *   node scripts/run-collect-once.mjs
 *   node scripts/run-collect-once.mjs --mode=hot --accounts=40
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1].trim()] = v.trim();
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

// Prefer the data-rich cloud DB from .env.local over empty local postgres in .env
const merged = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env
};

if (!merged.DATABASE_URL) {
  console.error(JSON.stringify({ ok: false, error: "DATABASE_URL is required" }));
  process.exit(1);
}

const mode = get("mode", "hot");
const accounts = get("accounts", "40");
const tweets = get("tweets", "1");
const concurrency = get("concurrency", "3");

const runner = `
import { collectTrackedTweets } from "./lib/ingest/collect-tracked-tweets.ts";

const result = await collectTrackedTweets({
  mode: process.env.COLLECT_MODE || "hot",
  accountLimit: Number(process.env.COLLECT_ACCOUNTS || 40),
  tweetsPerAccount: Number(process.env.COLLECT_TWEETS || 1),
  concurrency: Number(process.env.COLLECT_CONCURRENCY || 3)
});

console.log(JSON.stringify({
  ok: true,
  dbHost: process.env.DB_HOST_LABEL,
  mode: result.mode,
  selectedAccounts: result.selectedAccounts,
  discovered: result.discovered,
  queued: result.queued,
  processed: result.processed,
  errors: result.errors,
  rateLimitErrors: result.rateLimitErrors,
  circuitOpen: result.circuitOpen,
  runId: result.runId
}, null, 2));
`;

// Must live at repo root so @/ and relative lib imports resolve consistently under tsx.
const tmp = path.join(".run-collect-once.tmp.mts");
fs.writeFileSync(tmp, runner, "utf8");

console.log(
  JSON.stringify({
    starting: true,
    dbHost: hostOf(merged.DATABASE_URL),
    mode,
    accounts,
    tweets,
    concurrency
  })
);

const child = spawn(
  "npx",
  ["tsx", tmp],
  {
    stdio: "inherit",
    env: {
      ...merged,
      COLLECT_MODE: mode,
      COLLECT_ACCOUNTS: accounts,
      COLLECT_TWEETS: tweets,
      COLLECT_CONCURRENCY: concurrency,
      DB_HOST_LABEL: hostOf(merged.DATABASE_URL)
    },
    shell: true
  }
);

child.on("exit", (code) => {
  try {
    fs.unlinkSync(tmp);
  } catch {
    // ignore
  }
  process.exit(code ?? 1);
});
