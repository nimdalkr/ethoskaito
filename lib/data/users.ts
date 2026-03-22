import { prisma } from "@/lib/db";
import { computeTrustComposite, fallbackLevelFromScore, getTrustTier } from "@/lib/analytics/tier";
import { pickCanonicalEthosUserkey, toEthosXUsernameUserkey } from "@/lib/ethos/identity";
import type { EthosStats, EthosUserSnapshot } from "@/lib/types/domain";

function toStats(rawUser: any): EthosStats {
  return {
    review: {
      received: {
        negative: Number(rawUser?.stats?.review?.received?.negative ?? 0),
        neutral: Number(rawUser?.stats?.review?.received?.neutral ?? 0),
        positive: Number(rawUser?.stats?.review?.received?.positive ?? 0)
      }
    },
    vouch: {
      given: {
        amountWeiTotal: String(rawUser?.stats?.vouch?.given?.amountWeiTotal ?? "0"),
        count: Number(rawUser?.stats?.vouch?.given?.count ?? 0)
      },
      received: {
        amountWeiTotal: String(rawUser?.stats?.vouch?.received?.amountWeiTotal ?? "0"),
        count: Number(rawUser?.stats?.vouch?.received?.count ?? 0)
      }
    }
  };
}

export function buildEthosUserSnapshot(rawUser: any, level?: string): EthosUserSnapshot {
  const userkeys = Array.isArray(rawUser?.userkeys) ? rawUser.userkeys.filter(Boolean) : [];
  const userkey = pickCanonicalEthosUserkey({
    userkeys,
    username: rawUser?.username ?? null,
    id: rawUser?.id ?? null
  });
  const stats = toStats(rawUser);
  const score = Number(rawUser?.score ?? 0);
  const trustComposite = computeTrustComposite({
    score,
    influenceFactorPercentile: Number(rawUser?.influenceFactorPercentile ?? 0),
    humanVerificationStatus: rawUser?.humanVerificationStatus ?? null,
    stats
  });

  return {
    userId: String(rawUser?.id ?? userkey),
    userkey,
    profileId: rawUser?.profileId ?? null,
    displayName: rawUser?.displayName ?? rawUser?.username ?? userkey,
    username: rawUser?.username ?? null,
    avatarUrl: rawUser?.avatarUrl ?? "",
    description: rawUser?.description ?? null,
    score,
    level: (level as any) ?? fallbackLevelFromScore(score),
    influenceFactor: Number(rawUser?.influenceFactor ?? 0),
    influenceFactorPercentile: Number(rawUser?.influenceFactorPercentile ?? 0),
    humanVerificationStatus: rawUser?.humanVerificationStatus ?? null,
    validatorNftCount: Number(rawUser?.validatorNftCount ?? 0),
    xpTotal: Number(rawUser?.xpTotal ?? 0),
    xpStreakDays: Number(rawUser?.xpStreakDays ?? 0),
    stats,
    trustComposite,
    trustTier: getTrustTier(trustComposite)
  };
}

export function buildEthosUserWriteData(snapshot: EthosUserSnapshot, raw: unknown) {
  return {
    profileId: snapshot.profileId,
    username: snapshot.username,
    displayName: snapshot.displayName,
    avatarUrl: snapshot.avatarUrl,
    description: snapshot.description,
    score: snapshot.score,
    level: snapshot.level,
    influenceFactor: snapshot.influenceFactor,
    influenceFactorPercentile: snapshot.influenceFactorPercentile,
    humanVerificationStatus: snapshot.humanVerificationStatus,
    validatorNftCount: snapshot.validatorNftCount,
    xpTotal: snapshot.xpTotal,
    xpStreakDays: snapshot.xpStreakDays,
    reviewPositive: snapshot.stats.review.received.positive,
    reviewNeutral: snapshot.stats.review.received.neutral,
    reviewNegative: snapshot.stats.review.received.negative,
    vouchGivenCount: snapshot.stats.vouch.given.count,
    vouchReceivedCount: snapshot.stats.vouch.received.count,
    trustComposite: snapshot.trustComposite,
    trustTier: snapshot.trustTier,
    raw: raw as any
  };
}

export async function upsertEthosUser(snapshot: EthosUserSnapshot, raw: unknown) {
  const data = buildEthosUserWriteData(snapshot, raw);
  const existingByProfileId =
    snapshot.profileId !== null
      ? await prisma.ethosUser.findUnique({
          where: {
            profileId: snapshot.profileId
          },
          select: {
            id: true,
            userkey: true
          }
        })
      : null;

  if (existingByProfileId) {
    const existingByUserkey = await prisma.ethosUser.findUnique({
      where: {
        userkey: snapshot.userkey
      },
      select: {
        id: true
      }
    });

    return prisma.ethosUser.update({
      where: {
        id: existingByProfileId.id
      },
      data: {
        ...data,
        userkey: !existingByUserkey || existingByUserkey.id === existingByProfileId.id ? snapshot.userkey : existingByProfileId.userkey
      }
    });
  }

  return prisma.ethosUser.upsert({
    where: { userkey: snapshot.userkey },
    update: data,
    create: {
      userkey: snapshot.userkey,
      ...data
    }
  });
}
