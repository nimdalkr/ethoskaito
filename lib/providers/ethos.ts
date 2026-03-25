import { z } from "zod";

import { env } from "@/lib/env";
import { pickCanonicalEthosUserkey } from "@/lib/ethos/identity";
import { clamp, normalizeToken, slugify } from "@/lib/utils";
import { fetchJson, pickString, pickNumber, isRecord, asRecord, pickFirstRecord, toIsoString } from "@/lib/providers/shared";
import type {
  EthosActivityActorSummary,
  EthosActivityFeedResult,
  EthosActivitySummary,
  EthosCategoryRank,
  EthosCategoryRanksResult,
  EthosProjectActivityFeedResult,
  EthosProjectActivityRecord,
  EthosProjectCategory,
  EthosProjectChain,
  EthosProfilesPageResult,
  EthosProjectResult,
  EthosProjectVoter,
  EthosProjectVotes,
  EthosScoreLevelResult,
  EthosUserByXResult,
  EthosVouchRecord,
  EthosXpMultipliers,
  ProviderRequestOptions
} from "@/lib/types/provider";

const defaultBaseUrl = env.ETHOS_API_BASE_URL;

export function buildEthosHeaders(headers: HeadersInit = {}) {
  const merged = new Headers(headers);
  merged.set("X-Ethos-Client", env.ETHOS_CLIENT_NAME);
  return merged;
}

const ethosScoreLevelSchema = z.enum([
  "untrusted",
  "questionable",
  "neutral",
  "known",
  "established",
  "reputable",
  "exemplary",
  "distinguished",
  "revered",
  "renowned"
]);

const userSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  profileId: z.number().nullable().optional(),
  displayName: z.string(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().optional().nullable().default(""),
  description: z.string().nullable().optional(),
  score: z.number(),
  status: z.enum(["ACTIVE", "INACTIVE", "MERGED"]),
  userkeys: z.array(z.string()).default([]),
  xpTotal: z.number().default(0),
  xpStreakDays: z.number().default(0),
  xpRemovedDueToAbuse: z.boolean().default(false),
  influenceFactor: z.number().default(0),
  influenceFactorPercentile: z.number().default(0),
  humanVerificationStatus: z.enum(["REQUESTED", "VERIFIED", "REVOKED"]).nullable().optional(),
  validatorNftCount: z.number().default(0),
  stats: z
    .object({
      review: z
        .object({
          received: z
            .object({
              negative: z.number().default(0),
              neutral: z.number().default(0),
              positive: z.number().default(0)
            })
            .passthrough()
        })
        .passthrough(),
      vouch: z
        .object({
          given: z
            .object({
              amountWeiTotal: z.union([z.string(), z.number()]).default("0"),
              count: z.number().default(0)
            })
            .passthrough(),
          received: z
            .object({
              amountWeiTotal: z.union([z.string(), z.number()]).default("0"),
              count: z.number().default(0)
            })
            .passthrough()
        })
        .passthrough()
    })
    .passthrough()
    .optional()
});

const scoreSchema = z.object({
  score: z.number(),
  level: ethosScoreLevelSchema
});

const projectVotesSchema = z.object({
  bullish: z
    .object({
      topVoters: z.array(userSchema).default([]),
      total: z.number().default(0),
      uniqueVoters: z.number().default(0)
    })
    .passthrough(),
  bearish: z
    .object({
      topVoters: z.array(userSchema).default([]),
      total: z.number().default(0),
      uniqueVoters: z.number().default(0)
    })
    .passthrough(),
  all: z
    .object({
      total: z.number().default(0),
      uniqueVoters: z.number().default(0)
    })
    .passthrough()
});

const projectSchema = z
  .object({
    id: z.number(),
    userkey: z.string(),
    status: z.enum(["ACTIVE", "ARCHIVED"]),
    bannerImageUrl: z.string().optional().nullable().default(""),
    isPromoted: z.boolean().default(false),
    showArchived: z.boolean().default(false),
    description: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    user: userSchema,
    votes: projectVotesSchema,
    categories: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable().optional()
        })
      )
      .default([]),
    chains: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          url: z.string().optional().nullable().default(""),
          iconUrl: z.string().optional().nullable().default("")
        })
      )
      .default([]),
    commentCount: z.number().default(0),
    links: z.record(z.unknown()).optional()
  })
  .passthrough();

const projectsResponseSchema = z.object({
  projects: z.array(projectSchema),
  total: z.number()
});

const profilesPageSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  values: z
    .array(
      z
        .object({
          user: userSchema
        })
        .passthrough()
    )
    .default([])
});

const vouchUserSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  profileId: z.number().nullable().optional(),
  displayName: z.string(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().optional().nullable().default(""),
  description: z.string().nullable().optional(),
  score: z.number().default(0),
  status: z.string().optional(),
  userkeys: z.array(z.string()).optional(),
  xpTotal: z.number().default(0),
  xpStreakDays: z.number().default(0),
  xpRemovedDueToAbuse: z.boolean().default(false),
  influenceFactor: z.number().default(0),
  influenceFactorPercentile: z.number().default(0),
  humanVerificationStatus: z.enum(["REQUESTED", "VERIFIED", "REVOKED"]).nullable().optional(),
  validatorNftCount: z.number().default(0)
});

const categoryRanksResponseSchema = z.object({
  categoryRanks: z
    .array(
      z.object({
        rank: z.number(),
        category: z
          .object({
            id: z.number(),
            slug: z.string().nullable().optional(),
            name: z.string(),
            description: z.string().nullable().optional(),
            showOnLeaderboard: z.boolean().default(false),
            showInDailyService: z.boolean().default(false),
            bannerImageUrl: z.string().nullable().optional(),
            userCount: z.number().default(0)
          })
          .passthrough()
      })
    )
    .default([])
});

const activityFeedSchema = z.object({
  values: z.array(z.unknown()).default([]),
  total: z.number().default(0),
  limit: z.number().default(0),
  offset: z.number().default(0)
});

const multiplierTierSchema = z.object({
  threshold: z.number(),
  multiplier: z.number()
});

const xpMultipliersSchema = z.object({
  scoreMultiplier: z.object({
    value: z.number(),
    score: z.number(),
    tier: z.string(),
    nextTier: multiplierTierSchema.nullable()
  }),
  streakMultiplier: z.object({
    value: z.number(),
    streakDays: z.number(),
    tier: z.string(),
    nextTier: multiplierTierSchema.nullable()
  }),
  validatorCount: z.number(),
  marketHoldingsEth: z.number(),
  combinedMultiplier: z.number()
});

function deriveEthosLevel(score: number) {
  if (score >= 2600) return "renowned";
  if (score >= 2300) return "revered";
  if (score >= 2000) return "distinguished";
  if (score >= 1700) return "exemplary";
  if (score >= 1400) return "reputable";
  if (score >= 1100) return "established";
  if (score >= 800) return "known";
  if (score >= 500) return "neutral";
  if (score >= 200) return "questionable";
  return "untrusted";
}

function deriveTrustTier(score: number): "T0" | "T1" | "T2" | "T3" | "T4" {
  if (score >= 80) return "T4";
  if (score >= 60) return "T3";
  if (score >= 40) return "T2";
  if (score >= 20) return "T1";
  return "T0";
}

function normalizeStats(raw: EthosUserByXResult["stats"] | undefined) {
  return {
    review: {
      received: {
        negative: raw?.review.received.negative ?? 0,
        neutral: raw?.review.received.neutral ?? 0,
        positive: raw?.review.received.positive ?? 0
      }
    },
    vouch: {
      given: {
        amountWeiTotal: String(raw?.vouch.given.amountWeiTotal ?? "0"),
        count: raw?.vouch.given.count ?? 0
      },
      received: {
        amountWeiTotal: String(raw?.vouch.received.amountWeiTotal ?? "0"),
        count: raw?.vouch.received.count ?? 0
      }
    }
  };
}

function deriveTrustComposite(input: {
  score: number;
  influenceFactorPercentile: number;
  humanVerificationStatus: EthosUserByXResult["humanVerificationStatus"];
  validatorNftCount: number;
  stats: EthosUserByXResult["stats"];
}) {
  const scorePart = clamp((input.score / 2800) * 60, 0, 60);
  const influencePart = clamp((input.influenceFactorPercentile / 100) * 20, 0, 20);
  const verificationPart = input.humanVerificationStatus === "VERIFIED" ? 10 : input.humanVerificationStatus ? 4 : 0;
  const reviewHealth =
    clamp((input.stats.review.received.positive - input.stats.review.received.negative + 10) / 20, 0, 1) * 5;
  const vouchHealth = clamp(Math.log10(Number(input.stats.vouch.received.count) + 1) * 2, 0, 5);
  const validatorBonus = input.validatorNftCount > 0 ? 2 : 0;

  return clamp(scorePart + influencePart + verificationPart + reviewHealth + vouchHealth + validatorBonus, 0, 100);
}

