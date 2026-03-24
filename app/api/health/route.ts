import { getCollectorHealthSnapshot } from "@/lib/collector/health";
import { isDatabaseConfigured, isDatabaseUnavailable } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const databaseConfigured = isDatabaseConfigured();

  if (!databaseConfigured) {
    return NextResponse.json({
      ok: true,
      service: "ethos-alpha-dashboard",
      databaseConfigured,
      collector: null
    });
  }

  try {
    return NextResponse.json({
      ok: true,
      service: "ethos-alpha-dashboard",
      databaseConfigured,
      collector: await getCollectorHealthSnapshot()
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        {
          ok: false,
          service: "ethos-alpha-dashboard",
          databaseConfigured,
          collector: null,
          error: "database_unavailable"
        },
        {
          status: 503
        }
      );
    }

    throw error;
  }
}
