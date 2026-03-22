import { describe, expect, it } from "vitest";

import { buildEthosUserSnapshot, toEthosXUsernameUserkey } from "@/lib/data/users";
import { buildEthosHeaders } from "@/lib/providers/ethos";

describe("ethos conventions", () => {
  it("formats x usernames as canonical Ethos userkeys", () => {
    expect(toEthosXUsernameUserkey("@ExampleUser")).toBe("service:x.com:username:exampleuser");
  });

  it("falls back to canonical x username userkey when raw userkeys are missing", () => {
    const snapshot = buildEthosUserSnapshot({
      id: 123,
      username: "ExampleUser",
      displayName: "Example User",
      avatarUrl: "",
      description: null,
      score: 1200,
      influenceFactor: 0,
      influenceFactorPercentile: 0,
      humanVerificationStatus: null,
      validatorNftCount: 0,
      xpTotal: 0,
      xpStreakDays: 0,
      stats: {
        review: { received: { negative: 0, neutral: 0, positive: 0 } },
        vouch: {
          given: { amountWeiTotal: "0", count: 0 },
          received: { amountWeiTotal: "0", count: 0 }
        }
      }
    });

    expect(snapshot.userkey).toBe("service:x.com:username:exampleuser");
  });

  it("adds the X-Ethos-Client header to Ethos requests", () => {
    const headers = buildEthosHeaders();
    expect(headers.get("X-Ethos-Client")).toBeTruthy();
  });
});
