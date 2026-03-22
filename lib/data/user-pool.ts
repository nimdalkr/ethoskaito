import { prisma } from "@/lib/db";
import { buildEthosUserSnapshot, buildEthosUserWriteData } from "@/lib/data/users";
import { ethosClient } from "@/lib/providers/ethos";
import type { EthosUserSnapshot } from "@/lib/types/domain";

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function extractTrackableAccounts(users: EthosUserSnapshot[]) {
  const accountMap = new Map<string, { xUsername: string; ethosUserkey: string; source: string }>();

  for (const user of users) {
    if (!user.username) {
      continue;
    }

    const xUsername = normalizeUsername(user.username);
    if (!xUsername) {
      continue;
    }

    accountMap.set(xUsername, {
      xUsername,
      ethosUserkey: user.userkey,
      source: "ethos-profile-sync"
    });
  }

  return [...accountMap.values()];
}

export async function syncEthosUserPool(options: {
  limit?: number;
  maxPages?: number;
  offset?: number;
  archived?: boolean;
  refreshExisting?: boolean;
} = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 500, 500));
  const maxPages = Math.max(1, options.maxPages ?? Number.MAX_SAFE_INTEGER);
  const archived = options.archived ?? false;
  const refreshExisting = options.refreshExisting ?? false;

  let total = Number.POSITIVE_INFINITY;
  let offset = Math.max(0, options.offset ?? 0);
  let pages = 0;
  let syncedUsers = 0;
  let trackedAccountsUpserted = 0;
  let createdUsers = 0;
  let updatedUsers = 0;
  let createdTrackedAccounts = 0;
  let updatedTrackedAccounts = 0;

  while (offset < total && pages < maxPages) {
    const page = await ethosClient.getProfilesPage({
      limit,
      offset,
      archived
    });

    total = page.total;
    pages += 1;

    const snapshots = page.users.map((user) => buildEthosUserSnapshot(user, user.level ?? undefined));
    const rawUserByUserkey = new Map(page.users.map((user) => [user.userkey, user] as const));

    const existingUsers = await prisma.ethosUser.findMany({
      where: {
        userkey: {
          in: snapshots.map((snapshot) => snapshot.userkey)
        }
      },
      select: {
        userkey: true
      }
    });
    const existingUserSet = new Set(existingUsers.map((user) => user.userkey));
    const newUsers = snapshots.filter((snapshot) => !existingUserSet.has(snapshot.userkey));
    const existingSnapshots = snapshots.filter((snapshot) => existingUserSet.has(snapshot.userkey));

    if (newUsers.length > 0) {
      await prisma.ethosUser.createMany({
        data: newUsers.map((snapshot) => ({
          userkey: snapshot.userkey,
          ...buildEthosUserWriteData(snapshot, rawUserByUserkey.get(snapshot.userkey) ?? null)
        })),
        skipDuplicates: true
      });
      createdUsers += newUsers.length;
    }

    if (refreshExisting) {
      for (const snapshot of existingSnapshots) {
        await prisma.ethosUser.update({
          where: { userkey: snapshot.userkey },
          data: buildEthosUserWriteData(snapshot, rawUserByUserkey.get(snapshot.userkey) ?? null)
        });
        updatedUsers += 1;
      }
    }
    syncedUsers += snapshots.length;

    const trackedAccounts = extractTrackableAccounts(snapshots);
    const existingTrackedAccounts = await prisma.trackedAccount.findMany({
      where: {
        xUsername: {
          in: trackedAccounts.map((account) => account.xUsername)
        }
      },
      select: {
        xUsername: true
      }
    });
    const existingTrackedSet = new Set(existingTrackedAccounts.map((account) => account.xUsername));
    const newTrackedAccounts = trackedAccounts.filter((account) => !existingTrackedSet.has(account.xUsername));
    const existingTracked = trackedAccounts.filter((account) => existingTrackedSet.has(account.xUsername));

    if (newTrackedAccounts.length > 0) {
      await prisma.trackedAccount.createMany({
        data: newTrackedAccounts.map((account) => ({
          xUsername: account.xUsername,
          ethosUserkey: account.ethosUserkey,
          source: account.source,
          isActive: true
        })),
        skipDuplicates: true
      });
      createdTrackedAccounts += newTrackedAccounts.length;
    }

    if (refreshExisting) {
      for (const account of existingTracked) {
        await prisma.trackedAccount.update({
          where: { xUsername: account.xUsername },
          data: {
            ethosUserkey: account.ethosUserkey,
            source: account.source,
            isActive: true
          }
        });
        updatedTrackedAccounts += 1;
      }
    }
    trackedAccountsUpserted += trackedAccounts.length;

    if (page.users.length < limit) {
      break;
    }

    offset += limit;
  }

  return {
    total,
    syncedUsers,
    createdUsers,
    updatedUsers,
    trackedAccountsUpserted,
    createdTrackedAccounts,
    updatedTrackedAccounts,
    pages,
    nextOffset: offset
  };
}
