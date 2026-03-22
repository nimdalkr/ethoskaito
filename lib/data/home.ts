import { isDatabaseConfigured, isDatabaseUnavailable, prisma } from "@/lib/db";
import { getDemoHomePageModel } from "@/lib/data/demo";
import type { EthosUserSnapshot, ProjectMention, ProjectOutcome, ProjectSnapshot, TierRollup } from "@/lib/types/domain";

export async function getHomePageModel() {
  if (!isDatabaseConfigured()) {
    return getDemoHomePageModel();
  }

  try {
  const [projects, users, outcomes, mentions] = await Promise.all([
    prisma.project.findMany({
      include: { aliases: true },
      orderBy: [{ totalVotes: "desc" }, { updatedAt: "desc" }],
      take: 12
    }),
    prisma.ethosUser.findMany({
      orderBy: [{ trustComposite: "desc" }, { score: "desc" }],
      take: 8
    }),
    prisma.projectOutcome.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.projectMention.findMany({
      include: { tweet: true },
      orderBy: { mentionedAt: "desc" },
      take: 200
    })
  ]);

  const projectSnapshots: ProjectSnapshot[] = projects.map((project: any) => ({
    id: project.id,
    projectId: project.projectId,
    userkey: project.userkey,
    name: project.name,
    username: project.username,
    description: project.description,
    categories: Array.isArray(project.categories) ? (project.categories as any) : [],
    chains: Array.isArray(project.chains) ? (project.chains as any) : [],
    totalVotes: project.totalVotes,
    uniqueVoters: project.uniqueVoters,
    bullishVotes: project.bullishVotes,
    bearishVotes: project.bearishVotes,
    commentCount: project.commentCount,
    aliases: project.aliases.map((alias: any) => alias.alias)
  }));

  const userSnapshots: EthosUserSnapshot[] = users.map((user: any) => ({
    userId: user.id,
    userkey: user.userkey,
    profileId: user.profileId,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    description: user.description,
    score: user.score,
    level: user.level as any,
    influenceFactor: user.influenceFactor,
    influenceFactorPercentile: user.influenceFactorPercentile,
    humanVerificationStatus: user.humanVerificationStatus as any,
    validatorNftCount: user.validatorNftCount,
    xpTotal: user.xpTotal,
    xpStreakDays: user.xpStreakDays,
    stats: {
      review: {
        received: {
          negative: user.reviewNegative,
          neutral: user.reviewNeutral,
          positive: user.reviewPositive
        }
      },
      vouch: {
        given: {
          amountWeiTotal: "0",
          count: user.vouchGivenCount
        },
        received: {
          amountWeiTotal: "0",
          count: user.vouchReceivedCount
        }
      }
    },
    trustComposite: user.trustComposite,
    trustTier: user.trustTier as any
  }));

  const projectOutcomes: ProjectOutcome[] = outcomes.map((outcome: any) => ({
    projectId: outcome.projectId,
    symbol: outcome.symbol,
    source: outcome.source,
    firstPriceAt: outcome.firstPriceAt?.toISOString() ?? null,
    latestPriceAt: outcome.latestPriceAt?.toISOString() ?? null,
    return1d: outcome.return1d,
    return7d: outcome.return7d,
    return30d: outcome.return30d
  }));

  const normalizedMentions: ProjectMention[] = mentions.map((mention: any) => ({
    tweetId: mention.tweet.tweetId,
    projectId: mention.projectId,
    authorUserkey: mention.authorUserkey,
    authorTier: mention.authorTier as any,
    authorComposite: mention.authorComposite,
    mentionedAt: mention.mentionedAt.toISOString(),
    weight: mention.weight,
    isFirstTrackedMention: mention.isFirstTrackedMention
  }));

  const tierRollupMap = new Map<string, TierRollup>();
  const authorBuckets = new Map<string, Set<string>>();

  for (const mention of normalizedMentions) {
    const key = `${mention.projectId}:${mention.authorTier}`;
    const bucket = authorBuckets.get(key) ?? new Set<string>();
    bucket.add(mention.authorUserkey);
    authorBuckets.set(key, bucket);

    const existing = tierRollupMap.get(key);
    if (existing) {
      existing.mentionCount += 1;
      existing.weightedMentions += mention.weight;
      existing.uniqueAuthors = bucket.size;
      if (!existing.firstMentionAt || mention.mentionedAt < existing.firstMentionAt) {
        existing.firstMentionAt = mention.mentionedAt;
      }
      continue;
    }

    tierRollupMap.set(key, {
      projectId: mention.projectId,
      tier: mention.authorTier,
      mentionCount: 1,
      weightedMentions: mention.weight,
      uniqueAuthors: 1,
      firstMentionAt: mention.mentionedAt
    });
  }

  return {
    projects: projectSnapshots,
    users: userSnapshots,
    outcomes: projectOutcomes,
    mentions: normalizedMentions,
    tierRollups: [...tierRollupMap.values()]
  };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return getDemoHomePageModel();
    }
    throw error;
  }
}
