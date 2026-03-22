import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
import { syncEthosUserPool } from "@/lib/data/user-pool";
import { env } from "@/lib/env";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | null, fallback = false) {
  if (value === null) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes";
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
  const limit = parsePositiveInt(url.searchParams.get("limit"), 500);
  const maxPages = parsePositiveInt(url.searchParams.get("pages"), Number.MAX_SAFE_INTEGER);
  const offset = parsePositiveInt(url.searchParams.get("offset"), 0);
  const refreshExisting = parseBoolean(url.searchParams.get("refresh"), false);
  const result = await syncEthosUserPool({
    limit,
    maxPages,
    offset,
    refreshExisting
  });

  return NextResponse.json(result);
}