function normalizeUser(user: z.infer<typeof userSchema>): EthosUserByXResult {
  const stats = normalizeStats(user.stats as EthosUserByXResult["stats"] | undefined);
  const trustComposite = deriveTrustComposite({
    score: user.score,
    influenceFactorPercentile: user.influenceFactorPercentile,
    humanVerificationStatus: user.humanVerificationStatus ?? null,
    validatorNftCount: user.validatorNftCount,
    stats
  });

  return {
    userId: user.id,
    userkey: pickCanonicalEthosUserkey({
      userkeys: user.userkeys,
      username: user.username ?? null,
      id: user.id
    }),
    userkeys: user.userkeys,
    profileId: user.profileId ?? null,
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl || "",
    description: user.description ?? null,
    score: user.score,
    level: deriveEthosLevel(user.score) as EthosScoreLevelResult["level"],
    influenceFactor: user.influenceFactor,
    influenceFactorPercentile: user.influenceFactorPercentile,
    humanVerificationStatus: user.humanVerificationStatus ?? null,
    validatorNftCount: user.validatorNftCount,
    xpTotal: user.xpTotal,
    xpStreakDays: user.xpStreakDays,
    stats,
    trustComposite,
    trustTier: deriveTrustTier(trustComposite)
  };
}

function normalizeProjectVoter(raw: unknown): EthosProjectVoter | null {
  if (!isRecord(raw)) {
    return null;
  }
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const user = normalizeUser(parsed.data);
  return {
    userId: user.userId,
    userkey: user.userkey,
    displayName: user.displayName,
    username: user.username,
    score: user.score,
    level: user.level,
    trustComposite: user.trustComposite,
    trustTier: user.trustTier
  };
}

function normalizeProject(raw: z.infer<typeof projectSchema>): EthosProjectResult {
  const aliases = [
    raw.userkey,
    raw.user.username ?? undefined,
    raw.user.displayName,
    normalizeToken(raw.user.displayName),
    slugify(raw.user.displayName)
  ].filter((value): value is string => Boolean(value));

  return {
    id: raw.id,
    userkey: raw.userkey,
    status: raw.status,
    bannerImageUrl: raw.bannerImageUrl || null,
    isPromoted: raw.isPromoted,
    showArchived: raw.showArchived,
    description: raw.description ?? raw.user.description ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    user: normalizeUser(raw.user),
    votes: {
      bullish: {
        total: raw.votes.bullish.total,
        uniqueVoters: raw.votes.bullish.uniqueVoters,
        topVoters: raw.votes.bullish.topVoters.map(normalizeProjectVoter).filter((value): value is EthosProjectVoter => Boolean(value))
      },
      bearish: {
        total: raw.votes.bearish.total,
        uniqueVoters: raw.votes.bearish.uniqueVoters,
        topVoters: raw.votes.bearish.topVoters.map(normalizeProjectVoter).filter((value): value is EthosProjectVoter => Boolean(value))
      },
      all: {
        total: raw.votes.all.total,
        uniqueVoters: raw.votes.all.uniqueVoters
      }
    },
    categories: raw.categories.map((category): EthosProjectCategory => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null
    })),
    chains: raw.chains.map((chain): EthosProjectChain => ({
      id: chain.id,
      name: chain.name,
      url: chain.url || null,
      iconUrl: chain.iconUrl || null
    })),
    commentCount: raw.commentCount,
    aliases: Array.from(new Set(aliases))
  };
}

function normalizeVouchUser(raw: unknown) {
  const parsed = vouchUserSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const user = parsed.data;
  const stats = {
    review: {
      received: {
        negative: 0,
        neutral: 0,
        positive: 0
      }
    },
    vouch: {
      given: {
        amountWeiTotal: "0",
        count: 0
      },
      received: {
        amountWeiTotal: "0",
        count: 0
      }
    }
  };
  const trustComposite = clamp((user.score / 2800) * 60 + (user.influenceFactorPercentile / 100) * 20 + (user.humanVerificationStatus === "VERIFIED" ? 10 : 0), 0, 100);
  return {
    userId: user.id,
    userkey: pickCanonicalEthosUserkey({
      userkeys: user.userkeys ?? [],
      username: user.username ?? null,
      id: user.id
    }),
    profileId: user.profileId ?? null,
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? null,
    description: user.description ?? null,
    score: user.score,
    level: deriveEthosLevel(user.score) as EthosScoreLevelResult["level"],
    influenceFactor: user.influenceFactor,
    influenceFactorPercentile: user.influenceFactorPercentile,
    humanVerificationStatus: user.humanVerificationStatus ?? null,
    validatorNftCount: user.validatorNftCount,
    xpTotal: user.xpTotal,
    xpStreakDays: user.xpStreakDays,
    stats,
    trustComposite,
    trustTier: deriveTrustTier(trustComposite)
  };
}

