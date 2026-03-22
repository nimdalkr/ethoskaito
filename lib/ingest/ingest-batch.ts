import { prisma } from "@/lib/db";
import { matchProjectsByText } from "@/lib/analytics/project-match";
import { getTierWeight } from "@/lib/analytics/tier";
import { syncProjectCatalog } from "@/lib/data/projects";
import { buildEthosUserSnapshot, buildTrackedAccountWriteData, upsertEthosUser } from "@/lib/data/users";
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

function matchProjectsForTweet(input: {
  text: string;
  xUsername: string;
  aliasCandidates: Array<{ projectId: string; aliases: string[] }>;
}) {
  const textMatches = matchProjectsByText(input.text, input.aliasCandidates);
  const handleMatches = input.aliasCandidates
    .filter((candidate) =>
      candidate.aliases.some((alias) => alias.trim().toLowerCase() === input.xUsername.trim().toLowerCase())
    )
    .map((candidate) => candidate.projectId);

  return [...new Set([...textMatches, ...handleMatches])];
}

export async function ingestTweetBatch(input: IngestBatchInput) {
  const projects = await ensureAliasesLoaded();
  const aliasCandidates = projects.map((project: any) => ({
    projectId: project.id,
    aliases: project.aliases.map((alias: any) => alias.alias)
  }));
  const ethosUsersByUsername = await ethosClient.getUsersByX(input.tweets.map((item) => item.xUsername));

  const results = [];

  for (const item of input.tweets) {
    const normalizedTweet = await fxTwitterClient.getTweetByStatus({
      xUsername: item.xUsername,
      tweetId: item.tweetId,
      tweetUrl: item.tweetUrl
    });

    const rawUser = ethosUsersByUsername.get(item.xUsername.trim().toLowerCase()) ?? (await ethosClient.getUserByX(item.xUsername));
    const snapshot = buildEthosUserSnapshot(rawUser, rawUser?.level ?? undefined);
    const userRecord = await upsertEthosUser(snapshot, rawUser);

    await prisma.trackedAccount.upsert({
      where: { xUsername: item.xUsername },
      update: {
        ethosUserkey: snapshot.userkey,
        source: item.source,
        priorityScore: buildTrackedAccountWriteData({
          xUsername: item.xUsername,
          ethosUserkey: snapshot.userkey,
          source: item.source,
          trustComposite: snapshot.trustComposite,
          lastObservedTweetAt: normalizedTweet.createdAt
        }).priorityScore
      },
      create: {
        ...buildTrackedAccountWriteData({
          xUsername: item.xUsername,
          ethosUserkey: snapshot.userkey,
          source: item.source,
          trustComposite: snapshot.trustComposite,
          lastObservedTweetAt: normalizedTweet.createdAt
        })
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

    const matchedProjectIds = matchProjectsForTweet({
      text: normalizedTweet.text,
      xUsername: normalizedTweet.xUsername,
      aliasCandidates
    });

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
