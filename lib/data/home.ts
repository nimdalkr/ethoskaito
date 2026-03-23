import { isDatabaseConfigured, isDatabaseUnavailable, prisma } from "@/lib/db";
import { getDemoHomePageModel } from "@/lib/data/demo";
import { ensureProjectCatalog } from "@/lib/data/projects";
import type { CollectorOpsSummary, EthosUserSnapshot, ProjectMention, ProjectOutcome, ProjectSnapshot, TierRollup } from "@/lib/types/domain";

function getEmptyHomePageModel() {
  return {
    projects: [] as ProjectSnapshot[],
    users: [] as EthosUserSnapshot[],
    outcomes: [] as ProjectOutcome[],
    mentions: [] as ProjectMention[],
    tierRollups: [] as TierRollup[],
    totalUsers: 0,
    totalTrackedAccounts: 0,
    collectorSummary: {
      totalTrackedAccounts: 0,
      coveredLast24h: 0,
      coveragePct: 0,
      dueNow: 0,
      failedAccounts: 0,
      latestRun: null,
      latestMainCompletedAt: null,
      latestRepairCompletedAt: null,
      latestHotCompletedAt: null
    } satisfies CollectorOpsSummary
  };
}

export async function getHomePageModel() {
  if (!isDatabaseConfigured()) {
    return getDemoHomePageModel();
  }

  try {
    await ensureProjectCatalog();

    const projects = await prisma.project.findMany({
      include: { aliases: true },
      orderBy: [{ updatedAt: "desc" }]
    });
    const users = await prisma.ethosUser.findMany({
      orderBy: [{ trustComposite: "desc" }, { score: "desc" }],
      take: 8
    });
    const outcomes = await prisma.projectOutcome.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20
    });
    const mentions = await prisma.projectMention.findMany({
      include: { tweet: true },
      orderBy: { mentionedAt: "desc" },
      take: 1500
    });
    const totalUsers = await prisma.ethosUser.count();
    const totalTrackedAccounts = await prisma.trackedAccount.count({
      where: {
        isActive: true
      }
    });
    const coveredLast24h = await prisma.trackedAccount.count({
      where: {
        isActive: true,
        lastSuccessfulSweepAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    const dueNow = await prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: new Date() } }]
      }
    });
    const failedAccounts = await prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ lastCollectorError: { not: null } }, { consecutiveFailures: { gt: 0 } }]
      }
    });
    const latestRun = await prisma.collectorRun.findFirst({
      orderBy: {
        startedAt: "desc"
      }
    });
    const latestMainRun = await prisma.collectorRun.findFirst({
      where: {
        mode: "main",
        completedAt: {
          not: null
        }
      },
      orderBy: {
        completedAt: "desc"
      }
    });
    const latestRepairRun = await prisma.collectorRun.findFirst({
      where: {
        mode: "repair",
        completedAt: {
          not: null
        }
      },
      orderBy: {
        completedAt: "desc"
      }
    });
    const latestHotRun = await prisma.collectorRun.findFirst({
      where: {
        mode: "hot",
        completedAt: {
          not: null
        }
      },
      orderBy: {
        completedAt: "desc"
      }
    });

  const mentionWeightByProject = new Map<string, number>();
  for (const mention of mentions) {
    mentionWeightByProject.set(mention.projectId, (mentionWeightByProject.get(mention.projectId) ?? 0) + mention.weight);
  }

  const projectSnapshots: ProjectSnapshot[] = projects
    .slice()
    .sort((left: any, right: any) => {
      const leftWeight = mentionWeightByProject.get(left.id) ?? 0;
      const rightWeight = mentionWeightByProject.get(right.id) ?? 0;
      if (rightWeight !== leftWeight) {
        return rightWeight - leftWeight;
      }

      if (right.totalVotes !== left.totalVotes) {
        return right.totalVotes - left.totalVotes;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, 64)
    .map((project: any) => ({
    id: project.id,
    projectId: project.projectId,
    userkey: project.userkey,
    name: project.name,
    logoUrl:
      (project.raw as any)?.user?.avatarUrl ??
      (project.raw as any)?.bannerImageUrl ??
      project.chains?.[0]?.iconUrl ??
      null,
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
    tierRollups: [...tierRollupMap.values()],
    totalUsers,
    totalTrackedAccounts,
    collectorSummary: {
      totalTrackedAccounts,
      coveredLast24h,
      coveragePct: totalTrackedAccounts > 0 ? Math.round((coveredLast24h / totalTrackedAccounts) * 100) : 0,
      dueNow,
      failedAccounts,
      latestRun: latestRun
        ? {
            mode: latestRun.mode,
            status: latestRun.status,
            startedAt: latestRun.startedAt.toISOString(),
            completedAt: latestRun.completedAt?.toISOString() ?? null,
            selectedAccounts: latestRun.selectedAccounts,
            processedAccounts: latestRun.processedAccounts,
            errorCount: latestRun.errorCount,
            shardId: latestRun.shardId
          }
        : null,
      latestMainCompletedAt: latestMainRun?.completedAt?.toISOString() ?? null,
      latestRepairCompletedAt: latestRepairRun?.completedAt?.toISOString() ?? null,
      latestHotCompletedAt: latestHotRun?.completedAt?.toISOString() ?? null
    }
  };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return getEmptyHomePageModel();
    }
    throw error;
  }
}