function normalizeVouchRecord(raw: unknown): EthosVouchRecord | null {
  if (!isRecord(raw)) {
    return null;
  }

  const authorUser = normalizeVouchUser(raw.authorUser);
  const subjectUser = normalizeVouchUser(raw.subjectUser);
  const id = typeof raw.id === "number" || typeof raw.id === "string" ? raw.id : null;

  const authorProfileId = pickNumber(raw, ["authorProfileId"], Number.NaN);
  const subjectProfileId = pickNumber(raw, ["subjectProfileId"], Number.NaN);
  if (!Number.isFinite(authorProfileId) || !Number.isFinite(subjectProfileId)) {
    return null;
  }

  return {
    id,
    authorProfileId,
    subjectProfileId,
    balance: typeof raw.balance === "string" ? raw.balance : typeof raw.balance === "number" ? String(raw.balance) : null,
    archived: Boolean(raw.archived ?? false),
    vouchedAt: typeof raw.vouchedAt === "string" ? raw.vouchedAt : typeof raw.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    authorUser,
    subjectUser
  };
}

function normalizeVouchesResponse(value: unknown): EthosVouchRecord[] {
  const root = asRecord(value);
  const values = Array.isArray(root.values) ? root.values : Array.isArray(root.vouches) ? root.vouches : [];
  return values.map(normalizeVouchRecord).filter((item): item is EthosVouchRecord => Boolean(item));
}

function normalizeCategoryRanks(value: z.infer<typeof categoryRanksResponseSchema>): EthosCategoryRanksResult {
  return {
    categoryRanks: value.categoryRanks.map((item): EthosCategoryRank => ({
      rank: item.rank,
      category: {
        id: item.category.id,
        slug: item.category.slug ?? null,
        name: item.category.name,
        description: item.category.description ?? null,
        showOnLeaderboard: item.category.showOnLeaderboard,
        showInDailyService: item.category.showInDailyService,
        bannerImageUrl: item.category.bannerImageUrl ?? null,
        userCount: item.category.userCount
      }
    }))
  };
}

function startCase(input: string) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function pickStringArray(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const items = value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    if (items.length > 0) {
      return items;
    }
  }
  return [];
}

function parseJsonRecord(value: unknown) {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickScalarString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function pickIsoTimestamp(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return toIsoString(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return toIsoString(value);
    }
  }
  return "";
}

function normalizeActivitySummary(raw: unknown): EthosActivitySummary | null {
  if (!isRecord(raw)) {
    return null;
  }

  const record = pickFirstRecord(raw, ["activity", "item"]);
  const author = asRecord(record.author);
  const subject = asRecord(record.subject);
  const type = pickString(record, ["type", "activityType"], "activity");
  const createdAt = pickString(record, ["createdAt", "timestamp"], "");
  const title =
    pickString(record, ["title", "comment", "content", "description", "reason"], "") ||
    [pickString(author, ["displayName", "username"], ""), pickString(subject, ["displayName", "username"], "")]
      .filter(Boolean)
      .join(" -> ") ||
    `${startCase(type)} activity`;
  const score = pickNumber(record, ["score", "points", "votes"], Number.NaN);

  return {
    type,
    title,
    createdAt: createdAt || null,
    score: Number.isFinite(score) ? score : null
  };
}

