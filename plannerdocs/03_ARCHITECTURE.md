# 03 — System architecture

Last updated: 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026
**Source of truth:** the code under `apps/` and `packages/`, `CLAUDE.md` for the rules, `docs/DECISIONS.md` for why.

## 1. What was chosen

A modular monolith, as v0.1 recommended, on a fixed stack the founder set on 23 October 2026. It has not moved since:

- `apps/web`: React 19, Vite 7, Tailwind 4, React Router 7, TanStack Query, Zustand, GSAP (new motion; `motion/react` only where it already is), `vite-plugin-pwa`, `qrcode`. The public site and the app are one bundle.
- `apps/api`: Hono on a Cloudflare Worker with a D1 database (`wrangler.jsonc`: compatibility date 2026-10-01, `nodejs_compat`, observability on, Smart Placement on, two cron triggers). The Worker serves the built web app as static assets, so one deploy ships everything. It runs first for `/`, `/api/*`, `/go/*`, `/out/*`, `/__scheduled` and `/sitemap.xml`, and for a list of paths that should hold nothing (hidden files, backups, dumps, config and project files; see 10); everything else is a file or the SPA shell. Its only runtime dependencies are `hono` and `@anthropic-ai/sdk`.
- `packages/shared`: the domain model both sides import straight from TypeScript, with Vitest tests (it has no runtime dependencies of its own). Relationships, the pyramid, xp and waits, questions, modules, flags, roles and permissions, periods, repeat rules, money, time zones and slots, matching, listings, commerce, finance, the invoice calculator and contract templates, the week plan, the how-tos and the glossary. Two small helpers sit there for the whole app: `byKey` (not exported; it builds every `*_BY_KEY` lookup with no prototype, so a key a person typed, such as "constructor", finds nothing instead of an inherited function) and `typedCents` (reads a typed amount from its digits, never through a float).
- A pnpm workspace. No ORM; plain SQL migrations in `apps/api/migrations` (60 of them), applied with wrangler.

## 2. Logical layers

