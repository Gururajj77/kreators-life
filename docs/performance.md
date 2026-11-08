# App performance

Written 2026-11-01. The owner's 31-point checklist, one row each, with what was found, what changed and how to check it. The server
and database half is written here. The front-end half is in the Web items section below.

Status words: **DONE** (already right, evidence given), **FIXED** (a defect found and changed in this pass), **N/A** (does not apply to Workers
and D1, reason given), **OPEN** (accepted, or still to do, with who and what).

"Checked" for the server half means `pnpm typecheck`, `pnpm --filter @kreators/shared test`, `wrangler deploy --dry-run` (the Worker bundles),
`EXPLAIN QUERY PLAN` on a SQLite database built from all 60 migrations, and small Node checks of the new pure code. **No server was run for this
pass** (port 8788 belonged to another agent), so no route was exercised end to end and the smoke test (`bash scripts/smoke/blueprint.sh`) still
needs a run. See "Still to run".

## Budgets

| What | Budget | Why |
|---|---|---|
| LCP (largest contentful paint) | 2.5 s at the 75th percentile | Google's "good" line |
| INP (interaction to next paint) | 200 ms at the 75th percentile | same |
| CLS (layout shift) | 0.1 at the 75th percentile | same |
| TTFB (first byte) | 0.8 s at the 75th percentile | same; most of it is the Worker plus D1 round trips |
| API read | most under 300 ms; any plain read over 1.5 s is logged as a warning (`SLOW_READ_MS` in logs.ts) | a screen makes several |
| D1 round trips per invocation | under 50, the Free plan's limit; the suite fails past 45 (see The Free plan). As few as the dependency allows: independent reads together (`Promise.all`), many writes in one `db.batch` | each trip is a network hop to the one database |
| Initial JavaScript (web) | entry 480 kB raw, first download 1,500 kB raw, any other chunk 400 kB (`pnpm perf:budget`); the hope is 200 kB gzip for the first download, now 421 kB | `scripts/perf-budget.mjs`, see the Web items section |
| Worker bundle | 2.6 MB raw, 545 KiB gzip today (the Anthropic SDK is 1.07 MB of it, now loaded on first use); keep under 3 MB raw | cold start parses the whole file |

