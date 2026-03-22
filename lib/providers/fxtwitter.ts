import { z } from "zod";

import { asRecord, fetchJson, pickFirstRecord, pickNumber, pickString } from "@/lib/providers/shared";
import type { FxTwitterTweetResult, ProviderRequestOptions } from "@/lib/types/provider";

const defaultBaseUrl = process.env.FXTWITTER_API_BASE_URL ?? "https://api.fxtwitter.com";

const flexibleResponseSchema = z.object({}).passthrough();

function normalizeTweet(raw: unknown, fallback: { xUsername: string; tweetId: string; tweetUrl?: string }): FxTwitterTweetResult {
  const root = asRecord(raw);
  const tweet = pickFirstRecord(root, ["tweet", "data", "result", "status"]);
  const author = pickFirstRecord(tweet, ["author", "user", "owner", "account"]);
  const metrics = pickFirstRecord(tweet, ["stats", "public_metrics", "metrics"]);
  const media = pickFirstRecord(tweet, ["media", "attachments"]);

  const tweetId = pickString(tweet, ["id", "tweetId"], fallback.tweetId);
  const xUsername = pickString(author, ["screen_name", "username", "handle"], fallback.xUsername);
  const tweetUrl = pickString(tweet, ["tweetUrl", "url", "link"], fallback.tweetUrl ?? `https://x.com/${xUsername}/status/${tweetId}`);

  return {
    xUsername,
    tweetId,
    tweetUrl,
    url: tweetUrl,
    text: pickString(tweet, ["text", "full_text", "fullText", "content"], ""),
    createdAt: pickString(tweet, ["created_at", "createdAt", "timestamp"], new Date().toISOString()),
    authorName: pickString(author, ["name", "display_name", "displayName"], xUsername),
    likeCount: pickNumber(metrics, ["likes", "favorite_count", "like_count"]),
    repostCount: pickNumber(metrics, ["retweets", "reposts", "retweet_count", "repost_count"]),
    replyCount: pickNumber(metrics, ["replies", "reply_count"]),
    quoteCount: pickNumber(metrics, ["quotes", "quote_count"]),
    author: {
      name: pickString(author, ["name", "display_name", "displayName"], xUsername),
      username: xUsername,
      avatarUrl: pickString(author, ["avatar_url", "avatarUrl", "profile_image_url"], "") || null,
      verified: typeof author.verified === "boolean" ? author.verified : null
    },
    metrics: {
      likes: pickNumber(metrics, ["likes", "favorite_count", "like_count"]),
      reposts: pickNumber(metrics, ["retweets", "reposts", "retweet_count", "repost_count"]),
      replies: pickNumber(metrics, ["replies", "reply_count"]),
      quotes: pickNumber(metrics, ["quotes", "quote_count"])
    },
    mediaCount: Array.isArray(media?.items) ? media.items.length : Array.isArray(media?.media) ? media.media.length : 0,
    raw: root
  };
}

export class FxTwitterClient {
  readonly baseUrl: string;

  constructor(baseUrl = defaultBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getTweetByStatus(input: { xUsername: string; tweetId: string; tweetUrl?: string }, options: ProviderRequestOptions = {}) {
    const { data } = await fetchJson(
      "fxtwitter",
      `${this.baseUrl}/${encodeURIComponent(input.xUsername)}/status/${encodeURIComponent(input.tweetId)}`,
      options,
      (value) => flexibleResponseSchema.parse(value)
    );

    return normalizeTweet(data, input);
  }
}

export const fxTwitterClient = new FxTwitterClient();
export const fxtwitterClient = fxTwitterClient;
