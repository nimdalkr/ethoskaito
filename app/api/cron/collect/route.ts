import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
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
  const accountLimit = parsePositiveInt(url.searchParams.get("accounts"), 20);
  const tweetsPerAccount = parsePositiveInt(url.searchParams.get("tweets"), 5);
  const concurrency = parsePositiveInt(url.searchParams.get("concurrency"), 5);
  const result = await collectTrackedTweets({
    accountLimit,
    tweetsPerAccount,
    concurrency
  });

  return NextResponse.json(result);
}
