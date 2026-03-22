import { NextResponse } from "next/server";
import { getUserDetail } from "@/lib/data/dashboard";

export async function GET(_: Request, { params }: { params: { userkey: string } }) {
  const user = await getUserDetail(params.userkey);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
