import { NextRequest, NextResponse } from "next/server";

import { isWorkerLeaseActive } from "@/lib/collector/health";
import { DEFAULT_COLLECTOR_SHARDS, type CollectorMode } from "@/lib/collector/scheduling";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { collectTrackedTweets } from "@/lib/ingest/collect-tracked-tweets";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalShard(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMode(value: string | null): CollectorMode {
  if (value === "repair") return "repair";
  if (value === "hot") return "hot";
  return "main";
}

function getDefaultBatchConfig(mode: CollectorMode) {
  if (mode === "repair") {
    return {
      accountLimit: 180,
      tweetsPerAccount: 2,
      concurrency: 3
    };
  }

  if (mode === "hot") {
    return {
      accountLimit: 160,
      tweetsPerAccount: 2,
      concurrency: 4
    };
  }

  return {
    accountLimit: 220,
    tweetsPerAccount: 1,
    concurrency: 4
  };
}

async function shouldSkipVercelCronRequest(isVercelCron: boolean) {
  if (!isVercelCron || env.COLLECTOR_PRIMARY !== "worker") {
    return false;
  }

  const lease = await prisma.workerLease.findUnique({
    where: {
      workerType: "collector-supervisor"
    },
    select: {
      expiresAt: true
    }
  });

  return isWorkerLeaseActive(lease);
}

export async function handleCollectorRequest(
  request: NextRequest,
  options: {
    mode?: string | null;
    shard?: string | null;
  } = {}
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron = userAgent.includes("vercel-cron/1.0");
  if (await shouldSkipVercelCronRequest(isVercelCron)) {
    return NextResponse.json({
      skipped: true,
      reason: "collector_primary_worker"
    });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = normalizeMode(options.mode ?? url.searchParams.get("mode"));
  const defaults = getDefaultBatchConfig(mode);
  const shardId = parseOptionalShard(options.shard ?? url.searchParams.get("shard"));
  const shardCount = parsePositiveInt(url.searchParams.get("shards"), DEFAULT_COLLECTOR_SHARDS);
  const accountLimit = parsePositiveInt(url.searchParams.get("accounts"), defaults.accountLimit);
  const tweetsPerAccount = parsePositiveInt(url.searchParams.get("tweets"), defaults.tweetsPerAccount);
  const concurrency = parsePositiveInt(url.searchParams.get("concurrency"), defaults.concurrency);

  const result = await collectTrackedTweets({
    accountLimit,
    tweetsPerAccount,
    concurrency,
    mode,
    shardId,
    shardCount
  });

  return NextResponse.json(result);
}