```text
Public site + app (React, one bundle, PWA)
          |
          v
Worker entry: a root Hono app
  a path that holds nothing (hidden file, backup, dump, config) answers 404 here (headers.ts, blockedPath)
  /go/:code, /out/:kind/:id, /sitemap.xml and the site home "/" (routes/go.ts), outside /api, with the page headers from headers.ts
  then the app, basePath /api:
    a request id (X-Request-Id), the Origin rule for writes (403 "wrong origin"), secureHeaders,
    Cache-Control (private, no-store for anything personal), logger (the app's own log: app_logs). No CORS.
    /health, POST /public/client-error (limited per address, after the limits are wired)
    limits on the doors without a session (/auth/* and /public/*), per address
    /auth, /admin (its own check: the admin key or an admin's session), /public/* (see 6; the legal, vitals, explore and media routes carry their own cache lines), /webhooks
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
          +---- headers.ts  the page headers and the content security policy, blockedPath, originAllowed (see 10)
          +---- safeurl.ts  publicHttpsUrl and safeFetch: the one guard for any address a person influenced that the Worker fetches
          +---- http.ts     fetchT and the named timeouts (TIMEOUT): every call out of the API has a clock and is never retried
          +---- cachecontrol.ts  cache('public' | 'immutable' | 'none'): the one place a Cache-Control line is chosen
          +---- alerts.ts   securityAlerts: counts from app_logs and audit_logs, a note to every admin's inbox, once an hour per kind
          +---- payments.ts the provider interface (test, Razorpay)
          +---- reach.ts    research: Agent Reach over the bridge, page reads and YouTube as fallbacks
          +---- strategist.ts the writer: Claude by SDK, Workers AI, or a labelled digest
          +---- routes/legal.ts (what a person accepted and chose, the business details, copyright notices, unsubscribe) and routes/vitals.ts (real-user web vitals)
          +---- assistant/  tools.ts (each tool is a description over an existing route), dispatch.ts (runs it through app.fetch as the person), model.ts (any OpenAI-compatible endpoint)
          +---- cron.ts, engage.ts   two triggers: everything every fifteen minutes, water alone every two hours (see 7)
          |
          v
D1 (SQLite): 60 migrations, 183 tables
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
- Guards against double pay and double refund (the 2026-11-01 bug sweep). A write that moves points or money first makes one guarded `UPDATE`, then checks `meta.changes`, and goes on only when it is 1. Rewards redeem takes the points first with `WHERE points >= ?`; rewards cancel moves the redemption out of `reserved` first; a Win payout moves the submission out of `verified` first (so a paid one cannot be paid or resubmitted again); `refundOrder` flips the order to `refunded` before it credits anyone, so two refunds at once pay the buyer once; Finance's recurring run moves `next_date` first with `AND next_date = ?`, and the manual run (`runRecurring(db, onlyUser)`) touches only the caller's own rows. The same sweep closed the free-purchase holes: School enrol takes `pay: 'test'` only when the program has a money price and no points price, and the Store checkout treats a payment as money only when `cents > 0`.
- Real days only. `DATE_RE.test` in `db.ts` checks a day against the calendar (2026-11-31 and 2026-00-00 have the shape and are refused, never a 500); `parseRepeat` drops an `until` that is not a real day. The person's day still comes from the device (`dayFromDevice`).

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

- Every answer carries `X-Request-Id`, and the same id is in the log line and in the body of a server error, so a report can be traced. Every answer is JSON, except the private calendar (`text/calendar`), the sitemap and the media bytes. Errors are a flat `{ "error": "<plain words>" }` with the status: 400 for a bad request, 401 without a session (with `reason: "devices"` for a device pushed out by a fourth), 403 for a role, ownership or module refusal (the module refusal also carries `module`), 404 for not found (also used instead of 403 where existence should not leak, for example another person's not-to-do item), 409 for a duplicate, 403 `wrong origin` for a write from another site (see 10), 429 for a limit, 500 for "something broke on our side". The v0.1 `{ error: { code, message } }` envelope was not adopted.
- Inputs are coerced and bounded by `str(value, max, fallback)`, `num(value, fallback, min, max)` and `oneOf(value, list, fallback)` on every route. Shared holds the one reader for anything that is stored as JSON (`parseRepeat`, `parseFaq`, `parseLinkBlocks`, `parseFocusSettings`, `parseInvoiceDoc`, `parseContractDoc`, `parsePortalShow`) and the one rule for each password, phone and date of birth. No validation library.
- Every list a person scrolls is a page at a time: `?page=N&size=S` with S in 10, 25, 50 or 100 (`pageOf` and `paged` in db.ts fetch one row more than the size, so `page.more` says whether a next page exists); the answer carries `page`. A screen with two lists prefixes the second (`lpage`, `lsize`). A kanban board column is a page of its own with a "Show more" (`?per=`). Short side lists on a detail page keep a cap.
- The person's day comes from the device, never from the server's clock: a request that depends on "today" carries `?day=YYYY-MM-DD` (`dayFromDevice` in db.ts accepts a day up to one day ahead of UTC and otherwise falls back to the UTC date). Ticks, focus rounds, water, time entries and the Agency month all follow it.
- Idempotency: webhooks insert their event id with `INSERT OR IGNORE` into `webhook_events` and stop on a duplicate; a checkout refuses a second order for the same product; reminders have a fixed id (`task-<id>-<day>`, `review-<id>-<day>`, `water-<user>-<day>`) so each goes once; there is no client-supplied idempotency key.
- Rate limits are a `rate_limits` row per key (`name:address-or-person`) counted in a fixed window. Every number and the route it guards is one line in `apps/api/src/limits.ts`: `LIMITS` holds 37 named limits and `ROUTE_LIMITS` 90 method and path pairs; index.ts wires them (the doors without a session per address before the session check, everything else per person after it). Today: sign-in 10 a minute plus 20 per email per quarter hour, sign-up, forgot and anonymous start per hour, reset, the lead form, checkout, posts 10 an hour, replies 30, likes 120, follows 60, chat messages 120, introductions 20, offers 20, things put up 30, tickets 5, applications 10, run entries 10, attendee code claims 10, content research 40 and writing 20, the setup chat 20, water and reminders 240, uploads 30, the assistant 60, coaching asks 20 and writes 60, Discover results 30, saved preferences 240, everyday Agency work 600, and a client at their link 30 per ten minutes (`portal`). The legal pass added three, all per address on the doors without a session: real-user vitals 60 an hour (`vitals`), a copyright notice or counter-notice 5 an hour (`notice`) and a one-click unsubscribe 30 an hour (`unsubscribe`).
- Owner-scoped queries filter by the session user id. Staff powers come from `can(user, permission)`. Brand access comes from `orgRole`. A module that is not available to the person is refused before its route runs: `modulesForPath` maps the first one or two path segments to the module keys that own them. A new route file needs a line in that map or it is treated as core and always open.
- The `/go/:code` and `/out/:kind/:id` redirects answer first and write the click in `waitUntil`, with a salted hash of the address and never the address.
- Time is stored as UTC ISO; zone conversion happens only through `zonedToUtc` and `slotsFor` in shared. Money is integer cents or integer points through `money()` and `feeBps()`; the invoice calculator works in whole cents and basis points.
- Auth is hand-built on Hono and D1: Bearer session tokens in `sessions` (two UUIDs), PBKDF2-SHA256 at 100,000 iterations with a 16-byte salt, constant-time compare, an answer that is the same for an unknown email and a wrong password, at most three devices at once (`MAX_DEVICES`, `newSession` signs out the oldest and leaves a row in `session_evictions`), password reset by a one-time hashed link.

## 6. Public routes

Nothing here needs a session. The doors that take input are limited per address.

| Route | What it serves |
|---|---|
| `GET /api/public/explore`, `/explore/stats`, `/explore/:type/:id` | the public listings (cached for a minute in the browser, five at a shared cache, and 60 seconds per data centre in the Workers cache when the request carries no Authorization or cookie) |
| `GET /api/public/:handle`, `/people/:id`, `/products/:id`, `POST /:handle/click`, `/:handle/lead`, `GET /config` | a person's public page, a product page, the lead form, the payment config (`routes/store.ts`) |
| `GET /api/public/certificates/:code` | a certificate check |
| `GET /api/public/media/:id`, `/media/for/:type/:id` | uploaded pictures and the media on a listing |
| `GET /api/public/invoices/:token`, `POST /:token/comments` | a client's invoice, with what the owner switched off removed on the server, and a comment asking for a change (`/i/<token>` on the site) |
| `GET /api/public/agency/:token`, `POST /:token/items/:id` | a client's dashboard, only the parts switched on, and approve, send back or comment as far as allowed (`/a/<token>`) |
| `GET /api/public/contracts/:token`, `POST /:token/accept`, `POST /:token/comments` | an agreement, its typed acceptance, and a comment (`/k/<token>`) |
| `GET /api/public/calendar/<token>.ics` | the person's private calendar: tasks with a day, and scheduled reviews. Off until switched on; a 24-character secret |
| `POST /api/public/client-error` | a broken screen reporting itself (a short message and where, never who) |
| `POST /api/public/vitals` | a browser's own timings for a page (route pattern, phone or desktop, LCP, INP, CLS, TTFB; no person, no address); limit `vitals`; staff read a summary at `GET /api/internal/vitals` |
| `GET /api/public/business` | the business details the owner set in Worker variables, for the legal pages; empty fields read "Being set up" |
| `POST /api/public/copyright-notice` | a copyright notice or counter-notice, stored in `copyright_notices` and sent to every admin's inbox; limit `notice` |
| `GET` and `POST /api/public/unsubscribe/:token` | the one-click unsubscribe from marketing mail (limit `unsubscribe`); the token is the person's id and a hash only this server can make |
| `/go/:code`, `/out/:kind/:id`, `/sitemap.xml`, `/` | short links, partner redirects, the sitemap, and the home page with an absolute share image |
| `POST /api/webhooks/razorpay`, `GET` and `POST /api/webhooks/meta` | provider webhooks; each verifies its own signature on the raw body |

The matching site pages are `/`, `/explore`, `/features`, `/features/:key`, `/7rp`, `/c/:code`, `/i/:token`, `/a/:token`, `/k/:token`, the policy pages (`/terms`, `/privacy`, `/refunds`, `/contact`, `/pricing`), the legal pages that need the server or a list (`/subprocessors`, `/copyright`, `/licences`, and `/unsubscribe/:token`), `/u/:handle`, `/people/:id` and `/p/:id`. The client link, an invoice and an agreement each rely on a long random token as the only key, so they are limited per address (`portal`) and a fresh link closes the old one.

## 7. The cron

`apps/api/wrangler.jsonc` has two triggers, and `runScheduled(env, cron)` in `cron.ts` decides what each one does:

- **`0 */2 * * *` (`WATER_CRON`, every two hours):** water only (`sendWaterAndCustom` with water on and custom reminders off). Nothing else runs, so this trigger returns at once.
- **`*/15 * * * *` (`MAIN_CRON`, every fifteen minutes):** everything else, in this order. It leaves water alone.
- Any other schedule, for example a hand-made `GET /__scheduled` test, does both.

The fifteen-minute run:

1. The daily reminder (`sendReminders`): anyone whose check-in time has passed within the last hour in their own zone and who has not checked in that day, once per due time.
2. The person's own reminders (`sendWaterAndCustom` with custom on): a reminder goes once on each of its days, within an hour after its time.
3. Task reminders (`sendTaskReminders`): a task tagged Remember with a day, at its time, once. The date window is applied in SQL (yesterday to tomorrow in UTC), then each task's own zone decides.
4. Review reminders (`sendReviewReminders`): a scheduled review on its day at its time in the person's zone, once; `next_on` is moved to the next day the repeat rule falls on, and a day missed while nothing ran is skipped, never sent late. The note links to the period it covers and says how many tasks were brought to it.
5. `clearPastWaterNotes`: inbox water lines (`water-<user>-<day>`) of a day that is over, in that person's own zone, are deleted whether read or archived or not (`pastWaterNote` in shared). Other notes stay.
6. The daily tidy-up (`tidyOld`, from `RETENTION_DAYS` in shared): `email_outbox` after 90 days, spent or expired `password_resets` after 7, the raw text of `webhook_events` after 365 (the row stays), `link_clicks` after 396, and `data_requests` and settled `copyright_notices` after 1,095.
7. Security alerts (`securityAlerts`, alerts.ts): from the last fifteen minutes of `app_logs` and `audit_logs`, a note to every admin's inbox when there are 20 or more failed sign-ins, 100 or more answers of 429, 20 or more server errors (5xx), or any role or permission change; each kind at most once an hour per admin (the inbox id carries the kind and the hour); counts only, never a name or a request. A failure here never stops the rest of the run.
8. Event reminders (`sendEventReminders`, engage.ts): a day before and an hour before every Party event, circle table and run someone signed up for, once each through `event_reminders`.
9. Close last month's leaderboard season once (`closeSeason`): its top three go to `season_results` and get the `season_top` honor.
10. Post-purchase sequences into inboxes (`runSequences`).
11. Monthly recurring finance entries (`runRecurring`).
12. Circle tables set two days out, and the next weekly occurrence opened (`matchDueCircles`, `rollWeeklyCircles`).
13. Money orders nobody paid for within half an hour are closed (`expired`), so the product is buyable again.
14. YouTube numbers refreshed for content items not synced in six hours (twenty at a time) and for YouTube reward submissions with no automatic reading in the last six hours (twenty at a time), when a key is set.

Three rules of the reminders:

- **Water has its own rhythm.** The choices are two or four hours (`WATER_EVERY_CHOICES` = 120, 240; migration 0058 moved shorter choices to 120 and anything from 121 to 239 to 240). A reminder waits for "time since the last water note" to reach the choice less five minutes, because the next two-hour tick lands a few seconds before the two hours are up. Water is one inbox line per person per day: each reminder rewrites it with the new count, back to unread, newest first, and clears `archived_at`, so an archived line comes back.
- **The last tick of the day is 23:45 (`LAST_TICK`).** A reminder set for 23:46 to 23:59 goes out at 23:45 and not at 00:00, when its day has already turned over. It applies to the daily reminder, custom reminders, task reminders and review reminders.
- **Each goes once.** The ids are fixed (`task-<id>-<day>`, `review-<id>-<day>`, `water-<user>-<day>`), and custom reminders keep `last_sent_day`.

After the run: a line in `app_logs` if anything was done, `pruneLogs` (log lines older than thirty days), `pruneVitals` (`web_vitals` rows older than 90 days) and `session_evictions` rows older than thirty days are deleted. Locally `pnpm dev` passes `--test-scheduled`, so `GET /__scheduled?cron=*+*+*+*+*` runs both halves by hand (the smoke test does this for the reminders, and also runs the two-hour trigger on its own).

## 8. Environments, deployment and checks

- Development: `pnpm dev`, web on 5173 proxying `/api`, `/go` and `/out` to the Worker on 8787 with a local D1 under `.wrangler`. Secrets in `apps/api/.dev.vars`; `.dev.vars.example` lists every key, among them `PUBLIC_URL` (the site's address, used for the reset link, the unsubscribe link and the Origin rule), the business details (`BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_REG`, `BUSINESS_VAT`) and the copyright agent (`DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, `DMCA_REGISTERED`). Anything the legal pages say about the business comes from those variables, never from code, and reads "Being set up" until the owner sets them.
- Smoke: a second Worker on 8788 with its own database under `scripts/smoke/state`, started by `scripts/smoke/blueprint.sh` (`--fresh` wipes the database, `--keep` leaves the server up). `scripts/smoke/smoke.mjs` imports the shared model straight from TypeScript and, at the last run, made 910 checks (the shared package has 209 Vitest tests); it serves a stand-in model on 8799 so the assistant checks never pay for a model. Test accounts live only there.
- Probes and drives (puppeteer-core driving the installed Chrome, over `shots-all.mjs`'s list of about a hundred routes): `shoot.mjs` takes the shots; `orphan-probe.js` (no word alone on the last line, must be 0 on a laptop), `overflow-probe.js` (nothing past the screen at phone width), `contrast-probe.js` (text on its real background, in dark mode); `drive-signup.mjs`, `drive-keep.mjs`, `drive-talk.mjs`, `drive-cards.mjs` (cards stay on the table when focus mode is left), `drive-scroll.mjs` (no tab or toggle throws the page back to the top), `drive-headings.mjs` (every section heading and its action are level, and a link action has its chevron), `drive-home.mjs` (Home's paired halves are one height at 1100, 1280 and 1600 pixels) and `drive-plan.mjs` (the Plan my week sheet; it sweeps its own leftover tasks at the start and the end). `scripts/scan.sh` runs the spacing, colour, link, old-name and image-alt scans (it now fails on an `<img>` with no `alt`); `scripts/flesch.py` scores reading ease. Added by the launch pass: `scripts/smoke/csp-browse.mjs` (browses the routes and sheets and reports any policy violation; 102 routes, 0 messages), `scripts/smoke/perf-probe.mjs`, `scripts/check-exposed.sh` (asks for hidden, backup and config paths and expects 404), `scripts/perf-budget.mjs` (`pnpm perf:budget`, the size budget for the built web app), `scripts/licences.mjs` (writes `apps/web/public/licences.json`) and `scripts/hooks/pre-commit` (a secrets check, written but not installed).
- Production: `pnpm deploy` builds the web app and runs `wrangler deploy`. Secrets with `pnpm cf:secret <NAME>`. Migrations with `pnpm db:migrate` (run it before the deploy that needs them). Logs with `pnpm cf:logs`. Wrangler observability is enabled.
- The PWA: `vite-plugin-pwa` with `autoUpdate`, `skipWaiting` and `clientsClaim`, so a deploy replaces a cached page on the next load; `/api/*` is never served from the shell; the fonts are the site's own woff2 files and are precached with the rest (no request to Google Fonts); the start page is `/today`.
- There is no staging environment. A restore procedure is written (`docs/security/RESTORE.md`) but has not been rehearsed; D1's own point-in-time recovery is what it leans on. Alerting is the inbox note from `securityAlerts` (7 in the cron) and nothing outside the app.
- Feature flags switch any module off in production without a deploy (Admin, Flags), and the API refuses it at once.

