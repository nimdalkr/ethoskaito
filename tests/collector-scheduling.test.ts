import { describe, expect, it } from "vitest";

import { getCollectorShardId, getFailureCooldownMs, getPriorityScore, getSweepIntervalMs } from "@/lib/collector/scheduling";

describe("collector scheduling", () => {
  it("assigns usernames deterministically to shards", () => {
    expect(getCollectorShardId("ExampleUser", 40)).toBe(getCollectorShardId("@exampleuser", 40));
  });

  it("raises priority for high-trust recent accounts", () => {
    const low = getPriorityScore({
      trustComposite: 20,
      lastQueuedCount: 0,
      lastObservedTweetAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    });
    const high = getPriorityScore({
      trustComposite: 90,
      lastQueuedCount: 2,
      lastObservedTweetAt: new Date()
    });

    expect(high).toBeGreaterThan(low);
  });

  it("backs off failed accounts aggressively", () => {
    expect(getFailureCooldownMs(1)).toBeGreaterThan(0);
    expect(getFailureCooldownMs(3)).toBeGreaterThan(getFailureCooldownMs(1));
  });

  it("keeps hot lane tighter than main sweep", () => {
    expect(getSweepIntervalMs("hot", 950)).toBeLessThan(getSweepIntervalMs("main", 950));
  });
});
