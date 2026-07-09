import type { XRecentTweetRef } from "@/lib/types/provider";

const SNOWFLAKE_ID = /^\d+$/;

/** Compare tweet/snowflake IDs. Returns >0 if a is newer/higher than b. */
export function compareTweetIds(a: string, b: string) {
  if (SNOWFLAKE_ID.test(a) && SNOWFLAKE_ID.test(b)) {
    const left = BigInt(a);
    const right = BigInt(b);
    if (left === right) return 0;
    return left > right ? 1 : -1;
  }

  return a.localeCompare(b);
}

/** High-water mark: max snowflake id among candidates (or null). */
export function getMaxTweetId(tweetIds: Array<string | null | undefined>) {
  let maxId: string | null = null;

  for (const id of tweetIds) {
    if (!id) {
      continue;
    }
    if (!maxId || compareTweetIds(id, maxId) > 0) {
      maxId = id;
    }
  }

  return maxId;
}

/**
 * Keep tweets newer than the high-water mark.
 * Prefers numeric snowflake comparison so list order from X cannot skip older-but-unseen IDs
 * when the cursor is still in range. Falls back to newest-first list slice when IDs are non-numeric.
 */
export function getUnseenTweetRefs(recentTweets: XRecentTweetRef[], lastSeenTweetId?: string | null) {
  if (!lastSeenTweetId) {
    return recentTweets;
  }

  const canCompareAsSnowflake =
    SNOWFLAKE_ID.test(lastSeenTweetId) && recentTweets.every((tweet) => SNOWFLAKE_ID.test(tweet.tweetId));

  if (canCompareAsSnowflake) {
    return recentTweets.filter((tweet) => compareTweetIds(tweet.tweetId, lastSeenTweetId) > 0);
  }

  const seenIndex = recentTweets.findIndex((tweet) => tweet.tweetId === lastSeenTweetId);
  if (seenIndex === -1) {
    return recentTweets;
  }

  return recentTweets.slice(0, seenIndex);
}
