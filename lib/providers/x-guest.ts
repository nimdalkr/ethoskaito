import { z } from "zod";

import { fetchJson, isRecord } from "@/lib/providers/shared";
import { ProviderError, type ProviderRequestOptions, type XRecentTweetRef } from "@/lib/types/provider";

const X_WEB_BASE_URL = "https://x.com";
const X_API_BASE_URL = "https://api.x.com";

const userLookupSchema = z.object({}).passthrough();
const userTweetsSchema = z.object({}).passthrough();

interface GuestClientConfig {
  bearerToken: string;
  userByScreenNameQueryId: string;
  userTweetsQueryId: string;
}

interface GuestSession {
  config: GuestClientConfig;
  guestToken: string;
}

const USER_BY_SCREEN_NAME_FEATURES = {
  hidden_profile_subscriptions_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: true,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: true,
  subscriptions_feature_can_gift_premium: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true
} satisfies Record<string, boolean>;

const USER_BY_SCREEN_NAME_FIELD_TOGGLES = {
  withPayments: false,
  withAuxiliaryUserLabels: true
} satisfies Record<string, boolean>;

const USER_TWEETS_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: false,
  responsive_web_grok_annotations_enabled: false,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: false,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: false,
  responsive_web_grok_imagine_annotation_enabled: false,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
} satisfies Record<string, boolean>;

const USER_TWEETS_FIELD_TOGGLES = {
  withPayments: false,
  withAuxiliaryUserLabels: true,
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withArticleSummaryText: false,
  withArticleVoiceOver: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false
} satisfies Record<string, boolean>;

