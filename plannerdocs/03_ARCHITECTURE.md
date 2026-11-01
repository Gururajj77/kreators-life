# 03 — System architecture

Last updated: 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026
**Source of truth:** the code under `apps/` and `packages/`, `CLAUDE.md` for the rules, `docs/DECISIONS.md` for why.

## 1. What was chosen

A modular monolith, as v0.1 recommended, on a fixed stack the founder set on 23 October 2026. It has not moved since:

- `apps/web`: React 19, Vite 7, Tailwind 4, React Router 7, TanStack Query, Zustand, GSAP (new motion; `motion/react` only where it already is), `vite-plugin-pwa`, `qrcode`. The public site and the app are one bundle.
- `apps/api`: Hono on a Cloudflare Worker with a D1 database (`wrangler.jsonc`: compatibility date 2026-10-01, `nodejs_compat`, observability on, one cron). The Worker serves the built web app as static assets, so one deploy ships everything. It runs first for `/`, `/api/*`, `/go/*`, `/out/*`, `/__scheduled` and `/sitemap.xml`; everything else is a file or the SPA shell. Its only runtime dependencies are `hono` and `@anthropic-ai/sdk`.
- `packages/shared`: the domain model both sides import straight from TypeScript, with Vitest tests (it has no runtime dependencies of its own). Relationships, the pyramid, xp and waits, questions, modules, flags, roles and permissions, periods, repeat rules, money, time zones and slots, matching, listings, commerce, finance, the invoice calculator and contract templates, the week plan, the how-tos and the glossary.
- A pnpm workspace. No ORM; plain SQL migrations in `apps/api/migrations` (57 of them), applied with wrangler.

## 2. Logical layers

```text
Public site + app (React, one bundle, PWA)
          |
          v
Worker entry: a root Hono app
  /go/:code, /out/:kind/:id, /sitemap.xml and the site home "/" (routes/go.ts), outside /api
  then the app, basePath /api:
    cors, secureHeaders, logger (the app's own log: app_logs)
    /health, POST /public/client-error
    limits on the doors without a session (/auth/* and /public/*), per address
    /auth, /admin (its own check: the admin key or an admin's session), /public/* (see 6), /webhooks
    ---- everything below needs a session ----
    Bearer session -> c.get('user')   (a token that was signed out for a fourth device answers 401 with reason "devices")
    module gate: 403 when none of the path's modules is available to the person
    the rest of the limits, per person
    one route file per module (apps/api/src/routes/*.ts), mounted in index.ts
          |
          +---- access.ts   flags, overrides, rollout, role -> access per module; the prefix map the gate uses
          +---- limits.ts   every rate limit, with the route it guards
          +---- db.ts       can(), orgRole(), audit(), notify(), pageOf/paged, str/num/oneOf, dayFromDevice, validators, badges
          +---- ops.ts      rate limits (rateLimit), email outbox, timeline, analytics
          +---- logs.ts     the app's own log (what changed, what was refused, what broke); never a body or a query
          +---- account.ts  delete an account (the person's own and an admin's use the same function)
          +---- rewards.ts  social rewards, capped and paid once
          +---- unlocks.ts, attendee.ts, coaching.ts, credits.ts, admins.ts, social.ts, sitemap.ts, agencyStats.ts
          +---- payments.ts the provider interface (test, Razorpay)
          +---- reach.ts    research: Agent Reach over the bridge, page reads and YouTube as fallbacks
          +---- strategist.ts the writer: Claude by SDK, Workers AI, or a labelled digest
          +---- assistant/  tools.ts (each tool is a description over an existing route), dispatch.ts (runs it through app.fetch as the person), model.ts (any OpenAI-compatible endpoint)
          +---- cron.ts, engage.ts   every fifteen minutes, and water every two hours (see 7)
          |
          v
D1 (SQLite): 57 migrations, 177 tables
          |
          v
Adapters: Razorpay, Resend (through the outbox), YouTube Data API, Meta webhooks, Workers AI (optional), the Anthropic SDK (the content strategist's writer), an OpenAI-compatible endpoint for the assistant (OpenRouter by default), the Agent Reach bridge (research, scripts/reach/server.mjs)
```

## 3. Module boundaries as built

