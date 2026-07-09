import { unstable_cache } from "next/cache";

import { isDatabaseConfigured, isDatabaseUnavailable, prisma } from "@/lib/db";
import { getDemoHomePageModel } from "@/lib/data/demo";
import type {
  CollectorOpsSummary,
  DataFreshness,
  EthosUserSnapshot,
  ProjectMention,
  ProjectOutcome,
  ProjectSnapshot,
  TierRollup
} from "@/lib/types/domain";

const HOME_MENTION_LIMIT = 1500;
const HOME_PROJECT_LIMIT = 64;
const HOME_CACHE_SECONDS = 60;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Load enough history for 6M window + previous-period deltas. */
const MENTION_LOOKBACK_DAYS = 360;

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
    } satisfies CollectorOpsSummary,
    freshness: {
      latestMentionAt: null,
      latestTweetObservedAt: null,
      latestCollectorRunAt: null,
      mentionsLast90d: 0,
      mentionsLast180d: 0,
      totalMentions: 0,
      isStale: true
    } satisfies DataFreshness
  };
}

function logoFromProject(project: {
  raw: unknown;
  chains: unknown;
}) {
  const raw = project.raw as { user?: { avatarUrl?: string }; bannerImageUrl?: string } | null;
  const chains = Array.isArray(project.chains) ? (project.chains as Array<{ iconUrl?: string | null }>) : [];
  return raw?.user?.avatarUrl ?? raw?.bannerImageUrl ?? chains[0]?.iconUrl ?? null;
}

