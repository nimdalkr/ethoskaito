import { prisma } from "@/lib/db";
import { matchProjectsByText } from "@/lib/analytics/project-match";
import { getTierWeight } from "@/lib/analytics/tier";
import { syncProjectCatalog } from "@/lib/data/projects";
import { buildEthosUserSnapshot, upsertEthosUser } from "@/lib/data/users";
import type { IngestBatchInput } from "@/lib/types/api";
import { ethosClient } from "@/lib/providers/ethos";
import { fxTwitterClient } from "@/lib/providers/fxtwitter";

async function ensureAliasesLoaded() {
  const projectCount = await prisma.project.count();
  if (projectCount === 0) {
    await syncProjectCatalog();
  }

  return prisma.project.findMany({
    include: {
      aliases: true
    }
  });
}

export async function ingestTweetBatch(input: IngestBatchInput) {
  const projects = await ensureAliasesLoaded();
  const aliasCandidates = projects.map((project: any) => ({
    projectId: project.id,
    aliases: project.aliases.map((alias: any) => alias.alias)
  }));

  const results = [];

  for (const item of input.tweets) {
    const normalizedTweet = await fxTwitterClient.getTweetByStatus({
      xUsername: item.xUsername,
      tweetId: item.tweetId,
      tweetUrl: item.tweetUrl
    });

    const rawUser = await ethosClient.getUserByX(item.xUsername);
    const userkey = rawUser?.userkey ?? rawUser?.username ?? item.xUsername;
    const score = userkey ? await ethosClient.getScoreLevel(userkey) : null;
    const snapshot = buildEthosUserSnapshot(rawUser, score?.level);
    const userRecord = await upsertEthosUser(snapshot, rawUser);

    await prisma.trackedAccount.upsert({
      where: { xUsername: item.xUsername },
      update: {
        ethosUserkey: snapshot.userkey,
        source: item.source
      },
      create: {
        xUsername: item.xUsername,
        ethosUserkey: snapshot.userkey,
        source: item.source
      }
    });

    const tweetRecord = await prisma.tweet.upsert({
      where: { tweetId: normalizedTweet.tweetId },
      update: {
        url: normalizedTweet.url,
        xUsername: normalizedTweet.xUsername,
        authorName: normalizedTweet.author.name,
        text: normalizedTweet.text,
        createdAt: new Date(normalizedTweet.createdAt),
        observedAt: new Date(item.observedAt),
        source: item.source,
        likeCount: normalizedTweet.metrics.likes,
        repostCount: normalizedTweet.metrics.reposts,
        replyCount: normalizedTweet.metrics.replies,
        quoteCount: normalizedTweet.metrics.quotes,
        raw: normalizedTweet.raw as any,
        ethosUserId: userRecord.id
      },
      create: {
        tweetId: normalizedTweet.tweetId,
        url: normalizedTweet.url,
        xUsername: normalizedTweet.xUsername,
        authorName: normalizedTweet.author.name,
        text: normalizedTweet.text,
        createdAt: new Date(normalizedTweet.createdAt),
        observedAt: new Date(item.observedAt),
        source: item.source,
        likeCount: normalizedTweet.metrics.likes,
        repostCount: normalizedTweet.metrics.reposts,
        replyCount: normalizedTweet.metrics.replies,
        quoteCount: normalizedTweet.metrics.quotes,
        raw: normalizedTweet.raw as any,
        ethosUserId: userRecord.id
      }
    });

    const matchedProjectIds = matchProjectsByText(normalizedTweet.text, aliasCandidates);

    for (const projectId of matchedProjectIds) {
      const firstMention = await prisma.projectMention.findFirst({
        where: { projectId },
        orderBy: { mentionedAt: "asc" }
      });

      await prisma.projectMention.upsert({
        where: {
          tweetId_projectId: {
            tweetId: tweetRecord.id,
            projectId
          }
        },
        update: {
          authorUserkey: snapshot.userkey,
          authorTier: snapshot.trustTier,
          authorComposite: snapshot.trustComposite,
          weight: getTierWeight(snapshot.trustTier),
          isFirstTrackedMention: !firstMention || firstMention.tweetId === tweetRecord.id,
          mentionedAt: new Date(normalizedTweet.createdAt)
        },
        create: {
          tweetId: tweetRecord.id,
          projectId,
          authorUserkey: snapshot.userkey,
          authorTier: snapshot.trustTier,
          authorComposite: snapshot.trustComposite,
          weight: getTierWeight(snapshot.trustTier),
          isFirstTrackedMention: !firstMention,
          mentionedAt: new Date(normalizedTweet.createdAt)
        }
      });
    }

    results.push({
      tweetId: normalizedTweet.tweetId,
      matchedProjects: matchedProjectIds.length,
      authorUserkey: snapshot.userkey,
      trustTier: snapshot.trustTier
    });
  }

  return {
    processed: results.length,
    results
  };
}
