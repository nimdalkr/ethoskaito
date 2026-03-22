import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
import type { CollectorMode } from "@/lib/collector/scheduling";
import { env } from "@/lib/env";
import { collectTrackedTweets } from "@/lib/ingest/collect-tracked-tweets";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") ?? "main") as CollectorMode;
  const accountLimit = parsePositiveInt(url.searchParams.get("accounts"), 20);
  const tweetsPerAccount = parsePositiveInt(url.searchParams.get("tweets"), 5);
  const concurrency = parsePositiveInt(url.searchParams.get("concurrency"), 5);
  const shardId = url.searchParams.get("shard");
  const shardCount = parsePositiveInt(url.searchParams.get("shards"), 40);
  const result = await collectTrackedTweets({
    accountLimit,
    tweetsPerAccount,
    concurrency,
    mode,
    shardId: shardId === null ? null : Number.parseInt(shardId, 10),
    shardCount
  });

  return NextResponse.json(result);
}