async function loadHomePageModel() {
  const now = Date.now();
  const window90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const window180 = new Date(now - 180 * 24 * 60 * 60 * 1000);
  const window24h = new Date(now - 24 * 60 * 60 * 1000);
  const mentionLookback = new Date(now - MENTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [
    projectCount,
    projects,
    users,
    outcomes,
    mentions,
    totalUsers,
    totalTrackedAccounts,
    coveredLast24h,
    dueNow,
    failedAccounts,
    latestRun,
    latestMainRun,
    latestRepairRun,
    latestHotRun,
    latestMention,
    latestTweet,
    totalMentions,
    mentionsLast90d,
    mentionsLast180d
  ] = await Promise.all([
    prisma.project.count(),
    prisma.project.findMany({
      select: {
        id: true,
        projectId: true,
        userkey: true,
        name: true,
        username: true,
        description: true,
        categories: true,
        chains: true,
        totalVotes: true,
        uniqueVoters: true,
        bullishVotes: true,
        bearishVotes: true,
        commentCount: true,
        raw: true,
        updatedAt: true,
        aliases: { select: { alias: true } }
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.ethosUser.findMany({
      orderBy: [{ trustComposite: "desc" }, { score: "desc" }],
      take: 8,
      select: {
        id: true,
        userkey: true,
        profileId: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        description: true,
        score: true,
        level: true,
        influenceFactor: true,
        influenceFactorPercentile: true,
        humanVerificationStatus: true,
        validatorNftCount: true,
        xpTotal: true,
        xpStreakDays: true,
        reviewNegative: true,
        reviewNeutral: true,
        reviewPositive: true,
        vouchGivenCount: true,
        vouchReceivedCount: true,
        trustComposite: true,
        trustTier: true
      }
    }),
    prisma.projectOutcome.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        projectId: true,
        symbol: true,
        source: true,
        firstPriceAt: true,
        latestPriceAt: true,
        return1d: true,
        return7d: true,
        return30d: true
      }
    }),
    prisma.projectMention.findMany({
      where: {
        mentionedAt: { gte: mentionLookback }
      },
      orderBy: { mentionedAt: "desc" },
      take: HOME_MENTION_LIMIT,
      select: {
        projectId: true,
        authorUserkey: true,
        authorTier: true,
        authorComposite: true,
        mentionedAt: true,
        weight: true,
        isFirstTrackedMention: true,
        tweet: {
          select: {
            tweetId: true
          }
        }
      }
    }),
    prisma.ethosUser.count(),
    prisma.trackedAccount.count({ where: { isActive: true } }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        lastSuccessfulSweepAt: { gte: window24h }
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: new Date(now) } }]
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ lastCollectorError: { not: null } }, { consecutiveFailures: { gt: 0 } }]
      }
    }),
    prisma.collectorRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.collectorRun.findFirst({
      where: { mode: "main", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true }
    }),
    prisma.collectorRun.findFirst({
      where: { mode: "repair", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true }
    }),
    prisma.collectorRun.findFirst({
      where: { mode: "hot", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true }
    }),
    prisma.projectMention.findFirst({
      orderBy: { mentionedAt: "desc" },
      select: { mentionedAt: true }
    }),
    prisma.tweet.findFirst({
      orderBy: { observedAt: "desc" },
      select: { observedAt: true }
    }),
    prisma.projectMention.count(),
    prisma.projectMention.count({ where: { mentionedAt: { gte: window90 } } }),
    prisma.projectMention.count({ where: { mentionedAt: { gte: window180 } } })
  ]);

  // Catalog sync is owned by cron/refresh — avoid calling Ethos on every homepage hit.
  // Only surface a hint via empty project count (ops should run /api/cron/refresh).
  void projectCount;

  const mentionWeightByProject = new Map<string, number>();
  for (const mention of mentions) {
    mentionWeightByProject.set(
      mention.projectId,
      (mentionWeightByProject.get(mention.projectId) ?? 0) + mention.weight
    );
  }

  const projectSnapshots: ProjectSnapshot[] = projects
    .slice()
    .sort((left, right) => {
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
    .slice(0, HOME_PROJECT_LIMIT)
    .map((project) => ({
      id: project.id,
      projectId: project.projectId,
      userkey: project.userkey,
      name: project.name,
      logoUrl: logoFromProject(project),
      username: project.username,
      description: project.description,
      categories: Array.isArray(project.categories) ? (project.categories as ProjectSnapshot["categories"]) : [],
      chains: Array.isArray(project.chains) ? (project.chains as ProjectSnapshot["chains"]) : [],
      totalVotes: project.totalVotes,
      uniqueVoters: project.uniqueVoters,
      bullishVotes: project.bullishVotes,
      bearishVotes: project.bearishVotes,
      commentCount: project.commentCount,
      aliases: project.aliases.map((alias) => alias.alias)
    }));

  const userSnapshots: EthosUserSnapshot[] = users.map((user) => ({
    userId: user.id,
    userkey: user.userkey,
    profileId: user.profileId,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    description: user.description,
    score: user.score,
    level: user.level as EthosUserSnapshot["level"],
    influenceFactor: user.influenceFactor,
    influenceFactorPercentile: user.influenceFactorPercentile,
    humanVerificationStatus: user.humanVerificationStatus as EthosUserSnapshot["humanVerificationStatus"],
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
    trustTier: user.trustTier as EthosUserSnapshot["trustTier"]
  }));

  const projectOutcomes: ProjectOutcome[] = outcomes.map((outcome) => ({
    projectId: outcome.projectId,
    symbol: outcome.symbol,
    source: outcome.source,
    firstPriceAt: outcome.firstPriceAt?.toISOString() ?? null,
    latestPriceAt: outcome.latestPriceAt?.toISOString() ?? null,
    return1d: outcome.return1d,
    return7d: outcome.return7d,
    return30d: outcome.return30d
  }));

  const normalizedMentions: ProjectMention[] = mentions.map((mention) => ({
    tweetId: mention.tweet.tweetId,
    projectId: mention.projectId,
    authorUserkey: mention.authorUserkey,
    authorTier: mention.authorTier as ProjectMention["authorTier"],
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

  const latestMentionAt = latestMention?.mentionedAt.toISOString() ?? null;
  const latestCollectorRunAt = latestRun?.startedAt.toISOString() ?? null;
  const latestActivityMs = latestMention?.mentionedAt.getTime() ?? latestRun?.startedAt.getTime() ?? 0;
  const isStale = !latestActivityMs || now - latestActivityMs > STALE_AFTER_MS;

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
    },
    freshness: {
      latestMentionAt,
      latestTweetObservedAt: latestTweet?.observedAt.toISOString() ?? null,
      latestCollectorRunAt,
      mentionsLast90d,
      mentionsLast180d,
      totalMentions,
      isStale
    } satisfies DataFreshness
  };
}

const getCachedHomePageModel = unstable_cache(loadHomePageModel, ["home-page-model-v2"], {
  revalidate: HOME_CACHE_SECONDS
});

export async function getHomePageModel() {
  if (!isDatabaseConfigured()) {
    const demo = getDemoHomePageModel();
    return {
      ...demo,
      freshness: {
        latestMentionAt: demo.mentions[0]?.mentionedAt ?? null,
        latestTweetObservedAt: null,
        latestCollectorRunAt: null,
        mentionsLast90d: demo.mentions.length,
        mentionsLast180d: demo.mentions.length,
        totalMentions: demo.mentions.length,
        isStale: false
      } satisfies DataFreshness
    };
  }

  try {
    return await getCachedHomePageModel();
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return getEmptyHomePageModel();
    }
    throw error;
  }
}
