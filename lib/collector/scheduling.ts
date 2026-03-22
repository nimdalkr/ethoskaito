export type CollectorMode = "main" | "repair" | "hot";

export const DEFAULT_COLLECTOR_SHARDS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function normalizeTrackedUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function getCollectorShardId(xUsername: string, shardCount = DEFAULT_COLLECTOR_SHARDS) {
  const normalized = normalizeTrackedUsername(xUsername);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return hash % Math.max(1, shardCount);
}

export function getPriorityScore(input: {
  trustComposite?: number | null;
  lastQueuedCount?: number | null;
  lastObservedTweetAt?: Date | string | null;
}) {
  const trustScore = Math.max(0, Math.round((input.trustComposite ?? 0) * 10));
  const queuedBonus = Math.max(0, Math.min(150, Math.round((input.lastQueuedCount ?? 0) * 25)));
  const observedAt = input.lastObservedTweetAt ? new Date(input.lastObservedTweetAt) : null;
  const activityAgeMs = observedAt ? Date.now() - observedAt.getTime() : Number.POSITIVE_INFINITY;
  const recencyBonus = activityAgeMs <= 12 * HOUR_MS ? 120 : activityAgeMs <= DAY_MS ? 80 : activityAgeMs <= 3 * DAY_MS ? 35 : 0;

  return trustScore + queuedBonus + recencyBonus;
}

export function getFailureCooldownMs(consecutiveFailures: number) {
  if (consecutiveFailures <= 0) return 0;
  if (consecutiveFailures === 1) return 6 * HOUR_MS;
  if (consecutiveFailures === 2) return DAY_MS;
  return 3 * DAY_MS;
}

export function getSweepIntervalMs(mode: CollectorMode, priorityScore: number) {
  if (mode === "repair") {
    return 12 * HOUR_MS;
  }

  if (mode === "hot") {
    if (priorityScore >= 900) return 15 * 60 * 1000;
    if (priorityScore >= 700) return 30 * 60 * 1000;
    return HOUR_MS;
  }

  if (priorityScore >= 900) return 6 * HOUR_MS;
  if (priorityScore >= 700) return 12 * HOUR_MS;
  return DAY_MS;
}

export function getNextEligibleAt(options: {
  mode: CollectorMode;
  priorityScore: number;
  now?: Date;
  consecutiveFailures?: number;
  success: boolean;
}) {
  const now = options.now ?? new Date();
  const offsetMs = options.success
    ? getSweepIntervalMs(options.mode, options.priorityScore)
    : getFailureCooldownMs(options.consecutiveFailures ?? 1);

  return new Date(now.getTime() + offsetMs);
}

export function getCollectorModeLabel(mode: CollectorMode) {
  switch (mode) {
    case "repair":
      return "Repair";
    case "hot":
      return "Hot lane";
    case "main":
    default:
      return "Main sweep";
  }
}
