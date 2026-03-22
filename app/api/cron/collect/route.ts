import { NextRequest } from "next/server";

import { handleCollectorRequest } from "@/lib/collector/cron";

export async function GET(request: NextRequest) {
  return handleCollectorRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCollectorRequest(request);
}
