import { getOfficialProjectUsernameSet, isOfficialProjectUsername, normalizeXUsername } from "@/lib/collector/project-accounts";
import { prisma } from "@/lib/db";
import { matchProjectsByText } from "@/lib/analytics/project-match";
import { getTierWeight } from "@/lib/analytics/tier";
import { ensureProjectCatalog } from "@/lib/data/projects";
import { buildEthosUserSnapshot, buildTrackedAccountWriteData, upsertEthosUser } from "@/lib/data/users";
import type { IngestBatchInput } from "@/lib/types/api";
import { ethosClient } from "@/lib/providers/ethos";
import { fxTwitterClient } from "@/lib/providers/fxtwitter";

async function ensureAliasesLoaded() {
  await ensureProjectCatalog();

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
  const normalizedUsername = normalizeXUsername(input.xUsername);
  const textMatches = matchProjectsByText(input.text, input.aliasCandidates);
  const handleMatches = input.aliasCandidates
    .filter((candidate) => candidate.aliases.some((alias) => normalizeXUsername(alias) === normalizedUsername))
    .map((candidate) => candidate.projectId);

  return [...new Set([...textMatches, ...handleMatches])];
}

/**
 * Keep exactly one earliest mention as first-tracked per project.
 * Uses mentionedAt ASC, id ASC as a stable tie-breaker.
 */
async function repairFirstTrackedMentions(projectIds: string[]) {
  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];
  if (uniqueProjectIds.length === 0) {
    return;
  }

  for (const projectId of uniqueProjectIds) {
    const earliest = await prisma.projectMention.findFirst({
      where: { projectId },
      orderBy: [{ mentionedAt: "asc" }, { id: "asc" }],
      select: { id: true }
    });

    if (!earliest) {
      continue;
    }

    await prisma.$transaction([
      prisma.projectMention.updateMany({
        where: {
          projectId,
          isFirstTrackedMention: true,
          NOT: { id: earliest.id }
        },
        data: { isFirstTrackedMention: false }
      }),
      prisma.projectMention.updateMany({
        where: {
          projectId,
          id: earliest.id,
          isFirstTrackedMention: false
        },
        data: { isFirstTrackedMention: true }
      })
    ]);
  }
}

async function ingestSingleTweet(
  item: IngestBatchInput["tweets"][number],
  aliasCandidates: Array<{ projectId: string; aliases: string[] }>,
  officialProjectUsernames: Set<string>,
  ethosUsersByUsername: Map<string, Awaited<ReturnType<typeof ethosClient.getUserByX>>>
) {
  const xUsername = normalizeXUsername(item.xUsername);

  const normalizedTweet = await fxTwitterClient.getTweetByStatus({
    xUsername,
    tweetId: item.tweetId,
    tweetUrl: item.tweetUrl
  });
  const tweetUsername = normalizeXUsername(normalizedTweet.xUsername || xUsername);

  let rawUser = ethosUsersByUsername.get(xUsername) ?? ethosUsersByUsername.get(tweetUsername) ?? null;
  if (!rawUser) {
    try {
      rawUser = await ethosClient.getUserByX(tweetUsername);
    } catch {
      rawUser = null;
    }
  }

  if (!rawUser) {
    throw new Error(`Ethos user not found for @${tweetUsername}`);
  }

  const snapshot = buildEthosUserSnapshot(rawUser, rawUser?.level ?? undefined);
  const userRecord = await upsertEthosUser(snapshot, rawUser);
  const isOfficialAuthor = isOfficialProjectUsername(tweetUsername, officialProjectUsernames);
  const trackedAccountData = buildTrackedAccountWriteData({
    xUsername: tweetUsername,
    ethosUserkey: snapshot.userkey,
    source: item.source,
    trustComposite: snapshot.trustComposite,
    lastObservedTweetAt: normalizedTweet.createdAt
  });

  const matchedProjectIds = await prisma.$transaction(async (tx) => {
    if (!isOfficialAuthor) {
      await tx.trackedAccount.upsert({
        where: { xUsername: trackedAccountData.xUsername },
        update: {
          ethosUserkey: snapshot.userkey,
          source: item.source,
          priorityScore: trackedAccountData.priorityScore
        },
        create: trackedAccountData
      });
    }

    const tweetRecord = await tx.tweet.upsert({
      where: { tweetId: normalizedTweet.tweetId },
      update: {
        url: normalizedTweet.url,
        xUsername: tweetUsername,
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
        xUsername: tweetUsername,
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

    const projectIds = matchProjectsForTweet({
      text: normalizedTweet.text,
      xUsername: tweetUsername,
      aliasCandidates
    });

    const mentionWeight = getTierWeight(snapshot.trustTier);
    const mentionedAt = new Date(normalizedTweet.createdAt);

    for (const projectId of projectIds) {
      // First-mention flag is repaired after the batch; avoid racey findFirst here.
      await tx.projectMention.upsert({
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
          weight: mentionWeight,
          mentionedAt
        },
        create: {
          tweetId: tweetRecord.id,
          projectId,
          authorUserkey: snapshot.userkey,
          authorTier: snapshot.trustTier,
          authorComposite: snapshot.trustComposite,
          weight: mentionWeight,
          isFirstTrackedMention: false,
          mentionedAt
        }
      });
    }

    return projectIds;
  });

  return {
    tweetId: normalizedTweet.tweetId,
    matchedProjects: matchedProjectIds.length,
    authorUserkey: snapshot.userkey,
    trustTier: snapshot.trustTier,
    projectIds: matchedProjectIds
  };
}

export async function ingestTweetBatch(input: IngestBatchInput) {
  const projects = await ensureAliasesLoaded();
  const officialProjectUsernames = await getOfficialProjectUsernameSet();
  const aliasCandidates = projects.map((project) => ({
    projectId: project.id,
    aliases: project.aliases.map((alias) => alias.alias)
  }));

  const normalizedUsernames = input.tweets.map((item) => normalizeXUsername(item.xUsername));
  const ethosUsersByUsername = await ethosClient.getUsersByX(normalizedUsernames);

  const results: Array<{
    tweetId: string;
    matchedProjects: number;
    authorUserkey: string;
    trustTier: string;
  }> = [];
  const errors: Array<{
    tweetId: string;
    xUsername: string;
    error: string;
  }> = [];
  const touchedProjectIds: string[] = [];

  for (const item of input.tweets) {
    try {
      const result = await ingestSingleTweet(item, aliasCandidates, officialProjectUsernames, ethosUsersByUsername);
      results.push({
        tweetId: result.tweetId,
        matchedProjects: result.matchedProjects,
        authorUserkey: result.authorUserkey,
        trustTier: result.trustTier
      });
      touchedProjectIds.push(...result.projectIds);
    } catch (error) {
      errors.push({
        tweetId: item.tweetId,
        xUsername: normalizeXUsername(item.xUsername),
        error: error instanceof Error ? error.message : "Unknown ingest error"
      });
    }
  }

  await repairFirstTrackedMentions(touchedProjectIds);

  return {
    processed: results.length,
    failed: errors.length,
    results,
    errors
  };
}
