import { NextRequest, NextResponse } from "next/server";

import { isWorkerLeaseActive } from "@/lib/collector/health";
import { DEFAULT_COLLECTOR_SHARDS, type CollectorMode } from "@/lib/collector/scheduling";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { collectProjectActivities } from "@/lib/ingest/project-activities";
import { collectTrackedTweets } from "@/lib/ingest/collect-tracked-tweets";
import { syncCollectorUserPoolSlot } from "@/lib/collector/user-pool-sync";

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
    accountLimit: 400,
    tweetsPerAccount: 1,
    concurrency: 6
  };
}

function getProjectActivityBucket(mode: CollectorMode, shardId: number | null) {
  if (mode !== "hot" || typeof shardId !== "number") {
    return null;
  }

  if (shardId < 0 || shardId > 5) {
    return null;
  }

  return {
    bucketIndex: shardId,
    bucketCount: 6
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

async function maybeCollectProjectActivities(input: {
  isVercelCron: boolean;
  mode: CollectorMode;
  shardId: number | null;
}) {
  if (!input.isVercelCron) {
    return null;
  }

  const bucket = getProjectActivityBucket(input.mode, input.shardId);
  if (!bucket) {
    return null;
  }

  return collectProjectActivities({
    bucketIndex: bucket.bucketIndex,
    bucketCount: bucket.bucketCount,
    activityLimit: 10,
    sinceHours: 168
  });
}

async function maybeSyncUserPool(input: {
  isVercelCron: boolean;
  mode: CollectorMode;
  rawTarget: string | null;
}) {
  if (!input.isVercelCron) {
    return null;
  }

  return syncCollectorUserPoolSlot(input.mode, input.rawTarget);
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

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = normalizeMode(options.mode ?? url.searchParams.get("mode"));
  const rawTarget = options.shard ?? url.searchParams.get("shard");
  const defaults = getDefaultBatchConfig(mode);
  const shardId = parseOptionalShard(rawTarget);
  const shardCount = parsePositiveInt(url.searchParams.get("shards"), DEFAULT_COLLECTOR_SHARDS);
  const accountLimit = parsePositiveInt(url.searchParams.get("accounts"), defaults.accountLimit);
  const tweetsPerAccount = parsePositiveInt(url.searchParams.get("tweets"), defaults.tweetsPerAccount);
  const concurrency = parsePositiveInt(url.searchParams.get("concurrency"), defaults.concurrency);
  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron = userAgent.includes("vercel-cron/1.0");
  if (await shouldSkipVercelCronRequest(isVercelCron)) {
    const userPoolSync = await maybeSyncUserPool({
      isVercelCron,
      mode,
      rawTarget
    });
    const projectActivities = await maybeCollectProjectActivities({
      isVercelCron,
      mode,
      shardId
    });

    return NextResponse.json({
      skipped: true,
      reason: "collector_primary_worker",
      ...(userPoolSync ? { userPoolSync } : {}),
      ...(projectActivities ? { projectActivities } : {})
    });
  }

  const result = await collectTrackedTweets({
    accountLimit,
    tweetsPerAccount,
    concurrency,
    mode,
    shardId,
    shardCount
  });

  const projectActivities = await maybeCollectProjectActivities({
    isVercelCron,
    mode,
    shardId
  });
  const userPoolSync = await maybeSyncUserPool({
    isVercelCron,
    mode,
    rawTarget
  });

  return NextResponse.json({
    ...result,
    ...(userPoolSync ? { userPoolSync } : {}),
    ...(projectActivities ? { projectActivities } : {})
  });
}
