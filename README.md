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
curl -X POST "http://localhost:3000/api/cron/collect?accounts=20&tweets=5" \
  -H "authorization: Bearer $CRON_SECRET"
```

The collector will:

- ensure tracked project usernames exist when the tracker is still sparse
- fetch the latest tweet IDs from X guest GraphQL
- skip tweet IDs already stored in the database
- pass unseen tweets into the existing FxTwitter-based ingest pipeline
