export type TrustTier = "T0" | "T1" | "T2" | "T3" | "T4";

export type EthosLevel =
  | "untrusted"
  | "questionable"
  | "neutral"
  | "known"
  | "established"
  | "reputable"
  | "exemplary"
  | "distinguished"
  | "revered"
  | "renowned";

export interface TweetIngestPayload {
  tweetId: string;
  tweetUrl: string;
  xUsername: string;
  observedAt: string;
  source: string;
}

export interface EthosStats {
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

export interface EthosUserSnapshot {
  userId: string;
  userkey: string;
  profileId: number | null;
  displayName: string;
  username: string | null;
  avatarUrl: string;
  description: string | null;
  score: number;
  level: EthosLevel;
  influenceFactor: number;
  influenceFactorPercentile: number;
  humanVerificationStatus: "REQUESTED" | "VERIFIED" | "REVOKED" | null;
  validatorNftCount: number;
  xpTotal: number;
  xpStreakDays: number;
  stats: EthosStats;
  trustComposite: number;
  trustTier: TrustTier;
}

export interface ProjectSnapshot {
  id: string;
  projectId: number;
  userkey: string;
  name: string;
  username: string | null;
  description: string | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  chains: Array<{ id: number; name: string; url: string | null; iconUrl: string | null }>;
  totalVotes: number;
  uniqueVoters: number;
  bullishVotes: number;
  bearishVotes: number;
  commentCount: number;
  aliases: string[];
}

export interface NormalizedTweet {
  tweetId: string;
  url: string;
  xUsername: string;
  authorName: string;
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  raw: unknown;
}

export interface ProjectMention {
  tweetId: string;
  projectId: string;
  authorUserkey: string;
  authorTier: TrustTier;
  authorComposite: number;
  mentionedAt: string;
  weight: number;
  isFirstTrackedMention: boolean;
}

export interface ProjectOutcome {
  projectId: string;
  symbol: string;
  source: string;
  firstPriceAt: string | null;
  latestPriceAt: string | null;
  return1d: number | null;
  return7d: number | null;
  return30d: number | null;
}

export interface TierRollup {
  projectId: string;
  tier: TrustTier;
  mentionCount: number;
  weightedMentions: number;
  uniqueAuthors: number;
  firstMentionAt: string | null;
}

export interface CollectorOpsSummary {
  totalTrackedAccounts: number;
  coveredLast24h: number;
  coveragePct: number;
  dueNow: number;
  failedAccounts: number;
  latestRun: {
    mode: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    selectedAccounts: number;
    processedAccounts: number;
    errorCount: number;
    shardId: number | null;
  } | null;
  latestMainCompletedAt: string | null;
  latestRepairCompletedAt: string | null;
  latestHotCompletedAt: string | null;
}
