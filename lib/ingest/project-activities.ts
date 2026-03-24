import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ethosClient } from "@/lib/providers/ethos";
import type { EthosProjectActivityRecord } from "@/lib/types/provider";

const DEFAULT_BUCKET_INDEX = 0;
const DEFAULT_BUCKET_COUNT = 1;
const DEFAULT_ACTIVITY_LIMIT = 10;
const DEFAULT_SINCE_HOURS = 72;

export interface CollectProjectActivitiesOptions {
  bucketIndex?: number;
  bucketCount?: number;
  activityLimit?: number;
  sinceHours?: number;
  projectLimit?: number;
}

interface SyncableProject {
  id: string;
  projectId: number;
  userkey: string;
  name: string;
}

function asJsonValue(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function clampPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

export function isSyncableEthosProject(project: Pick<SyncableProject, "projectId" | "userkey">) {
  return project.projectId > 0 && project.userkey.startsWith("service:x.com:");
}

function shouldKeepProjectForBucket(project: SyncableProject, bucketIndex: number, bucketCount: number) {
  return ((project.projectId % bucketCount) + bucketCount) % bucketCount === bucketIndex;
}

function normalizeTimestamp(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildProjectActivityWrite(projectId: string, activity: EthosProjectActivityRecord) {
  const timestamp = normalizeTimestamp(activity.timestamp);
  if (!timestamp) {
    return null;
  }

  return {
    projectId,
    externalActivityId: activity.externalActivityId,
    type: activity.type,
    timestamp,
    sourceCreatedAt: normalizeTimestamp(activity.createdAt),
    sentiment: activity.sentiment,
    comment: activity.comment,
    description: activity.description,
    authorUserkey: activity.author?.userkey ?? null,
    authorProfileId: activity.author?.profileId ?? null,
    authorUsername: activity.author?.username ?? null,
    authorDisplayName: activity.author?.displayName ?? null,
    subjectUserkey: activity.subject?.userkey ?? null,
    subjectProfileId: activity.subject?.profileId ?? null,
    subjectUsername: activity.subject?.username ?? null,
    subjectDisplayName: activity.subject?.displayName ?? null,
    upvotes: activity.upvotes,
    downvotes: activity.downvotes,
    replyCount: activity.replyCount,
    llmQualityScore: activity.llmQualityScore,
    isSpam: activity.isSpam,
    link: activity.link,
    raw: asJsonValue(activity.raw)
  };
}

export async function collectProjectActivities(options: CollectProjectActivitiesOptions = {}) {
  const bucketCount = clampPositiveInteger(options.bucketCount ?? DEFAULT_BUCKET_COUNT, DEFAULT_BUCKET_COUNT, 64);
  const bucketIndex = clampPositiveInteger((options.bucketIndex ?? DEFAULT_BUCKET_INDEX) + 1, DEFAULT_BUCKET_INDEX + 1, bucketCount) - 1;
  const activityLimit = clampPositiveInteger(options.activityLimit ?? DEFAULT_ACTIVITY_LIMIT, DEFAULT_ACTIVITY_LIMIT, 25);
  const sinceHours = clampPositiveInteger(options.sinceHours ?? DEFAULT_SINCE_HOURS, DEFAULT_SINCE_HOURS, 24 * 30);
  const cutoffAt = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const projects = await prisma.project.findMany({
    orderBy: [{ totalVotes: "desc" }, { projectId: "asc" }],
    select: {
      id: true,
      projectId: true,
      userkey: true,
      name: true
    }
  });

  const selectedProjects = projects
    .filter(isSyncableEthosProject)
    .filter((project) => shouldKeepProjectForBucket(project, bucketIndex, bucketCount))
    .slice(0, options.projectLimit && options.projectLimit > 0 ? options.projectLimit : undefined);

  let activitiesSeen = 0;
  let activitiesStored = 0;
  const failures: Array<{ projectId: number; name: string; reason: string }> = [];

  for (const project of selectedProjects) {
    try {
      const feed = await ethosClient.getProjectActivities(project.userkey, {
        limit: activityLimit,
        excludeSpam: true,
        excludeHistorical: true
      });

      for (const activity of feed.values) {
        const timestamp = normalizeTimestamp(activity.timestamp);
        if (!timestamp || timestamp < cutoffAt) {
          continue;
        }

        activitiesSeen += 1;
        const write = buildProjectActivityWrite(project.id, activity);
        if (!write) {
          continue;
        }

        await prisma.projectActivity.upsert({
          where: {
            projectId_externalActivityId_type: {
              projectId: project.id,
              externalActivityId: write.externalActivityId,
              type: write.type
            }
          },
          update: write,
          create: write
        });
        activitiesStored += 1;
      }
    } catch (error) {
      failures.push({
        projectId: project.projectId,
        name: project.name,
        reason: error instanceof Error ? error.message : "Unknown project activity sync error"
      });
    }
  }

  return {
    bucketIndex,
    bucketCount,
    sinceHours,
    cutoffAt: cutoffAt.toISOString(),
    projectsProcessed: selectedProjects.length,
    activitiesSeen,
    activitiesStored,
    failures
  };
}
