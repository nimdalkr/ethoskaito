import { isDatabaseConfigured, isDatabaseUnavailable, prisma } from "@/lib/db";
import { getDemoProjectDetail, getDemoProjectFlow, getDemoUserDetail } from "@/lib/data/demo";
import { ethosClient } from "@/lib/providers/ethos";
import type { TrustTier } from "@/lib/types/domain";

function parseWindowDays(input: string | null) {
  const value = Number(input ?? 30);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function fromDateForWindow(windowDays: number) {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
}

export async function listProjectDashboardData(params: {
  tier?: TrustTier | null;
  windowDays?: string | null;
  sort?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      windowDays: parseWindowDays(params.windowDays ?? null),
      total: 0,
      projects: []
    };
  }

  try {
  const windowDays = parseWindowDays(params.windowDays ?? null);
  const fromDate = fromDateForWindow(windowDays);

  const projects = await prisma.project.findMany({
    include: {
      mentions: {
        where: {
          mentionedAt: { gte: fromDate },
          ...(params.tier ? { authorTier: params.tier } : {})
        },
        orderBy: { mentionedAt: "asc" },
        include: {
          tweet: {
            include: {
              ethosUser: true
            }
          }
        }
      },
      outcomes: true,
      aliases: true
    }
  });

  const rows = projects
    .map((project: any) => {
      const mentionCount = project.mentions.length;
      const weightedMentions = project.mentions.reduce((sum: number, mention: any) => sum + mention.weight, 0);
      const uniqueAuthors = new Set(project.mentions.map((mention: any) => mention.authorUserkey)).size;
      const firstMentionAt = project.mentions[0]?.mentionedAt ?? null;
      const outcome = project.outcomes[0] ?? null;

      const tierBreakdown = ["T0", "T1", "T2", "T3", "T4", "T5"].map((tier) => {
        const tierMentions = project.mentions.filter((mention: any) => mention.authorTier === tier);
        return {
          tier,
          mentionCount: tierMentions.length,
          weightedMentions: tierMentions.reduce((sum: number, mention: any) => sum + mention.weight, 0),
          firstMentionAt: tierMentions[0]?.mentionedAt ?? null
        };
      });

      return {
        id: project.id,
        projectId: project.projectId,
        name: project.name,
        username: project.username,
        description: project.description,
        mentionCount,
        weightedMentions,
        uniqueAuthors,
        firstMentionAt,
        categories: project.categories,
        chains: project.chains,
        outcome,
        tierBreakdown
      };
    })
    .filter((row: any) => row.mentionCount > 0);

  const sorted = rows.sort((a: any, b: any) => {
    switch (params.sort) {
      case "firstMention":
        return (a.firstMentionAt?.getTime() ?? 0) - (b.firstMentionAt?.getTime() ?? 0);
      case "outcome30d":
        return (b.outcome?.return30d ?? -Infinity) - (a.outcome?.return30d ?? -Infinity);
      case "mentions":
      default:
        return b.weightedMentions - a.weightedMentions;
    }
  });

  return {
    windowDays,
    total: sorted.length,
    projects: sorted
  };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return {
        windowDays: parseWindowDays(params.windowDays ?? null),
        total: 0,
        projects: []
      };
    }
    throw error;
  }
}

export async function getProjectDetail(projectId: string) {
  if (!isDatabaseConfigured()) {
    return getDemoProjectDetail(projectId);
  }

  try {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      aliases: true,
      outcomes: true,
      marketMappings: true,
      mentions: {
        orderBy: { mentionedAt: "asc" },
        include: {
          tweet: {
            include: {
              ethosUser: true
            }
          }
        }
      }
    }
  });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

export async function getProjectFlow(projectId: string) {
  if (!isDatabaseConfigured()) {
    return getDemoProjectFlow(projectId);
  }

  try {
  const mentions = await prisma.projectMention.findMany({
    where: { projectId },
    orderBy: { mentionedAt: "asc" }
  });

  const firstByTier = new Map<TrustTier, Date>();
  for (const mention of mentions) {
    const tier = mention.authorTier as TrustTier;
    if (!firstByTier.has(tier)) {
      firstByTier.set(tier, mention.mentionedAt);
    }
  }

  const tierOrder: TrustTier[] = ["T5", "T4", "T3", "T2", "T1", "T0"];
  const edges = [];

  for (let i = 0; i < tierOrder.length; i += 1) {
    for (let j = i + 1; j < tierOrder.length; j += 1) {
      const source = tierOrder[i];
      const target = tierOrder[j];
      const sourceDate = firstByTier.get(source);
      const targetDate = firstByTier.get(target);

      if (!sourceDate || !targetDate) {
        continue;
      }

      const diffHours = (targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours <= 72) {
        edges.push({
          source,
          target,
          startedAt: sourceDate,
          reachedAt: targetDate,
          delayHours: Math.round(diffHours * 10) / 10
        });
      }
    }
  }

  return {
    projectId,
    firstByTier: Object.fromEntries([...firstByTier.entries()].map(([tier, date]) => [tier, date.toISOString()])),
    edges
  };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return {
        projectId,
        firstByTier: {},
        edges: []
      };
    }
    throw error;
  }
}

export async function getUserDetail(userkey: string) {
  if (!isDatabaseConfigured()) {
    return getDemoUserDetail(userkey);
  }

  try {
  const user = await prisma.ethosUser.findUnique({
    where: { userkey }
  });

  if (!user) {
    return null;
  }

  const mentions = await prisma.projectMention.findMany({
    where: { authorUserkey: userkey },
    include: {
      project: true
    },
    orderBy: { mentionedAt: "asc" }
  });

  const firstMentions = mentions.filter((mention: any) => mention.isFirstTrackedMention);
  const hitRate = mentions.length > 0 ? firstMentions.length / mentions.length : 0;
  const [categoriesResult, activitiesResult, xpResult] = await Promise.allSettled([
    ethosClient.getUserCategoryRanks(user.userkey),
    ethosClient.getProfileActivities(user.userkey, { limit: 6 }),
    user.profileId ? ethosClient.getXpMultipliers(user.profileId) : Promise.resolve(null)
  ]);

  return {
    user,
    mentionCount: mentions.length,
    firstMentionCount: firstMentions.length,
    hitRate,
    categories: categoriesResult.status === "fulfilled" ? categoriesResult.value.categoryRanks : [],
    recentActivities: activitiesResult.status === "fulfilled" ? activitiesResult.value.values : [],
    xpMultipliers: xpResult.status === "fulfilled" ? xpResult.value : null,
    projects: firstMentions.map((mention: any) => ({
      projectId: mention.projectId,
      projectName: mention.project.name,
      mentionedAt: mention.mentionedAt,
      weight: mention.weight
    }))
  };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return null;
    }
    throw error;
  }
}
