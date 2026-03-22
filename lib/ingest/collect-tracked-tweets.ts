import { prisma } from "@/lib/db";
import {
  DEFAULT_COLLECTOR_SHARDS,
  type CollectorMode,
  getCollectorShardId,
  getNextEligibleAt,
  getPriorityScore
} from "@/lib/collector/scheduling";
import { buildTrackedAccountWriteData } from "@/lib/data/users";
import { ingestTweetBatch } from "@/lib/ingest/ingest-batch";
import { xGuestClient } from "@/lib/providers/x-guest";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

async function ensureTrackedAccountsFromProjects() {
  const trackedCount = await prisma.trackedAccount.count({
    where: {
      isActive: true
    }
  });

  if (trackedCount > 0) {
    return trackedCount;
  }

  const projects = await prisma.project.findMany({
    where: {
      username: {
        not: null
      }
    },
    select: {
      username: true
    }
  });

  const usernames = [...new Set(projects.map((project) => normalizeUsername(project.username!)).filter(Boolean))];
  if (usernames.length === 0) {
    return 0;
  }

  await prisma.trackedAccount.createMany({
    data: usernames.map((xUsername) =>
      buildTrackedAccountWriteData({
        xUsername,
        source: "ethos-project-sync"
      })
    ),
    skipDuplicates: true
  });

  return prisma.trackedAccount.count({
    where: {
      isActive: true
    }
  });
}

async function backfillTrackedAccountScheduling(shardCount: number, limit = 1000) {
  const accounts = await prisma.trackedAccount.findMany({
    where: {
      isActive: true,
      OR: [{ assignedShardId: null }, { nextEligibleAt: null }]
    },
    include: {
      ethosUser: {
        select: {
          trustComposite: true
        }
      }
    },
    take: Math.max(1, Math.min(limit, 2000)),
    orderBy: {
      updatedAt: "asc"
    }
  });

  for (const account of accounts) {
    await prisma.trackedAccount.update({
      where: { id: account.id },
      data: {
        assignedShardId: getCollectorShardId(account.xUsername, shardCount),
        priorityScore: getPriorityScore({
          trustComposite: account.ethosUser?.trustComposite ?? null,
          lastQueuedCount: account.lastQueuedCount,
          lastObservedTweetAt: account.lastObservedTweetAt
        }),
        nextEligibleAt: account.nextEligibleAt ?? new Date()
      }
    });
  }

  return accounts.length;
}

function sortCandidates(mode: CollectorMode, accounts: any[]) {
  const now = Date.now();

  return [...accounts].sort((left, right) => {
    if (mode === "hot") {
      return (
        right.priorityScore - left.priorityScore ||
        (right.lastObservedTweetAt?.getTime() ?? 0) - (left.lastObservedTweetAt?.getTime() ?? 0) ||
        (left.lastSuccessfulSweepAt?.getTime() ?? 0) - (right.lastSuccessfulSweepAt?.getTime() ?? 0)
      );
    }

    if (mode === "repair") {
      return (
        (right.consecutiveFailures ?? 0) - (left.consecutiveFailures ?? 0) ||
        (left.lastCollectedAt?.getTime() ?? 0) - (right.lastCollectedAt?.getTime() ?? 0)
      );
    }

    return (
      (left.lastSuccessfulSweepAt?.getTime() ?? 0) - (right.lastSuccessfulSweepAt?.getTime() ?? 0) ||
      ((left.nextEligibleAt ? now - left.nextEligibleAt.getTime() : Number.POSITIVE_INFINITY) -
        (right.nextEligibleAt ? now - right.nextEligibleAt.getTime() : Number.POSITIVE_INFINITY)) ||
      right.priorityScore - left.priorityScore
    );
  });
}

