import type { CollectorMode } from "@/lib/collector/scheduling";
import { syncEthosUserPool } from "@/lib/data/user-pool";

const MAIN_SHARD_COUNT = 40;
const REPAIR_SLOT_COUNT = 10;
const HOT_SLOT_COUNT = 10;
const DEFAULT_USER_POOL_PAGE_SIZE = 500;
const USER_POOL_SYNC_SLOT_COUNT = MAIN_SHARD_COUNT * 2 + REPAIR_SLOT_COUNT + HOT_SLOT_COUNT;

export function getUserPoolSyncSlot(mode: CollectorMode, target: string | null | undefined) {
  if (!target) {
    return null;
  }

  if (mode === "main") {
    const match = target.match(/^(\d+)-(a|b)$/i);
    if (!match) {
      return null;
    }

    const shardId = Number.parseInt(match[1], 10);
    const lane = match[2].toLowerCase();
    if (!Number.isFinite(shardId) || shardId < 0 || shardId >= MAIN_SHARD_COUNT) {
      return null;
    }

    return {
      slotIndex: shardId + (lane === "b" ? MAIN_SHARD_COUNT : 0),
      slotCount: USER_POOL_SYNC_SLOT_COUNT
    };
  }

  if (mode === "repair" || mode === "hot") {
    const match = target.match(/^all-(\d+)$/i);
    if (!match) {
      return null;
    }

    const shardId = Number.parseInt(match[1], 10);
    if (!Number.isFinite(shardId) || shardId < 0 || shardId >= REPAIR_SLOT_COUNT) {
      return null;
    }

    return {
      slotIndex: (mode === "repair" ? MAIN_SHARD_COUNT * 2 : MAIN_SHARD_COUNT * 2 + REPAIR_SLOT_COUNT) + shardId,
      slotCount: USER_POOL_SYNC_SLOT_COUNT
    };
  }

  return null;
}

export async function syncCollectorUserPoolSlot(mode: CollectorMode, target: string | null | undefined) {
  const slot = getUserPoolSyncSlot(mode, target);
  if (!slot) {
    return null;
  }

  const limit = DEFAULT_USER_POOL_PAGE_SIZE;
  const result = await syncEthosUserPool({
    limit,
    maxPages: 1,
    offset: slot.slotIndex * limit,
    refreshExisting: false
  });

  return {
    slotIndex: slot.slotIndex,
    slotCount: slot.slotCount,
    pageSize: limit,
    ...result
  };
}
