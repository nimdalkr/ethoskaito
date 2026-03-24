import { describe, expect, it } from "vitest";

import { isWorkerLeaseActive } from "@/lib/collector/health";

describe("collector worker health", () => {
  it("treats an unexpired lease as active", () => {
    expect(
      isWorkerLeaseActive({
        expiresAt: new Date(Date.now() + 60_000)
      })
    ).toBe(true);
  });

  it("treats a missing or expired lease as inactive", () => {
    expect(isWorkerLeaseActive(null)).toBe(false);
    expect(
      isWorkerLeaseActive({
        expiresAt: new Date(Date.now() - 1_000)
      })
    ).toBe(false);
  });
});
