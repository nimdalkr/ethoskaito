import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { authorizeIngestApiKey } from "@/lib/env";
import { ingestBatchSchema } from "@/lib/types/api";
import { ingestTweetBatch } from "@/lib/ingest/ingest-batch";

export async function POST(request: NextRequest) {
  const auth = authorizeIngestApiKey(request.headers.get("x-api-key"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const json = await request.json();
  const parsed = ingestBatchSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const result = await ingestTweetBatch(parsed.data);
  const status = result.failed > 0 && result.processed === 0 ? 502 : result.failed > 0 ? 207 : 200;
  return NextResponse.json(result, { status });
}
