const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const shardCount = Math.max(1, Number.parseInt(process.env.COLLECTOR_SHARDS ?? "40", 10) || 40);
const mainPauseMs = Math.max(5_000, Number.parseInt(process.env.COLLECTOR_MAIN_PAUSE_MS ?? "30000", 10) || 30000);
const cyclePauseMs = Math.max(30_000, Number.parseInt(process.env.COLLECTOR_CYCLE_PAUSE_MS ?? "900000", 10) || 900000);
const runOnce = process.env.COLLECTOR_ONCE === "1";

if (!secret) {
  throw new Error("CRON_SECRET is required");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    await postCollect({
      mode: "main",
      shard: String(shardId),
      shards: String(shardCount),
      accounts: process.env.MAIN_COLLECTOR_ACCOUNTS ?? "700",
      tweets: process.env.MAIN_COLLECTOR_TWEETS ?? "1",
      concurrency: process.env.MAIN_COLLECTOR_CONCURRENCY ?? "10"
    });
    await sleep(mainPauseMs);
  }
}

async function runRepairSweep() {
  await postCollect({
    mode: "repair",
    shards: String(shardCount),
    accounts: process.env.REPAIR_COLLECTOR_ACCOUNTS ?? "400",
    tweets: process.env.REPAIR_COLLECTOR_TWEETS ?? "2",
    concurrency: process.env.REPAIR_COLLECTOR_CONCURRENCY ?? "8"
  });
}

async function runHotSweep() {
  await postCollect({
    mode: "hot",
    shards: String(shardCount),
    accounts: process.env.HOT_COLLECTOR_ACCOUNTS ?? "300",
    tweets: process.env.HOT_COLLECTOR_TWEETS ?? "3",
    concurrency: process.env.HOT_COLLECTOR_CONCURRENCY ?? "10"
  });
}

async function runCycle() {
  await runMainSweep();
  await runRepairSweep();
  await runHotSweep();
}

(async () => {
  do {
    await runCycle();
    if (!runOnce) {
      await sleep(cyclePauseMs);
    }
  } while (!runOnce);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
