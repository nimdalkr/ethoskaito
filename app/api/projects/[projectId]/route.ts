import { NextRequest, NextResponse } from "next/server";
import { getProjectDetail } from "@/lib/data/dashboard";

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const mentionLimit = new URL(request.url).searchParams.get("mentionLimit");
  const project = await getProjectDetail(params.projectId, { mentionLimit });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const response = NextResponse.json(project);
  response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  return response;
}
