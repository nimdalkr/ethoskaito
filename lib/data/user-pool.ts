import { prisma } from "@/lib/db";
import { getOfficialProjectUsernameSet, isOfficialProjectUsername, normalizeXUsername } from "@/lib/collector/project-accounts";
import { buildEthosUserSnapshot, buildEthosUserWriteData, buildTrackedAccountWriteData, upsertEthosUser } from "@/lib/data/users";
import { ethosClient } from "@/lib/providers/ethos";
import type { EthosUserSnapshot } from "@/lib/types/domain";

export function extractTrackableAccounts(users: EthosUserSnapshot[], officialProjectUsernames = new Set<string>()) {
  const accountMap = new Map<string, { xUsername: string; ethosUserkey: string; source: string }>();

  for (const user of users) {
    if (!user.username) {
      continue;
    }

    const xUsername = normalizeXUsername(user.username);
    if (!xUsername) {
      continue;
    }
    if (isOfficialProjectUsername(xUsername, officialProjectUsernames)) {
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
  const officialProjectUsernames = await getOfficialProjectUsernameSet();

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
    const snapshotProfileIds = snapshots
      .map((snapshot) => snapshot.profileId)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const existingUsers = await prisma.ethosUser.findMany({
      where: {
        OR: [
          {
            userkey: {
              in: snapshots.map((snapshot) => snapshot.userkey)
            }
          },
          snapshotProfileIds.length > 0
            ? {
                profileId: {
                  in: snapshotProfileIds
                }
              }
            : {
                userkey: {
                  in: []
                }
              }
        ]
      },
      select: {
        userkey: true,
        profileId: true
      }
    });
    const existingUserSet = new Set(existingUsers.map((user) => user.userkey));
    const existingProfileIdSet = new Set(
      existingUsers
        .map((user) => user.profileId)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    );
    const newUsers = snapshots.filter(
      (snapshot) => !existingUserSet.has(snapshot.userkey) && (snapshot.profileId === null || !existingProfileIdSet.has(snapshot.profileId))
    );
    const existingSnapshots = snapshots.filter(
      (snapshot) => existingUserSet.has(snapshot.userkey) || (snapshot.profileId !== null && existingProfileIdSet.has(snapshot.profileId))
    );

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
        await upsertEthosUser(snapshot, rawUserByUserkey.get(snapshot.userkey) ?? null);
        updatedUsers += 1;
      }
    }
    syncedUsers += snapshots.length;

    const trackedAccounts = extractTrackableAccounts(snapshots, officialProjectUsernames);
    const existingTrackedAccounts = await prisma.trackedAccount.findMany({
      where: {
        xUsername: {
          in: trackedAccounts.map((account) => account.xUsername)
        }
      },
      select: {
        xUsername: true,
        isActive: true
      }
    });
    const existingTrackedMap = new Map(existingTrackedAccounts.map((account) => [account.xUsername, account] as const));
    const newTrackedAccounts = trackedAccounts.filter((account) => !existingTrackedMap.has(account.xUsername));
    const existingTracked = trackedAccounts.filter((account) => existingTrackedMap.has(account.xUsername));

    if (newTrackedAccounts.length > 0) {
      await prisma.trackedAccount.createMany({
        data: newTrackedAccounts.map((account) => ({
          ...buildTrackedAccountWriteData({
            xUsername: account.xUsername,
            ethosUserkey: account.ethosUserkey,
            source: account.source,
            trustComposite: snapshots.find((snapshot) => snapshot.userkey === account.ethosUserkey)?.trustComposite ?? null
          })
        })),
        skipDuplicates: true
      });
      createdTrackedAccounts += newTrackedAccounts.length;
    }

    if (refreshExisting) {
      for (const account of existingTracked) {
        const scheduling = buildTrackedAccountWriteData({
          xUsername: account.xUsername,
          ethosUserkey: account.ethosUserkey,
          source: account.source,
          trustComposite: snapshots.find((snapshot) => snapshot.userkey === account.ethosUserkey)?.trustComposite ?? null
        });
        const existingTrackedAccount = existingTrackedMap.get(account.xUsername);
        await prisma.trackedAccount.update({
          where: { xUsername: account.xUsername },
          data: {
            ethosUserkey: account.ethosUserkey,
            source: account.source,
            isActive: true,
            assignedShardId: scheduling.assignedShardId,
            priorityScore: scheduling.priorityScore,
            ...(existingTrackedAccount?.isActive === false
              ? {
                  nextEligibleAt: scheduling.nextEligibleAt
                }
              : {})
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
