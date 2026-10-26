# 03 — System architecture

**Product:** kreators.app
**Version:** 0.2, reconciled with the app on 26 October 2026
**Source of truth:** the code under `apps/` and `packages/`, `CLAUDE.md` for the rules.

## 1. What was chosen

A modular monolith, as v0.1 recommended, on a fixed stack the founder set on 23 October 2026:

- `apps/web`: React 19, Vite 7, Tailwind 4, React Router 7, TanStack Query, Zustand, GSAP (new motion; `motion/react` only where it already is), `vite-plugin-pwa`. The public site and the app are one bundle.
- `apps/api`: Hono on a Cloudflare Worker with a D1 database. The Worker serves the built web app as static assets, so one deploy ships everything. It runs first for `/`, `/api/*`, `/go/*`, `/out/*`, `/__scheduled` and `/sitemap.xml`; everything else is a file or the SPA shell.
- `packages/shared`: the domain model both sides import straight from TypeScript, with Vitest tests. Relationships, the pyramid, xp and waits, questions, modules, flags, periods, money, time zones and slots, matching, listings, commerce, finance, the how-tos and the glossary.
- A pnpm workspace. No ORM; plain SQL migrations in `apps/api/migrations`, applied with wrangler.

## 2. Logical layers

```text
Public site + app (React, one bundle, PWA)
          |
          v
Hono Worker, basePath /api
  cors, secureHeaders, rate limits on the doors without a session
  Bearer session -> c.get('user')
          |
          +---- one route file per module (apps/api/src/routes/*.ts)
          +---- access.ts   flags, overrides, rollout, role -> access per module
          +---- db.ts       can(), orgRole(), audit(), notify(), validators, badges
          +---- ops.ts      rate limits, email outbox, timeline, analytics
          +---- rewards.ts  social rewards, capped and paid once
          +---- payments.ts the provider interface (test, Razorpay)
          +---- cron.ts     every fifteen minutes
          |
          v
D1 (SQLite): 25 migrations, about 110 tables
          |
          v
Adapters: Razorpay, Resend (through the outbox), YouTube Data API, Meta webhooks, Workers AI (optional)
```

## 3. Module boundaries as built

- A module is one entry in `MODULES` (shared), one route file, its own tables, and one or more screens behind `Gate`. Its rules live in shared where both sides need them (`notToDoStreak`, `periodFor`, `slotsFor`, `unlockFor`, `runEntryState`, `bountyPayout`, `trustScore`).
- Shared entities (users, sessions, organizations, points, xp, notifications, audit) belong to the core and are reached through `db.ts` helpers, not re-implemented.
- Modules read each other's tables only for the dashboards that are meant to: Home (`GET /home`, one call), Life (`life.ts` scores from wellbeing, finance, nodes, runs), Reviews (`numbersFor` pulls one period from every app's table), Search.
- Money and points move only through `points_ledger`, `orders` and `xp_events`; nothing writes a balance directly except through those paths.
- Race-sensitive writes use D1 batches and unique indexes: one booking per slot, one application per listing, one registration per event, one review per period, one entry per run, one open offer per buyer.

## 4. Cross-module flows as built

- **School to Work:** completion sends an inbox note pointing at Work. No automatic eligibility or grade disclosure.
- **Army to Work:** a campaign can be made public as a listing; applications stay on the opportunity.
- **Party to Bond:** feedback carries a networking opt-in; Bond suggests people met at events only when both opted in; an introduction needs consent before anything is shared.
- **Circles to Bond:** a table member can open an alias chat from the table; ids never reach the browser.
- **Club to Party and Work:** club-only events are enforced in Party. Club-only Work listings are promised and not enforced (gap).
- **Run to Life:** a logged run's minutes are a `move` wellbeing log, so the physical score counts them.
- **Everything to Reviews and Home:** read-only period numbers.
- **Wellbeing and Journal to nothing:** never to the public page, brands, staff, the leaderboard, Observability or Club selection. Enforced in `pageFor`, `internal.ts` and the Rank query; proven by the smoke test.