function normalizeActivityActor(rawActor: unknown, rawUser: unknown): EthosActivityActorSummary | null {
  const parsedUser = vouchUserSchema.safeParse(rawUser);
  if (parsedUser.success) {
    const user = normalizeVouchUser(parsedUser.data);
    if (user) {
      return {
        userkey: user.userkey,
        profileId: user.profileId,
        displayName: user.displayName,
        username: user.username,
        score: user.score,
        level: user.level,
        trustComposite: user.trustComposite,
        trustTier: user.trustTier
      };
    }
  }

  const parsedActor = userSchema.safeParse(rawActor);
  if (parsedActor.success) {
    const user = normalizeUser(parsedActor.data);
    return {
      userkey: user.userkey,
      profileId: user.profileId,
      displayName: user.displayName,
      username: user.username,
      score: user.score,
      level: user.level,
      trustComposite: user.trustComposite,
      trustTier: user.trustTier
    };
  }

  const actor = asRecord(rawActor);
  const actorUser = asRecord(rawUser);
  const username = pickString(actorUser, ["username"], "") || pickString(actor, ["username"], "");
  const userkeys = pickStringArray(actorUser, ["userkeys"]).concat(pickStringArray(actor, ["userkeys"]));
  const id = pickScalarString(actorUser, ["id"]) || pickScalarString(actor, ["id"]);
  const actorUserScore = pickNumber(actorUser, ["score"], Number.NaN);
  const actorScore = pickNumber(actor, ["score"], Number.NaN);
  const score = Number.isFinite(actorUserScore) ? actorUserScore : actorScore;
  const trustComposite = Number.isFinite(score) ? clamp((score / 2800) * 100, 0, 100) : Number.NaN;
  const displayName = pickString(actorUser, ["displayName", "name"], "") || pickString(actor, ["displayName", "name"], "");
  const actorUserProfileId = pickNumber(actorUser, ["profileId"], Number.NaN);
  const actorProfileId = pickNumber(actor, ["profileId"], Number.NaN);
  const profileId = Number.isFinite(actorUserProfileId) ? actorUserProfileId : actorProfileId;

  if (!displayName && !username && userkeys.length === 0 && !id) {
    return null;
  }

  return {
    userkey: pickCanonicalEthosUserkey({
      userkeys,
      username: username || null,
      id: id || null
    }),
    profileId: Number.isFinite(profileId) ? profileId : null,
    displayName: displayName || null,
    username: username || null,
    score: Number.isFinite(score) ? score : null,
    level: Number.isFinite(score) ? (deriveEthosLevel(score) as EthosScoreLevelResult["level"]) : null,
    trustComposite: Number.isFinite(trustComposite) ? trustComposite : null,
    trustTier: Number.isFinite(trustComposite) ? deriveTrustTier(trustComposite) : null
  };
}

