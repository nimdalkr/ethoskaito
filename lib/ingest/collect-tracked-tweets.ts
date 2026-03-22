import { prisma } from "@/lib/db";
import { ingestTweetBatch } from "@/lib/ingest/ingest-batch";
import { xGuestClient } from "@/lib/providers/x-guest";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}

async function ensureTrackedAccountsFromProjects() {
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
    return [];
  }

  const existing = await prisma.trackedAccount.findMany({
    where: {
      xUsername: {
        in: usernames
      }
    },
    select: {
      xUsername: true
    }
  });

  const existingSet = new Set(existing.map((account) => account.xUsername.toLowerCase()));
  const missing = usernames
    .filter((username) => !existingSet.has(username.toLowerCase()))
    .map((xUsername) => ({
      xUsername,
      source: "ethos-project-sync"
    }));

  if (missing.length > 0) {
    await prisma.trackedAccount.createMany({
      data: missing,
      skipDuplicates: true
    });
  }

  return prisma.trackedAccount.findMany({
    where: {
      isActive: true
    },
    orderBy: {
      xUsername: "asc"
    },
    select: {
      xUsername: true,
      source: true
    }
  });
}

export async function collectTrackedTweets(options: { accountLimit?: number; tweetsPerAccount?: number } = {}) {
  const trackedAccounts = await ensureTrackedAccountsFromProjects();
  const accountLimit = Math.max(1, Math.min(options.accountLimit ?? 20, 100));
  const tweetsPerAccount = Math.max(1, Math.min(options.tweetsPerAccount ?? 5, 20));
  const accounts = trackedAccounts.slice(0, accountLimit);
  const accountResults: Array<{
    xUsername: string;
    discovered: number;
    queued: number;
    processed: number;
    source: string;
    error?: string;
  }> = [];

  let discovered = 0;
  let queued = 0;
  let processed = 0;

  for (const account of accounts) {
    try {
      const recentTweets = await xGuestClient.getRecentTweetsByUsername({
        xUsername: account.xUsername,
        count: tweetsPerAccount
      });

      discovered += recentTweets.length;
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

      queued += freshTweets.length;

      if (freshTweets.length === 0) {
        accountResults.push({
          xUsername: account.xUsername,
          discovered: recentTweets.length,
          queued: 0,
          processed: 0,
          source: account.source
        });
        continue;
      }

      const ingestResult = await ingestTweetBatch({
        tweets: freshTweets.map((tweet) => ({
          tweetId: tweet.tweetId,
          tweetUrl: tweet.tweetUrl,
          xUsername: tweet.xUsername,
          observedAt: new Date().toISOString(),
          source: "x-guest-collector"
        }))
      });

      processed += ingestResult.processed;
      accountResults.push({
        xUsername: account.xUsername,
        discovered: recentTweets.length,
        queued: freshTweets.length,
        processed: ingestResult.processed,
        source: account.source
      });
    } catch (error) {
      accountResults.push({
        xUsername: account.xUsername,
        discovered: 0,
        queued: 0,
        processed: 0,
        source: account.source,
        error: error instanceof Error ? error.message : "Unknown collector error"
      });
    }
  }

  return {
    trackedAccounts: accounts.length,
    discovered,
    queued,
    processed,
    results: accountResults
  };
}