## 5. API conventions as built

- Every answer is JSON. Errors are a flat `{ "error": "<plain words>" }` with the status: 400 for a bad request, 401 without a session, 403 for a role or ownership refusal, 404 for not found (also used instead of 403 where existence should not leak, for example another person's not-to-do item), 409 for a duplicate, 429 for a limit, 500 for "something broke on our side". The v0.1 `{ error: { code, message } }` envelope was not adopted.
- Inputs are coerced and bounded by `str(value, max, fallback)`, `num(value, fallback, min, max)` and `oneOf(value, list, fallback)` on every route. No validation library.
- Lists are capped rather than paginated: `LIMIT 100` or `LIMIT 200`, newest first. Only Observability takes `offset` and `limit`. Gap for large accounts.
- Idempotency: webhooks insert their event id with `INSERT OR IGNORE` into `webhook_events` and stop on a duplicate; a checkout refuses a second order for the same product; there is no client-supplied idempotency key.
- Rate limits are a `rate_limits` row per key and window, keyed by `CF-Connecting-IP` or the session user: sign-in 10 a minute, sign-up 10 an hour, forgot 10 an hour, reset 20 an hour, anonymous start 60 an hour, lead form 5 a minute, checkout 10 a minute, plus 20 sign-in tries per email per quarter hour.
- Owner-scoped queries filter by the session user id. Staff powers come from `can(user, permission)`. Brand access comes from `orgRole`.
- The `/go/:code` and `/out/:kind/:id` redirects answer first and write the click in `waitUntil`, with a salted hash of the address and never the address.
- Time is stored as UTC ISO; zone conversion happens only through `zonedToUtc` and `slotsFor` in shared. Money is integer cents or integer points through `money()` and `feeBps()`.

## 6. The cron

`*/15 * * * *` runs `runScheduled`: closes money orders nobody paid within half an hour so the product is buyable again; sends post-purchase sequences into inboxes; posts monthly recurring finance entries; sets circle tables two days out and opens the next weekly occurrence; refreshes YouTube numbers for content items older than six hours and for reward submissions. Locally `pnpm dev` passes `--test-scheduled`, so `GET /__scheduled?cron=*+*+*+*+*` runs it by hand.

## 7. Environments and deployment

- Development: `pnpm dev`, web on 5173 proxying to the Worker on 8787 with a local D1 under `.wrangler`. Secrets in `apps/api/.dev.vars`; `.dev.vars.example` lists every key.
- Smoke: a second Worker on 8788 with its own database under `scripts/smoke/state`, started by `scripts/smoke/blueprint.sh`. Test accounts live only there.
- Production: `pnpm deploy` builds the web app and runs `wrangler deploy`. Secrets with `pnpm cf:secret <NAME>`. Migrations with `pnpm db:migrate`. Logs with `pnpm cf:logs`. Wrangler observability is enabled.
- There is no staging environment, no written backup and restore step, and no alerting. D1's own point-in-time recovery is relied on but not documented or rehearsed.
- Feature flags can switch any module off in production without a deploy (Admin, Flags), subject to the enforcement gap in 05.

## 8. Anti-patterns, checked

- One mega-prompt: avoided; DECISIONS shows the slices.
- One giant component or table: avoided; 25 migrations, one route file per module, screens built from `Screen`, `Section`, `StatTile` and the charts.
- Frontend-only authorization: avoided for roles and ownership; present for module flags (gap).
- Hard-coded access in components: avoided; `Gate` reads `access` from `/api/me`.
- Payment state in a mutable user field: avoided; `orders` plus `webhook_events`.
- Keys in client code: avoided; secrets are Worker bindings.
- Ingesting the books into AI: avoided.
- Switching frameworks: the stack has not moved since it was fixed.
- Native app first: avoided.

## Known gaps

- Module flags are not enforced by the API routes (05).
- Lists are capped at 100 or 200 rows with no pagination except Observability.
- No staging environment, backup procedure or alerting.
- No idempotency key on checkout beyond the one-order-per-product rule.
