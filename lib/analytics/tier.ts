import type { EthosLevel, EthosStats, TrustTier } from "@/lib/types/domain";
import { clamp } from "@/lib/utils";

const SCORE_MAX = 2800;
export const TRUST_TIER_ORDER: TrustTier[] = ["T4", "T3", "T2", "T1", "T0"];

const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  T0: "Bronze",
  T1: "Gold",
  T2: "Platinum",
  T3: "Diamond",
  T4: "Challenger"
};

export function getTrustTier(trustComposite: number): TrustTier {
  if (trustComposite >= 80) return "T4";
  if (trustComposite >= 60) return "T3";
  if (trustComposite >= 40) return "T2";
  if (trustComposite >= 20) return "T1";
  return "T0";
}

export function getTrustTierLabel(tier: TrustTier) {
  return TRUST_TIER_LABELS[tier];
}

export function getTierWeight(tier: TrustTier) {
  switch (tier) {
    case "T4":
      return 10;
    case "T3":
      return 7;
    case "T2":
      return 4;
    case "T1":
      return 2;
    case "T0":
    default:
      return 1;
  }
}

function computeReviewHealth(stats: EthosStats) {
  const positive = stats.review.received.positive ?? 0;
  const neutral = stats.review.received.neutral ?? 0;
  const negative = stats.review.received.negative ?? 0;
  const total = positive + neutral + negative;

  if (total === 0) {
    return 0.5;
  }

  return clamp((positive + neutral * 0.35 - negative * 0.85) / total, 0, 1);
}

function computeVouchHealth(stats: EthosStats) {
  const count = stats.vouch.received.count ?? 0;
  return clamp(count / 25, 0, 1);
}

export function computeTrustComposite(input: {
  score: number;
  influenceFactorPercentile: number;
  humanVerificationStatus: "REQUESTED" | "VERIFIED" | "REVOKED" | null;
  stats: EthosStats;
}) {
  const scoreComponent = clamp(input.score / SCORE_MAX, 0, 1) * 60;
  const influenceComponent = clamp(input.influenceFactorPercentile / 100, 0, 1) * 20;
  const verificationComponent =
    input.humanVerificationStatus === "VERIFIED"
      ? 10
      : input.humanVerificationStatus === "REQUESTED"
        ? 5
        : 0;
  const reputationComponent =
    computeReviewHealth(input.stats) * 6 + computeVouchHealth(input.stats) * 4;

  return Math.round(clamp(scoreComponent + influenceComponent + verificationComponent + reputationComponent, 0, 100) * 10) / 10;
}

export function fallbackLevelFromScore(score: number): EthosLevel {
  if (score >= 2450) return "renowned";
  if (score >= 2200) return "revered";
  if (score >= 1950) return "distinguished";
  if (score >= 1700) return "exemplary";
  if (score >= 1450) return "reputable";
  if (score >= 1200) return "established";
  if (score >= 950) return "known";
  if (score >= 700) return "neutral";
  if (score >= 400) return "questionable";
  return "untrusted";
}
