import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ingestBatchSchema } from "@/lib/types/api";
import { ingestTweetBatch } from "@/lib/ingest/ingest-batch";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== env.INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  return NextResponse.json(result);
}