## The 31 items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Skeletons instead of "Loading" | DONE (web) | Web items, row 1 |
| 2 | Image formats and sizes | DONE (web) | Web items, row 2; the server takes JPEG, PNG, WebP, AVIF, GIF up to 1 MB (`routes/media.ts`) |
| 3 | Duplicate requests | DONE (web) | Web items, row 3 |
| 4 | Debounced inputs | DONE (web) | Web items, row 4 |
| 5 | Pagination | DONE, FIXED (caps), OPEN (three lists) | Every list a person scrolls goes through `pageOf` and `paged` (PAGE_SIZES 10 to 100, one extra row fetched). Found five staff lists with no limit and gave them a safety cap with the same response shape: reward review queue and a reward's entrants (500, `routes/win.ts`), open help requests (500, `support.ts`), applications to an opportunity (500, `work.ts`), a host's guest list (1,000, `party.ts`). Also fixed `metricsFor` in win.ts, which put every id in one `IN (...)` and would fail past 100 bound values; it now chunks by 80 in one batch. OPEN, need a `Pager` on the screen as well: the review queue and entrants, `GET /nodes` (one person's whole pyramid, bounded by their own data), and Dev Tools' user list (`routes/internal.ts` reads every user to count access; staff only). |
| 6 | CDN for static files | DONE | `wrangler.jsonc`: `assets` serves `apps/web/dist` and `run_worker_first` lists only `/`, `/api/*`, `/go/*`, `/out/*`, `/__scheduled`, `/sitemap.xml`, so every script, style, font and picture is answered from Cloudflare's edge without starting the Worker. |
| 7 | Background work | DONE, OPEN (two helpers) | `waitUntil` carries the request log (`logs.ts`), the /go and /out click writes and the webhook processing (`routes/go.ts`), and the Workers cache write (`cachecontrol.ts`); the cron runs every 15 minutes and every 2 hours (`wrangler.jsonc`). OPEN: `track()` (14 call sites) and `sendEmail()` (8) are awaited inline; both live in `ops.ts`. Wrapping them in `ctx.waitUntil` at the call site takes a person's tap off the analytics insert and the mail provider call. |
| 8 | N+1 queries | FIXED | See "Query count changes" below. Loops that did one query per row are now one batch: subtask counts (`withSubtasks`), pictures for cards (`mediaForListings`), the pieces of a kit (`kitItems`), reward metrics (`metricsFor`), the data export (`/me/export`), and every fan-out notice (`notifyMany` in db.ts: community mentions and thread followers, circle tables, run and event cancellations, reward edits, campaign status, photo folder, coach asks to admins). |
| 9 | Compression | N/A (platform) | Cloudflare compresses text responses (Brotli, then gzip) at the edge for both static files and Worker answers; there is no compression code to write or to double up. Check with `curl -sI -H 'accept-encoding: br' https://kreators.app/api/public/explore` and read `content-encoding`. |
| 10 | HTTP caching headers | FIXED (API), OPEN (hashed files) | New `apps/api/src/cachecontrol.ts`, `cache('public' \| 'immutable' \| 'none')`. Applied: Explore (all of `/api/public/explore`, the same for everyone, no viewer is read) is `public, max-age=60, s-maxage=300, stale-while-revalidate=600`; `GET /api/public/media/:id` is `public, max-age=31536000, immutable` (a picture's bytes are written once under a random id and no code updates them: `media_files` has only INSERT and DELETE) and an error is never kept. The sitemap already sent `max-age=3600`. OPEN: static files get Cloudflare's default (`max-age=0, must-revalidate` with an ETag); fingerprinted files under `/assets/*` can be `immutable` through `apps/web/public/_headers`, which is the front end's file. `private, no-store` for the personal API is the `none` kind: one middleware line in index.ts (below). |
| 11 | Unused dependencies | DONE | API: `hono`, `@anthropic-ai/sdk` and the shared package are all imported; nothing else is declared. Web: Web items, row 11. |
| 12 | Timeouts on outside calls | FIXED, OPEN (three files) | New `apps/api/src/http.ts`: `fetchT(url, init, ms)` (keeps a caller's own signal), `withTimeout(promise, ms)` for calls that take no signal, `isTimeout`, and the named clocks in `TIMEOUT`: quick 5 s, payments 15 s, research 15 s, assistant 60 s, strategist 90 s. Routed through it: Razorpay order and refund (`payments.ts`, never repeated; the refund message says to check the dashboard before trying again), YouTube view counts (`social.ts`), Meta private reply (`routes/growth.ts`, never repeated), the assistant's model call (`assistant/model.ts`: a timeout, including a model that sends headers and stalls, is a `ModelError`, so the route answers its normal "could not answer" and not a 500), the writer for the content strategist (`strategist.ts`: the SDK's own `timeout`, a race on `finalMessage()`, and a race on Workers AI; a clock that runs out falls back to the digest for Workers AI and answers 502 with a plain line for Claude, as any writer failure did). Retry behaviour is unchanged. OPEN, owned elsewhere: Resend in `ops.ts` (`fetchT(..., TIMEOUT.quick)`, no retry), and the six calls in `reach.ts` (bridge and pages `TIMEOUT.research`; the four YouTube calls `TIMEOUT.quick`). `safeurl.ts` already limits its hops. |
| 13 | Stream AI answers | OPEN (accepted) | The assistant runs a tool loop (look up, change, Undo receipts) and answers once it is done, so there is no half answer to stream; the panel shows a working state and a Stop (`assistant_runs`). The strategist uses the SDK's stream internally but returns the finished piece. Streaming would need a server-sent-events route and a client reader. |
| 14 | Optimistic updates | N/A (web) | Web items, row 14 |
| 15 | Lazy-load below the fold | DONE (web) | Web items, row 15 |
| 16 | Parallel independent work | FIXED | See "Query count changes". Daily, the Home brief, a task and the task list, tick, the inbox, the Community feed, Profile (`/me`), the leaderboard, a public page, a reward's page, the Explore listing, badges. |
| 17 | Database indexes | FIXED | Migration `0060_performance_indexes.sql`: 22 new indexes on existing tables, 2 on the new `web_vitals` table, and 3 old ones dropped (each is the front of a new one). Every one has the query it serves in a comment, and `EXPLAIN QUERY PLAN` was run before and after on a database built from migrations 0001 to 0060. The ones that mattered most: `organization_members(user_id, status)` (read on **every** gated request, was a table scan), `follows(owner_id, follower_id)` (the follower count on every feed post was a table scan), a partial `notifications(user_id, kind) WHERE read_at IS NULL` (the unread count on every app load), `nodes(user_id, kind, status, completed_at)` (done-task windows; also makes the leaderboard's per-person counts index-only), `xp_events` and `points_ledger` by user and time or reason, the partial `users(xp DESC, created_at) WHERE leaderboard_opt_in = 1 AND onboarded_at IS NOT NULL` (the leaderboard pool, no sort), and the retention sweeps (`link_clicks`, `email_outbox` by `created_at`). OPEN for the cron's owner: `clearPastWaterNotes` filters `n.id LIKE 'water-%'`, which cannot use the primary key (SQLite's LIKE is case-insensitive); `n.id >= 'water-' AND n.id < 'water.'` does, and was checked with `EXPLAIN QUERY PLAN` (scan to search). |
| 18 | Tracing and measurement | DONE, FIXED | Every API answer has `X-Request-Id`, and the same id is in the log line and the body of a server error (`index.ts`). `app_logs` records `ms` for every change, refusal and failure (`logs.ts`, `writeLog`). A plain read that worked was not logged at all, so a slow screen left no trace: now a read over `SLOW_READ_MS` (1.5 s) is logged as a warning "slow read" with its time. `wrangler.jsonc` has `observability.enabled`. Real-user numbers are item 30. |
| 19 | Region and placement | OPEN (needs wrangler.jsonc) | Every handler makes several round trips to one D1 primary. Smart Placement runs the Worker near that database instead of near the visitor, which usually wins for chatty handlers; add `"placement": { "mode": "smart" }` (exact JSON below). The database's own location is fixed when it is created (`wrangler d1 create kreators-life --location=apac` for an audience in India); the current one cannot be moved, only recreated and refilled. |
| 20 | Server rendering | OPEN (accepted, web) | Web items, row 20 |
| 21 | Third-party scripts and fonts | DONE (web) | Web items, row 21 |
| 22 | Code splitting | DONE (web); FIXED (Worker) | Web items, row 22. Worker: `@anthropic-ai/sdk` is 1,074 kB of the 2,640 kB bundle and was evaluated on every cold start though only the content strategist uses it; `strategist.ts` now imports it on first use (`await import(...)`), and `wrangler deploy --dry-run` shows its module wrapped as a lazy init. |
| 23 | Virtualised lists | N/A (web) | Web items, row 23; every list is paged |
| 24 | Select only what is needed | FIXED, DONE | The seven Explore queries (`routes/explore.ts`) read `b.*`, `o.*`, `e.*`, `p.*`, `c.*` and `SELECT * FROM tools` and now name the columns the card uses (a public, cached, 200-row-per-kind path); the Agency agreements list and board no longer read each agreement's whole document, answers and acceptance (`CONTRACT_LIST_SELECT` in `agencyDocs.ts`). The data export already leaves out `media_files.data`, sessions and password rows. **Secrets never leave the server:** `password_hash`, `password_salt` and `pan_hash` appear only in `auth.ts`, `me.ts` (change password), `kyc.ts` and `account.ts`; every row returned to a browser goes through a whitelist mapper (`toUser`, `toAdminUser`, `toKyc`, `publicOf`, `toNode` and the like), none spreads a raw row; `token_hash` lives only in `password_resets` and is read only by `auth.ts`. The remaining `SELECT *` are lists whose mapper sends nearly every column (nodes, journal, notifications, brand pieces and runs), so narrowing them gains nothing. |
| 25 | Connection pooling | N/A | D1 is reached through a binding, not a connection; there is no pool to size. |
| 26 | Needless re-renders | FIXED (web) | Web items, row 26 |
| 27 | Server-side caching | FIXED, N/A (Redis) | No Redis on Workers. Two caches, both safe: the Workers cache holds the anonymous Explore answers for 60 s per data centre (`cache('public', { edgeSeconds: 60 })`; skipped for any request with `Authorization` or a cookie, only 200 answers to GET); and `loadAccessContext` in `access.ts` keeps the module flags and overrides for 5 s (`ACCESS_TTL_MS`) in the instance, because the module gate read them on every gated request. An admin change drops the copy at once on the instance that saved it (`forgetAccessContext` in `routes/admin.ts`) and is seen within 5 s on any other. Nothing that differs by viewer is cached. |
| 28 | Load balancing | N/A | Cloudflare routes and scales Workers; there is no server fleet. |
| 29 | (not named in the brief the agents were given) | OPEN | Ask the owner which item this is. |
| 30 | Real-user vitals | DONE (server and web), OPEN (three lines) | Web sends `{ route, lcp, inp, cls, ttfb, device, conn }` once when the page is hidden (`apps/web/src/lib/vitals.ts`). Server: `routes/vitals.ts`, `POST /api/public/vitals`, stored in `web_vitals` (migration 0060). Kept: a route pattern with ids removed, phone or desktop, a connection label of at most 12 characters, whole milliseconds (CLS in thousandths); a metric of 0 (the web sends 0 for "did not happen") is stored as NULL, CLS 0 is kept; a note with no timing at all is dropped with a 204. Not kept and not a column: user id, IP address, user agent, cookie. Limit `vitals` (60 per address per hour, `limits.ts`). The request log skips this route so a page view does not write two rows. `vitalsSummary(db, days)` returns the 75th percentile per route and device with a good, needs work or poor rating; `pruneVitals(db)` deletes rows older than 90 days. OPEN, the lead's files: mount the route, call the summary from an `/api/internal` route, call the prune from the cron (lines below). |
| 31 | Budgets and a slow-device test | DONE (web); DONE (server budgets) | Web items, row 31 for the bundle budget and the slow-phone probe; the server budgets are in the table at the top. |

## Query count changes

"Hops" is the longest chain of D1 calls that wait on each other, which is what a person feels; "queries" is the total sent.

| Route or helper | Before | After | How |
|---|---|---|---|
| Every gated request (module gate, `resolveAccess`) | 3 queries (org members, module settings, flag overrides) | 1 query (org members); the other two come from a 5 s copy | `access.ts`; org members now has an index (it was a scan) |
| `GET /today` (Daily) | 14 hops, 14 queries (16 with the nudge) | 3 hops, 12 queries | One `Promise.all` of 10 reads, then one subtask count for all three task lists (was three) |
| `GET /home/brief` | 4 hops | 2 hops | Discover settings and profile join the first group; extras need the settings, so they follow |
| `GET /me` | 3 hops | 1 hop | Answered pillars and granted badges join the group |
| `GET /nodes`, `GET /nodes/:id` | 3 hops | 2 hops | Tick gate with the rows; subtask counts after |
| `POST /nodes/:id/complete` (a tick) | 5 hops | 3 hops | Gate, today's paid count and the badges before the tick together |
| `badgesNow` | 3 hops | 2 hops | stats and granted badges together |
| `GET /inbox` | 2 hops | 1 hop | page and unread counts together; the unread count now uses a partial index |
| `GET /community` (feed) | 2 hops | 1 hop | muted flag with the page; follower counts per post now use an index |
| `GET /leaderboard` | 2 hops | 1 hop | closed seasons with the board; the board reads its pool from a partial index and counts done tasks from an index |
| Public page (`/public/:handle`) | 7 hops | 2 hops | view count write, posts, stats, honors, friendship, trust and badges together |
| `GET /public/explore`, `GET /admin/listings` (`listingsFor`) | up to 8 hops (seven kinds one after another, then pictures) | 2 hops, and cached for anonymous readers | the seven kinds together, the same order of results |
| `withSubtasks`, `mediaForListings`, `metricsFor` | one hop per 80 ids | 1 hop | one `db.batch` of the chunks |
| A kit's pieces (`kitItems`) | one query per piece, per kit, in parallel across kits | one batch per kit | up to `MAX_KIT_ITEMS` fewer subrequests per kit; Workers count each query against the subrequest limit |
| `GET /win/:id` | 5 hops | 3 hops | own entry, all entries (staff) and the board together; both metric reads together |
| `GET /me/export` | about 55 hops | 2 hops | the tables in batches of 30 |
| A notice to N people (`notifyMany`) | N hops | ceil(N / 50) hops | a batch of inserts, the same rows; 12 call sites |

## Rows a quiet tick reads (2026-11-07)

Measured on seeded data with SQLite's scan statistics, not D1's meter. At 1,000 people a quiet cron tick visits 9,183 rows, down from 18,189 (migration 0114: `rate_limits` by window, deleted users by a partial index, plus the Agency scans). 100 agencies with 1,000 clients and 30,000 pieces: 12,683 rows a tick, down from about 290,000. The life dashboard's stillness read: 896 rows for someone with four focus rounds a day for 300 days, down from 438,000. `localNow` in cron.ts keeps one formatter per zone: about 3 ms of JS a tick at 1,000 people on a Mac. One account delete visits 65,031 rows, down from 95,031; `app_logs` (40,001) stays unindexed on purpose, since every logged change would pay a row written for it, and `rate_limits` matches the end of a key, which no index serves.

## The Free plan (the founder, 2026-11-07)

The app stays on Workers Free. These are Cloudflare's limits as its own pages said on 2026-11-07, and what the app does about each.

| Limit on Free | What it means here | What the app does |
|---|---|---|
| 50 D1 queries per invocation (a `db.batch()` is one) | the 51st fails with "Too many API requests by single Worker invocation" | stays under 50; the suite fails past 45 |
| 50 subrequests per invocation; another page says 1,000 to Cloudflare's own services | only the live platform can settle it, so it is built to the stricter one | a cron tick counts its calls out against the same budget; see "Settle it" below |
| 10 ms of CPU per invocation, with some flexibility | requests and cron alike | see the CPU table; PBKDF2 at 100,000 is the known exception and stays |
| 100,000 requests a day | each API call and each cron run; static files do not count | see the daily table |
| 5 million rows read, 100,000 rows written a day (enforced since 1 September 2026) | past either, every D1 query fails until midnight UTC, 05:30 IST | see the daily table |

### The rule and the guard

An invocation stays under 50 D1 round trips. `D1_GUARD` (`apps/api/src/d1Guard.ts`) is one Worker variable, set by `scripts/smoke/blueprint.sh` and the test server's script and never in production, where `fetch` only looks at that one property. With it set, every answer carries `X-D1-Round-Trips`, `X-D1-Rows-Read` and `X-D1-Rows-Written` (D1's own `meta`), and `X-D1-Last-Tick` holds the last cron run's numbers. `scripts/smoke/smoke.mjs` keeps the highest per route, prints the top twenty, and fails a check when anything passes 45.

### Round trips, before and after

The highest each route or tick reached over the whole smoke suite (2,459 checks, 651 routes), on the test server's real local D1. "Before" is the code as the review left it.

| Route | Before | After |
|---|---|---|
| cron tick | 79 | 25 |
| `GET /coach/students/:id/patterns` | 59 | 13 |
| `PUT /reviews` | 51 | 14 |
| `POST /assistant` | 50 | 27 |
| `GET /coach/students/:id/report` | 50 | 10 |
| `GET /reviews` | 49 | 10 |
| `GET /reviews/summary` | 42 | 6 |
| `GET /insights/dashboard` | 41 | 9 |
| `POST /agency/retainers/:id/confirm` | 39 | 36 |
| `GET /home` | 36 | 2 |
| `POST /companion` | 34 | 16 |
| `POST /nodes/:id/complete` | 29 | 24 |
| `POST /assistant/actions/:id/confirm` | 28 | 13 |
| `GET /coach/students/:id` | 26 | 13 |
| `POST /store/:id/checkout` | 25 | 22 |
| `GET /today` | 24 | 5 |
| `POST /run/runs/:id/entry` | 23 | 18 |
| `DELETE /me` | 22 | 21 |
| `POST /party/events/:id/claim` | 21 | 16 |
| `GET /public/agency/:id` | 21 | 9 |

The highest now is 36, a retainer confirmed with two months due. The suite does not reach these, so they were run on the stand-in binding (`scripts/smoke/d1-shim.mjs`, held to 50): a coach with 100 students, `GET /coach?size=100` 10 trips and taking the coach's permission away 17 (it was about 400, one link at a time); a cancel for 600 guests 41 trips, 408 told at once and the rest over the next ticks; a host with 30 events of 30 guests deleted in one tap, the seats finished by the cron; `GET /me/export` 9 trips on a heavy account.

How it got there: `batchedReads` (`apps/api/src/d1Batch.ts`) wraps the binding once per invocation in index.ts and sends every read made in one turn of the event loop as one `db.batch`. A route still writes `await db.prepare(...).first()`, and `Promise.all` of reads is one trip. Only a SELECT waits. A write goes at once, after sending what was gathered, so nothing changes order. A batch is a transaction, so when one fails each read is sent again alone, and only the read at fault fails its caller. The answers are the same: the Reviews, Coaching report, Emerging and period sections of the suite and the golden tests ran before and after. A rate limit is now one statement (`RETURNING count`).

What can still grow with a list checks `tripsOf(db)` against `ROUTE_TRIPS` (40) and stops while it can answer. The assistant's message and the Companion's run tools only while a read's 8 or a write's 16 trips are left, and then say "go on". A note to many people (`notifyMany`) is N / 50 trips, so about 2,000 people on one note would pass the ceiling; nothing sends that many today (a run club's members, a reward's entrants).

### The cron

A tick cannot do unbounded work on this plan. `apps/api/src/cronTick.ts` holds it to `TICK_TRIPS` (38) round trips and calls out, and `TICK_STATEMENTS` (400) statements. How jobs share them:

- Every job first reads what it has to do, all together, usually one trip. A job with nothing to do takes no part.
- The rest go one at a time: the security alerts first, the others in an order that moves on by one each tick, worked out from the clock, so nothing is stored.
- Each gets an equal part of what is left, and what it does not use passes to the jobs after it. A job that cannot do one piece of work with less (an Agency month is about 16 trips) gets that much while it is left.
- A job's read leaves out what was already sent, and someone who needs no note (a day already focused, Fitness off) never takes a place, so the budget goes on people still waiting.
- What needs only an hour's accuracy runs on the first tick of the hour: the tidy-up, past supplement notes, the season, sequences, monthly entries, a retainer's months, stages, the next weekly circle, discount uses. So a quiet tick is 3 trips, and the first of an hour 4.
- A tick that had to leave work writes `cron_state`. While that row is there, a reminder's hour reaches back to when the ticks fell behind, so what was left is still caught, and note ids and `last_sent_day` keep each one once.
- A claim and its work are one batch, so a stop can never lose them: a season's close (claim, top three, honors and notes), a month's entry (`UPDATE ... WHERE next_date = ?`, then `INSERT ... WHERE changes() = 1`), an event's reminder, a sequence's message, one circle's tables and seats.

`node --experimental-strip-types scripts/smoke/cron-stress.mjs` runs all this with no server, every migration on a scratch file and a thousand people:

| Case | Result |
|---|---|
| 100 reminders of each of nine kinds due at once | 4 ticks, the most 18 trips and 493 statements; every person once; the month's 100 entries on the next hour's tick |
| 900 of each | 31 ticks, the most 21 trips; every person once; the window grew and went back to an hour |
| A tick stopped dead after N trips, N from 1 to 40, then ordinary ticks | all 30 of each kind told once, all 30 monthly entries, the season closed with its top three, honors and notes, in all 40 |
| A quiet tick | 3 trips, 16 statements; a first tick of the hour 4 trips, 48 statements |

A reminder that cannot be reached by the person's own midnight is lost with that day: at 400 statements a tick that takes about 1,600 statements due at once, every hour, for several hours. It would need thousands of reminders in one hour.

### Rows a quiet tick reads

The window on the reminders (`indiaTimes`: in India only the times that can be due now; anyone abroad every tick) and the partial indexes of migration 0116 take a quiet tick at 1,000 seeded people from 7,169 rows to about 400, plus 2.5 rows for each Remember task on a day near now (2,895 in that seed, where all 1,000 have one today). The tidy-up moved to once an hour. So the cron reads about 40,000 to 280,000 rows a day at 1,000 accounts, 1% to 6% of the limit, and it was 688,000, 14%. Without a YouTube key the two metric reads are not made at all.

### CPU

JavaScript time on this Mac, cpu time less time inside SQLite, with a heavy person (25 ticks a day for 84 days, every tracker daily, 2,907 nodes). **A Mac is not a Worker**, and Cloudflare's meter is not this one, so read these as a comparison. The first request in a process costs 20 to 25 ms here whatever it is (V8 compiling), and a Worker's cold start is similar work.

| Route | Warm JS, ms |
|---|---|
| `GET /home` | 0.5 |
| `GET /today` | 0.9 |
| `GET /reviews` | 0.4 |
| `GET /insights/dashboard`, a week / a year | 0.6 / 3.6 |
| `GET /coach/students/:id/report` | 1.7 |
| **`GET /insights`** | **6.3** (10.8 before the offset cache) |
| **`GET /coach/students/:id/patterns`** | **6.7** (10.7 before) |
| **`GET /me/export`** (2.2 MB of JSON) | **8.3** |
| `GET /me/activity` | 4.3 |
| Quiet tick at 1,000 people, warm / cold | 0.4 / 7.6 |
| A tick with 500 statements, warm / cold | 4 / 18 |

The three in bold stay over about 5 ms on this heaviest account; an ordinary account is about a fifth of it. The export is rare and said to take a moment; a very large one may need asking twice. `POST /auth/signin` and sign-up (PBKDF2 at 100,000 rounds) are the known exception, by design. What changed: `zoneOffsetMinutes` keeps each zone's offset per UTC day, unless the clocks change that day (checked against the exact answer at 408,785 instants across all 418 zones, 0 different, and the shared tests); before 1973 it stays exact. `dayInZone`, `localDay`, `clockIn` and `slotsFor` keep one formatter per zone. `zonedToUtc` and `localStamp` go through `zoneOffsetMinutes`.

### The daily limits

Real D1 meters, from `scripts/smoke/drive-day.mjs`: a real browser opens Home twice, Daily three times, Pillars, Journal and Mood, each from cold; then a check-in, four ticks, a new task, a journal line, mood, sleep and three glasses of water. A tick also refetches what Daily shows, which that drive does not count, so add about 1,300 rows a tick on a screen that is open.

| One person's ordinary day | Requests | Rows read | Rows written |
|---|---|---|---|
| A new account, before | 94 | 11,022 | 159 |
| A new account, after | 95 | 8,045 | 164 |
| A new account, starting blocks from code (2026-11-07) | 95 | 3,885 | 164 |
| Three months of use (5 ticks a day, trackers daily, 467 nodes), before | 72 | 71,397 | 67* |
| Three months of use, after | 95 | 37,866 | 100* |
| Three months of use, same account again, blocks as rows (2026-11-07) | 91 | 36,203 | 69 |
| Three months of use, same account, never changed a block (2026-11-07) | 91 | 32,057 | 69 |

\* Corrected 2026-11-07: the first run read 28,314 rows, on a test account whose tasks named pillars that do not exist, so Daily crashed after its first four requests and most of its reads were never made. These are from a Daily that draws. The drive does not count what a screen reads again after a tick, about 1,400 rows on this account (Daily's own reads without Emerging, worked out from its requests, not measured through a tick), so four ticks make about 43,500 rows a day.

| People a day before each limit | New accounts | Three months of use, a block changed | Three months of use, no block changed |
|---|---|---|---|
| 100,000 requests | about 1,050 | about 1,050 | about 1,050 |
| 5 million rows read | about 1,280 (610 when the starting blocks were rows) | **about 115**, 119 with the 2026-11-07 run and 138 before what a tick reads again (70 before this work, on the same crashing account, so not like for like) | **about 135**: 155 before what a tick reads again |
| 100,000 rows written | about 600 | about 600 (1,000 by the drive, which ticked fewer tasks) | the same |

**Rows read come first, at about 115 active people a day once accounts have three months in them and have changed a block, and about 135 if they never did**, before the cron's share. A new account costs 307 rows written, so about 325 sign-ups in a day would use every write, and writes are what a launch day hits first. A person's day writes: each tick about 33 rows (the node, xp, scores, points, notes, a log line of 4 rows), each limited request 1 to 3.

What moved it, each without changing an answer or a promise:

- `/me` read every count behind the badges, 2,900 rows at three months, after every write. The counts now stay on the person's row for an hour (`keptStats`): 24 rows. A tick moves them by what it changed, so it no longer reads them twice (about 5,000 rows less a tick). The gallery and unlocks read fresh. A badge from anything but a tick can show up to an hour late on Profile.
- `/me` walked every task for Pillars' counts: Pillars now asks (`GET /me/pillar-tasks`).
- `GET /reviews/summary`, on Home and six other screens: the overdue count walks only what can be overdue, the kinds of day read their templates once and no slots, and tasks brought to a review have a partial index: 3,795 to about 1,100 rows.
- `idx_wb_user_date`: a range of days walked every log the person had. `taskGate` read every done task to answer "under the free few?" and "when was the last?"; both now stop early. `completed_at LIKE` and `date LIKE` became ranges.
- Emerging waits fifteen minutes after a read before reading again, however many writes marked it stale.
- The Leaderboard's overview and filter counts visited about 47,000 rows an open at 1,000 opted-in people. They come from `board_cache` now, three hours old at most, from one pass of about eight rows a person; who shows is read fresh. The two sorts that walk everyone's tasks are kept six hours. The xp and streak boards read badge counts only for who is on the page. Log filters list the last day, not the last week.

Left on purpose: `app_logs` keeps its three indexes (each line is 4 rows written). Dropping them would make one filter on Logs read the whole table, which costs more than it saves.

### The starting blocks live in code (2026-11-07, the founder's yes)

A new account used to write 769 of its 1,076 rows on its first open of Daily: 14 blocks, 14 templates and 124 slots, about five rows each once the indexes count. Now it writes none of them until it changes a block or a template. A task, a date and a weekday hold only an id, and the ids are the same in code and in rows (`b-<seed>-<user>`, `t-<seed>-<user>`), so none of those needs the rows. Who has rows is `users.time_blocks_seeded_at`, read beside whatever it decides.

| | Before | After |
|---|---|---|
| Rows written, one sign-up | 1,076 | 307 |
| Sign-ups a day before the writes run out | 92 | 325 |
| First open of Daily | 712 rows read, 769 written | 235 read, 0 written |
| Each read of a person's blocks | 317 rows | none with no rows; one more row with rows |
| A new account's ordinary day | 8,159 rows read | 3,885 |
| The first change, once | | about 780 rows written, 7 or 8 trips (777 to 835 measured, the top when the change itself adds slots) |

The 325 assumes nobody changes a block on their first day. Every person who does adds that one 780 back, so a launch where everyone did would be back near 90. Picking a kind of day, a weekly pattern or a block for a task writes only its own row.

Two tabs: the batch that writes the rows first claims the account with a stamp no other batch holds, and each insert runs only under that claim. A tab that read the account before another tab's first change adds nothing, so a template deleted in between stays deleted (the suite's section "Starting blocks from code" runs first changes at once). Every answer was compared byte for byte: 120 answers over 20 read routes before and after the change, at six stages of one account, and 21 routes on one account with no rows and then with rows.

### When a limit is hit

Past a D1 daily limit, every query fails until 05:30 IST. Checked with a binding that refuses everything: every API route answers 500 with the plain line and a request id (`{"error":"something broke on our side","requestId":...}`), `/go/:code` and the sitemap answer a plain 500, and nothing signs anyone out, since only a 401 does. The screens show their ordinary error line. The public pages, the app shell and `GET /api/health` still load, since they need no database. A cron tick fails as a whole and tries again in fifteen minutes. Past 100,000 requests, Cloudflare itself answers `/api/*` (error 1027); the static site still loads, and the client shows its fallback line, "That did not work. Check your connection and try again." No new screen was built for any of this.

### Settle it, once, on the live site

Cloudflare's pages disagree on 50 and 1,000. Signed in as a super admin on the live site, in the browser console:

```js
fetch('/api/internal/platform-limit', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage['kreators.session']).state.token } }).then((r) => r.json()).then(console.log)
```

It asks `SELECT 1` until it is refused, so it changes nothing and reads no rows, and it answers how many queries that invocation made. Run it once and write the number here. Whatever it says, the app stays built to 50.

### How to measure

- `bash scripts/smoke/blueprint.sh`: the top twenty and the ceiling, at the end. `SMOKE_D1_REPORT=<file>` keeps every route.
- `node --experimental-strip-types scripts/smoke/cron-stress.mjs`: the cron at a thousand people. No server.
- `node --experimental-strip-types scripts/smoke/drive-day.mjs`: one person's day and how many people fit. `DRIVE_DAY_TOKEN=<token>` for an account with months of data, `DRIVE_DAY_ROWS=1` for each request.
- The Cloudflare dashboard, D1, the database, Metrics: the real rows a day. Look before the app has 150 active people a day.

## Maintenance rhythm

- **Every release:** `pnpm typecheck`, shared tests, `pnpm build && pnpm perf:budget`, `bash scripts/smoke/blueprint.sh`. After touching a query, run
  `EXPLAIN QUERY PLAN` on it (recipe below) and check there is no `SCAN` of a table that grows.
- **Weekly:** open Dev Tools, Real-user vitals (once mounted) and read the 75th percentile per route against the budgets. Read Logs for
  "slow read" warnings and note the routes that repeat. Check `wrangler tail` or the Workers dashboard for CPU time and errors.
- **Monthly:** `SELECT COUNT(*)` on the fast-growing tables (`link_clicks`, `xp_events`, `points_ledger`, `app_logs`, `web_vitals`, `notifications`)
  against the retention in the cron; look at the Worker bundle size (`wrangler deploy --dry-run`) and the web budget.
- **When a table passes about 1 million rows:** re-run the plan check on its queries and think about the sweep; D1 charges for rows read, so a scan is money as well as time.
- **Retention:** `web_vitals` 90 days (`pruneVitals`), `app_logs` 30 days, `link_clicks` and `email_outbox` per `RETENTION_DAYS` in shared.

## How to measure

- **A query plan (no server needed):**
  `rm -f /tmp/p.db; for f in apps/api/migrations/00*.sql; do sqlite3 /tmp/p.db < $f; done; sqlite3 /tmp/p.db "EXPLAIN QUERY PLAN SELECT ..."`.
  `SCAN t` on a table that grows is the thing to remove; `SEARCH t USING INDEX` is right; `COVERING INDEX` is best.
- **The Worker's size and what is in it:** `pnpm --filter @kreators/api exec wrangler deploy --dry-run --outdir <dir>` prints the upload size; the
  bundle is `<dir>/index.js`.
- **A slow route:** Logs (from Dev Tools) for "slow read" and the `ms` of any change; `pnpm cf:logs` for the live tail; `X-Request-Id` ties a browser
  report to a log line.
- **Real users:** the Real-user vitals table (item 30), 75th percentile per route and device, against the budgets at the top.
- **The web bundle and a slow phone:** `pnpm perf:budget`, `SHOOT_TOKEN=<token> node scripts/smoke/perf-probe.mjs` (the Web items section).
- **Compression and cache headers in production:** `curl -sI -H 'accept-encoding: br' https://kreators.app/api/public/explore` and a picture URL.

## Wired in

The vitals route, its 90-day prune and the staff summary (`GET /api/internal/vitals`), the note sweep range (now only supplement lines, since water notes went on 2026-11-07), the timeouts on Resend and the research reads, and Smart Placement are all in place (see `apps/api/src/index.ts`, `routes/internal.ts`, `ops.ts`, `reach.ts`, `wrangler.jsonc`).

## Web items

Written 2026-11-01. This covers the front end (apps/web). The server half lives in docs/performance.md when it exists.
Status words: DONE (built and checked here), FIXED (a defect found and changed), N/A (does not apply), OPEN (accepted or still to do).
"Checked here" means typecheck, build, the scan and the size budget. No browser or server was run for this pass, so every
behaviour check is listed at the end under "Still to run".

### Sizes

| | Before | After |
|---|---|---|
| Entry script (`index-*.js`) | 2,488 kB raw, 703 kB gzip | 417 kB raw, 119 kB gzip |
| First download (entry plus the five files it preloads) | 2,488 kB raw, 703 kB gzip | 1,303 kB raw, 421 kB gzip |
| All scripts (kept for offline by the service worker) | 2,601 kB raw | 2,652 kB raw in 100 files |

The first download is 48 percent smaller raw and 40 percent smaller gzip. It is still above the 200 kB gzip hope:
React with the router (102 kB gzip), the shared model (116 kB gzip), the entry (119 kB gzip), motion (45 kB) and
gsap (29 kB) are all needed to paint the first screen. See item 22 for what would take it lower.

### The 15 items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Skeletons instead of bare "Loading" | DONE | `components/Skeleton.tsx` (`Skeleton`, `SkeletonCard`, `SkeletonList`, `Busy`): `aria-hidden` blocks, `role="status"` and `aria-busy` on the wrapper, pulse off under reduced motion, theme tokens only. Used on Home, Daily, Journal (list and day sheet), Community, Store and Inbox where the screen showed a "Loading" line or nothing. Pillars and Profile draw from the account the app shell already waits for, so they have nothing to wait on. `RouteFallback` keeps the page frame while a screen downloads. |
| 2 | Image formats and sizes | DONE | `lib/shrink.ts` saves WebP at quality 0.82 and steps down, as before, but now checks the browser really made WebP (a browser that cannot hands back a PNG) and otherwise saves JPEG, or PNG for a PNG so nothing transparent turns black. Same 1600 px longest side and 1 MB cap. GIF handling is untouched. The server accepts JPEG, PNG, WebP, AVIF and GIF (`apps/api/src/routes/media.ts`), so all three outputs pass. `public/` holds no large pictures: the biggest file is `licences.json` (51 kB), then `og.png` (33 kB); nothing deleted. |
| 3 | Duplicate requests | DONE | TanStack Query already merges identical requests by key. Read data is now fresh for 30 seconds (`main.tsx`, was 10), one retry, and none for a 4xx answer. Window focus still refreshes stale data, so at most one refresh per 30 seconds. Submit buttons on sign-in, reset, profile, product checkout, Community post and reply, Bond chat, listing offers and chat, event chat, Help and Customers already disable while `isPending`. The sign-up card inside the setup chat and strategy session is a chat card whose answer is consumed once; not changed, see "Still to run". |
| 4 | Debounced inputs | DONE | New `lib/useDebounced.ts` (300 ms). Used by `SearchBox` (two letters minimum, as before) and the team's member search in Manage, which asked the server on every key. Already debounced and left alone: Week plan's task search, Logs, Dev Tools, the public Explore search. Every search carries the debounced word in its query key, so an answer for an older word is a different query and cannot replace a newer one. The admin server searches run on a button, and `DataTable` filters rows already in memory. |
| 11 | Unused dependencies | DONE | Every web dependency is imported: react, react-dom, react-router, @tanstack/react-query, zustand, gsap, motion, qrcode (one screen). No change. |
| 14 | Optimistic updates | N/A (noted) | They exist only where a drag needs them: Agency's board moves (`screens/Agency.tsx`, `components/AgencyPipeline.tsx`) and the focus settings (`lib/focusPrefs.ts`). Task ticks use the one-at-a-time action queue (`lib/useActionQueue.ts`) with a busy state, on purpose: a tick pays xp and the server decides. Nothing added. |
| 15 | Lazy-load below the fold | DONE | Pictures in Store, Media, Listing sheet, link blocks and the Media section thumbnails now carry `loading="lazy"` and `decoding="async"` (Media section thumbnails also got width and height). Video embeds were already `loading="lazy"` and sit behind the consent gate. The public page's profile picture is the likely largest paint and has `fetchPriority="high"`. Images changed: `screens/Store.tsx` (2), `screens/Public.tsx`, `screens/Profile.tsx`, `components/Media.tsx` (2), `components/ListingSheet.tsx`, `components/LinkBlocks.tsx` (3), `components/MediaSection.tsx`. Link-block pictures have no known size, so they can still shift the page a little when they arrive. |
| 20 | Server rendering | OPEN (accepted) | The app is a client-rendered single page app by design. The public pages carry their own meta tags in `index.html`. No server rendering was attempted. |
| 21 | Third-party scripts and fonts | DONE | The only third-party scripts are Razorpay, loaded on demand at checkout, and the video embeds, which wait behind the consent gate (`EmbedGate`). Fonts are self-hosted from `public/fonts` and precached (another change). |
| 22 | Code splitting by page | DONE | `lib/lazy.ts` (`lazyNamed`) loads 83 screens on first open; the app shell, Home, Daily, sign-in, Welcome, the setup chat and the public landing page stay in the first download. A `Suspense` with `RouteFallback` sits in each layout (root, standalone pages, app shell), so the tab bar and the theme switch stay put while a page arrives. If a download fails (a new version removed the old file) the page reloads once, guarded by `sessionStorage` so it never loops, then shows a short "could not load" line. `vite.config.ts` puts React with the router, Query, gsap, motion and the shared model in their own files; sourcemaps stay off. The shared model is one 690 kB source file used by every screen, so about 320 kB of it must load first; splitting `packages/shared` into several files would let most of it load only where used and is the biggest remaining saving. The service worker still precaches every file (`**/*.{js,css,html,woff2}`, 115 entries), so the app works offline; the strategy is unchanged. |
| 23 | Virtualised long lists | N/A | Every list is paged by the server (10 to 100 rows). |
| 26 | Needless re-renders | FIXED (one) | No profiler was run. One visible defect: `CelebrationProvider` made a new context object on every render, so showing or hiding the celebration re-rendered every screen that asks for it. It is now memoised (`components/Celebration.tsx`). No other measured hot spot. |
| 29 | (not named in the brief I was given) | OPEN | Not covered. |
| 30 | Real-user vitals | DONE | `lib/vitals.ts`, started from `main.tsx`: largest paint, layout shift (without recent input), slowest tap or key press (events over 40 ms) and first byte. One note when the page is hidden, by `sendBeacon` or a keepalive fetch, to `POST /api/public/vitals`: `{ route, lcp, inp, cls, ttfb, device, conn }`. The route is the router's matched pattern (for example `/store/:id`) of the page the visit started on; no user id, cookie or storage. Silent under Do Not Track or Global Privacy Control, and on any 404 or 429. A metric that did not happen is sent as 0. |
| 31 | Budgets and a slow-device test | DONE | `pnpm perf:budget` (`scripts/perf-budget.mjs`) fails when the entry is over 480 kB raw (post-split plus about 15 percent), the first download over 1,500 kB, or any other chunk (vendor files excepted) over 400 kB, and prints a table. `scripts/smoke/perf-probe.mjs` loads the landing page, Home and Daily with the CPU 4 times slower and Slow 4G, cold cache, and prints LCP, CLS, long tasks and JavaScript transferred. It only reports. |

### Still to run (needs a server and a browser)

- `pnpm build && pnpm perf:budget` should say "Within budget".
- Click through the app in a browser: every route opens (the lazy screens), Back returns to the same scroll position, the tab bar stays while a page loads, the offline copy opens a screen that was never visited.
- `node scripts/smoke/drive-scroll.mjs shots.json`, `drive-keep.mjs`, `drive-headings.mjs`, and the overflow and orphan probes over the shot list.
- `bash scripts/smoke/blueprint.sh`.
- `SHOOT_TOKEN=<token> node scripts/smoke/perf-probe.mjs` for the slow-phone numbers.
- Upload a PNG, a JPEG and a GIF in the Media section and check the stored type.
- Network tab: one `POST /api/public/vitals` when the tab is hidden (answers 404 until the server route is live).

## Still to run (needs a server)

- `bash scripts/smoke/blueprint.sh`: nothing was run against a live Worker for this pass. Pay special attention to Daily (`/today`), the tick
  (`/nodes/:id/complete`), the Community feed, Explore, a creator's public page, a reward's page, the data export, and anything that notifies a group.
- Apply migration 0060 to the dev database (`pnpm db:migrate:local`) and then to production (`pnpm db:migrate`); it is safe to run twice.
- Check the headers: `curl -si localhost:8787/api/public/explore | head` (public), a picture id (immutable), and any personal route once `cache('none')` is mounted.
- Post a vitals note and read it back: `POST /api/public/vitals` with `{"route":"/store/:id","lcp":2100,"inp":120,"cls":0.03,"ttfb":300,"device":"phone","conn":"4g"}` answers 204.
- Time a timeout: point `ASSISTANT_BASE_URL` at a server that never answers and confirm the assistant says the model took too long and the request is a 200 with a `ModelError` line, not a 500.
