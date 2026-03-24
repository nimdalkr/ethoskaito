const mode = process.argv[2] ?? "main";
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").trim();
const secret = process.env.CRON_SECRET;
const shardCount = Math.max(1, Number.parseInt(process.env.COLLECTOR_SHARDS ?? "40", 10) || 40);

if (!secret) {
  throw new Error("CRON_SECRET is required");
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

if (mode === "main") {
  for (let shardId = 0; shardId < shardCount; shardId += 1) {
    await postCollect({
      mode: "main",
      shard: String(shardId),
      shards: String(shardCount),
      accounts: process.env.COLLECTOR_ACCOUNTS ?? "220",
      tweets: process.env.COLLECTOR_TWEETS ?? "1",
      concurrency: process.env.COLLECTOR_CONCURRENCY ?? "4"
    });
  }
} else {
  await postCollect({
    mode,
    shards: String(shardCount),
    accounts: process.env.COLLECTOR_ACCOUNTS ?? (mode === "hot" ? "160" : "180"),
    tweets: process.env.COLLECTOR_TWEETS ?? (mode === "hot" ? "2" : "2"),
    concurrency: process.env.COLLECTOR_CONCURRENCY ?? (mode === "hot" ? "4" : "3")
  });
}
