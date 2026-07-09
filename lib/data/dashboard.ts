import { isDatabaseConfigured, isDatabaseUnavailable, prisma } from "@/lib/db";
import { getDemoProjectDetail, getDemoProjectFlow, getDemoUserDetail } from "@/lib/data/demo";
import { ethosClient } from "@/lib/providers/ethos";
import type { TrustTier } from "@/lib/types/domain";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;
const DEFAULT_DETAIL_MENTION_LIMIT = 200;
const MAX_DETAIL_MENTION_LIMIT = 500;

function parseWindowDays(input: string | null) {
  const value = Number(input ?? 30);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function fromDateForWindow(windowDays: number) {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
}

function parseLimit(input: string | null | undefined, fallback: number, max: number) {
  if (!input) {
    return fallback;
  }

  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export async function listProjectDashboardData(params: {
  tier?: TrustTier | null;
  windowDays?: string | null;
  sort?: string | null;
  limit?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      windowDays: parseWindowDays(params.windowDays ?? null),
      total: 0,
      limit: parseLimit(params.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
      projects: []
    };
  }

  try {
    const windowDays = parseWindowDays(params.windowDays ?? null);
    const fromDate = fromDateForWindow(windowDays);
    const limit = parseLimit(params.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const mentionWhere = {
      mentionedAt: { gte: fromDate },
      ...(params.tier ? { authorTier: params.tier } : {})
    };

    const [tierGroups, authorGroups, projects, outcomes] = await Promise.all([
      prisma.projectMention.groupBy({
        by: ["projectId", "authorTier"],
        where: mentionWhere,
        _count: { _all: true },
        _sum: { weight: true },
        _min: { mentionedAt: true }
      }),
      prisma.projectMention.groupBy({
        by: ["projectId", "authorUserkey"],
        where: mentionWhere,
        _count: { _all: true }
      }),
      prisma.project.findMany({
        select: {
          id: true,
          projectId: true,
          name: true,
          username: true,
          description: true,
          categories: true,
          chains: true
        }
      }),
      prisma.projectOutcome.findMany({
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const projectById = new Map(projects.map((project) => [project.id, project]));
    const outcomeByProjectId = new Map<string, (typeof outcomes)[number]>();
    for (const outcome of outcomes) {
      if (!outcomeByProjectId.has(outcome.projectId)) {
        outcomeByProjectId.set(outcome.projectId, outcome);
      }
    }

    type Acc = {
      mentionCount: number;
      weightedMentions: number;
      firstMentionAt: Date | null;
      uniqueAuthors: Set<string>;
      tierBreakdown: Map<string, { mentionCount: number; weightedMentions: number; firstMentionAt: Date | null }>;
    };

    const statsByProject = new Map<string, Acc>();

    for (const group of tierGroups) {
      const current = statsByProject.get(group.projectId) ?? {
        mentionCount: 0,
        weightedMentions: 0,
        firstMentionAt: null,
        uniqueAuthors: new Set<string>(),
        tierBreakdown: new Map()
      };

      const mentionCount = group._count._all;
      const weightedMentions = group._sum.weight ?? 0;
      const firstMentionAt = group._min.mentionedAt;

      current.mentionCount += mentionCount;
      current.weightedMentions += weightedMentions;
      if (
        firstMentionAt &&
        (!current.firstMentionAt || firstMentionAt.getTime() < current.firstMentionAt.getTime())
      ) {
        current.firstMentionAt = firstMentionAt;
      }

      current.tierBreakdown.set(group.authorTier, {
        mentionCount,
        weightedMentions,
        firstMentionAt
      });

      statsByProject.set(group.projectId, current);
    }

    for (const group of authorGroups) {
      const current = statsByProject.get(group.projectId);
      if (!current) {
        continue;
      }
      current.uniqueAuthors.add(group.authorUserkey);
    }

    const rows = [...statsByProject.entries()]
      .map(([projectId, stats]) => {
        const project = projectById.get(projectId);
        if (!project || stats.mentionCount === 0) {
          return null;
        }

        const tierBreakdown = ["T0", "T1", "T2", "T3", "T4", "T5"].map((tier) => {
          const row = stats.tierBreakdown.get(tier);
          return {
            tier,
            mentionCount: row?.mentionCount ?? 0,
            weightedMentions: row?.weightedMentions ?? 0,
            firstMentionAt: row?.firstMentionAt ?? null
          };
        });

        return {
          id: project.id,
          projectId: project.projectId,
          name: project.name,
          username: project.username,
          description: project.description,
          mentionCount: stats.mentionCount,
          weightedMentions: stats.weightedMentions,
          uniqueAuthors: stats.uniqueAuthors.size,
          firstMentionAt: stats.firstMentionAt,
          categories: project.categories,
          chains: project.chains,
          outcome: outcomeByProjectId.get(project.id) ?? null,
          tierBreakdown
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const sorted = rows.sort((a, b) => {
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
      limit,
      projects: sorted.slice(0, limit)
    };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return {
        windowDays: parseWindowDays(params.windowDays ?? null),
        total: 0,
        limit: parseLimit(params.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
        projects: []
      };
    }
    throw error;
  }
}

export async function getProjectDetail(projectId: string, options?: { mentionLimit?: string | null }) {
  if (!isDatabaseConfigured()) {
    return getDemoProjectDetail(projectId);
  }

  try {
    const mentionLimit = parseLimit(options?.mentionLimit, DEFAULT_DETAIL_MENTION_LIMIT, MAX_DETAIL_MENTION_LIMIT);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        aliases: true,
        outcomes: true,
        marketMappings: true,
        mentions: {
          orderBy: { mentionedAt: "desc" },
          take: mentionLimit,
          include: {
            tweet: {
              select: {
                id: true,
                tweetId: true,
                url: true,
                xUsername: true,
                authorName: true,
                text: true,
                createdAt: true,
                ethosUser: {
                  select: {
                    userkey: true,
                    displayName: true,
                    username: true,
                    trustTier: true,
                    trustComposite: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!project) {
      return null;
    }

    const [mentionTotal, firstTrackedMention] = await Promise.all([
      prisma.projectMention.count({
        where: { projectId: project.id }
      }),
      prisma.projectMention.findFirst({
        where: { projectId: project.id },
        orderBy: [{ mentionedAt: "asc" }, { id: "asc" }],
        select: { mentionedAt: true, isFirstTrackedMention: true }
      })
    ]);

    // Latest N mentions, then oldest-first for display within that window.
    const mentions = [...project.mentions].sort(
      (left, right) => left.mentionedAt.getTime() - right.mentionedAt.getTime()
    );

    return {
      ...project,
      mentions,
      mentionTotal,
      mentionLimit,
      firstTrackedMentionAt: firstTrackedMention?.mentionedAt ?? null
    };
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
    const firstByTierRows = await prisma.projectMention.groupBy({
      by: ["authorTier"],
      where: { projectId },
      _min: { mentionedAt: true }
    });

    const firstByTier = new Map<TrustTier, Date>();
    for (const row of firstByTierRows) {
      if (row._min.mentionedAt) {
        firstByTier.set(row.authorTier as TrustTier, row._min.mentionedAt);
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
        project: {
          select: {
            id: true,
            name: true,
            projectId: true
          }
        }
      },
      orderBy: { mentionedAt: "asc" },
      take: MAX_DETAIL_MENTION_LIMIT
    });

    const firstMentions = mentions.filter((mention) => mention.isFirstTrackedMention);
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
      projects: firstMentions.map((mention) => ({
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
