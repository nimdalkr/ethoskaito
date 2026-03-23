import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const shardCount = Math.max(1, Number.parseInt(process.env.COLLECTOR_SHARDS ?? "40", 10) || 40);
const mainPauseMs = Math.max(5_000, Number.parseInt(process.env.COLLECTOR_MAIN_PAUSE_MS ?? "90000", 10) || 90000);
const cyclePauseMs = Math.max(30_000, Number.parseInt(process.env.COLLECTOR_CYCLE_PAUSE_MS ?? "900000", 10) || 900000);
const leaseSeconds = Math.max(60, Number.parseInt(process.env.COLLECTOR_LEASE_SECONDS ?? "300", 10) || 300);
const failurePauseMs = Math.max(15_000, Number.parseInt(process.env.COLLECTOR_FAILURE_PAUSE_MS ?? "60000", 10) || 60000);
const workerType = process.env.COLLECTOR_WORKER_TYPE ?? "collector-supervisor";
const holderId = process.env.COLLECTOR_WORKER_ID ?? `worker-${randomUUID()}`;
const runOnce = process.env.COLLECTOR_ONCE === "1";

if (!secret) {
  throw new Error("CRON_SECRET is required");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLease() {
  const expiresAt = new Date(Date.now() + leaseSeconds * 1000);

  try {
    await prisma.workerLease.create({
      data: {
        workerType,
        holderId,
        expiresAt
      }
    });
    return true;
  } catch {
    const claimed = await prisma.workerLease.updateMany({
      where: {
        workerType,
        OR: [{ holderId }, { expiresAt: { lt: new Date() } }]
      },
      data: {
        holderId,
        heartbeatAt: new Date(),
        expiresAt
      }
    });

    return claimed.count > 0;
  }
}

async function renewLease() {
  const renewed = await prisma.workerLease.updateMany({
    where: {
      workerType,
      holderId,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      heartbeatAt: new Date(),
      expiresAt: new Date(Date.now() + leaseSeconds * 1000)
    }
  });

  return renewed.count > 0;
}

async function releaseLease() {
  await prisma.workerLease.deleteMany({
    where: {
      workerType,
      holderId
    }
  });
}

async function postCollect(params) {
  const search = new URLSearchParams(params);
  const response = await fetch(`${appUrl}/api/cron/collect?${search.toString()}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`
    }
  });

  if (!response.ok) {
    throw new Error(`Collector request failed with ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  console.log(JSON.stringify(payload));
  return payload;
}

async function runMainSweep() {
  for (let shardId = 0; shardId < shardCount; shardId += 1) {
    const stillLeader = await renewLease();
    if (!stillLeader) {
      throw new Error("Collector lease was lost during main sweep");
    }

    await postCollect({
      mode: "main",
      shard: String(shardId),
      shards: String(shardCount),
      accounts: process.env.MAIN_COLLECTOR_ACCOUNTS ?? "220",
      tweets: process.env.MAIN_COLLECTOR_TWEETS ?? "1",
      concurrency: process.env.MAIN_COLLECTOR_CONCURRENCY ?? "4"
    });
    await sleep(mainPauseMs);
  }
}

async function runRepairSweep() {
  const stillLeader = await renewLease();
  if (!stillLeader) {
    throw new Error("Collector lease was lost before repair sweep");
  }

  await postCollect({
    mode: "repair",
    shards: String(shardCount),
    accounts: process.env.REPAIR_COLLECTOR_ACCOUNTS ?? "180",
    tweets: process.env.REPAIR_COLLECTOR_TWEETS ?? "2",
    concurrency: process.env.REPAIR_COLLECTOR_CONCURRENCY ?? "3"
  });
}

async function runHotSweep() {
  const stillLeader = await renewLease();
  if (!stillLeader) {
    throw new Error("Collector lease was lost before hot sweep");
  }

  await postCollect({
    mode: "hot",
    shards: String(shardCount),
    accounts: process.env.HOT_COLLECTOR_ACCOUNTS ?? "160",
    tweets: process.env.HOT_COLLECTOR_TWEETS ?? "2",
    concurrency: process.env.HOT_COLLECTOR_CONCURRENCY ?? "4"
  });
}

async function runCycle() {
  await runMainSweep();
  await runRepairSweep();
  await runHotSweep();
}

try {
  do {
    try {
      const acquired = await acquireLease();
      if (!acquired) {
        console.log(`Worker lease is held by another instance for ${workerType}`);
        await sleep(Math.min(cyclePauseMs, leaseSeconds * 1000));
        continue;
      }

      await runCycle();
      if (!runOnce) {
        await sleep(cyclePauseMs);
      }
    } catch (error) {
      console.error("Collector cycle failed", error);
      await sleep(failurePauseMs);
    }
  } while (!runOnce);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await releaseLease().catch(() => undefined);
  await prisma.$disconnect();
}