export function normalizeProjectActivityRecord(raw: unknown): EthosProjectActivityRecord | null {
  if (!isRecord(raw)) {
    return null;
  }

  const record = pickFirstRecord(raw, ["activity", "item"]);
  const data = asRecord(record.data);
  const translation = asRecord(record.translation);
  const metadata = parseJsonRecord(data.metadata);
  const author = normalizeActivityActor(record.author, record.authorUser);
  const subject = normalizeActivityActor(record.subject, record.subjectUser);
  const type = pickString(record, ["type", "activityType"], "activity");
  const timestamp = pickIsoTimestamp(record, ["timestamp"]);
  const createdAt = pickIsoTimestamp(data, ["createdAt"]) || pickIsoTimestamp(record, ["createdAt"]);
  const comment =
    pickString(translation, ["translatedContent"], "") ||
    pickString(data, ["comment"], "") ||
    pickString(record, ["comment", "content"], "") ||
    null;
  const description =
    pickString(translation, ["translatedDescription"], "") ||
    pickString(metadata ?? {}, ["description"], "") ||
    pickString(record, ["description"], "") ||
    null;
  const externalActivityId =
    pickScalarString(data, ["id"]) ||
    pickScalarString(record, ["id"]) ||
    pickString(record, ["link"], "") ||
    [type, timestamp || createdAt, author?.userkey ?? author?.username ?? "unknown", subject?.userkey ?? subject?.username ?? "unknown"].join(":");

  return {
    externalActivityId,
    type,
    timestamp: timestamp || createdAt || null,
    createdAt: createdAt || timestamp || null,
    sentiment: pickString(data, ["score"], "") || null,
    comment,
    description,
    upvotes: pickNumber(asRecord(record.votes), ["upvotes"], 0),
    downvotes: pickNumber(asRecord(record.votes), ["downvotes"], 0),
    replyCount: pickNumber(asRecord(record.replySummary), ["count", "replyCount", "total"], 0),
    llmQualityScore: (() => {
      const value = pickNumber(record, ["llmQualityScore"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    isSpam: Boolean(record.isSpam ?? false),
    link: pickString(record, ["link"], "") || null,
    author,
    subject,
    raw: record,
  };
}

function normalizeActivityFeed(value: z.infer<typeof activityFeedSchema>): EthosActivityFeedResult {
  return {
    total: value.total,
    limit: value.limit,
    offset: value.offset,
    values: value.values.map(normalizeActivitySummary).filter((item): item is EthosActivitySummary => Boolean(item))
  };
}

function normalizeProjectActivityFeed(value: z.infer<typeof activityFeedSchema>): EthosProjectActivityFeedResult {
  return {
    total: value.total,
    limit: value.limit,
    offset: value.offset,
    values: value.values.map(normalizeProjectActivityRecord).filter((item): item is EthosProjectActivityRecord => Boolean(item))
  };
}

export class EthosClient {
  readonly baseUrl: string;

  constructor(baseUrl = defaultBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private withHeaders<T extends ProviderRequestOptions>(options: T): T {
    return {
      ...options,
      headers: buildEthosHeaders(options.headers)
    };
  }

  async getUserByX(xUsername: string, options: ProviderRequestOptions = {}): Promise<EthosUserByXResult> {
    const { data } = await fetchJson("ethos", `${this.baseUrl}/user/by/x/${encodeURIComponent(xUsername)}`, this.withHeaders(options), (value) =>
      userSchema.parse(value)
    );
    return normalizeUser(data);
  }

  async getUsersByX(accountIdsOrUsernames: string[], options: ProviderRequestOptions = {}) {
    const normalized = Array.from(
      new Set(
        accountIdsOrUsernames
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    if (normalized.length === 0) {
      return new Map<string, EthosUserByXResult>();
    }

    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/users/by/x`,
      this.withHeaders({
        ...options,
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {})
        },
        body: JSON.stringify({
          accountIdsOrUsernames: normalized.slice(0, 500)
        })
      }),
      (value) => z.array(userSchema).parse(value)
    );

    return new Map(
      data
        .map(normalizeUser)
        .filter((user) => Boolean(user.username))
        .map((user) => [user.username!.trim().toLowerCase(), user] as const)
    );
  }

  async getScoreLevel(userkey: string, options: ProviderRequestOptions = {}): Promise<EthosScoreLevelResult> {
    const { data } = await fetchJson(
      "ethos",
        `${this.baseUrl}/score/userkey`,
      this.withHeaders({
        ...options,
        query: {
          userkey,
          triggerCalculation: true
        }
      }),
      (value) => scoreSchema.parse(value)
    );

    return {
      userkey,
      score: data.score,
      level: data.level,
      trustTier: deriveTrustTier(clamp((data.score / 2800) * 100, 0, 100))
    };
  }

  async getProjects(options: ProviderRequestOptions & { limit?: number } = {}): Promise<EthosProjectResult[]> {
    const limit = options.limit ?? 100;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const projects: EthosProjectResult[] = [];
    const requestOptions = this.withHeaders({ ...options });
    delete (requestOptions as { limit?: number }).limit;

    while (projects.length < total) {
      const { data } = await fetchJson(
        "ethos",
        `${this.baseUrl}/projects`,
        {
          ...requestOptions,
          query: {
            limit,
            offset
          }
        },
        (value) => projectsResponseSchema.parse(value)
      );

      total = data.total;
      projects.push(...data.projects.map(normalizeProject));
      if (data.projects.length < limit) {
        break;
      }
      offset += limit;
    }

    return projects;
  }

  async getProfilesPage(
    options: ProviderRequestOptions & { limit?: number; offset?: number; archived?: boolean } = {}
  ): Promise<EthosProfilesPageResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 500, 500));
    const offset = Math.max(0, options.offset ?? 0);
    const archived = options.archived ?? false;
    const requestOptions = this.withHeaders({ ...options });
    delete (requestOptions as { limit?: number }).limit;
    delete (requestOptions as { offset?: number }).offset;
    delete (requestOptions as { archived?: boolean }).archived;

    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/profiles`,
      {
        ...requestOptions,
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(requestOptions.headers ?? {})
        },
        body: JSON.stringify({
          archived,
          limit,
          offset,
          sortField: "createdAt",
          sortDirection: "desc"
        })
      },
      (value) => profilesPageSchema.parse(value)
    );

    return {
      total: data.total,
      limit: data.limit,
      offset: data.offset,
      users: data.values.map((entry) => normalizeUser(entry.user))
    };
  }

  async getProjectById(projectId: string | number, options: ProviderRequestOptions = {}): Promise<EthosProjectResult> {
    const { data } = await fetchJson("ethos", `${this.baseUrl}/projects/${encodeURIComponent(String(projectId))}`, this.withHeaders(options), (value) =>
      projectSchema.parse(value)
    );
    return normalizeProject(data);
  }

  async getVouchesByProfileId(profileId: number, options: ProviderRequestOptions & { limit?: number } = {}): Promise<EthosVouchRecord[]> {
    const limit = options.limit ?? 100;
    let offset = 0;
    const vouches: EthosVouchRecord[] = [];
    const requestOptions = this.withHeaders({ ...options });
    delete (requestOptions as { limit?: number }).limit;

    while (true) {
      const { data } = await fetchJson(
        "ethos",
        `${this.baseUrl}/vouches`,
        {
          ...requestOptions,
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(requestOptions.headers ?? {})
          },
          body: JSON.stringify({
            subjectProfileIds: [profileId],
            limit,
            offset
          })
        },
        normalizeVouchesResponse
      );

      vouches.push(...data);
      if (data.length < limit) {
        break;
      }
      offset += limit;
    }

    return vouches;
  }

  async getUserCategoryRanks(userkey: string, options: ProviderRequestOptions = {}): Promise<EthosCategoryRanksResult> {
    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/users/${encodeURIComponent(userkey)}/categories`,
      this.withHeaders(options),
      (value) => categoryRanksResponseSchema.parse(value)
    );

    return normalizeCategoryRanks(data);
  }

  async getProfileActivities(
    userkey: string,
    options: ProviderRequestOptions & { limit?: number; offset?: number; excludeSpam?: boolean; excludeHistorical?: boolean } = {}
  ): Promise<EthosActivityFeedResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 6, 25));
    const offset = Math.max(0, options.offset ?? 0);
    const excludeSpam = options.excludeSpam ?? true;
    const excludeHistorical = options.excludeHistorical ?? true;
    const requestOptions = this.withHeaders({ ...options });
    delete (requestOptions as { limit?: number }).limit;
    delete (requestOptions as { offset?: number }).offset;
    delete (requestOptions as { excludeSpam?: boolean }).excludeSpam;
    delete (requestOptions as { excludeHistorical?: boolean }).excludeHistorical;

    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/activities/profile/all`,
      {
        ...requestOptions,
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(requestOptions.headers ?? {})
        },
        body: JSON.stringify({
          userkey,
          limit,
          offset,
          excludeSpam,
          excludeHistorical,
          orderBy: {
            field: "timestamp",
            direction: "desc"
          }
        })
      },
      (value) => activityFeedSchema.parse(value)
    );

    return normalizeActivityFeed(data);
  }

  async getProjectActivities(
    userkey: string,
    options: ProviderRequestOptions & { limit?: number; offset?: number; excludeSpam?: boolean; excludeHistorical?: boolean } = {}
  ): Promise<EthosProjectActivityFeedResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 10, 25));
    const offset = Math.max(0, options.offset ?? 0);
    const excludeSpam = options.excludeSpam ?? true;
    const excludeHistorical = options.excludeHistorical ?? true;
    const requestOptions = this.withHeaders({ ...options });
    delete (requestOptions as { limit?: number }).limit;
    delete (requestOptions as { offset?: number }).offset;
    delete (requestOptions as { excludeSpam?: boolean }).excludeSpam;
    delete (requestOptions as { excludeHistorical?: boolean }).excludeHistorical;

    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/activities/project`,
      {
        ...requestOptions,
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(requestOptions.headers ?? {})
        },
        body: JSON.stringify({
          userkey,
          limit,
          offset,
          excludeSpam,
          excludeHistorical,
          orderBy: {
            field: "timestamp",
            direction: "desc"
          }
        })
      },
      (value) => activityFeedSchema.parse(value)
    );

    return normalizeProjectActivityFeed(data);
  }

  async getXpMultipliers(profileId: number, options: ProviderRequestOptions = {}): Promise<EthosXpMultipliers> {
    const { data } = await fetchJson(
      "ethos",
      `${this.baseUrl}/xp/dashboard/multipliers/${profileId}`,
      this.withHeaders(options),
      (value) => xpMultipliersSchema.parse(value)
    );

    return data;
  }
}

export const ethosClient = new EthosClient();
