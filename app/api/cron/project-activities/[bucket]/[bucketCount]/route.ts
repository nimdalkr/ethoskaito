import { NextRequest } from "next/server";

import { handleProjectActivitiesCron } from "@/lib/collector/project-activities-cron";

function parseBucket(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBucketCount(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { bucket: string; bucketCount: string } }
) {
  return handleProjectActivitiesCron(
    request,
    parseBucket(params.bucket, 0),
    parseBucketCount(params.bucketCount, 1)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { bucket: string; bucketCount: string } }
) {
  return handleProjectActivitiesCron(
    request,
    parseBucket(params.bucket, 0),
    parseBucketCount(params.bucketCount, 1)
  );
}
