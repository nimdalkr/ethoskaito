import { describe, expect, it } from "vitest";

import {
  isMissingUserErrorMessage,
  isRateLimitCircuitOpen,
  isWorkerLeaseActive,
  shouldDeactivateTrackedAccount
} from "@/lib/collector/health";

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

  it("flags missing-user collector errors for deactivation", () => {
    expect(isMissingUserErrorMessage("User rest_id was not found")).toBe(true);
    expect(
      shouldDeactivateTrackedAccount({
        lastCollectorError: "User rest_id was not found",
        consecutiveFailures: 3
      })
    ).toBe(true);
    expect(
      shouldDeactivateTrackedAccount({
        lastCollectorError: "Request failed with status 429",
        consecutiveFailures: 3
      })
    ).toBe(false);
  });

  it("opens the circuit breaker when rate-limit hits cross the threshold", () => {
    expect(isRateLimitCircuitOpen({ recentRateLimitHits: 6 })).toBe(true);
    expect(isRateLimitCircuitOpen({ recentRateLimitHits: 5 })).toBe(false);
  });
});
