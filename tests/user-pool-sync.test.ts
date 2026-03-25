import { describe, expect, it } from "vitest";

import { getInitialEligibleAt } from "@/lib/collector/scheduling";
import { getUserPoolSyncSlot } from "@/lib/collector/user-pool-sync";

describe("user pool sync slot mapping", () => {
  it("maps main shards across two daily lanes", () => {
    expect(getUserPoolSyncSlot("main", "0-a")).toEqual({ slotIndex: 0, slotCount: 100 });
    expect(getUserPoolSyncSlot("main", "39-a")).toEqual({ slotIndex: 39, slotCount: 100 });
    expect(getUserPoolSyncSlot("main", "0-b")).toEqual({ slotIndex: 40, slotCount: 100 });
    expect(getUserPoolSyncSlot("main", "39-b")).toEqual({ slotIndex: 79, slotCount: 100 });
  });

  it("maps repair and hot slots after main coverage", () => {
    expect(getUserPoolSyncSlot("repair", "all-0")).toEqual({ slotIndex: 80, slotCount: 100 });
    expect(getUserPoolSyncSlot("repair", "all-9")).toEqual({ slotIndex: 89, slotCount: 100 });
    expect(getUserPoolSyncSlot("hot", "all-0")).toEqual({ slotIndex: 90, slotCount: 100 });
    expect(getUserPoolSyncSlot("hot", "all-9")).toEqual({ slotIndex: 99, slotCount: 100 });
  });

  it("spreads initial eligibility inside the sweep interval", () => {
    const now = new Date("2026-03-25T00:00:00.000Z");
    const initial = getInitialEligibleAt("exampleuser", 0, now);
    expect(initial.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(initial.getTime()).toBeLessThan(now.getTime() + 24 * 60 * 60 * 1000);
  });
});
