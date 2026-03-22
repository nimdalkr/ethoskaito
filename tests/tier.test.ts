import { describe, expect, it } from "vitest";
import { computeTrustComposite, getTierWeight, getTrustTier, getTrustTierLabel } from "@/lib/analytics/tier";

describe("tier analytics", () => {
  it("assigns the correct tier bucket", () => {
    expect(getTrustTier(10)).toBe("T0");
    expect(getTrustTier(25)).toBe("T1");
    expect(getTrustTier(45)).toBe("T2");
    expect(getTrustTier(65)).toBe("T3");
    expect(getTrustTier(95)).toBe("T4");
  });

  it("returns deterministic mention weights", () => {
    expect(getTierWeight("T0")).toBe(1);
    expect(getTierWeight("T1")).toBe(2);
    expect(getTierWeight("T2")).toBe(4);
    expect(getTierWeight("T3")).toBe(7);
    expect(getTierWeight("T4")).toBe(10);
  });

  it("maps buckets to LoL-style labels", () => {
    expect(getTrustTierLabel("T0")).toBe("Bronze");
    expect(getTrustTierLabel("T1")).toBe("Gold");
    expect(getTrustTierLabel("T2")).toBe("Platinum");
    expect(getTrustTierLabel("T3")).toBe("Diamond");
    expect(getTrustTierLabel("T4")).toBe("Challenger");
  });

  it("computes a higher composite for stronger profiles", () => {
    const low = computeTrustComposite({
      score: 600,
      influenceFactorPercentile: 15,
      humanVerificationStatus: null,
      stats: {
        review: { received: { negative: 5, neutral: 2, positive: 1 } },
        vouch: {
          given: { amountWeiTotal: "0", count: 0 },
          received: { amountWeiTotal: "0", count: 0 }
        }
      }
    });

    const high = computeTrustComposite({
      score: 2400,
      influenceFactorPercentile: 98,
      humanVerificationStatus: "VERIFIED",
      stats: {
        review: { received: { negative: 0, neutral: 2, positive: 35 } },
        vouch: {
          given: { amountWeiTotal: "0", count: 5 },
          received: { amountWeiTotal: "0", count: 20 }
        }
      }
    });

    expect(high).toBeGreaterThan(low);
    expect(getTrustTier(high)).toBe("T4");
  });
});
