/**
 * Ops helper: compare DB targets (redacted), probe connectivity,
 * hit /api/health, and optionally trigger a small collector batch.
 *
 * Usage:
 *   node scripts/ops-check-and-collect.mjs
 *   node scripts/ops-check-and-collect.mjs --collect
 *   node scripts/ops-check-and-collect.mjs --collect --accounts=40
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

function loadEnvFile(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
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

function redactUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//***@${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:\/\/[^@]+@/, "://***@");
  }
}

function hostKey(url) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

async function probeDb(label, url) {
  if (!url) {
    return { label, ok: false, error: "missing DATABASE_URL", host: null };
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [projects, mentions, tweets, tracked, latestRun, latestMention] = await Promise.all([
      prisma.project.count(),
      prisma.projectMention.count(),
      prisma.tweet.count(),
      prisma.trackedAccount.count({ where: { isActive: true } }),
      prisma.collectorRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { mode: true, status: true, startedAt: true, completedAt: true, ingestedTweets: true, errorCount: true }
      }),
      prisma.projectMention.findFirst({
        orderBy: { mentionedAt: "desc" },
        select: { mentionedAt: true }
      })
    ]);
    return {
      label,
      ok: true,
      host: hostKey(url),
      redacted: redactUrl(url),
      counts: { projects, mentions, tweets, tracked },
      latestRun,
      latestMentionAt: latestMention?.mentionedAt?.toISOString() ?? null
    };
  } catch (error) {
    return {
      label,
      ok: false,
      host: hostKey(url),
      redacted: redactUrl(url),
      error: error.message.split("\n").filter(Boolean).slice(0, 3).join(" | ")
    };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function hitHealth(appUrl) {
  const url = `${appUrl.replace(/\/+$/, "")}/api/health`;
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-store" } });
    const body = await res.json().catch(() => null);
    return { url, status: res.status, body };
  } catch (error) {
    return { url, status: 0, error: error.message };
  }
}

async function triggerCollect(appUrl, secret, params) {
  const search = new URLSearchParams(params);
  const url = `${appUrl.replace(/\/+$/, "")}/api/cron/collect?${search.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`
    }
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { url: url.replace(secret, "***"), status: res.status, body };
}

const args = new Set(process.argv.slice(2));
const doCollect = args.has("--collect");
const accountsArg = process.argv.find((a) => a.startsWith("--accounts="));
const accounts = accountsArg ? accountsArg.split("=")[1] : "30";

const fileEnv = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...loadEnvFile(".env.railway-sync")
};

// Prefer process env overrides, then merged files.
const env = { ...fileEnv, ...process.env };

const localOnly = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const railwayOnly = loadEnvFile(".env.railway-sync");

const probes = await Promise.all([
  probeDb("env-primary", env.DATABASE_URL),
  probeDb("dotenv", localOnly.DATABASE_URL),
  probeDb("railway-sync", railwayOnly.DATABASE_URL)
]);

// De-dupe by host for report
const seen = new Set();
const uniqueProbes = [];
for (const p of probes) {
  const key = `${p.label}:${p.host}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniqueProbes.push(p);
}

const appUrl = (env.APP_URL || "https://ethosalpha.vercel.app").trim();
const health = await hitHealth(appUrl);

const report = {
  appUrl,
  databaseProbes: uniqueProbes,
  sameHostAsRailway: uniqueProbes
    .filter((p) => p.ok)
    .map((p) => p.host)
    .includes(hostKey(railwayOnly.DATABASE_URL)),
  health
};

console.log(JSON.stringify({ check: report }, null, 2));

if (!doCollect) {
  console.log(JSON.stringify({ collect: { skipped: true, hint: "pass --collect to run a small batch" } }));
  process.exit(0);
}

const secret = env.CRON_SECRET;
if (!secret || secret === "replace-me") {
  console.error(JSON.stringify({ collect: { ok: false, error: "CRON_SECRET missing or placeholder" } }));
  process.exit(1);
}

// Prefer a reachable DB for interpretation; collect hits the APP API which uses the app's own DATABASE_URL.
const collect = await triggerCollect(appUrl, secret, {
  mode: "hot",
  accounts: String(accounts),
  tweets: "1",
  concurrency: "3",
  shards: env.COLLECTOR_SHARDS || "40"
});

console.log(
  JSON.stringify(
    {
      collect: {
        status: collect.status,
        ok: collect.status >= 200 && collect.status < 300,
        summary: collect.body
          ? {
              skipped: collect.body.skipped,
              reason: collect.body.reason,
              mode: collect.body.mode,
              selectedAccounts: collect.body.selectedAccounts,
              discovered: collect.body.discovered,
              queued: collect.body.queued,
              processed: collect.body.processed,
              errors: collect.body.errors,
              rateLimitErrors: collect.body.rateLimitErrors,
              circuitOpen: collect.body.circuitOpen,
              error: collect.body.error
            }
          : null,
        rawError: collect.status >= 400 ? collect.body : undefined
      }
    },
    null,
    2
  )
);

process.exit(collect.status >= 200 && collect.status < 300 ? 0 : 1);
