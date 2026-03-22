import { prisma } from "@/lib/db";
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
    data: usernames.map((xUsername) => ({
      xUsername,
      source: "ethos-project-sync"
    })),
    skipDuplicates: true
  });

  return prisma.trackedAccount.count({
    where: {
      isActive: true
    }
  });
}

async function getCollectionCandidates(accountLimit: number) {
  const unseenAccounts = await prisma.trackedAccount.findMany({
    where: {
      isActive: true,
      lastCollectedAt: null
    },
    orderBy: {
      xUsername: "asc"
    },
    take: accountLimit,
    select: {
      id: true,
      xUsername: true,
      source: true
    }
  });

  if (unseenAccounts.length >= accountLimit) {
    return unseenAccounts;
  }

  const seenAccounts = await prisma.trackedAccount.findMany({
    where: {
      isActive: true,
      lastCollectedAt: {
        not: null
      },
      id: {
        notIn: unseenAccounts.map((account) => account.id)
      }
    },
    orderBy: [
      {
        lastCollectedAt: "asc"
      },
      {
        xUsername: "asc"
      }
    ],
    take: accountLimit - unseenAccounts.length,
    select: {
      id: true,
      xUsername: true,
      source: true
    }
  });

  return [...unseenAccounts, ...seenAccounts];
}

async function collectSingleAccount(input: {
  id: string;
  xUsername: string;
  source: string;
  tweetsPerAccount: number;
}) {
  const collectedAt = new Date();

  try {
    const recentTweets = await xGuestClient.getRecentTweetsByUsername({
      xUsername: input.xUsername,
      count: input.tweetsPerAccount
    });

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

    await prisma.trackedAccount.update({
      where: { id: input.id },
      data: {
        lastCollectedAt: collectedAt,
        lastObservedTweetAt: latestObservedAt,
        lastDiscoveredCount: recentTweets.length,
        lastQueuedCount: freshTweets.length,
        lastProcessedCount: processed,
        lastCollectorError: null
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
    await prisma.trackedAccount.update({
      where: { id: input.id },
      data: {
        lastCollectedAt: collectedAt,
        lastDiscoveredCount: 0,
        lastQueuedCount: 0,
        lastProcessedCount: 0,
        lastCollectorError: message
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
} = {}) {
  const totalTrackedAccounts = await ensureTrackedAccountsFromProjects();
  const accountLimit = Math.max(1, Math.min(options.accountLimit ?? 20, 500));
  const tweetsPerAccount = Math.max(1, Math.min(options.tweetsPerAccount ?? 5, 20));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 10));
  const accounts = await getCollectionCandidates(accountLimit);

  const accountResults = await runWithConcurrency(accounts, concurrency, (account) =>
    collectSingleAccount({
      id: account.id,
      xUsername: account.xUsername,
      source: account.source,
      tweetsPerAccount
    })
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

  return {
    totalTrackedAccounts,
    selectedAccounts: accounts.length,
    remainingUncollected,
    discovered,
    queued,
    processed,
    errors,
    results: accountResults
  };
}
