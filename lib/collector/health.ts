import { prisma } from "@/lib/db";

type WorkerLeaseSnapshot = {
  heartbeatAt?: Date | string | null;
  expiresAt?: Date | string | null;
  holderId?: string | null;
};

export const MISSING_USER_ERROR_MARKER = "User rest_id was not found";
export const DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD = 3;
export const DEFAULT_RATE_LIMIT_CIRCUIT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_RATE_LIMIT_CIRCUIT_THRESHOLD = 6;

function toDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function isWorkerLeaseActive(lease?: WorkerLeaseSnapshot | null, now = new Date()) {
  const expiresAt = toDate(lease?.expiresAt);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() > now.getTime();
}

export function isMissingUserErrorMessage(message: string) {
  return message.includes(MISSING_USER_ERROR_MARKER);
}

export function shouldDeactivateTrackedAccount(input: {
  lastCollectorError?: string | null;
  consecutiveFailures?: number | null;
  threshold?: number;
}) {
  return (
    isMissingUserErrorMessage(input.lastCollectorError ?? "") &&
    (input.consecutiveFailures ?? 0) >= (input.threshold ?? DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD)
  );
}

export function isRateLimitCircuitOpen(input: {
  recentRateLimitHits: number;
  threshold?: number;
}) {
  return input.recentRateLimitHits >= (input.threshold ?? DEFAULT_RATE_LIMIT_CIRCUIT_THRESHOLD);
}

export async function getCollectorHealthSnapshot(now = new Date()) {
  const rateLimitWindowStart = new Date(now.getTime() - DEFAULT_RATE_LIMIT_CIRCUIT_WINDOW_MS);
  const coveredWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleWindowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [
    workerLease,
    totalTrackedAccounts,
    coveredLast24h,
    dueNow,
    failedAccounts,
    recentRateLimitHits,
    deadAccountCandidates,
    staleAccounts,
    latestRun,
    latestTweet,
    latestMention
  ] = await Promise.all([
    prisma.workerLease.findUnique({
      where: {
        workerType: "collector-supervisor"
      },
      select: {
        holderId: true,
        heartbeatAt: true,
        expiresAt: true
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        lastSuccessfulSweepAt: {
          gte: coveredWindowStart
        }
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }]
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ lastCollectorError: { not: null } }, { consecutiveFailures: { gt: 0 } }]
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        lastCollectorError: {
          contains: "429"
        },
        updatedAt: {
          gte: rateLimitWindowStart
        }
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        lastCollectorError: {
          contains: MISSING_USER_ERROR_MARKER
        },
        consecutiveFailures: {
          gte: DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD
        }
      }
    }),
    prisma.trackedAccount.count({
      where: {
        isActive: true,
        OR: [{ lastSuccessfulSweepAt: null }, { lastSuccessfulSweepAt: { lt: staleWindowStart } }]
      }
    }),
    prisma.collectorRun.findFirst({
      orderBy: {
        startedAt: "desc"
      }
    }),
    prisma.tweet.findFirst({
      orderBy: {
        observedAt: "desc"
      },
      select: {
        observedAt: true,
        xUsername: true,
        tweetId: true
      }
    }),
    prisma.projectMention.findFirst({
      orderBy: {
        mentionedAt: "desc"
      },
      select: {
        mentionedAt: true,
        project: {
          select: {
            name: true
          }
        }
      }
    })
  ]);

  return {
    worker: {
      active: isWorkerLeaseActive(workerLease, now),
      holderId: workerLease?.holderId ?? null,
      heartbeatAt: toDate(workerLease?.heartbeatAt)?.toISOString() ?? null,
      expiresAt: toDate(workerLease?.expiresAt)?.toISOString() ?? null
    },
    totals: {
      totalTrackedAccounts,
      coveredLast24h,
      coveragePct: totalTrackedAccounts > 0 ? Math.round((coveredLast24h / totalTrackedAccounts) * 100) : 0,
      dueNow,
      failedAccounts,
      staleAccounts,
      deadAccountCandidates
    },
    circuitBreaker: {
      open: isRateLimitCircuitOpen({
        recentRateLimitHits
      }),
      recentRateLimitHits,
      threshold: DEFAULT_RATE_LIMIT_CIRCUIT_THRESHOLD,
      windowMinutes: Math.round(DEFAULT_RATE_LIMIT_CIRCUIT_WINDOW_MS / 60_000)
    },
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
    latestTweet: latestTweet
      ? {
          observedAt: latestTweet.observedAt.toISOString(),
          xUsername: latestTweet.xUsername,
          tweetId: latestTweet.tweetId
        }
      : null,
    latestMention: latestMention
      ? {
          mentionedAt: latestMention.mentionedAt.toISOString(),
          projectName: latestMention.project.name
        }
      : null
  };
}
