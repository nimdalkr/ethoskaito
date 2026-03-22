import type { EthosLevel, TrustTier } from "@/lib/types/domain";

export interface ProviderRetryOptions {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface ProviderRequestOptions extends ProviderRetryOptions {
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export class ProviderError extends Error {
  readonly name = "ProviderError";
  readonly status: number | null;
  readonly url: string;
  readonly body: string | null;
  readonly provider: string;

  constructor(message: string, options: { provider: string; url: string; status?: number | null; body?: string | null; cause?: unknown }) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.provider = options.provider;
    this.url = options.url;
    this.status = options.status ?? null;
    this.body = options.body ?? null;
  }
}

export interface ProviderResponseMeta {
  status: number;
  url: string;
  elapsedMs: number;
}

export interface EthosUserByXResult {
  userId: string;
  userkey: string;
  userkeys: string[];
  profileId: number | null;
  displayName: string;
  username: string | null;
  avatarUrl: string;
  description: string | null;
  score: number;
  level: EthosLevel | null;
  influenceFactor: number;
  influenceFactorPercentile: number;
  humanVerificationStatus: "REQUESTED" | "VERIFIED" | "REVOKED" | null;
  validatorNftCount: number;
  xpTotal: number;
  xpStreakDays: number;
  stats: NormalizedProfileStats;
  trustComposite: number;
  trustTier: TrustTier;
}

export interface EthosScoreLevelResult {
  userkey: string;
  score: number;
  level: EthosLevel;
  trustTier: TrustTier;
}

export interface EthosProjectCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface EthosProjectChain {
  id: number;
  name: string;
  url: string | null;
  iconUrl: string | null;
}

export interface EthosProjectVoter {
  userId: string;
  userkey: string;
  displayName: string;
  username: string | null;
  score: number;
  level: EthosLevel | null;
  trustComposite: number;
  trustTier: TrustTier;
}

export interface EthosProjectVotes {
  bullish: {
    total: number;
    uniqueVoters: number;
    topVoters: EthosProjectVoter[];
  };
  bearish: {
    total: number;
    uniqueVoters: number;
    topVoters: EthosProjectVoter[];
  };
  all: {
    total: number;
    uniqueVoters: number;
  };
}

export interface EthosProjectResult {
  id: number;
  userkey: string;
  status: "ACTIVE" | "ARCHIVED";
  bannerImageUrl: string | null;
  isPromoted: boolean;
  showArchived: boolean;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: EthosUserByXResult;
  votes: EthosProjectVotes;
  categories: EthosProjectCategory[];
  chains: EthosProjectChain[];
  commentCount: number;
  aliases: string[];
}

export interface EthosVouchRecord {
  id: number | string | null;
  authorProfileId: number;
  subjectProfileId: number;
  balance: string | null;
  archived: boolean;
  vouchedAt: string | null;
  updatedAt: string | null;
  authorUser: Pick<EthosUserByXResult, "userId" | "userkey" | "displayName" | "username" | "score" | "level" | "trustComposite" | "trustTier"> | null;
  subjectUser: Pick<EthosUserByXResult, "userId" | "userkey" | "displayName" | "username" | "score" | "level" | "trustComposite" | "trustTier"> | null;
}

export interface FxTwitterTweetAuthor {
  name: string;
  username: string;
  avatarUrl: string | null;
  verified: boolean | null;
}

export interface FxTwitterTweetResult {
  xUsername: string;
  tweetId: string;
  tweetUrl: string;
  url: string;
  text: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  author: FxTwitterTweetAuthor;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
  mediaCount: number;
  raw: Record<string, unknown>;
}

export interface ProjectOutcomeSnapshotInput {
  symbol: string;
  from: string | number | Date;
  currency?: string;
}

export interface ProjectOutcomeSnapshot {
  symbol: string;
  currency: string;
  resolvedCoinId: string | null;
  from: string;
  asOf: string;
  priceAtFrom: number | null;
  currentPrice: number | null;
  returnPct: number | null;
  absoluteChange: number | null;
  points: Array<{
    at: string;
    price: number;
  }>;
}

export interface NormalizedProfileStats {
  review: {
    received: {
      negative: number;
      neutral: number;
      positive: number;
    };
  };
  vouch: {
    given: {
      amountWeiTotal: string;
      count: number;
    };
    received: {
      amountWeiTotal: string;
      count: number;
    };
  };
}

export interface NormalizedTrustProfile {
  score: number;
  level: EthosLevel | null;
  influenceFactor: number;
  influenceFactorPercentile: number;
  humanVerificationStatus: "REQUESTED" | "VERIFIED" | "REVOKED" | null;
  validatorNftCount: number;
  trustComposite: number;
  trustTier: TrustTier;
}

export interface ProviderClock {
  now: () => number;
}

export type JsonObject = Record<string, unknown>;
