import { NextResponse } from "next/server";
import { getProjectDetail } from "@/lib/data/dashboard";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const project = await getProjectDetail(params.projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    projectId: project.id,
    mentions: project.mentions.map((mention: any) => ({
      id: mention.id,
      tweetId: mention.tweet.tweetId,
      text: mention.tweet.text,
      url: mention.tweet.url,
      xUsername: mention.tweet.xUsername,
      authorName: mention.tweet.authorName,
      authorUserkey: mention.authorUserkey,
      authorTier: mention.authorTier,
      authorComposite: mention.authorComposite,
      weight: mention.weight,
      mentionedAt: mention.mentionedAt,
      isFirstTrackedMention: mention.isFirstTrackedMention
    }))
  });
}
