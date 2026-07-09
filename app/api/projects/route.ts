import { NextRequest, NextResponse } from "next/server";
import { listProjectDashboardData } from "@/lib/data/dashboard";
import type { TrustTier } from "@/lib/types/domain";

const VALID_TIERS = new Set(["T0", "T1", "T2", "T3", "T4", "T5"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tierParam = searchParams.get("tier");
  const tier = tierParam && VALID_TIERS.has(tierParam) ? (tierParam as TrustTier) : null;

  const data = await listProjectDashboardData({
    tier,
    windowDays: searchParams.get("window"),
    sort: searchParams.get("sort"),
    limit: searchParams.get("limit")
  });

  const response = NextResponse.json(data);
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  return response;
}
