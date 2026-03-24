import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
import { env } from "@/lib/env";
import { collectProjectActivities } from "@/lib/ingest/project-activities";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function handleProjectActivitiesCron(request: NextRequest, bucketIndex = 0, bucketCount = 1) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const result = await collectProjectActivities({
    bucketIndex,
    bucketCount,
    activityLimit: parsePositiveInt(url.searchParams.get("activityLimit"), 10),
    sinceHours: parsePositiveInt(url.searchParams.get("sinceHours"), 72),
    projectLimit: parsePositiveInt(url.searchParams.get("projectLimit"), 0) || undefined
  });

  return NextResponse.json(result);
}
