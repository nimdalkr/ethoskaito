import { NextResponse } from "next/server";
import { getProjectFlow } from "@/lib/data/dashboard";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  return NextResponse.json(await getProjectFlow(params.projectId));
}
