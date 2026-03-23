# Ethos Alpha Dashboard

Tier-aware analytics dashboard that combines:

- Ethos reputation and project data
- FixTweet/FxTwitter tweet expansion
- External price snapshots for outcome validation

## Stack

- Next.js App Router
- Prisma + PostgreSQL
- TypeScript
- Vitest

## Environment

Copy `.env.example` to `.env` and set:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ethos_alpha
ETHOS_CLIENT_NAME=ethosalpha
INGEST_API_KEY=replace-me
CRON_SECRET=replace-me
```

Optional provider overrides:

```bash
ETHOS_API_BASE_URL=https://api.ethos.network/api/v2
FXTWITTER_API_BASE_URL=https://api.fxtwitter.com
PRICE_API_BASE_URL=https://api.coingecko.com/api/v3
```

## Commands

```bash
npm install
npm run prisma:generate
npm run typecheck
npm test
npm run dev
```

## Key Routes

- `POST /api/ingest/tweets`
- `POST /api/cron/sync-users`
- `POST /api/cron/collect`
- `POST /api/cron/refresh`
- `GET /api/projects`
- `GET /api/projects/:projectId`
- `GET /api/projects/:projectId/mentions`
- `GET /api/projects/:projectId/flow`
- `GET /api/users/:userkey`

## Ingest Payload

```json
{
  "tweets": [
    {
      "tweetId": "1901234567890123456",
      "tweetUrl": "https://x.com/example/status/1901234567890123456",
      "xUsername": "example",
      "observedAt": "2026-03-22T04:10:00.000Z",
      "source": "external-collector"
    }
  ]
}
```

Provide `x-api-key: <INGEST_API_KEY>` when calling the ingest route.

## Notes

- The app expects an external collector to supply tweet IDs or URLs.
- A built-in sync route can now backfill the full Ethos profile pool via `/profiles`.
- All Ethos API requests include `X-Ethos-Client` using `ETHOS_CLIENT_NAME`.
- The collector discovers recent tweets from tracked Ethos usernames through X guest GraphQL and then expands each tweet through FxTwitter.
- Project catalog sync uses Ethos `projects`.
- Price mappings are seeded from project usernames and should be reviewed for accuracy.

## User Pool Sync

Backfill the Ethos user pool with:

```bash
curl -X POST "http://localhost:3000/api/cron/sync-users?limit=500&pages=10" \
  -H "authorization: Bearer $CRON_SECRET"
```

The sync will:

- page through the Ethos `/profiles` endpoint
- upsert every Ethos user into `EthosUser`
- add users with X usernames into `TrackedAccount`

## Collector

Trigger the internal collector with:

```bash
curl -X POST "http://localhost:3000/api/cron/collect?accounts=700&tweets=1&concurrency=10" \
  -H "authorization: Bearer $CRON_SECRET"
```

The collector will:

- ensure tracked project usernames exist when the tracker is still sparse
- prioritize never-collected accounts first, then rotate through the oldest collected accounts
- fetch the latest tweet IDs from X guest GraphQL
- skip tweet IDs already stored in the database
- stop scanning older timeline entries once the account's `lastSeenTweetId` is encountered
- pass unseen tweets into the existing FxTwitter-based ingest pipeline
- store per-account collection status on `TrackedAccount`

## Worker Mode

For reliable 24-hour coverage, run a separate long-lived worker instead of relying only on Vercel cron:

```bash
npm run collector:supervisor
```

The supervisor:

- acquires a DB-backed `WorkerLease` so only one active supervisor runs at a time
- runs `main -> repair -> hot` cycles continuously
- renews its lease during shard processing
- uses lighter `main` settings by default: `700 accounts`, `1 tweet/account`, `concurrency 10`

Useful env vars:

```bash
COLLECTOR_SHARDS=40
COLLECTOR_LEASE_SECONDS=300
COLLECTOR_MAIN_PAUSE_MS=30000
COLLECTOR_CYCLE_PAUSE_MS=900000
```
