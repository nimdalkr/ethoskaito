import { NextRequest } from "next/server";

import { handleProjectActivitiesCron } from "@/lib/collector/project-activities-cron";

export async function GET(request: NextRequest) {
  return handleProjectActivitiesCron(request);
}

export async function POST(request: NextRequest) {
  return handleProjectActivitiesCron(request);
}
