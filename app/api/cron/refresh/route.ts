import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { syncProjectCatalog } from "@/lib/data/projects";
import { priceClient } from "@/lib/providers/price";

function pickReturn(points: Array<{ at: string; price: number }>, days: number) {
  if (points.length === 0) {
    return null;
  }

  const latest = points[points.length - 1];
  const targetTime = new Date(latest.at).getTime() - days * 24 * 60 * 60 * 1000;
  const baseline =
    [...points]
      .reverse()
      .find((point) => new Date(point.at).getTime() <= targetTime) ?? points[0];

  if (!baseline || baseline.price === 0) {
    return null;
  }

  return ((latest.price - baseline.price) / baseline.price) * 100;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  const syncedProjects = await syncProjectCatalog();
  const mappings = await prisma.projectMarketMapping.findMany({
    where: { isPrimary: true },
    include: { project: true }
  });

  let outcomesUpdated = 0;

  for (const mapping of mappings) {
    const snapshot = await priceClient.getProjectOutcomeSnapshot({
      symbol: mapping.symbol,
      from: mapping.project.createdAt.toISOString()
    });

    await prisma.projectOutcome.upsert({
      where: {
        projectId_source_symbol: {
          projectId: mapping.projectId,
          source: mapping.source,
          symbol: mapping.symbol
        }
      },
      update: {
        firstPriceAt: snapshot.points[0]?.at ? new Date(snapshot.points[0].at) : null,
        latestPriceAt: snapshot.points.at(-1)?.at ? new Date(snapshot.points.at(-1)!.at) : null,
        return1d: pickReturn(snapshot.points, 1),
        return7d: pickReturn(snapshot.points, 7),
        return30d: pickReturn(snapshot.points, 30),
        raw: snapshot as any
      },
      create: {
        projectId: mapping.projectId,
        source: mapping.source,
        symbol: mapping.symbol,
        firstPriceAt: snapshot.points[0]?.at ? new Date(snapshot.points[0].at) : null,
        latestPriceAt: snapshot.points.at(-1)?.at ? new Date(snapshot.points.at(-1)!.at) : null,
        return1d: pickReturn(snapshot.points, 1),
        return7d: pickReturn(snapshot.points, 7),
        return30d: pickReturn(snapshot.points, 30),
        raw: snapshot as any
      }
    });
    outcomesUpdated += 1;
  }

  return NextResponse.json({
    syncedProjects,
    outcomesUpdated
  });
}
