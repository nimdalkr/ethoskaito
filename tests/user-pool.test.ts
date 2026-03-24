import { describe, expect, it } from "vitest";

import { extractTrackableAccounts } from "@/lib/data/user-pool";
import type { EthosUserSnapshot } from "@/lib/types/domain";

function makeUser(input: Partial<EthosUserSnapshot>): EthosUserSnapshot {
  return {
    userId: input.userId ?? "1",
    userkey: input.userkey ?? "userkey-1",
    profileId: input.profileId ?? 1,
    displayName: input.displayName ?? "User One",
    username: Object.prototype.hasOwnProperty.call(input, "username") ? (input.username ?? null) : "userone",
    avatarUrl: input.avatarUrl ?? "",
    description: input.description ?? null,
    score: input.score ?? 1000,
    level: input.level ?? "known",
    influenceFactor: input.influenceFactor ?? 0,
    influenceFactorPercentile: input.influenceFactorPercentile ?? 0,
    humanVerificationStatus: input.humanVerificationStatus ?? null,
    validatorNftCount: input.validatorNftCount ?? 0,
    xpTotal: input.xpTotal ?? 0,
    xpStreakDays: input.xpStreakDays ?? 0,
    stats: input.stats ?? {
      review: { received: { negative: 0, neutral: 0, positive: 0 } },
      vouch: {
        given: { amountWeiTotal: "0", count: 0 },
        received: { amountWeiTotal: "0", count: 0 }
      }
    },
    trustComposite: input.trustComposite ?? 30,
    trustTier: input.trustTier ?? "T1"
  };
}

describe("user pool tracking", () => {
  it("extracts unique normalized usernames", () => {
    const accounts = extractTrackableAccounts([
      makeUser({ userkey: "userkey-1", username: "@UserOne" }),
      makeUser({ userId: "2", userkey: "userkey-2", username: "userone" }),
      makeUser({ userId: "3", userkey: "userkey-3", username: "UserTwo" })
    ]);

    expect(accounts).toEqual([
      {
        xUsername: "userone",
        ethosUserkey: "userkey-2",
        source: "ethos-profile-sync"
      },
      {
        xUsername: "usertwo",
        ethosUserkey: "userkey-3",
        source: "ethos-profile-sync"
      }
    ]);
  });

  it("skips users without x usernames", () => {
    const accounts = extractTrackableAccounts([
      makeUser({ userkey: "userkey-1", username: null }),
      makeUser({ userId: "2", userkey: "userkey-2", username: "" }),
      makeUser({ userId: "3", userkey: "userkey-3", username: "usable" })
    ]);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.xUsername).toBe("usable");
  });

  it("skips official project accounts", () => {
    const accounts = extractTrackableAccounts(
      [
        makeUser({ userkey: "userkey-1", username: "monad" }),
        makeUser({ userId: "2", userkey: "userkey-2", username: "builder_alpha" })
      ],
      new Set(["monad"])
    );

    expect(accounts).toEqual([
      {
        xUsername: "builder_alpha",
        ethosUserkey: "userkey-2",
        source: "ethos-profile-sync"
      }
    ]);
  });
});