function toIsoOrNull(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getTextContent(tweet: Record<string, unknown>) {
  const legacy = isRecord(tweet.legacy) ? tweet.legacy : null;
  const noteTweet = isRecord(tweet.note_tweet) ? tweet.note_tweet : null;
  const noteTweetResults = noteTweet && isRecord(noteTweet.note_tweet_results) ? noteTweet.note_tweet_results : null;
  const noteTweetResult = noteTweetResults && isRecord(noteTweetResults.result) ? noteTweetResults.result : null;
  const stringCandidates = [
    legacy?.full_text,
    legacy?.text,
    noteTweetResult?.text
  ];

  for (const candidate of stringCandidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return "";
}

function getTweetAuthorUsername(tweet: Record<string, unknown>) {
  const core = isRecord(tweet.core) ? tweet.core : null;
  const userResults = core && isRecord(core.user_results) ? core.user_results : null;
  const result = userResults && isRecord(userResults.result) ? userResults.result : null;
  const userCore = result && isRecord(result.core) ? result.core : null;
  return typeof userCore?.screen_name === "string" ? userCore.screen_name : null;
}

function pushTimelineTweet(
  tweets: Map<string, XRecentTweetRef>,
  tweetResult: unknown,
  xUsername: string,
  normalizedUsername: string
) {
  if (!isRecord(tweetResult)) {
    return;
  }

  const restId = typeof tweetResult.rest_id === "string" ? tweetResult.rest_id : null;
  const legacy = isRecord(tweetResult.legacy) ? tweetResult.legacy : null;
  if (!restId || !legacy) {
    return;
  }

  const authorUsername = getTweetAuthorUsername(tweetResult)?.trim().toLowerCase();
  if (authorUsername !== normalizedUsername || tweets.has(restId)) {
    return;
  }

  tweets.set(restId, {
    tweetId: restId,
    tweetUrl: `https://x.com/${xUsername}/status/${restId}`,
    xUsername,
    text: getTextContent(tweetResult),
    createdAt: toIsoOrNull(legacy.created_at)
  });
}

function extractTweetResultsFromEntryContent(
  tweets: Map<string, XRecentTweetRef>,
  content: Record<string, unknown>,
  xUsername: string,
  normalizedUsername: string
) {
  const itemContent = isRecord(content.itemContent) ? content.itemContent : null;
  const tweetResults = itemContent && isRecord(itemContent.tweet_results) ? itemContent.tweet_results : null;
  const tweetResult = tweetResults && isRecord(tweetResults.result) ? tweetResults.result : null;

  if (tweetResult) {
    pushTimelineTweet(tweets, tweetResult, xUsername, normalizedUsername);
  }

  const items = Array.isArray(content.items) ? content.items : [];
  for (const moduleItem of items) {
    if (!isRecord(moduleItem)) {
      continue;
    }

    const item = isRecord(moduleItem.item) ? moduleItem.item : moduleItem;
    const nestedContent = isRecord(item.content)
      ? item.content
      : isRecord(item.itemContent)
        ? { itemContent: item.itemContent }
        : null;

    if (nestedContent) {
      extractTweetResultsFromEntryContent(tweets, nestedContent, xUsername, normalizedUsername);
    }
  }

  if (isRecord(content.entry)) {
    extractTimelineTweetsFromEntry(tweets, content.entry, xUsername, normalizedUsername);
  }
}

function extractTimelineTweetsFromEntry(
  tweets: Map<string, XRecentTweetRef>,
  entry: Record<string, unknown>,
  xUsername: string,
  normalizedUsername: string
) {
  const content = isRecord(entry.content) ? entry.content : null;
  if (content) {
    extractTweetResultsFromEntryContent(tweets, content, xUsername, normalizedUsername);
  }
}

function visitTimelineEntries(value: unknown, visitor: (entry: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitTimelineEntries(item, visitor);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (Array.isArray(value.entries)) {
    for (const entry of value.entries) {
      visitTimelineEntries(entry, visitor);
    }
  }

  if (isRecord(value.entry)) {
    visitTimelineEntries(value.entry, visitor);
  }

  if (typeof value.entryId === "string" || isRecord(value.content)) {
    visitor(value);
  }

  for (const nested of Object.values(value)) {
    if (nested !== value.entries && nested !== value.entry) {
      visitTimelineEntries(nested, visitor);
    }
  }
}

export function extractTimelineTweetRefs(payload: unknown, xUsername: string): XRecentTweetRef[] {
  const normalizedUsername = xUsername.trim().toLowerCase();
  const tweets = new Map<string, XRecentTweetRef>();

  visitTimelineEntries(payload, (entry) => {
    extractTimelineTweetsFromEntry(tweets, entry, xUsername, normalizedUsername);
  });

  return [...tweets.values()].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function extractMainBundleUrl(html: string) {
  const match = html.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[^"]+\.js/);
  return match?.[0] ?? null;
}

export function extractPublicBearerToken(bundle: string) {
  const match = bundle.match(/AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%_-]+/);
  return match ? decodeURIComponent(match[0]) : null;
}

export function extractQueryId(bundle: string, operationName: string) {
  const escapedOperation = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = bundle.match(new RegExp(`queryId:"([^"]+)",operationName:"${escapedOperation}"`));
  return match?.[1] ?? null;
}

async function fetchText(url: string, options: RequestInit & ProviderRequestOptions = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; EthosKaitoCollector/1.0)",
          accept: "text/html,application/javascript;q=0.9,*/*;q=0.8",
          ...options.headers
        },
        signal: options.signal ?? controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        throw new ProviderError(`Request failed with status ${response.status}`, {
          provider: "x-guest",
          url,
          status: response.status,
          body: text || null
        });
      }

      return text;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error instanceof ProviderError
          ? error
          : new ProviderError("Provider request failed", {
              provider: "x-guest",
              url,
              cause: error
            });
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ProviderError("Provider request failed after retries", {
    provider: "x-guest",
    url,
    cause: lastError
  });
}

export class XGuestClient {
  private cachedConfig: GuestClientConfig | null = null;
  private cachedAt = 0;

  private async getConfig() {
    const isFresh = this.cachedConfig && Date.now() - this.cachedAt < 6 * 60 * 60 * 1000;
    if (isFresh) {
      return this.cachedConfig!;
    }

    const profileHtml = await fetchText(`${X_WEB_BASE_URL}/x`, { timeoutMs: 10_000 });
    const mainBundleUrl = extractMainBundleUrl(profileHtml);
    if (!mainBundleUrl) {
      throw new ProviderError("Unable to locate X main bundle", {
        provider: "x-guest",
        url: `${X_WEB_BASE_URL}/x`
      });
    }

    const bundle = await fetchText(mainBundleUrl, { timeoutMs: 15_000 });
    const bearerToken = extractPublicBearerToken(bundle);
    const userByScreenNameQueryId = extractQueryId(bundle, "UserByScreenName");
    const userTweetsQueryId = extractQueryId(bundle, "UserTweets");

    if (!bearerToken || !userByScreenNameQueryId || !userTweetsQueryId) {
      throw new ProviderError("Unable to extract X guest query config", {
        provider: "x-guest",
        url: mainBundleUrl
      });
    }

    this.cachedConfig = {
      bearerToken,
      userByScreenNameQueryId,
      userTweetsQueryId
    };
    this.cachedAt = Date.now();

    return this.cachedConfig;
  }

  private async activateGuestToken(config: GuestClientConfig) {
    const { data } = await fetchJson(
      "x-guest",
      `${X_API_BASE_URL}/1.1/guest/activate.json`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.bearerToken}`,
          "user-agent": "Mozilla/5.0 (compatible; EthosKaitoCollector/1.0)"
        }
      },
      (value) => z.object({ guest_token: z.string().min(1) }).parse(value)
    );

    return data.guest_token;
  }

  private async getSession() {
    const config = await this.getConfig();
    const guestToken = await this.activateGuestToken(config);
    return { config, guestToken } satisfies GuestSession;
  }

  async withSession<T>(worker: (session: GuestSession) => Promise<T>) {
    const session = await this.getSession();
    return worker(session);
  }

  private async fetchGraphql(
    session: GuestSession,
    input: {
      queryId: string;
      operationName: string;
      variables: Record<string, unknown>;
      features?: Record<string, boolean>;
      fieldToggles?: Record<string, boolean>;
    }
  ) {
    const { data } = await fetchJson(
      "x-guest",
      `${X_WEB_BASE_URL}/i/api/graphql/${input.queryId}/${input.operationName}`,
      {
        headers: {
          authorization: `Bearer ${session.config.bearerToken}`,
          "x-guest-token": session.guestToken,
          "x-twitter-active-user": "yes",
          "x-twitter-client-language": "en",
          "user-agent": "Mozilla/5.0 (compatible; EthosKaitoCollector/1.0)"
        },
        query: {
          variables: JSON.stringify(input.variables),
          features: JSON.stringify(input.features ?? {}),
          fieldToggles: JSON.stringify(input.fieldToggles ?? {})
        },
        timeoutMs: 15_000
      },
      (value) => z.object({}).passthrough().parse(value)
    );

    return data;
  }

  private async getUserRestIdByUsernameWithSession(session: GuestSession, xUsername: string) {
    const data = await this.fetchGraphql(session, {
      queryId: session.config.userByScreenNameQueryId,
      operationName: "UserByScreenName",
      variables: {
        screen_name: xUsername,
        withSafetyModeUserFields: true
      },
      features: USER_BY_SCREEN_NAME_FEATURES,
      fieldToggles: USER_BY_SCREEN_NAME_FIELD_TOGGLES
    });

    const root = isRecord(data) ? data : {};
    const innerData = isRecord(root.data) ? root.data : {};
    const user = isRecord(innerData.user) ? innerData.user : {};
    const result = isRecord(user.result) ? user.result : {};
    const restId = typeof result.rest_id === "string" ? result.rest_id : null;

    if (!restId) {
      throw new ProviderError("User rest_id was not found", {
        provider: "x-guest",
        url: `${X_WEB_BASE_URL}/i/api/graphql/${session.config.userByScreenNameQueryId}/UserByScreenName`
      });
    }

    return restId;
  }

  async getUserRestIdByUsername(xUsername: string) {
    const session = await this.getSession();
    return this.getUserRestIdByUsernameWithSession(session, xUsername);
  }

  async getRecentTweetsByUsername(input: { xUsername: string; count?: number }, session?: GuestSession) {
    const activeSession = session ?? (await this.getSession());
    const userId = await this.getUserRestIdByUsernameWithSession(activeSession, input.xUsername);
    const count = Math.max(1, Math.min(input.count ?? 5, 20));
    const data = await this.fetchGraphql(activeSession, {
      queryId: activeSession.config.userTweetsQueryId,
      operationName: "UserTweets",
      variables: {
        userId,
        count,
        includePromotedContent: false,
        withVoice: true
      },
      features: USER_TWEETS_FEATURES,
      fieldToggles: USER_TWEETS_FIELD_TOGGLES
    });

    return extractTimelineTweetRefs(data, input.xUsername).slice(0, count);
  }
}

export const xGuestClient = new XGuestClient();
