import { NextRequest, NextResponse } from "next/server";
import { listProjectDashboardData } from "@/lib/data/dashboard";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await listProjectDashboardData({
    tier: (searchParams.get("tier") as any) ?? null,
    windowDays: searchParams.get("window"),
    sort: searchParams.get("sort")
  });

  return NextResponse.json(data);
}
