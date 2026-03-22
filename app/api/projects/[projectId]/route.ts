import { NextResponse } from "next/server";
import { getProjectDetail } from "@/lib/data/dashboard";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const project = await getProjectDetail(params.projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