async function getCollectionCandidates(input: {
  mode: CollectorMode;
  accountLimit: number;
  shardId?: number | null;
}) {
  const now = new Date();
  const where: any = {
    isActive: true,
    OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }]
  };

  if (typeof input.shardId === "number") {
    where.assignedShardId = input.shardId;
  }

  if (input.mode === "repair") {
    where.OR = [
      {
        lastCollectorError: {
          not: null
        },
        nextEligibleAt: {
          lte: now
        }
      },
      {
        consecutiveFailures: {
          gt: 0
        },
        nextEligibleAt: {
          lte: now
        }
      }
    ];
  }

  if (input.mode === "hot") {
    where.priorityScore = {
      gte: 700
    };
  }

  const candidates = await prisma.trackedAccount.findMany({
    where,
    select: {
      id: true,
      xUsername: true,
      source: true,
      assignedShardId: true,
      nextEligibleAt: true,
      lastCollectedAt: true,
      lastSuccessfulSweepAt: true,
      lastObservedTweetAt: true,
      lastQueuedCount: true,
      priorityScore: true,
      consecutiveFailures: true,
      lastCollectorError: true
    },
    take: Math.max(input.accountLimit * 4, 500),
    orderBy: [
      {
        nextEligibleAt: "asc"
      },
      {
        lastSuccessfulSweepAt: "asc"
      }
    ]
  });

  return sortCandidates(input.mode, candidates).slice(0, input.accountLimit);
}