- A module is one entry in `MODULES` (shared; 46 of them), one route file (or two: Agency has `agency.ts` and `agencyDocs.ts`), its own tables, and one or more screens behind `Gate`. Its rules live in shared where both sides need them (`notToDoStreak`, `periodFor`, `slotsFor`, `unlockFor`, `runEntryState`, `bountyPayout`, `trustScore`, `invoiceTotals`, `planWeek`, `projectPace`, `occurrencesBetween`, `scoreDiscover`).
- Shared entities (users, sessions, organizations, points, xp, notifications, audit) belong to the core and are reached through `db.ts` helpers, not re-implemented.
- Modules read each other's tables only for the dashboards that are meant to: Home (`GET /home`, one call), Life (`life.ts` scores from wellbeing, finance, nodes, runs), Reviews (`numbersFor` pulls one period from every app's table, `flaggedFor` the tasks brought to it, `agencyMetric` the business numbers), Search.
- One action, two callers. The assistant never has a second version of an action: every tool in `assistant/tools.ts` is a description over an existing route, and `dispatch.ts` runs it inside the Worker with the person's own Bearer token (`app.fetch`), so the session, the module gate, the limits, the waits, the xp caps and the owner filters apply exactly as to a tap. The same holds for Agency's use of Army (`uploadVersion` is exported from `army.ts`) and of Finance (`createInvoice` and `setInvoiceStatus` are exported from `finance.ts`), and for a coach's tasks (`createNode` and `editNode` in `nodes.ts`).
- Money and points move only through `points_ledger`, `orders` and `xp_events` (credits through `credit_ledger`; a creator's own books are `finance_transactions`); nothing writes a balance directly except through those paths.
- Race-sensitive writes use D1 batches and unique indexes: one booking per slot, one application per listing, one registration per event, one review per period, one entry per run, one open offer per buyer, one open coaching link per pair, one claim of a code per person, a pay-out capped inside the batch that pays.

## 4. Cross-module flows as built

- **School to Work:** completion sends an inbox note pointing at Work. No automatic eligibility or grade disclosure.
- **Army to Work:** a campaign can be made public as a listing; applications stay on the opportunity.
- **Army to Agency:** a client can be served through an Army campaign the person is an accepted creator on. `POST /agency/clients/:id/army-import` brings its deliverables into the pipeline; `…/items/:id/army/send` goes through Army's own `uploadVersion`; `…/army/sync` brings the brand's answer and feedback back as a note. All of it is refused while Army is off for the person.
- **Agency to Finance:** an invoice made in Agency is a row in `invoices` (made and paid through the shared helpers, so Agency does not need Finance switched on). Marking one paid books the income in `finance_transactions`; taking a paid one back out removes it.
- **Agency to Reviews:** business metrics (`kpis`) are typed in each period or read from Agency (`agencyStats.ts`). Scheduled reviews show in the private calendar link.
- **Daily to Reviews:** a task flagged `for_review` is listed in the review for its period, and a saved review keeps the list it was saved with. The scheduled review's inbox note says how many are waiting.
- **Party to Bond:** feedback carries a networking opt-in; Bond suggests people met at events only when both opted in; an introduction needs consent before anything is shared.
- **Circles to Bond:** a table member can open an alias chat from the table; ids never reach the browser.
- **Club to Party and Work:** club-only events are enforced in Party. Club-only Work listings are enforced too (`opportunities.club_only`, migration 0027): listed, opened and applied to only by an approved, unexpired member (`isClubMember`).
- **Run to Life:** a logged run's minutes are a `move` wellbeing log, so the physical score counts them.
- **Mindful minutes to Life:** a finished focus session is a `mindful` wellbeing log by default, and a finished break only if the person switches that on (`logFocus` and `logBreaks` in their saved timer settings). Focus rounds themselves (`focus_rounds`, with an optional focus-quality rating) feed only the focus dashboard.
- **Coaching to Daily and Pillars:** a coach sees what a student shares, read fresh on every request while the link is active and the permission held; the coach's tasks are made and changed through the student's own `createNode` and `editNode` and wear a "From your coach" tag.
- **Everything to Reviews and Home:** read-only period numbers. Home's daily brief (`briefFor`) is rules only, so it costs no credits.
- **Wellbeing, Journal and Discover to nothing:** never to the public page, brands, staff, the leaderboard, Observability, Club selection or a coach. Enforced in `pageFor`, `internal.ts` and the Rank query; proven by the smoke test. Only a short summary reaches the assistant, and only for a model that keeps nothing, while the person's own switch is on.

## 5. API conventions as built

- Every answer is JSON, except the private calendar (`text/calendar`), the sitemap and the media bytes. Errors are a flat `{ "error": "<plain words>" }` with the status: 400 for a bad request, 401 without a session (with `reason: "devices"` for a device pushed out by a fourth), 403 for a role, ownership or module refusal (the module refusal also carries `module`), 404 for not found (also used instead of 403 where existence should not leak, for example another person's not-to-do item), 409 for a duplicate, 429 for a limit, 500 for "something broke on our side". The v0.1 `{ error: { code, message } }` envelope was not adopted.
- Inputs are coerced and bounded by `str(value, max, fallback)`, `num(value, fallback, min, max)` and `oneOf(value, list, fallback)` on every route. Shared holds the one reader for anything that is stored as JSON (`parseRepeat`, `parseFaq`, `parseLinkBlocks`, `parseFocusSettings`, `parseInvoiceDoc`, `parseContractDoc`, `parsePortalShow`) and the one rule for each password, phone and date of birth. No validation library.
- Every list a person scrolls is a page at a time: `?page=N&size=S` with S in 10, 25, 50 or 100 (`pageOf` and `paged` in db.ts fetch one row more than the size, so `page.more` says whether a next page exists); the answer carries `page`. A screen with two lists prefixes the second (`lpage`, `lsize`). A kanban board column is a page of its own with a "Show more" (`?per=`). Short side lists on a detail page keep a cap.
- The person's day comes from the device, never from the server's clock: a request that depends on "today" carries `?day=YYYY-MM-DD` (`dayFromDevice` in db.ts accepts a day up to one day ahead of UTC and otherwise falls back to the UTC date). Ticks, focus rounds, water, time entries and the Agency month all follow it.
- Idempotency: webhooks insert their event id with `INSERT OR IGNORE` into `webhook_events` and stop on a duplicate; a checkout refuses a second order for the same product; reminders have a fixed id (`task-<id>-<day>`, `review-<id>-<day>`, `water-<user>-<day>`) so each goes once; there is no client-supplied idempotency key.
- Rate limits are a `rate_limits` row per key (`name:address-or-person`) counted in a fixed window. Every number and the route it guards is one line in `apps/api/src/limits.ts`: `LIMITS` holds 34 named limits and `ROUTE_LIMITS` 87 method and path pairs; index.ts wires them (the doors without a session per address before the session check, everything else per person after it). Today: sign-in 10 a minute plus 20 per email per quarter hour, sign-up, forgot and anonymous start per hour, reset, the lead form, checkout, posts 10 an hour, replies 30, likes 120, follows 60, chat messages 120, introductions 20, offers 20, things put up 30, tickets 5, applications 10, run entries 10, attendee code claims 10, content research 40 and writing 20, the setup chat 20, water and reminders 240, uploads 30, the assistant 60, coaching asks 20 and writes 60, Discover results 30, saved preferences 240, everyday Agency work 600, and a client at their link 30 per ten minutes (`portal`).
- Owner-scoped queries filter by the session user id. Staff powers come from `can(user, permission)`. Brand access comes from `orgRole`. A module that is not available to the person is refused before its route runs: `modulesForPath` maps the first one or two path segments to the module keys that own them. A new route file needs a line in that map or it is treated as core and always open.
- The `/go/:code` and `/out/:kind/:id` redirects answer first and write the click in `waitUntil`, with a salted hash of the address and never the address.
- Time is stored as UTC ISO; zone conversion happens only through `zonedToUtc` and `slotsFor` in shared. Money is integer cents or integer points through `money()` and `feeBps()`; the invoice calculator works in whole cents and basis points.
- Auth is hand-built on Hono and D1: Bearer session tokens in `sessions` (two UUIDs), PBKDF2-SHA256 at 100,000 iterations with a 16-byte salt, constant-time compare, an answer that is the same for an unknown email and a wrong password, at most three devices at once (`MAX_DEVICES`, `newSession` signs out the oldest and leaves a row in `session_evictions`), password reset by a one-time hashed link.

## 6. Public routes

Nothing here needs a session. The doors that take input are limited per address.

| Route | What it serves |
|---|---|
| `GET /api/public/explore`, `/explore/stats`, `/explore/:type/:id` | the public listings |
| `GET /api/public/:handle`, `/people/:id`, `/products/:id`, `POST /:handle/click`, `/:handle/lead`, `GET /config` | a person's public page, a product page, the lead form, the payment config (`routes/store.ts`) |
| `GET /api/public/certificates/:code` | a certificate check |
| `GET /api/public/media/:id`, `/media/for/:type/:id` | uploaded pictures and the media on a listing |
| `GET /api/public/invoices/:token`, `POST /:token/comments` | a client's invoice, with what the owner switched off removed on the server, and a comment asking for a change (`/i/<token>` on the site) |
| `GET /api/public/agency/:token`, `POST /:token/items/:id` | a client's dashboard, only the parts switched on, and approve, send back or comment as far as allowed (`/a/<token>`) |
| `GET /api/public/contracts/:token`, `POST /:token/accept`, `POST /:token/comments` | an agreement, its typed acceptance, and a comment (`/k/<token>`) |
| `GET /api/public/calendar/<token>.ics` | the person's private calendar: tasks with a day, and scheduled reviews. Off until switched on; a 24-character secret |
| `POST /api/public/client-error` | a broken screen reporting itself (a short message and where, never who) |
| `/go/:code`, `/out/:kind/:id`, `/sitemap.xml`, `/` | short links, partner redirects, the sitemap, and the home page with an absolute share image |
| `POST /api/webhooks/razorpay`, `GET` and `POST /api/webhooks/meta` | provider webhooks; each verifies its own signature on the raw body |

The matching site pages are `/`, `/explore`, `/features`, `/features/:key`, `/7rp`, `/c/:code`, `/i/:token`, `/a/:token`, `/k/:token`, the policy pages (`/terms`, `/privacy`, `/refunds`, `/contact`, `/pricing`), `/u/:handle`, `/people/:id` and `/p/:id`. The client link, an invoice and an agreement each rely on a long random token as the only key, so they are limited per address (`portal`) and a fresh link closes the old one.

## 7. The cron

`*/15 * * * *` runs `runScheduled`, in this order:

1. The daily reminder (`sendReminders`): anyone whose check-in time has passed within the last hour in their own zone and who has not checked in that day, once per due time.
2. Water and the person's own reminders (`sendWaterAndCustom`).
3. Task reminders (`sendTaskReminders`): a task tagged Remember with a day, at its time, once.
4. Review reminders (`sendReviewReminders`): a scheduled review on its day at its time in the person's zone, once; `next_on` is moved to the next day the repeat rule falls on, and a day missed while nothing ran is skipped, never sent late. The note links to the period it covers and says how many tasks were brought to it.
5. Event reminders (`sendEventReminders`, engage.ts): a day before and an hour before every Party event, circle table and run someone signed up for, once each through `event_reminders`.
6. Close last month's leaderboard season once (`closeSeason`): its top three go to `season_results` and get the `season_top` honor.
7. Post-purchase sequences into inboxes (`runSequences`).
8. Monthly recurring finance entries (`runRecurring`).
9. Circle tables set two days out, and the next weekly occurrence opened (`matchDueCircles`, `rollWeeklyCircles`).
10. Money orders nobody paid for within half an hour are closed (`expired`), so the product is buyable again.
11. YouTube numbers refreshed for content items not synced in six hours (twenty at a time) and for YouTube reward submissions with no automatic reading in the last six hours (twenty at a time), when a key is set.

After the run: a line in `app_logs` if anything was done, `pruneLogs` (log lines older than thirty days), and `session_evictions` rows older than thirty days are deleted. Locally `pnpm dev` passes `--test-scheduled`, so `GET /__scheduled?cron=*+*+*+*+*` runs it by hand (the smoke test does this for the reminders).

## 8. Environments, deployment and checks

- Development: `pnpm dev`, web on 5173 proxying `/api`, `/go` and `/out` to the Worker on 8787 with a local D1 under `.wrangler`. Secrets in `apps/api/.dev.vars`; `.dev.vars.example` lists every key.
- Smoke: a second Worker on 8788 with its own database under `scripts/smoke/state`, started by `scripts/smoke/blueprint.sh` (`--fresh` wipes the database, `--keep` leaves the server up). `scripts/smoke/smoke.mjs` imports the shared model straight from TypeScript and, at the last run, made 843 checks; it serves a stand-in model on 8799 so the assistant checks never pay for a model. Test accounts live only there.
- Probes and drives (puppeteer-core driving the installed Chrome, over `shots-all.mjs`'s list of about a hundred routes): `shoot.mjs` takes the shots; `orphan-probe.js` (no word alone on the last line, must be 0 on a laptop), `overflow-probe.js` (nothing past the screen at phone width), `contrast-probe.js` (text on its real background, in dark mode); `drive-signup.mjs`, `drive-keep.mjs`, `drive-talk.mjs`, `drive-cards.mjs` (cards stay on the table when focus mode is left) and `drive-scroll.mjs` (no tab or toggle throws the page back to the top). `scripts/scan.sh` runs the spacing, colour, link and old-name scans; `scripts/flesch.py` scores reading ease.
- Production: `pnpm deploy` builds the web app and runs `wrangler deploy`. Secrets with `pnpm cf:secret <NAME>`. Migrations with `pnpm db:migrate` (run it before the deploy that needs them). Logs with `pnpm cf:logs`. Wrangler observability is enabled.
- The PWA: `vite-plugin-pwa` with `autoUpdate`, `skipWaiting` and `clientsClaim`, so a deploy replaces a cached page on the next load; `/api/*` is never served from the shell; Google Fonts are cached first; the start page is `/today`.
- There is no staging environment, no written backup and restore step, and no alerting. D1's own point-in-time recovery is relied on but not documented or rehearsed.
- Feature flags switch any module off in production without a deploy (Admin, Flags), and the API refuses it at once.

## 9. Anti-patterns, checked

- One mega-prompt: avoided; DECISIONS shows the slices.
- One giant component or table: avoided; 57 migrations, one route file per module, screens built from `Screen`, `Section`, `StatTile` and the charts, one `DataTable`, one `Pager`, one `KanbanBoard`.
- Frontend-only authorization: avoided; roles, ownership and module flags are all server checks, and what a client may see at a link is removed on the server (`invoiceForClient`, the parts of `PortalView`).
- Hard-coded access in components: avoided; `Gate` reads `access` from `/api/me`.
- Payment state in a mutable user field: avoided; `orders` plus `webhook_events`.
- Keys in client code: avoided; secrets are Worker bindings.
- Two versions of one action: avoided; the assistant, Agency and the coach call the same code the screens call.
- Ingesting the books into AI: avoided.
- Switching frameworks: the stack has not moved since it was fixed.
- Native app first: avoided.

## Known gaps

- No staging environment, backup procedure or alerting.
- No idempotency key on checkout beyond the one-order-per-product rule.
- No purge for `webhook_events`, `email_outbox`, `analytics_events` or `link_clicks` (only `app_logs` and `session_evictions` are tidied by the cron).
- A PDF of an invoice or an agreement is the browser's print and save, because a Worker cannot make one.
- Calendar sync is one way (tasks and reviews appear in a calendar; nothing changes back), and there is no two-way link to Google, Outlook, Slack or meeting-note tools.

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October, 25 migrations, about 110 tables) to the app as it stands: 57 migrations and 177 tables, 46 modules. New since then: the strategy session, the setup chat, the assistant with credits and plans, coaching, attendee codes, engagement (reactions, pins, event reminders, seasons), media and event extras, anonymous threads, water and reminders, card games, Discover and its add-ons, the app's own log, focus rounds and their settings, task dates, repeat, priority and subtasks, the device cap, Agency (clients, deliverables, time, invoices, agreements, templates, the client link), business metrics, the private calendar link, and scheduled reviews with reminders.
- 2026-11-01: the request flow now has the module gate and the per-person limits written out in order; the public routes are listed in one place (6); the cron lists all eleven jobs; and the Club-only Work gap from 0.3 is closed.
