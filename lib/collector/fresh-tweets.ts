import type { XRecentTweetRef } from "@/lib/types/provider";

export function getUnseenTweetRefs(recentTweets: XRecentTweetRef[], lastSeenTweetId?: string | null) {
  if (!lastSeenTweetId) {
    return recentTweets;
  }

  const seenIndex = recentTweets.findIndex((tweet) => tweet.tweetId === lastSeenTweetId);
  if (seenIndex === -1) {
    return recentTweets;
  }

  return recentTweets.slice(0, seenIndex);
}