async function collectSingleAccount(input: {
  id: string;
  xUsername: string;
  source: string;
  tweetsPerAccount: number;
  mode: CollectorMode;
  session: unknown;
}) {
  const collectedAt = new Date();

  try {
    const recentTweets = await xGuestClient.getRecentTweetsByUsername(
      {
        xUsername: input.xUsername,
        count: input.tweetsPerAccount
      },
      input.session as any
    );

    const existingTweets = await prisma.tweet.findMany({
      where: {
        tweetId: {
          in: recentTweets.map((tweet) => tweet.tweetId)
        }
      },
      select: {
        tweetId: true
      }
    });
    const existingTweetIds = new Set(existingTweets.map((tweet) => tweet.tweetId));
    const freshTweets = recentTweets.filter((tweet) => !existingTweetIds.has(tweet.tweetId));

    let processed = 0;
    if (freshTweets.length > 0) {
      const ingestResult = await ingestTweetBatch({
        tweets: freshTweets.map((tweet) => ({
          tweetId: tweet.tweetId,
          tweetUrl: tweet.tweetUrl,
          xUsername: tweet.xUsername,
          observedAt: collectedAt.toISOString(),
          source: "x-guest-collector"
        }))
      });
      processed = ingestResult.processed;
    }

    const latestObservedAt =
      recentTweets
        .map((tweet) => (tweet.createdAt ? new Date(tweet.createdAt) : null))
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const priorityScore = getPriorityScore({
      lastQueuedCount: freshTweets.length,
      lastObservedTweetAt: latestObservedAt
    });

    await prisma.trackedAccount.update({
      where: { id: input.id },
      data: {
        lastCollectedAt: collectedAt,
        lastSweepAt: collectedAt,
        lastSuccessfulSweepAt: collectedAt,
        lastObservedTweetAt: latestObservedAt,
        lastDiscoveredCount: recentTweets.length,
        lastQueuedCount: freshTweets.length,
        lastProcessedCount: processed,
        lastCollectorError: null,
        consecutiveFailures: 0,
        lastRunMode: input.mode,
        priorityScore,
        nextEligibleAt: getNextEligibleAt({
          mode: input.mode,
          priorityScore,
          now: collectedAt,
          success: true
        })
      }
    });

    return {
      xUsername: input.xUsername,
      discovered: recentTweets.length,
      queued: freshTweets.length,
      processed,
      source: input.source
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown collector error";
    const existing = await prisma.trackedAccount.findUnique({
      where: { id: input.id },
      select: {
        consecutiveFailures: true,
        priorityScore: true
      }
    });
    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;

    await prisma.trackedAccount.update({
      where: { id: input.id },
      data: {
        lastCollectedAt: collectedAt,
        lastSweepAt: collectedAt,
        lastDiscoveredCount: 0,
        lastQueuedCount: 0,
        lastProcessedCount: 0,
        lastCollectorError: message,
        consecutiveFailures,
        lastRunMode: input.mode,
        nextEligibleAt: getNextEligibleAt({
          mode: input.mode,
          priorityScore: existing?.priorityScore ?? 0,
          now: collectedAt,
          consecutiveFailures,
          success: false
        })
      }
    });

    return {
      xUsername: input.xUsername,
      discovered: 0,
      queued: 0,
      processed: 0,
      source: input.source,
      error: message
    };
  }
}

async function runWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TResult>
) {
  const results: TResult[] = [];
  let currentIndex = 0;

  async function consume() {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;
      if (index >= items.length) {
        break;
      }

      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

export async function collectTrackedTweets(options: {
  accountLimit?: number;
  tweetsPerAccount?: number;
  concurrency?: number;
  mode?: CollectorMode;
  shardId?: number | null;
  shardCount?: number;
  schedulingBackfillLimit?: number;
} = {}) {
  const totalTrackedAccounts = await ensureTrackedAccountsFromProjects();
  const mode = options.mode ?? "main";
  const accountLimit = Math.max(1, Math.min(options.accountLimit ?? 20, 1000));
  const tweetsPerAccount = Math.max(1, Math.min(options.tweetsPerAccount ?? 5, 20));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 10));
  const shardCount = Math.max(1, Math.min(options.shardCount ?? DEFAULT_COLLECTOR_SHARDS, 200));

  await backfillTrackedAccountScheduling(shardCount, options.schedulingBackfillLimit ?? 1000);

  const run = await prisma.collectorRun.create({
    data: {
      mode,
      status: "running",
      shardId: typeof options.shardId === "number" ? options.shardId : null,
      shardCount,
      selectedAccounts: 0
    }
  });

  if (typeof options.shardId === "number") {
    await prisma.collectorShardState.upsert({
      where: {
        mode_shardId_shardCount: {
          mode,
          shardId: options.shardId,
          shardCount
        }
      },
      update: {
        status: "running",
        lastRunId: run.id,
        lastStartedAt: run.startedAt
      },
      create: {
        mode,
        shardId: options.shardId,
        shardCount,
        status: "running",
        lastRunId: run.id,
        lastStartedAt: run.startedAt
      }
    });
  }

  const accounts = await getCollectionCandidates({
    mode,
    accountLimit,
    shardId: options.shardId
  });

  await prisma.collectorRun.update({
    where: { id: run.id },
    data: {
      selectedAccounts: accounts.length
    }
  });

  const accountResults = await xGuestClient.withSession((session) =>
    runWithConcurrency(accounts, concurrency, (account) =>
      collectSingleAccount({
        id: account.id,
        xUsername: account.xUsername,
        source: account.source,
        tweetsPerAccount,
        mode,
        session
      })
    )
  );

  const discovered = accountResults.reduce((sum, account) => sum + account.discovered, 0);
  const queued = accountResults.reduce((sum, account) => sum + account.queued, 0);
  const processed = accountResults.reduce((sum, account) => sum + account.processed, 0);
  const errors = accountResults.filter((account) => "error" in account && Boolean(account.error)).length;
  const remainingUncollected = await prisma.trackedAccount.count({
    where: {
      isActive: true,
      lastCollectedAt: null
    }
  });
  const dueNow = await prisma.trackedAccount.count({
    where: {
      isActive: true,
      OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: new Date() } }]
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

  await prisma.collectorRun.update({
    where: { id: run.id },
    data: {
      status: errors > 0 ? "completed_with_errors" : "completed",
      processedAccounts: accountResults.length,
      discoveredTweets: discovered,
      queuedTweets: queued,
      ingestedTweets: processed,
      errorCount: errors,
      completedAt: new Date()
    }
  });

  if (typeof options.shardId === "number") {
    await prisma.collectorShardState.update({
      where: {
        mode_shardId_shardCount: {
          mode,
          shardId: options.shardId,
          shardCount
        }
      },
      data: {
        status: errors > 0 ? "completed_with_errors" : "completed",
        accountsTotal: accounts.length,
        accountsProcessed: accountResults.length,
        errorCount: errors,
        lastCompletedAt: new Date()
      }
    });
  }

  return {
    runId: run.id,
    mode,
    shardId: options.shardId ?? null,
    shardCount,
    totalTrackedAccounts,
    selectedAccounts: accounts.length,
    remainingUncollected,
    coveredLast24h,
    dueNow,
    discovered,
    queued,
    processed,
    errors,
    results: accountResults
  };
}