## 9. Anti-patterns, checked

- One mega-prompt: avoided; DECISIONS shows the slices.
- One giant component or table: avoided; 58 migrations, one route file per module, screens built from `Screen`, `Section`, `StatTile` and the charts, one `DataTable`, one `Pager`, one `KanbanBoard`.
- Frontend-only authorization: avoided; roles, ownership and module flags are all server checks, and what a client may see at a link is removed on the server (`invoiceForClient`, the parts of `PortalView`).
- Hard-coded access in components: avoided; `Gate` reads `access` from `/api/me`.
- Payment state in a mutable user field: avoided; `orders` plus `webhook_events`.
- Keys in client code: avoided; secrets are Worker bindings.
- Two versions of one action: avoided; the assistant, Agency and the coach call the same code the screens call.
- Ingesting the books into AI: avoided.
- Switching frameworks: the stack has not moved since it was fixed.
- Native app first: avoided.

## 10. Headers, origin and exposed paths (the launch pass, 2026-11-01)

- **Two header sources, one policy.** Static files get their headers from `apps/web/public/_headers`; the pages the Worker answers itself (the site home, the blocked paths) get the same set from `PAGE_HEADERS` in `apps/api/src/headers.ts`; API answers get Hono's `secureHeaders()` (a policy of `default-src 'none'`). A smoke check compares the first two. The page policy (`CSP`) allows scripts only from this site and Razorpay's checkout, styles from this site and inline, fonts from this site, pictures from any https address, video only in the YouTube and Vimeo players, no plugins, and `frame-ancestors 'none'`. It has been enforcing since 2026-11-01 (the name of the header is one constant, `CSP_HEADER`, to go back to report-only if ever needed). Also set: HSTS for two years with `includeSubDomains` and no preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (and `no-referrer` on `/signin/reset`), `Permissions-Policy` with camera and microphone off and geolocation for this site only, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. `csp-browse.mjs` found no violation over 102 routes. Not tested against the policy: a real payment through bank pages, UPI and 3-D Secure.
- **No CORS.** The app and its API are one origin, so `Access-Control-Allow-Origin: *`, which was on every API answer, is gone.
- **The Origin rule.** A write (anything but GET, HEAD or OPTIONS) that carries an `Origin` header must come from the request's own host, the host of `PUBLIC_URL`, or a loopback address while the request itself is to loopback (`originAllowed`); otherwise the answer is 403 `wrong origin`. A request with no `Origin` (a script, a webhook, the smoke tests) passes, and `/api/webhooks/*` skips it because each webhook verifies its own signature. Auth is a Bearer header, so this is a second layer, not the first.
- **Cache-Control.** `cachecontrol.ts` chooses it in one place: `public` for anonymous answers that are the same for everyone (a minute in the browser, five at a shared cache, stale for ten more), `immutable` for an uploaded picture (a year), `none` (`private, no-store`) for anything personal. An authenticated answer is `no-store`; an error is never kept public.
- **Blocked paths.** `blockedPath` (headers.ts) answers 404 with `no-store`, never the app shell, for hidden files and folders (any segment starting with a dot), repository and editor folders, backups and dumps, config and project files (`package.json`, `wrangler.*`, `tsconfig.json`, `.env`), `.map`, `.sql` and the like, and `/src`, `/logs`, `/tmp`. `/.well-known/` is left alone. `run_worker_first` in `wrangler.jsonc` sends those paths to the Worker so the static-asset layer does not answer them with the SPA shell; `BLOCKED_PATTERNS` and `wrangler.jsonc` are kept in step by hand.
- **Fetching an address a person gave.** `safeurl.ts`: `publicHttpsUrl` refuses anything but a public https address (no login in it, no IP number, no `localhost`, internal or wildcard-DNS name, no port but 443), and `safeFetch` follows at most three redirects, checking each hop, with a time limit and a size cap. Every fetch in `reach.ts` of a research link goes through it. It cannot look a name up in DNS (a Worker has no resolver), so a public name that points at a private address is not caught here; a Worker cannot reach private networks anyway. `httpUrl` in `db.ts` checks the typed meeting, replay, video and event links.
- **Other pieces.** The reset link is built from `PUBLIC_URL`, never from the Host header; a "password changed" mail follows a reset and a change; the reset mail's body is not kept in the outbox (`private: true`); the Razorpay webhook signature is compared in constant time. The security notes are `docs/security/` (`SECURITY_REPORT.md` has the 27 checks and 7 bonus checks with evidence, plus `SECURITY_MAP`, `SECURITY_RUNBOOK`, `SECRETS` and `RESTORE`).

