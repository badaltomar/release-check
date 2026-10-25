# ReleaseCheck

A release checklist tool. Create a release, tick off its steps as you go, and the status updates itself: **Planned** when nothing is done, **Ongoing** once a step is done, **Done** when every step is done.

- Live app: `https://YOUR-SERVICE.onrender.com`
- GraphQL endpoint: `https://YOUR-SERVICE.onrender.com/graphql` (opening it in a browser shows GraphiQL, an in-browser query editor)

**Stack:** React + Vite (single-page app), Node.js + TypeScript, GraphQL Yoga on Fastify, PostgreSQL, Vitest, Docker, k6 for the load test.

## Run it locally

You need Node 22+ and Docker.

```bash
docker compose up -d db          # PostgreSQL on port 5433
cp .env.example .env
npm install
npm run dev                      # API on http://localhost:3000
npm run dev:web                  # UI on http://localhost:5173 (calls the API through a proxy)
```

Or run everything (database, API and built UI) in Docker:

```bash
docker compose up --build        # open http://localhost:3000
```

Tests (they need the database container running):

```bash
npm test
```

## API

One GraphQL endpoint: `POST /graphql`. There is also `GET /health` for the hosting platform.

| Operation | Type | What it does |
|---|---|---|
| `releases(limit: Int = 20, offset: Int = 0)` | query | Releases, newest date first, one page at a time (limit 1 to 100) |
| `releaseCount` | query | Total number of releases, for paging |
| `release(id: ID!)` | query | One release with its steps, or `null` |
| `createRelease(input: { name, date, additionalInfo })` | mutation | Create a release. `name` and `date` are required |
| `updateRelease(id, input: { name, date, additionalInfo })` | mutation | Change any of those fields |
| `setStepCompleted(releaseId, stepId, completed)` | mutation | Tick or untick one step. Returns the release with its new status |
| `deleteRelease(id)` | mutation | Delete a release. Returns its id |

A `Release` has `id`, `name`, `date` (ISO 8601), `status` (`PLANNED`, `ONGOING`, `DONE`), `additionalInfo`, `steps { id label completed }`, `completedStepCount`, `totalStepCount`, `createdAt` and `updatedAt`.

Example:

```bash
curl -X POST http://localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"mutation { createRelease(input: { name: \"Version 1.0.1\", date: \"2026-11-01T10:00:00Z\" }) { id status } }"}'
```

Invalid input comes back as a GraphQL error with `extensions.code` set to `BAD_USER_INPUT` or `NOT_FOUND`.

## Database schema

One table. Migrations are plain SQL files in `server/src/migrations` and run automatically on startup.

```sql
CREATE TABLE releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(trim(name)) > 0),
  release_date    timestamptz NOT NULL,
  additional_info text,
  completed_steps text[] NOT NULL DEFAULT '{}',   -- ids of the steps that are done
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX releases_date_idx ON releases (release_date DESC, id);
```

## Design decisions

- **Steps live in code, not in a table.** Every release has the same 8 steps (`server/src/steps.ts`). Each release stores the ids of its completed steps in a `text[]` column. Ids stay stable, so a label can be reworded without touching data.
- **Status is computed, never stored.** It is derived from the completed steps every time a release is read, so it can never disagree with the checklist.
- **Ticking a step is one SQL statement.** The database adds or removes the step id in place. Reading the array, changing it in code and writing it back lets two quick clicks overwrite each other; a test ticks all 8 steps at once and checks all 8 are kept.
- **The list is paginated.** The UI asks for 20 releases at a time instead of all of them (see Performance).
- **One server for UI and API.** In production Fastify serves the built React app and the GraphQL endpoint from the same address, so there is one URL to deploy and no CORS setup.
- **No user accounts.** The task asks for a single-user tool, so there is no login.

## Performance

The load test simulates people using the app: each virtual user opens the release list, opens one release and ticks or unticks a step, over and over. The database holds 1,000 releases. The app runs in Docker limited to **1 CPU and 512 MB**, and a request counts as **dropped** if it gets no answer within 10 seconds.

| Simultaneous users | First version: req/s | p95 | dropped | Optimized: req/s | p95 | dropped |
|---:|---:|---:|---:|---:|---:|---:|
| 25 | 96 | 0.4 s | 0% | 805 | 0.08 s | 0% |
| 100 | 97 | 1.6 s | 0% | 734 | 0.2 s | 0% |
| 200 | 94 | 10 s | **5.5%** | 721 | 0.36 s | 0% |
| 400 | 97 | 10 s | **25.5%** | 700 | 0.65 s | 0% |
| 800 | 104 | 10 s | **48.6%** | 687 | 2.3 s | 0.7% |
| 1,600 | | | | 689 | 3.0 s | 1.1% |

- **First version:** stuck at about 96 requests per second. Requests start being dropped at **200 users**, and half are dropped at 800.
- **Optimized:** about 720 requests per second, **7.5 times more**. No dropped requests up to **400 users**, and p95 stays under 1 second up to 400.

What made the difference:

1. **Pagination.** The first version sent all 1,000 releases (164 KB) on every list call, and the server built every one of them through GraphQL. Now a page is 20 releases.
2. **An index on the date** that the list is sorted by, so a page is read straight from the index.
3. **One-statement step updates,** which also fixed the lost-update bug above.

The next limit is the app's own CPU: during the test the app uses its full CPU while the database sits at about 25%. The server keeps no state, so the next step is running more copies of it behind a load balancer.

Run it yourself:

```bash
docker compose up -d --build
npm run loadtest:seed -- --count 1000
npm run loadtest -- --levels 25,100,200,400,800 --label optimized
```

The first version is the git tag `v1-baseline`; the `baseline` branch is that code plus these load test scripts.

## Deploy

`render.yaml` describes one free Render web service built from the `Dockerfile`. The database is a free PostgreSQL on [Neon](https://neon.tech). Create a Neon project, copy its connection string, then in Render choose **New, Blueprint**, pick this repository and paste the connection string as `DATABASE_URL`.

The free Render service sleeps after 15 minutes without traffic and takes about a minute to wake up.
