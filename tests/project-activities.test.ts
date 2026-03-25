import { describe, expect, it } from "vitest";

import { isSyncableEthosProject } from "@/lib/ingest/project-activities";
import { normalizeProjectActivityRecord } from "@/lib/providers/ethos";

describe("project activity collection", () => {
  it("keeps only real Ethos projects for sync", () => {
    expect(isSyncableEthosProject({ projectId: 6, userkey: "service:x.com:1342961741718810632" })).toBe(true);
    expect(isSyncableEthosProject({ projectId: -1006, userkey: "external:kaito:selected:monad" })).toBe(false);
    expect(isSyncableEthosProject({ projectId: 6, userkey: "service:farcaster:123" })).toBe(false);
  });

  it("normalizes raw project review activities", () => {
    const record = normalizeProjectActivityRecord({
      type: "review",
      timestamp: 1774337075,
      link: "https://app.ethos.network/activity/review/123",
      llmQualityScore: 82,
      isSpam: false,
      data: {
        id: 123,
        createdAt: "2026-03-24T13:59:59.000Z",
        score: "positive",
        comment: "Monad keeps shipping.",
        metadata: "{\"description\":\"High conviction builder momentum.\"}"
      },
      votes: {
        upvotes: 11,
        downvotes: 1
      },
      replySummary: {
        count: 3
      },
      authorUser: {
        id: "42",
        profileId: 3029,
        displayName: "Fredricks",
        username: "FredricksOG",
        score: 1720,
        avatarUrl: "",
        influenceFactor: 10,
        influenceFactorPercentile: 60,
        xpTotal: 0,
        xpStreakDays: 0,
        xpRemovedDueToAbuse: false,
        validatorNftCount: 0
      },
      subjectUser: {
        id: "99",
        profileId: 8,
        displayName: "Monad",
        username: "monad",
        score: 1810,
        avatarUrl: "",
        influenceFactor: 12,
        influenceFactorPercentile: 70,
        xpTotal: 0,
        xpStreakDays: 0,
        xpRemovedDueToAbuse: false,
        validatorNftCount: 0
      }
    });

    expect(record).not.toBeNull();
    expect(record?.externalActivityId).toBe("123");
    expect(record?.type).toBe("review");
    expect(record?.timestamp).toBe("2026-03-24T07:24:35.000Z");
    expect(record?.sentiment).toBe("positive");
    expect(record?.comment).toBe("Monad keeps shipping.");
    expect(record?.description).toBe("High conviction builder momentum.");
    expect(record?.upvotes).toBe(11);
    expect(record?.downvotes).toBe(1);
    expect(record?.replyCount).toBe(3);
    expect(record?.author?.username).toBe("FredricksOG");
    expect(record?.subject?.username).toBe("monad");
  });
});
