import { getTrustTierRank } from "@/lib/analytics/tier";
import {
  DEFAULT_RATE_LIMIT_CIRCUIT_WINDOW_MS,
  DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD,
  isMissingUserErrorMessage,
  MISSING_USER_ERROR_MARKER,
  isRateLimitCircuitOpen
} from "@/lib/collector/health";
import { getOfficialProjectUsernameSet } from "@/lib/collector/project-accounts";
import { prisma } from "@/lib/db";
import {
  DEFAULT_COLLECTOR_SHARDS,
  type CollectorMode,
  getCollectorShardId,
  getNextEligibleAt,
  getPriorityScore
} from "@/lib/collector/scheduling";
import { getUnseenTweetRefs } from "@/lib/collector/fresh-tweets";
import { buildTrackedAccountWriteData } from "@/lib/data/users";
import { ingestTweetBatch } from "@/lib/ingest/ingest-batch";
import { xGuestClient } from "@/lib/providers/x-guest";

function isRateLimitedErrorMessage(message: string) {
  return message.includes("status 429");
}

async function deactivateStaleMissingUserAccounts() {
  const result = await prisma.trackedAccount.updateMany({
    where: {
      isActive: true,
      lastCollectorError: {
        contains: MISSING_USER_ERROR_MARKER
      },
      consecutiveFailures: {
        gte: DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD
      }
    },
    data: {
      isActive: false
    }
  });

  return result.count;
}

async function getRateLimitCircuitState(now = new Date()) {
  const recentRateLimitHits = await prisma.trackedAccount.count({
    where: {
      isActive: true,
      lastCollectorError: {
        contains: "429"
      },
      updatedAt: {
        gte: new Date(now.getTime() - DEFAULT_RATE_LIMIT_CIRCUIT_WINDOW_MS)
      }
    }
  });

  return {
    recentRateLimitHits,
    open: isRateLimitCircuitOpen({
      recentRateLimitHits
    })
  };
}

async function deactivateOfficialProjectTrackedAccounts(officialProjectUsernames: Set<string>) {
  const usernames = [...officialProjectUsernames];
  if (usernames.length === 0) {
    return 0;
  }

  const result = await prisma.trackedAccount.updateMany({
    where: {
      isActive: true,
      xUsername: {
        in: usernames
      }
    },
    data: {
      isActive: false
    }
  });

  return result.count;
}