## 11. Performance as built (the launch pass, 2026-11-01)

The 31-point list, its budgets and the query counts are in `docs/performance.md`.

- **Pages load when opened.** Every screen is a `lazyNamed(() => import(...))` (`lib/lazy.ts`); a failed download reloads the page once (a guard in `sessionStorage`, so it never loops) and then shows a short line instead of a blank page. While a screen downloads, `RouteFallback` keeps the page frame. The entry chunk went from 2,488 kB to 417 kB raw (703 to 119 kB gzip), and the first download is about 421 kB gzip. `vite.config.ts` splits the libraries into their own files (`vendor-react`, `vendor-query`, `vendor-gsap`, `vendor-motion`) and the shared model into one (`shared`, one 690 kB file that cannot be split without splitting the package). `pnpm perf:budget` fails the build over 480 kB for the entry, 1,500 kB for the first download or 400 kB for any other chunk (the vendor files are exempt).
- **Fewer, quicker requests.** TanStack Query keeps an answer fresh for 30 seconds and retries once, never for a 4xx. A search box waits (`useDebounced`). A picture is shrunk to WebP in the browser before upload and images load lazily. The browser reports its own timings once, when the page is hidden (`lib/vitals.ts`, to `POST /api/public/vitals`).
- **The API waits less.** Independent reads run together (`Promise.all`) on Daily, the Home brief, Pillars, the inbox, the feed, Profile, the leaderboard, a public page and Explore; fan-outs are one batch (`notifyMany`, `withSubtasks`, `mediaForListings`, and the data export, which went from 55 round trips to 2); the module gate keeps the flags and overrides for 5 seconds (`ACCESS_TTL_MS`) and an admin change drops them at once on that instance (`forgetAccessContext`). Every call out of the API goes through `fetchT` with a named timeout (`TIMEOUT` in `http.ts`: quick 5 s, payments 15 s, research 15 s, assistant 60 s, strategist 90 s) and is never retried, so a payment or a send cannot run twice because a clock ran out. A plain read over 1.5 seconds (`SLOW_READ_MS`) is logged as a warning. The Anthropic SDK is loaded on first use, not at cold start.
- **Placement.** `"placement": { "mode": "smart" }` in `wrangler.jsonc` runs the Worker near the database, since nearly every request makes several round trips to it.
- **Indexes.** Migration 0060 (see 04).
- **Left open on purpose:** the public pages are drawn in the browser, not on the server; the assistant answers once and does not stream; `track()` and `sendEmail()` are awaited inline (a call to `ctx.waitUntil` would take them off the person's tap).

## Known gaps

- No staging environment. A written restore procedure that has not been rehearsed. Alerts reach the admins' inbox only.
- No idempotency key on checkout beyond the one-order-per-product rule.
- No purge for `analytics_events`. (The cron now also tidies `email_outbox`, `webhook_events` payloads, `link_clicks`, `password_resets`, `data_requests`, copyright notices and `web_vitals`; see 7.)
- A PDF of an invoice or an agreement is the browser's print and save, because a Worker cannot make one.
- Calendar sync is one way (tasks and reviews appear in a calendar; nothing changes back), and there is no two-way link to Google, Outlook, Slack or meeting-note tools.
- Reported in the 2026-11-01 bug sweep and not changed, because each needs a decision:
  - `/orgs` is not in `MODULE_FOR_PREFIX`, so it is treated as core and always open, even when Army is off for the person (see 05).
  - (Closed by the launch pass: `POST /public/client-error` is now registered after the rate-limit loop, so the `clientError` limit runs.)
  - `POST /me/password` is not in `ROUTE_LIMITS`, and it compares the current password with `!==` instead of the constant-time compare used at sign-in.
  - Invoice status can move between any two states (draft straight to paid books the income).
  - Under simultaneous requests, a store checkout can create orders with one debit; School and Party enrolment debit points with no `points >= ?` guard; a coupon use is spent before a checkout that then fails.
  - Party: a host cancelling an event says points are refunded but refunds nothing, and promoting someone off the waitlist never charges them.
  - Dates and numbers that use UTC day edges instead of the person's zone: Agency's `approved_day` for a client's approval, and the Reviews numbers (`fromTs`, `toTs` in `reviews.ts`).
  - `getStats` counts a Club badge for membership statuses `accepted`, `member` and `active`, but reviewers set `approved`.
  - A community mute uses `INSERT OR REPLACE`, so muting again resets the muter's rank; Bond chat messages have no block check.
  - Uploaded media can never be deleted (the cap is 60).
  - A few screens ignore a failed mutation (Agency and review buttons) and keep stale error text when a sheet reopens.
  - A KPI target of 0 means "no target".

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October, 25 migrations, about 110 tables) to the app as it stands: 57 migrations and 177 tables, 46 modules. New since then: the strategy session, the setup chat, the assistant with credits and plans, coaching, attendee codes, engagement (reactions, pins, event reminders, seasons), media and event extras, anonymous threads, water and reminders, card games, Discover and its add-ons, the app's own log, focus rounds and their settings, task dates, repeat, priority and subtasks, the device cap, Agency (clients, deliverables, time, invoices, agreements, templates, the client link), business metrics, the private calendar link, and scheduled reviews with reminders.
- 2026-11-01: the request flow now has the module gate and the per-person limits written out in order; the public routes are listed in one place (6); the cron lists all eleven jobs; and the Club-only Work gap from 0.3 is closed.
- 2026-11-01 (later): bug sweep and water pass. The cron now has two triggers (the fifteen-minute one and a two-hour one that sends only water), `LAST_TICK` 23:45 for late reminders, and `clearPastWaterNotes`; migration 0058 makes two hours the shortest water gap (58 migrations, still 177 tables). New guard patterns are written down in section 3 (guarded `UPDATE`, then `meta.changes`; status-first pay and refund; `byKey`; real-day checks), and the reported-but-not-changed list is under Known gaps. Counts: 857 smoke checks, 209 shared tests.
- 2026-11-01 (later, the legal, security, performance and accessibility pass): 60 migrations and 183 tables (0059 legal records, 0060 indexes and `web_vitals`). New sections 10 and 11 describe the two header sources and the enforcing content security policy, the Origin rule, the removal of CORS, `no-store` for personal answers, blocked paths, the address guard, lazy-loaded pages with a size budget, outbound timeouts, the module-gate cache and Smart Placement. New files in `apps/api/src`: `headers.ts`, `safeurl.ts`, `http.ts`, `cachecontrol.ts`, `alerts.ts`, `routes/legal.ts` and `routes/vitals.ts`. The cron gained `tidyOld`, `securityAlerts` and `pruneVitals`. Three limits were added (`vitals`, `notice`, `unsubscribe`): 37 named limits and 90 routes. New Worker variables: `PUBLIC_URL`, `BUSINESS_*` and `DMCA_*`. Fonts are self-hosted and the PWA no longer fetches Google Fonts. Counts: 910 smoke checks, 209 shared tests. Reading list: `docs/security/SECURITY_REPORT.md`, `docs/performance.md`.
