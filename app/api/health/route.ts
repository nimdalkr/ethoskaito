import { getCollectorHealthSnapshot } from "@/lib/collector/health";
import { isDatabaseConfigured, isDatabaseUnavailable } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return response;
}

export async function GET() {
  const databaseConfigured = isDatabaseConfigured();

  if (!databaseConfigured) {
    return jsonNoStore({
      ok: true,
      service: "ethos-alpha-dashboard",
      databaseConfigured,
      collector: null
    });
  }

  try {
    return jsonNoStore({
      ok: true,
      service: "ethos-alpha-dashboard",
      databaseConfigured,
      collector: await getCollectorHealthSnapshot()
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonNoStore(
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
