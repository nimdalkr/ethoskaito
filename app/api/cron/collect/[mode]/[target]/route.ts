import { NextRequest } from "next/server";

import { handleCollectorRequest } from "@/lib/collector/cron";

export async function GET(
  request: NextRequest,
  { params }: { params: { mode: string; target: string } }
) {
  return handleCollectorRequest(request, {
    mode: params.mode,
    shard: params.target
  });
}