async function ensureTrackedAccountsFromProjects(officialProjectUsernames: Set<string>) {
  await deactivateOfficialProjectTrackedAccounts(officialProjectUsernames);

  return prisma.trackedAccount.count({
    where: {
      isActive: true,
      ...(officialProjectUsernames.size > 0
        ? {
            xUsername: {
              notIn: [...officialProjectUsernames]
            }
          }
        : {})
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
    const leftTierRank = getTrustTierRank(left.ethosUser?.trustTier);
    const rightTierRank = getTrustTierRank(right.ethosUser?.trustTier);

    if (rightTierRank !== leftTierRank) {
      return rightTierRank - leftTierRank;
    }

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
  officialProjectUsernames: Set<string>;
}) {
  const now = new Date();
  const where: any = {
    isActive: true,
    OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }]
  };

  if (input.officialProjectUsernames.size > 0) {
    where.xUsername = {
      notIn: [...input.officialProjectUsernames]
    };
  }

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
    where.ethosUser = {
      trustTier: {
        in: ["T4", "T3", "T2"]
      }
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
      lastSeenTweetId: true,
      lastObservedTweetAt: true,
      lastQueuedCount: true,
      priorityScore: true,
      consecutiveFailures: true,
      lastCollectorError: true,
      ethosUser: {
        select: {
          trustTier: true,
          trustComposite: true
        }
      }
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
  lastSeenTweetId?: string | null;
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
    const unseenRecentTweets = getUnseenTweetRefs(recentTweets, input.lastSeenTweetId);

    const existingTweets = await prisma.tweet.findMany({
      where: {
        tweetId: {
          in: unseenRecentTweets.map((tweet) => tweet.tweetId)
        }
      },
      select: {
        tweetId: true
      }
    });
    const existingTweetIds = new Set(existingTweets.map((tweet) => tweet.tweetId));
    const freshTweets = unseenRecentTweets.filter((tweet) => !existingTweetIds.has(tweet.tweetId));

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
        lastSeenTweetId: recentTweets[0]?.tweetId ?? input.lastSeenTweetId ?? null,
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
    const isRateLimited = isRateLimitedErrorMessage(message);
    const existing = await prisma.trackedAccount.findUnique({
      where: { id: input.id },
      select: {
        consecutiveFailures: true,
        priorityScore: true
      }
    });
    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
    const shouldDeactivate =
      isMissingUserErrorMessage(message) && consecutiveFailures >= DEFAULT_MISSING_USER_DEACTIVATION_THRESHOLD;

    await prisma.trackedAccount.update({
      where: { id: input.id },
      data: {
        isActive: shouldDeactivate ? false : undefined,
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
          success: false,
          failureReason: isRateLimited ? "rate_limit" : "generic"
        })
      }
    });

    return {
      xUsername: input.xUsername,
      discovered: 0,
      queued: 0,
      processed: 0,
      source: input.source,
      error: message,
      rateLimited: isRateLimited,
      deactivated: shouldDeactivate
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

async function runCollectorAccounts(
  accounts: any[],
  concurrency: number,
  worker: (account: any) => Promise<any>
) {
  const results = [];
  const chunkSize = Math.max(concurrency * 4, concurrency);
  let stoppedDueToRateLimit = false;
  let rateLimitHits = 0;

  for (let index = 0; index < accounts.length; index += chunkSize) {
    const chunk = accounts.slice(index, index + chunkSize);
    const chunkResults = await runWithConcurrency(chunk, concurrency, worker);
    results.push(...chunkResults);

    rateLimitHits += chunkResults.filter((result) => result?.rateLimited).length;
    if (rateLimitHits >= Math.max(3, concurrency)) {
      stoppedDueToRateLimit = true;
      break;
    }
  }

  return {
    results,
    stoppedDueToRateLimit,
    rateLimitHits
  };
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
  const officialProjectUsernames = await getOfficialProjectUsernameSet();
  const deactivatedDeadAccounts = await deactivateStaleMissingUserAccounts();
  const totalTrackedAccounts = await ensureTrackedAccountsFromProjects(officialProjectUsernames);
  const mode = options.mode ?? "main";
  const accountLimit = Math.max(1, Math.min(options.accountLimit ?? 20, 2000));
  const tweetsPerAccount = Math.max(1, Math.min(options.tweetsPerAccount ?? 5, 20));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 20));
  const shardCount = Math.max(1, Math.min(options.shardCount ?? DEFAULT_COLLECTOR_SHARDS, 200));
  const circuitState = await getRateLimitCircuitState();

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

  if (circuitState.open) {
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
          status: "skipped_rate_limited",
          lastRunId: run.id,
          lastStartedAt: run.startedAt,
          lastCompletedAt: new Date(),
          errorCount: circuitState.recentRateLimitHits
        },
        create: {
          mode,
          shardId: options.shardId,
          shardCount,
          status: "skipped_rate_limited",
          lastRunId: run.id,
          lastStartedAt: run.startedAt,
          lastCompletedAt: new Date(),
          errorCount: circuitState.recentRateLimitHits
        }
      });
    }

    await prisma.collectorRun.update({
      where: { id: run.id },
      data: {
        status: "skipped_rate_limited",
        errorCount: circuitState.recentRateLimitHits,
        completedAt: new Date()
      }
    });

    return {
      runId: run.id,
      mode,
      shardId: options.shardId ?? null,
      shardCount,
      totalTrackedAccounts,
      selectedAccounts: 0,
      remainingUncollected: 0,
      coveredLast24h: 0,
      dueNow: 0,
      discovered: 0,
      queued: 0,
      processed: 0,
      errors: 0,
      rateLimitErrors: circuitState.recentRateLimitHits,
      stoppedDueToRateLimit: true,
      circuitOpen: true,
      deactivatedDeadAccounts,
      results: []
    };
  }

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
    shardId: options.shardId,
    officialProjectUsernames
  });

  await prisma.collectorRun.update({
    where: { id: run.id },
    data: {
      selectedAccounts: accounts.length
    }
  });

  const accountExecution = await xGuestClient.withSession((session) =>
    runCollectorAccounts(accounts, concurrency, (account) =>
      collectSingleAccount({
        id: account.id,
        xUsername: account.xUsername,
        source: account.source,
        tweetsPerAccount,
        mode,
        session,
        lastSeenTweetId: account.lastSeenTweetId
      })
    )
  );
  const accountResults = accountExecution.results;

  const discovered = accountResults.reduce((sum, account) => sum + account.discovered, 0);
  const queued = accountResults.reduce((sum, account) => sum + account.queued, 0);
  const processed = accountResults.reduce((sum, account) => sum + account.processed, 0);
  const errors = accountResults.filter((account) => "error" in account && Boolean(account.error)).length;
  const rateLimitErrors = accountResults.filter((account) => account.rateLimited).length;
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
    rateLimitErrors,
    stoppedDueToRateLimit: accountExecution.stoppedDueToRateLimit,
    circuitOpen: false,
    deactivatedDeadAccounts,
    results: accountResults
  };
}
