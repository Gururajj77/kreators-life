# 03 — System architecture

Last updated: 2026-11-07

**Product:** kreators.app
**Version:** 0.7, reconciled with the app on 7 November 2026
**Source of truth:** the code under `apps/` and `packages/`, `CLAUDE.md` for the rules, `docs/DECISIONS.md` for why.

## 1. What was chosen

A modular monolith, as v0.1 recommended, on a fixed stack the founder set on 23 October 2026. It has not moved since:

- `apps/web`: React 19, Vite 7, Tailwind 4, React Router 7, TanStack Query, Zustand, GSAP (new motion; `motion/react` only where it already is, inside one `LazyMotion`), `lucide-react` (every icon), `react-useanimations` (the line animations, loaded after the first paint), `vite-plugin-pwa` and `qrcode`. The public site and the app are one build, split page by page (see 11). The type is one family, Google Sans Flex, self-hosted as two woff2 files (latin and latin-ext). Caveat stays only for a guide's handwritten line on the public site.
- `apps/api`: Hono on a Cloudflare Worker with a D1 database (`wrangler.jsonc`: compatibility date 2026-10-01, `nodejs_compat`, observability on, Smart Placement on, one cron trigger every fifteen minutes). The Worker serves the built web app as static assets, so one deploy ships everything. It runs first for `/`, `/api/*`, `/go/*`, `/out/*`, `/__scheduled` and `/sitemap.xml`, and for a list of paths that should hold nothing (hidden files, backups, dumps, config and project files; see 10). Everything else is a file or the SPA shell. Its only runtime dependencies are `hono` and `@anthropic-ai/sdk`.
- `packages/shared`: the domain model both sides import straight from TypeScript, with Vitest tests. It has no runtime dependencies of its own. Since the wave 9 cleanup (2026-11-04), `src/index.ts` is only a barrel: 49 lines of `export * from './<domain>.ts'`, in load order, over one file per domain (core, pillars, rewards, work, community, dates, api, events, store, badges, tasks, periods, money, invoice, contract, agency, design, discover, insightPlaces, legal, books, terms and the rest). The `.ts` extensions stay, because the smoke scripts load the barrel with Node's strip-types. A top-level constant may only call a function declared with `function` or defined above it. Twelve files are their own subpath exports and stay out of the barrel (`@kreators/shared/<name>`): `journalPrompts`, `agencyEmail`, `focusRun`, `ladderChoices`, `blockHints`, `gratitude`, `lessonResources`, `fitness`, `help`, `coachReport`, `insights` and `lifeDashboard`. See 11 for which of them are a chunk of their own and which the web app reads only as types.
- What shared holds: relationships, the pyramid, xp and waits, questions, modules, flags, roles and permissions, periods, repeat rules, money, time zones and slots, matching, listings, commerce, finance, the invoice calculator and contract templates, Agency's stages, team and paper rules, the week plan, Emerging's types and each place's share (`insightPlaces.ts`), the legal lists, the books and the glossary (`terms.ts`). The review questions (`reviewPrompts.ts`) are read only by the API, so the web build leaves their words out. Discover's answer keys are not in it: they live in `apps/api/src/discoverKeys.ts`, so the web page never carries the best answers.
- Two small helpers serve the whole app: `byKey` (builds every `*_BY_KEY` lookup with no prototype, so a typed key such as "constructor" finds nothing) and `typedCents` (reads a typed amount from its digits, never through a float).
- A pnpm workspace. No ORM; plain SQL migrations in `apps/api/migrations` (0001 to 0128, 122 files; the numbers 0090 to 0094 and 0107 were never used), applied with wrangler.

## 2. Logical layers

```text
Public site + app (React, one build split page by page, PWA)
          |
          v
Worker entry: a root Hono app
  a path that holds nothing (hidden file, backup, dump, config) answers 404 here (headers.ts, blockedPath)
  /go/:code, /out/:kind/:id, /sitemap.xml and the site home "/" (routes/go.ts), outside /api, with the page headers from headers.ts
  then the app, basePath /api:
    a request id (X-Request-Id), the Origin rule for writes (403 "wrong origin"), secureHeaders,
    Cache-Control (no-store for anything personal), logger (the app's own log: app_logs). No CORS.
    /health
    limits on the doors without a session (/auth/*, /public/* and /admin/*), per address
    POST /public/client-error (after those limits, so its own limit runs)
    /auth, /admin (its own check: the admin key or an admin's session), /public/* (see 6), /webhooks
      a team link session is refused on the client link and paper routes (refuseTeamSession, 404)
      a client's password gate in front of the agreement, invoice and document links (portalDocGate)
    ---- everything below needs a session ----
    Bearer session -> c.get('user')   (a token signed out for a fourth device answers 401 with reason "devices")
    module gate: 403 when none of the path's modules is available to the person
    the rest of the limits, per person
    the Agency team gate (X-Agency-Team: checked on every request, runs as the owner, answer cut down)
    the route files (apps/api/src/routes/*.ts, 75 files), mounted in index.ts
          |
          +---- access.ts   flags, overrides, rollout, role -> access per module; the prefix map the gate uses
          +---- limits.ts   every rate limit, with the route it guards
          +---- db.ts       can(), isGuide, isStaff, orgRole(), audit(), notify(), notifyMany, inBatches, pageOf/paged, str/num/oneOf,
          |                 dayFromDevice, DATE_RE, httpUrl, currencyOf, liveUser, badges and getStats
          +---- ops.ts      rate limits (rateLimit), the admin key's door (adminKeyDoor), email outbox, timeline, analytics
          +---- notes.ts    noteStmt: the one statement that writes an inbox note, its kind an InboxKind
          +---- logs.ts     the app's own log (what changed, what was refused, what broke); never a body or a query
          +---- account.ts  delete an account (the person's own and an admin's use the same function)
          +---- rewards.ts  social rewards, capped and paid once
          +---- unlocks.ts, attendee.ts, coaching.ts, coachReport.ts, credits.ts, discounts.ts, admins.ts, social.ts, sitemap.ts, discoverKeys.ts,
          |                 fitness.ts (one movement action, two doors), timeBlocks.ts, liveCall.ts
          +---- Agency:    agencyStats.ts, agencyCycles.ts (retainer months), lifecycle.ts (stages), agencyPaper.ts, agencyUtil.ts,
          |                portalAccess.ts (client link password and sessions), teamLinkAccess.ts, agencyTeamAccess.ts
          +---- headers.ts  the page headers and the content security policy, blockedPath, originAllowed (see 10)
          +---- safeurl.ts  publicHttpsUrl and safeFetch: the one guard for any address a person influenced that the Worker fetches
          +---- http.ts     fetchT and the named timeouts (TIMEOUT): every call out of the API has a clock and is never retried
          +---- cachecontrol.ts  cache('public' | 'immutable' | 'none'): the one place a Cache-Control line is chosen
          +---- alerts.ts   securityAlerts: counts from app_logs and audit_logs, a note to every admin's inbox, once an hour per kind,
          |                 and one private email with each new note
          +---- payments.ts the provider interface (test, Razorpay)
          +---- reach.ts    research: Agent Reach over the bridge, page reads and YouTube as fallbacks
          +---- strategist.ts the writer: Claude by SDK, Workers AI, or a labelled digest
          +---- assistant/  tools.ts (each tool is a description over an existing route), dispatch.ts (runs it through app.fetch
          |                 as the person), model.ts (any OpenAI-compatible endpoint), run.ts (the loop the Companion shares)
          +---- cron.ts, engage.ts   one trigger, every fifteen minutes (see 7)
          |
          v
D1 (SQLite): 117 migrations, 226 tables
          |
          v
Adapters: Razorpay, Resend (through the outbox), YouTube Data API, Meta webhooks, Workers AI (optional),
the Anthropic SDK (the content strategist's writer), an OpenAI-compatible endpoint for the assistant and the
Companion (OpenRouter by default), the Agent Reach bridge (research, scripts/reach/server.mjs)
```

## 3. Module boundaries as built

- A module is one entry in `MODULES` (shared; 47 of them, in six groups: Contribution, Reflection, Connection, Creation, Essentials and Operations), one route file or a few, its own tables, and one or more screens behind `Gate`. Agency is the largest: `agency.ts`, `agencyDocs.ts`, `agencyLife.ts`, `agencyOther.ts`, `agencyTeam.ts`, `teamLink.ts` and `kpis.ts`, plus `adminAgency.ts` for the house templates. Its rules live in shared where both sides need them (`notToDoStreak`, `periodFor`, `slotsFor`, `unlockFor`, `runEntryState`, `bountyPayout`, `trustScore`, `invoiceTotals`, `planWeek`, `projectPace`, `occurrencesBetween`, `scoreDiscover`, `parseTeamAccess`), or in a subpath export (`insightsFor`, `gratitudeOfferFor`, `parseMove`, `coachSuggestions`).
- Shared entities (users, sessions, organizations, points, xp, notifications, audit) belong to the core and are reached through `db.ts` helpers, not re-implemented.
- Modules read each other's tables only for the views that are meant to: Home (`GET /home`, one call), Life (`life.ts` scores from wellbeing, finance, nodes, runs), Reviews (`numbersFor` pulls one period from every app's table, `flaggedFor` the tasks brought to it, `agencyMetric` the business numbers), Search, and Emerging (`GET /insights`, see 4).
- Emerging is core and has no line in `MODULE_FOR_PREFIX`. It reads only while every app a signal needs is on, and never sends the reads for an app that is off.
- One action, two callers. The assistant never has a second version of an action: every tool in `assistant/tools.ts` is a description over an existing route, and `dispatch.ts` runs it inside the Worker with the person's own Bearer token (`app.fetch`). So the session, the module gate, the limits, the waits, the xp caps and the owner filters apply exactly as to a tap. The Companion reads through the same app the same way, and only through its read tools. The rule also holds for Agency's use of Army (`uploadVersion` from `army.ts`) and of Finance (`createInvoice`, `setInvoiceStatus` and `restoreInvoice` from `finance.ts`), for a coach's tasks (`createNode` and `editNode` in `nodes.ts`), and for movement (`logMoveFrom` and `removeMoveFrom` in `apps/api/src/fitness.ts`, called by Fitness and by Kreators Run's own tool).
- Money and points move only through `points_ledger`, `orders` and `xp_events` (credits through `credit_ledger`; a creator's own books are `finance_transactions`). Nothing writes a balance directly except through those paths.
- Race-sensitive writes use D1 batches and unique indexes: one booking per slot, one application per listing, one registration per event, one review per period, one entry per run, one open offer per buyer, one open coaching link per pair, one claim of a code per person, one focus round per `clientRef`, one retainer month per `(retainer_id, month)`, one open password ask per client and link, and a pay-out capped inside the batch that pays. Migration 0067 adds two unique indexes as the last guard: one paid question per order and one income line per invoice.
- Guards against double pay and double refund. A write that moves points or money first makes one guarded `UPDATE`, then checks `meta.changes`, and goes on only when it is 1. The Store checkout, School enrolment and a Party RSVP take points with `WHERE points >= ?`. Rewards cancel moves the redemption out of `reserved` first. A Win payout moves the submission out of `verified` first. `refundOrder` flips the order to `refunded` before it credits anyone. Settling a due moves it out of `open` first. Marking an invoice paid, voiding it and restoring it each move the status first, guarded on the status that was read. A host cancelling a Party event moves the event first, then each guest's row, and refunds only what each row paid. A discount code's use is taken first and given back if the order fails.
- Real days only. `DATE_RE.test` in `db.ts` checks a day against the calendar (2026-11-31 and 2026-00-00 are refused, never a 500). `parseRepeat` drops an `until` that is not a real day. The person's day still comes from the device (`dayFromDevice`).
- Loops of one query per row go fifty to a round trip through `inBatches`. D1 runs each fifty as one transaction, so only idempotent writes share a batch.

## 4. Cross-module flows as built

- **School to Work:** completion sends an inbox note pointing at Work. No automatic eligibility or grade disclosure.
- **Army to Work:** a campaign can be made public as a listing; applications stay on the opportunity.
- **Army to Agency:** a client can be served through an Army campaign the person is an accepted creator on. `POST /agency/clients/:id/army-import` brings its deliverables in; `…/items/:id/army/send` goes through Army's own `uploadVersion`; `…/army/sync` brings the brand's answer and feedback back as a note. All of it is refused while Army is off for the person.
- **Agency to Finance:** an Agency invoice is a row in `invoices`, made and paid through the shared helpers, so Agency does not need Finance switched on. Marking one paid books the income in `finance_transactions`; taking a paid one back out removes it. Restoring a voided paid invoice books the income again once.
- **Agency to Daily, Search, the brief and the calendar link:** each only while Agency is on and owner only. Daily lists pieces and invoices due. Search finds clients and invoices. The brief knows waiting client changes, a retainer month made today and due pieces. The private calendar link carries due and go-live days with the title and client only.
- **Agency to its team:** a member works on the owner's Agency through `X-Agency-Team`. The gate reads the member's row on every request, opens only the routes on `TEAM_ROUTE_RULES`, runs the route as the owner and scrubs the answer. The member's side lives under `/me/teams` and is core.
- **Agency to Reviews:** business metrics (`kpis`) are typed in each period or read from Agency (`agencyStats.ts`). Scheduled reviews show in the private calendar link.
- **Daily to Reviews:** a task flagged `for_review` is listed in the review for its period, and a saved review keeps the list it was saved with. The scheduled review's inbox note says how many are waiting.
- **Daily to Mindfulness:** Start focus opens the focus clock with the task and its estimate. Daily's time blocks show a faint bar for a task with focus sessions today.
- **Party to Bond:** feedback carries a networking opt-in; Bond suggests people met at events only when both opted in; an introduction needs consent before anything is shared.
- **Circles to Bond:** a table member can open an alias chat from the table; ids never reach the browser.
- **Club to Party and Work:** club-only events are enforced in Party. Club-only Work listings are enforced too (`opportunities.club_only`): listed, opened and applied to only by an approved, unexpired member (`isClubMember`).
- **Run to Life:** a logged run's minutes are a `move` wellbeing log, so the physical score counts them.
- **Run to Fitness:** Kreators Run's own tool (`/run/move`) and Fitness write the same `move` log. It works with Fitness off and pays nothing.
- **Mindfulness to Life:** a finished focus session is a `mindful` wellbeing log by default, and a finished break only if the person switches that on (`logFocus` and `logBreaks` in their saved settings). A finished breath always logs. A round that counts writes its log in the same batch and keeps its id (`log_id`), so a change or a delete moves the log with it. Focus rounds themselves (`focus_rounds`) feed only the focus dashboard.
- **Coaching to Daily and Pillars:** a coach sees what a student shares, read fresh on every request while the link is active and the permission held; the coach's tasks are made and changed through the student's own `createNode` and `editNode` and wear a "From your coach" tag.
- **Coaching to Reviews and Emerging:** the student report (`GET /coach/students/:id/report`) builds on `summaryFor` and lets through only `COACH_PERIOD_FIELDS`. Patterns (`GET /coach/students/:id/patterns`) run the Emerging rules on read over facts built only from the parts that link shares, only while the student's own Patterns switch is on.
- **Time blocks to Daily, Plan my week and Emerging:** a day's template gives the blocks; a task sits in the block picked, else the one its time falls in, and `suggestBlock` offers one for the rest. Nothing is written before a tap. `kindsOfDays` in `dayKinds.ts` is the one reading of a day's kind for Emerging, Reviews, the month calendar and the Time blocks page.
- **Everything to Emerging:** `GET /insights` reads the person's own rows across apps, computes patterns on read and stores nothing. The journal is read only by when an entry was written, gratitude only by which days have it, wellbeing only by kind, day and number, money only in the person's own currency. `GET /insights/dashboard` builds on `numbersFor` and `layerFor`. Nothing reaches the assistant, staff or the leaderboard, and a coach only through the one consented door above.
- **Everything to Reviews and Home:** read-only period numbers. `numbersFor` reads a period in the person's own zone (`periodWindow`). Home's daily brief (`briefFor`) is rules only, so it costs no credits.
- **Inbox to every app:** every note is written by `noteStmt` with a kind from `INBOX_KINDS`, which sits in exactly one tab (`inboxTabOf`). A note's link opens the page and lands on the section (`useLandOnHash`, see 10b).
- **Wellbeing, Journal and Discover to nothing:** never to the public page, brands, staff, the leaderboard, Dev Tools or Club selection. Enforced in `pageFor`, `internal.ts` and the Rank query; proven by the smoke test. The journal, gratitude and Discover never reach a coach; wellbeing numbers do only under the student's own Reflection switch. Only a short Discover summary reaches the assistant, and only for a model that keeps nothing, while the person's own switch is on.

## 5. API conventions as built

- Every answer carries `X-Request-Id`, and the same id is in the log line and in the body of a server error, so a report can be traced. Every answer is JSON, except the private calendar (`text/calendar`), the sitemap and the media bytes.
- Errors are a flat `{ "error": "<plain words>" }` with the status:
  - 400 for a bad request.
  - 401 without a session (`reason: "devices"` for a device pushed out by a fourth). A client link with a password answers 401 `locked` until it is unlocked.
  - 403 for a role, ownership or module refusal (the module refusal also carries `module`), and 403 `wrong origin` for a write from another site (see 10).
  - 404 for not found, also used instead of 403 where existence should not leak.
  - 409 for a duplicate, or `changed` when another tab saved a paper first.
  - 410 for a client or team link that was renewed or closed (`closedLinkAnswer`), with who to ask.
  - 429 for a limit, 500 for "something broke on our side". The v0.1 `{ error: { code, message } }` envelope was not adopted.
- Inputs are coerced and bounded by `str(value, max, fallback)`, `num(value, fallback, min, max)` and `oneOf(value, list, fallback)` on every route. Shared holds the one reader for anything stored as JSON (`parseRepeat`, `parseFaq`, `parseLinkBlocks`, `parseFocusSettings`, `parseInvoiceDoc`, `parseContractDoc`, `parsePortalShow`, `parseTeamLinkShow`, `parseTeamAccess`, `parseAppPrefs`, `parseDatePrefs`, `parseOnboarding`, `parseGratitudeLines`, `parseSupplement`, `parseCoachSections`, `parseLessonResources`) and the one rule for each password, phone and date of birth. No validation library.
- Every list a person scrolls is a page at a time: `?page=N&size=S` with S in 10, 25, 50 or 100 (the bar offers 10, 25 and 50; 100 is for pickers and the guest list at the door). Since 2026-11-07 every list that can pass about fifty pages, ten by default for the newly paged ones (`TEN_A_PAGE`), and each route reads the prefix its screen sends. `pageOf` and `paged` in db.ts fetch one row more than the size, so `page.more` says whether a next page exists. A screen with two lists prefixes the second (`lpage`, `lsize`). A kanban column is a page of its own with "Show more" (`?per=`). A chat list uses a cursor and "Load earlier", since a chat reads from the bottom. The public Explore list keeps a bound of 200 live rows per kind on purpose.
- The person's day comes from the device, never from the server's clock: a request that depends on "today" carries `?day=YYYY-MM-DD` (`dayFromDevice` accepts a day up to one day ahead of UTC and otherwise falls back to the UTC date). Ticks, focus rounds, water, time entries, settled dues and the Agency month all follow it.
- Idempotency:
  - Webhooks insert their event id with `INSERT OR IGNORE` into `webhook_events` and stop on a duplicate.
  - A checkout refuses a second order for the same product.
  - A focus round carries the browser's `clientRef`. A duplicate answers 200 with the first id and `duplicate: true`.
  - Notes have a fixed id so each goes once: `task-<id>-<day>`, `review-<id>-<day>`, `focus-<user>-<day>`, `supp-<user>-<time>-<day>`, `checkin-<user>-<day>`, `agency-due-<user>-<day>`, `invoice-<id>-due` and `invoice-<id>-late`, `pwreq-<client>`.
- Rate limits are a `rate_limits` row per key (`name:address-or-person`) counted in a fixed window. Every number and the route it guards is one line in `apps/api/src/limits.ts`. `LIMITS` holds 63 named limits and `ROUTE_LIMITS` 262 method and path pairs (05 §13 lists the new ones). index.ts wires them: the doors without a session per address before the session check, everything else per person after it. A few pairs count the address on a signed-in door (`by: 'address'`), and a few count only when the body carries something (`when`).
- What the limits are today:
  - Sign-in: 10 a minute per address, plus 20 per email per quarter hour. Sign-up, forgot and the device start per hour; a reset link at most 3 an hour per email. Changing the password: 5 per quarter hour (`passwordChange`).
  - Social: posts 10 an hour, replies 30, likes 120, follows 60, chat messages 120, channel lines 180, introductions 20, offers 20, things put up 30, tickets 5, applications 10, run entries 10, code claims 10.
  - Work and models: content research 40 and writing 20, the setup chat 20, the assistant 60, "Read with AI" 30, the Companion 60, coaching asks 20 and writes 60, Discover results 30, uploads 30.
  - Everyday saves: water and reminders 240, saved preferences 240, gratitude lines 240. Reads with a limit: Emerging 240 an hour (`insights`), a coach's report and patterns 300 (`coachRead`) and the coach's lookup 120 (`coachLookup`).
  - Agency: everyday work 600 an hour, lifecycle calls 120, team invites 20 a day, emailed copies 10 an hour.
  - A client at a link: 30 per ten minutes (`portal`). A link's password: 5 tries in ten minutes per address and 20 per client (`portalLogin`, `portalLoginLink`); the team link has the same pair of its own. A new-password ask: 3 an hour per address.
  - Discount codes: 20 checks per ten minutes per person and 60 per address.
  - The shared admin key: 10 tries in ten minutes per address (`adminKey`). A coach's invite link: 60 an hour per address and 300 per coach.
  - The legal doors, per address: vitals 60 an hour, a copyright notice 5, an unsubscribe 30, a client error report 20 per ten minutes.
- Owner-scoped queries filter by the session user id. Staff powers come from `can(user, permission)`; a guide is `isGuide` (`can(user, 'moderation')`). Brand access comes from `orgRole`. A module that is not available to the person is refused before its route runs: `modulesForPath` maps the first one or two path segments to the module keys that own them. A new route file needs a line in that map or it is treated as core and always open.
- The `/go/:code` and `/out/:kind/:id` redirects answer first and write the click in `waitUntil`, with a salted hash of the address and never the address.
- Time is stored as UTC ISO; zone conversion happens only through `zonedToUtc` and `slotsFor` in shared. Money is integer cents or integer points through `money()` and `feeBps()`; the invoice calculator works in whole cents and basis points. A person's sums use only their own currency (`currencyOf`).
- Auth is hand-built on Hono and D1: Bearer session tokens in `sessions` (two UUIDs), PBKDF2-SHA256 at 100,000 iterations with a 16-byte salt, constant-time compare (sign-in and the password change), an answer that is the same for an unknown email and a wrong password, at most three devices at once (`MAX_DEVICES`; `newSession` signs out the oldest and leaves a row in `session_evictions`), and password reset by a one-time hashed link. The client link and the team link reuse the same hashing for their own passwords and keep twelve-hour sessions as SHA-256 hashes.

## 6. Public routes

Nothing here needs a session. The doors that take input are limited per address.

| Route | What it serves |
|---|---|
| `GET /api/public/explore`, `/explore/stats`, `/explore/:type/:id` | the public listings (cached for a minute in the browser, five at a shared cache, and 60 seconds per data centre in the Workers cache when the request carries no Authorization or cookie) |
| `GET /api/public/:handle`, `/people/:id`, `/products/:id`, `POST /:handle/click`, `/:handle/lead`, `GET /config` | a person's public page, a product page, the lead form, the payment config (`routes/store.ts`) |
| `GET /api/public/certificates/:code` | a certificate check |
| `GET /api/public/media/:id`, `/media/for/:type/:id` | uploaded pictures and the media on a listing |
| `GET /api/public/books` | the founder's three books and where each opens (Shop product, School course, Rewards); read only, names nobody |
| `GET /api/public/invoices/:token`, `POST /:token/comments` | a client's invoice, with what the owner switched off removed on the server, and a comment asking for a change (`/i/<token>` on the site) |
| `GET /api/public/agency/:token`, `POST /:token/items/:id`, `POST /:token/retainer` | a client's page, only the parts switched on; approve, send back or comment as far as allowed; choose a retainer length (`/a/<token>`) |
| `GET`, `PUT /api/public/agency/:token/onboarding`, `POST …/onboarding/submit` | the client's one-time onboarding form, saved as they go and sent once |
| `POST /api/public/agency/:token/unlock`, and `/lock`, `/unlock` on `/contracts/:token`, `/invoices/:token` and `/agency/doc/:token` | the client's password, which gives a twelve-hour session sent as `X-Portal-Session`; limit `portalLogin` |
| `POST /api/public/agency/password-request` | a client or their team asking the owner for a new password; the same answer whatever the link; limit `portalPasswordAsk` |
| `GET /api/public/agency/doc/:token`, `POST /:token/approve`, `POST /:token/comments` | another document: read, approve by a typed name, comment (`/d/<token>`) |
| `GET /api/public/contracts/:token`, `POST /:token/accept`, `POST /:token/comments` | an agreement, its typed acceptance, and a comment (`/k/<token>`) |
| `GET /api/public/team-link/:token`, `POST /:token/unlock`, `POST /:token/items/:id` | the team link for the client's own team: the work only, never money or paper (`/t/<token>`); its session is refused on every client link and paper route |
| `GET /api/public/coach-join/:token` | a coach's invite link read signed out (`/coach/join/<token>`): the coach's card, nothing about anyone else; a renewed or closed link answers 410, an unknown one 404; limit `coachJoin` |
| `PUT /api/public/contracts/:token/answers` | a client's brief answers, saved as they type while the agreement is sent; limit `contractAnswers` |
| `GET /api/public/calendar/<token>.ics` | the person's private calendar: tasks with a day, scheduled reviews, and Agency days while Agency is on. Off until switched on; a 24-character secret |
| `POST /api/public/client-error` | a broken screen reporting itself (a short message and where, never who) |
| `POST /api/public/vitals` | a browser's own timings for a page (route pattern, phone or desktop, LCP, INP, CLS, TTFB; no person, no address); limit `vitals`; staff read a summary at `GET /api/internal/vitals` |
| `GET /api/public/business` | the business details the owner set in Worker variables, for the legal pages; an empty field reads "not set yet" |
| `POST /api/public/copyright-notice` | a copyright notice or counter-notice, stored in `copyright_notices` and sent to every admin's inbox; limit `notice` |
| `GET` and `POST /api/public/unsubscribe/:token` | the one-click unsubscribe from marketing mail (limit `unsubscribe`); the token is the person's id and a hash only this server can make |
| `/go/:code`, `/out/:kind/:id`, `/sitemap.xml`, `/` | short links, partner redirects, the sitemap, and the home page with an absolute share image |
| `POST /api/webhooks/razorpay`, `GET` and `POST /api/webhooks/meta` | provider webhooks; each verifies its own signature on the raw body |

The matching site pages are `/`, `/explore`, `/features`, `/features/:key` (Books among them), `/7rp`, `/c/:code`, `/i/:token`, `/a/:token`, `/k/:token`, `/d/:token`, `/t/:token`, the policy pages (`/terms`, `/privacy`, `/refunds`, `/contact`, `/pricing`), the legal pages that need the server or a list (`/subprocessors`, `/copyright`, `/licences`, `/unsubscribe/:token`), `/u/:handle`, `/people/:id`, `/p/:id` and `/coach/join/:token`. A client link, an invoice, an agreement, a document and a team link each rely on a long random token. They are limited per address, a password can sit in front of them, and a fresh link closes the old one. A closed token is kept only as a SHA-256 hash for a year, so it answers 410 instead of 404.

## 7. The cron

**On Workers Free (the founder, 2026-11-07).** One tick has 50 D1 queries and 10 ms of CPU, so it can never do all that might be due. `runScheduled` holds itself to `TICK_TRIPS` (38 round trips and calls out) and `TICK_STATEMENTS` (400 statements), in `cronTick.ts`, and stops cleanly; the rest goes on the next tick. Every job first reads what it has to do, all together (`batchedReads`, usually one trip); a job with nothing to do takes no part. The rest take turns, one at a time: the security alerts first, the others in an order that moves on by one each tick (from the clock, nothing stored), each with an equal part of what is left, and what one does not use passes to the next. So no job can starve the next. While a job has had to leave work, `cron_state` says since when, and the reminders' hour reaches back to then, so a reminder left behind is still caught and nobody's is lost; note ids and `last_sent_day` keep each one once. What needs no more than an hour's accuracy runs only on the first tick of the hour (a run by hand runs everything): the tidy-up, supplement notes of a past day, the season's close, sequences, monthly entries, a retainer's months, stages, the next weekly circle, discount uses given back. A claim and its work are one batch, so a stop can never lose them: a season's close, a month's entry (`WHERE changes() = 1`), an event's reminder, a sequence's message, one circle's tables. `node --experimental-strip-types scripts/smoke/cron-stress.mjs` holds all of this at a thousand people, and stops a tick dead at each of 40 points.

`apps/api/wrangler.jsonc` has one trigger, `*/15 * * * *` (`MAIN_CRON`). `runScheduled(env, cron)` in `cron.ts` does nothing for any other schedule except a run by hand (`* * * * *`, `BY_HAND_CRON`). The old two-hour water trigger went on 2026-11-07, and it can fire once more around a deploy, on the same minute as the main one, so it must not start a second full run.

The fifteen-minute run:

1. The daily reminder (`sendReminders`): anyone whose check-in time has passed within the last hour in their own zone and who has not checked in that day, once per due time.
2. The person's own reminders (`sendCustomReminders`): a reminder goes once on each of its days, within an hour after its time. Water sends no note.
3. Task reminders (`sendTaskReminders`): a task tagged Remember with a day, at its time, once. The date window is applied in SQL (yesterday to tomorrow in UTC), then each task's own zone decides.
4. Review reminders (`sendReviewReminders`): a scheduled review on its day at its time in the person's zone, once; `next_on` moves to the next day the repeat rule falls on, and a day missed while nothing ran is skipped, never sent late. The note links to the period it covers and says how many tasks were brought to it.
5. Invoice notes (`sendInvoiceNotes`): a sent, unpaid invoice gets one note on its due day and one the day after, from 09:00 in the owner's zone. An Agency invoice is noted only while Agency is on.
6. Agency due notes (`sendAgencyDueNotes`): one note a day from 09:00 in the owner's zone for pieces due that day, only while Agency is on.
7. The focus nudge (`sendFocusReminders`): one note on the chosen days, within an hour after the time, skipped when that day already has a focus session. Off until the person sets it. Supplement reminders (`sendSupplementReminders`): one note per person, part of the day and day, within an hour after the time, only while Track supplements and Fitness are on and something of that part is due and not ticked; it names a count, never a name.
8. `clearPastSupplementNotes`: supplement notes of a day that is over, in that person's own zone, are deleted whether read or archived or not (`pastSupplementNote` in shared). Other notes stay.
9. The daily tidy-up (`tidyOld`, from `RETENTION_DAYS` in shared): `email_outbox` after 90 days, spent or expired `password_resets` after 7, the raw text of `webhook_events` after 365 (the row stays), `link_clicks` after 396, channel lines and run discussion lines after 365, a cohort's discussion a whole thread at a time 365 days after its newest line, closed password asks after 90, `rate_limits` windows after 2, notes written to a deleted account afterwards, and `data_requests` and settled `copyright_notices` after 1,095.
10. Security alerts (`securityAlerts`, alerts.ts): from the last fifteen minutes of `app_logs` and `audit_logs`, a note to every admin's inbox when there are 20 or more failed sign-ins, 100 or more answers of 429, 20 or more server errors, or any role or permission change; each kind at most once an hour per admin; counts only, never a name or a request. Each new note also goes out as one private email; while `RESEND_API_KEY` is unset the mail waits in the outbox as `skipped` and the note says so. A failed mail never stops the cron.
11. Event reminders (`sendEventReminders`, engage.ts): a day before and an hour before every Party event, circle table and run someone signed up for, once each through `event_reminders`.
12. Close last month's leaderboard season once (`closeSeason`): its top three go to `season_results` and get the `season_top` honor.
13. Post-purchase sequences into inboxes (`runSequences`), on the first tick of the hour like 9, 12, 14 and 15.
14. Monthly recurring finance entries (`runRecurring`).
15. Agency: each running retainer's months, each with its invoice and pieces, once (`runAgencyCycles`); stages moved by signed or sent agreements (`syncStageFromAgreements`); client link and team link sessions past twelve hours deleted; closed client link, team link and coach invite hashes older than a year deleted.
16. Circle tables set two days out, and the next weekly occurrence opened (`matchDueCircles`, `rollWeeklyCircles`).
17. Money orders nobody paid for within half an hour are closed (`expired`), so the product is buyable again. Then `releaseDeadOrders` gives back a discount code's use held by an order that failed or expired.
18. YouTube numbers refreshed for content items not synced in six hours (five a tick) and for YouTube reward submissions with no automatic reading in the last six hours (five a tick), only when a key is set; without one, these two read nothing.

A job that fails never stops the others (`Tick.run`): its error goes in one line of `app_logs`, and it is tried again next tick.

Three rules of the reminders:

- **Water sends no note (2026-11-07, the founder).** Nothing else reminds anyone to drink. `reminder_prefs` keeps the old columns unread; `PUT /reminders/water/settings` takes `goalMl` and `glassMl`, ignores what an old tab still sends, and answers with that old tab's four fields as fixed words (`OPEN_OLD_TAB`, to go with the next deploy). Migration 0112 deleted the stored notes.
- **The last tick of the day is 23:45 (`LAST_TICK`).** A reminder set for 23:46 to 23:59 goes out at 23:45 and not at 00:00, when its day has already turned over. It applies to the daily reminder, custom reminders, task reminders, review reminders, the focus nudge and supplement reminders.
- **Each goes once.** The ids are fixed (see 5), and custom reminders keep `last_sent_day`. A retainer month is made once by `UNIQUE (retainer_id, month)` on `agency_cycles`, however often the cron runs.

After the run: a line in `app_logs` if anything was done. Log lines older than thirty days, `web_vitals` rows older than 90 days and `session_evictions` rows older than thirty days go in the hourly tidy-up. Locally `pnpm dev` passes `--test-scheduled`, so `GET /__scheduled?cron=*+*+*+*+*` runs it by hand. The smoke test does this for the reminders.

## 8. Environments, deployment and checks

- Development: `pnpm dev`, web on 5173 proxying `/api`, `/go` and `/out` to the Worker on 8787 with a local D1 under `.wrangler`. Secrets in `apps/api/.dev.vars`; `.dev.vars.example` lists the keys, among them `PUBLIC_URL` (used for the reset link, the unsubscribe link, emailed document links and the Origin rule), the business details (`BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_REG`, `BUSINESS_VAT`) and the copyright agent (`DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, `DMCA_REGISTERED`). The Grievance Officer for India is three more Worker variables (`BUSINESS_GRIEVANCE_NAME`, `BUSINESS_GRIEVANCE_EMAIL`, `BUSINESS_GRIEVANCE_PHONE`, in `env.ts`). Anything the legal pages say about the business comes from those variables, never from code, and reads "not set yet" until the owner sets them.
- Smoke: a second Worker on 8788 with its own database under `scripts/smoke/state`, started by `scripts/smoke/blueprint.sh` (`--fresh` wipes the database, `--keep` leaves the server up). `scripts/smoke/smoke.mjs` imports the shared model straight from TypeScript and makes 2,686 checks. It serves a stand-in model on 8799, so the assistant checks never pay for a model. Test accounts live only there. The shared package has 859 Vitest tests in 44 files, among them `insights.golden.test.ts`, which pins Emerging's whole output against four fixtures in `__golden__/`.
- Probes (puppeteer-core driving the installed Chrome, over `shots-all.mjs`'s list of about a hundred routes): `shoot.mjs` takes the shots; then `overflow-probe.js` (nothing past the screen), `orphan-probe.js` (no word alone on a last line), `lone-probe.js` (no pill alone on its line), `target-probe.js` (no tap target under 44 by 44), `cut-probe.js` (no row of tabs cut at its edge), `height-probe.js` (cards in a row are one height), `box-probe.js` (no square-cornered control with a fill or edge), `rag-probe.js` (the rectangle rule), `bento-probe.js` (a row of tiles that stops short of the full width, or holds two widths), `density-probe.js` (copy too heavy for a phone) and `contrast-probe.js` (text on its real background). The results of 7 November are in 09 §4.
- Drives: `drive-signup.mjs`, `drive-keep.mjs`, `drive-talk.mjs`, `drive-cards.mjs` (cards stay on the table when focus mode is left), `drive-scroll.mjs` (no tab or toggle throws the page back to the top), `drive-headings.mjs` (every section heading and its action are level), `drive-home.mjs` (Home's paired halves are one height at 1100, 1280 and 1600 pixels), `drive-plan.mjs` (the Plan my week sheet) and `drive-focus-everywhere.mjs` (the focus clock across pages and tabs).
- Other scripts: `scripts/scan.sh` (spacing, colour, old name, image alt, `dangerouslySetInnerHTML`, `font-extrabold` outside paper, any `INTO notifications` outside `notes.ts`, and the three guards in 10b), `scripts/flesch.py` (reading ease), `scripts/smoke/csp-browse.mjs` (browses the routes and sheets and reports any policy violation; 118 pages, 0 messages, on 2026-11-03), `scripts/smoke/perf-probe.mjs` (pages on a slow CPU and Slow 4G), `scripts/check-exposed.sh` (asks a live site for hidden, backup and config paths and expects 404), `scripts/perf-budget.mjs` (`pnpm perf:budget`, see 11), `scripts/licences.mjs` (writes `apps/web/public/licences.json`) and `scripts/hooks/pre-commit` (refuses a commit that carries a secret pattern; it is installed by copying it to `.git/hooks`, and a copy is there on the working machine).
- Production: `pnpm deploy` builds the web app and runs `wrangler deploy`. Secrets with `pnpm cf:secret <NAME>`. Migrations with `pnpm db:migrate`, run before the deploy that needs them. Logs with `pnpm cf:logs`. Wrangler observability is enabled.
- Before the next deploy: the work since the last commit ("alphav2.1") is not committed yet; four of its new files are added to git (`A` in `git status`) and 31 are not (`??`), among them migrations 0124 (`team_connections`, wave 24's Connect people), 0125 (`invites`), 0126 (`invites_guides`), 0127 (`connect_staff_orgs`) and 0128 (`connect_guides`), so commit with `git add -A`. Back up, migrate, then deploy (09 §6).
- The PWA: `vite-plugin-pwa` with `autoUpdate`, `skipWaiting` and `clientsClaim`, so a deploy replaces a cached page on the next load; `/api/*` is never served from the shell; the fonts are the site's own woff2 files and are precached with the rest (no request to Google Fonts); the start page is `/today`.
- There is no staging environment. CI is in `.github/workflows/ci.yml` (see 10b); it first runs on the next push, and nothing has run on GitHub yet. A restore procedure is written (`docs/security/RESTORE.md`) but has not been rehearsed; it leans on D1's own point-in-time recovery. Alerting is the inbox note and one email from `securityAlerts` (10 in the cron); nobody is paged.
- Feature flags switch any module off in production without a deploy (Admin, Flags), and the API refuses it at once on that instance, and within five seconds elsewhere.

## 9. Anti-patterns, checked

- One mega-prompt: avoided; DECISIONS shows the slices.
- One giant component or table: avoided; 117 migrations, one or a few route files per module, screens built from `Screen`, `Section`, `StatTile` and the charts, one `DataTable`, one `Pager`, one `KanbanBoard`, one `RowCard`. The 15,000-line shared `index.ts` became a barrel over one file per domain.
- Frontend-only authorization: avoided; roles, ownership, module flags and team access are all server checks, and what a client may see at a link is removed on the server (`invoiceForClient`, the parts of `PortalView`, `TeamLinkView`).
- Hard-coded access in components: avoided; `Gate` reads `access` from `/api/me`.
- Payment state in a mutable user field: avoided; `orders` plus `webhook_events`.
- Keys in client code: avoided; secrets are Worker bindings. Discover's answer keys moved out of the web bundle too.
- Two versions of one action: avoided; the assistant, the Companion, Agency and the coach call the same code the screens call.
- Ingesting the books into AI: avoided.
- Switching frameworks: the stack has not moved since it was fixed.
- Native app first: avoided.

## 10. Headers, origin and exposed paths (the launch pass, 2026-11-01)

- **Two header sources, one policy.** Static files get their headers from `apps/web/public/_headers`; the pages the Worker answers itself (the site home, the blocked paths) get the same set from `PAGE_HEADERS` in `apps/api/src/headers.ts`; API answers get Hono's `secureHeaders()` (a policy of `default-src 'none'`). A smoke check compares the first two. The page policy (`CSP`) allows scripts only from this site and Razorpay's checkout, styles from this site and inline, fonts from this site, pictures from any https address, frames only for the YouTube and Vimeo players and Razorpay, no plugins, and `frame-ancestors 'none'`. It has been enforcing since 2026-11-01 (the header's name is one constant, `CSP_HEADER`, to go back to report-only if ever needed). Also set: HSTS for two years with `includeSubDomains` and no preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (and `no-referrer` on `/signin/reset`), `Permissions-Policy` with camera and microphone off and geolocation for this site only, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. `csp-browse.mjs` found no violation over 118 pages on 2026-11-03. A new third-party origin needs a line in both places and a new run of it. Not tested against the policy: a real payment through bank pages, UPI and 3-D Secure.
- **No CORS.** The app and its API are one origin, so an unknown Origin gets no `Access-Control-Allow-Origin`.
- **The Origin rule.** A write (anything but GET, HEAD or OPTIONS) that carries an `Origin` header must come from the request's own host, the host of `PUBLIC_URL`, or a loopback address while the request itself is to loopback (`originAllowed`); otherwise the answer is 403 `wrong origin`. A request with no `Origin` (a script, a webhook, the smoke tests) passes, and `/api/webhooks/*` skips it because each webhook verifies its own signature. Auth is a Bearer header, so this is a second layer, not the first.
- **Cache-Control.** `cachecontrol.ts` chooses it in one place: `public` for anonymous answers that are the same for everyone (a minute in the browser, five at a shared cache, stale for ten more), `immutable` for an uploaded picture (a year), `none` (`private, no-store`) for anything personal. An authenticated answer is `no-store`; an error is never kept public.
- **Blocked paths.** `blockedPath` (headers.ts) answers 404 with `no-store`, never the app shell, for hidden files and folders (any segment starting with a dot), repository and editor folders, backups and dumps, config and project files (`package.json`, `wrangler.*`, `tsconfig.json`, `.env`), `.map`, `.sql` and the like, and `/src`, `/logs`, `/tmp`. `/.well-known/` is left alone. `run_worker_first` in `wrangler.jsonc` sends those paths to the Worker so the static-asset layer does not answer them with the SPA shell; `BLOCKED_PATTERNS` and `wrangler.jsonc` are kept in step by hand.
- **Fetching an address a person gave.** `safeurl.ts`: `publicHttpsUrl` refuses anything but a public https address (no login in it, no IP number, no `localhost`, internal or wildcard-DNS name, no port but 443), and `safeFetch` follows at most three redirects, checking each hop, with a time limit and a size cap. Every fetch in `reach.ts` of a research link goes through it. It cannot look a name up in DNS (a Worker has no resolver), so a public name that points at a private address is not caught here; a Worker cannot reach private networks anyway. `httpUrl` in `db.ts` checks every link a person types for others to open: a meeting, a replay, a video, an event, a product's file, a portfolio piece, a School hand-in and Army work. `badLink` and `LINK_PROBLEM` refuse a bad one with a 400, so nobody loses what they typed.
- **Other pieces.** The reset link and every emailed document link are built from `PUBLIC_URL`, never from the Host header; a "password changed" mail follows a reset and a change; the reset mail's body is not kept in the outbox (`private: true`); the Razorpay and Meta webhook signatures are compared in constant time. The security notes are in `docs/security/` (`SECURITY_REPORT.md` has the 27 checks and 7 bonus checks with evidence, plus `SECURITY_MAP`, `SECURITY_RUNBOOK`, `SECRETS` and `RESTORE`).

## 10b. The guards and CI (2026-11-07)

Four checks hold promises that once rested on memory.

- **CI.** `.github/workflows/ci.yml` runs on every push and pull request: a frozen install, typecheck, shared tests, `scripts/scan.sh`, build and `pnpm perf:budget`. It is read-only and holds no secrets, and each action is pinned to a commit. The smoke suite stays local, since it needs a running Worker and its own database. `pnpm audit --prod` stays a manual step, since a new advisory would fail unrelated pushes.
- **Data coverage.** `scripts/data-coverage.mjs` (run by `scan.sh`; `--table` prints it all) holds one line for every table with a column naming a person: its export key and what the delete does. It builds the schema from the migrations with `node:sqlite` and checks each line against `routes/me.ts` and `deleteAccount`. A new table fails the scan until it has a line.
- **Note links.** `scripts/check-note-links.mjs` (run by `scan.sh`) reads every `noteStmt`, `notify` and `notifyMany` with the TypeScript parser. A link with no route in `App.tsx` (a redirect does not count) or a hash no id in the web app draws fails. A link it cannot work out needs a `note-link: /party/:id` comment.
- **App pictures.** `scripts/app-art/build.mjs --check` (run by `scan.sh`) fails when a module has no picture for Home's tiles or two share one.

**Note landing.** `useLandOnHash` (`lib/useLandOnHash.ts`, wired once in `Root`; the landing is its own chunk, `lib/landOnHash.ts`) lands a hash on its element after a tap, a redirect or the first load, never on Back or Forward. It waits up to eight seconds for the `id` (or a word in a `data-land` list), opens it when it is folded, scrolls it under the title bar and moves focus to its toggle or heading. It keeps going to that place while the page grows, until the person scrolls, taps or types. `MOVED` in `screens/Inbox.tsx` maps an old note's stored link to the new place, so no migration rewrites rows.

**Even rows.** `evenRows` in `lib/bento.ts` is the one rule for a grid of tiles: the fewest rows that hold them, shared so two rows differ by at most one, shorter rows first, every tile in a row one width and every row the full width. `evenSpans` lays it on shared tracks, `evenGrid` and `evenTile` apply it at each step (a media step or a container's own), and the class names they build are listed by `@source inline` in `app.css`. `scripts/smoke/bento-probe.js` measures it.

**Dates and times.** `lib/date.ts` is the one way a time reaches a screen. It follows the signed-in person's zone (`users.timezone`) and format (`users.date_prefs_json`) through `setDateDisplay`, called from `main.tsx` when the account lands, with a device copy for the first paint. `formatDate`, `formatClock`, `formatStamp` and `formatMinute` in shared `dates.ts` do the drawing. What is sent stays the device's (`todayLocal`, `localDateTimeValue`), and printed paper keeps its own.

## 11. Performance as built

The 31-point list, its budgets and the query counts are in `docs/performance.md`.

- **Pages load when opened.** Every screen except Home, Daily, sign-in, Welcome, the setup chat, the landing page and the tab bar is a `lazyNamed(() => import(...))` (`lib/lazy.ts`), under one `Suspense` and `RouteFallback`. A failed download reloads the page once (a guard in `sessionStorage`, so it never loops) and then shows a short line instead of a blank page.
- **How the build is split** (`vite.config.ts`):
  - Libraries: `vendor-react` (React, React DOM, the router), `vendor-query`, `vendor-gsap`, `vendor-icons` (lucide's shared drawing code; each icon stays beside its screen) and `vendor-useanimations` (loaded through `import()` after the first paint).
  - Motion is not named. What the first screens need sits with the entry, and its animation, drag and layout code loads after the first download through `lib/motionFeatures.ts` inside the one `LazyMotion`.
  - The shared model is one chunk (`shared`), with leaves split off: `shared-lines` (the line of the day), `shared-legal` (the legal lists), `shared-base` (core, dates, books, store, activity, circles, dayKinds, dayTypes, money), and the subpath files `journal-prompts`, `agency-email`, `ladder-choices`, `shared-focus-run`, `gratitude`, `shared-fitness` and `shared-coach`. A file split off while still in the barrel must import nothing from the rest of shared, or the two chunks form a cycle and the app stops.
  - A subpath file may import the rest of shared only while nothing in the barrel imports it: `block-hints`, `shared-help` (`HOW_TO`, read by the How it works card) and `lesson-resources`.
  - `insights.ts` and `lifeDashboard.ts` have no chunk of their own: the web app imports nothing from the first and only types from the second, so their words stay on the server.
  - `icons-app` (the shared icon registry) and `app-api` (the API client) are their own files, preloaded with the first download.
- **The budget.** `pnpm perf:budget` fails the build over 480 kB for the entry, 1,500 kB for the first download or 400 kB for any other chunk (the vendor files are exempt). The gate of 8 November 2026, after the trim (the founder: trim, never raise the line) and the spacing pass, measured: entry 448.7 kB raw (141.8 kB gzip), first download 1,444.4 kB raw (479.9 kB gzip) over 11 files, `shared` 371.2 kB, the whole build 247 files, 4,148.2 kB. The last gate, on 9 November, after the phone pass (the held main action, the sideways tag rows, the lower buttons), measured: entry 452.8 kB raw (143.0 kB gzip), first download 1,448.6 kB raw (481.1 kB gzip) over 11 files, `shared` 371.2 kB, the whole build 249 files. The last gate, after the seven calls that followed (9 November), measures: entry 452.9 kB raw (143.0 kB gzip), first download 1,448.7 kB raw (481.2 kB gzip) over 11 files, `shared` 371.2 kB, the whole build 249 files, 4,164.0 kB. The last gate, after wave 24 (Connect people, the design passes on Admin, Dev Tools brought up to date; 9 November), measures: entry 453.0 kB raw (143.0 kB gzip), first download 1,448.8 kB raw (481.2 kB gzip) over 11 files, `shared` 371.2 kB, the whole build 253 files, 4,195.5 kB. The last gate, after wave 25 (joining by invite, its rewards and badges, the words; 10 November), measures: entry 454.9 kB raw (143.9 kB gzip), first download 1,453.4 kB raw (483.0 kB gzip) over 11 files, `shared` 373.2 kB, the whole build 260 files, 4,232.4 kB. The last gate, after wave 26 (staff in Connect people, a brand's team joined by a yes, a cohort's manager; 10 November), measures: entry 454.9 kB raw (143.9 kB gzip), first download 1,453.5 kB raw (483.0 kB gzip) over 11 files, `shared` 373.2 kB, the whole build 264 files, 4,245.6 kB.
- **Fewer, quicker requests.** TanStack Query keeps an answer fresh for 30 seconds and retries once, never for a 4xx. Emerging is one request a device day: `GET /insights` answers the person's whole list (`insightsForEvery`), the client keeps it under `['insights', day]` and each screen picks its share (`insightsForPlace`). An ordinary write only marks it stale; the writes that change what it says refetch it. A picked period on `/insights` asks `GET /insights?kind=&start=` and `GET /insights/dashboard` for that period only. A search box waits 300 ms (`useDebounced`). A picture is shrunk to WebP in the browser before upload, and images below the first screen load lazily. The browser reports its own timings once, when the page is hidden (`lib/vitals.ts`, to `POST /api/public/vitals`), and not under Do Not Track or Global Privacy Control.
- **Fifty queries an invocation (Workers Free, 2026-11-07).** The one rule: an invocation stays under 50 D1 round trips, and the suite fails past 45. `batchedReads` (d1Batch.ts) wraps the binding once per invocation in index.ts and sends every read made in one turn of the event loop as one `db.batch`, so a route writes `await db.prepare(...).first()` as ever and `Promise.all` of reads is one trip. Only a SELECT waits; a write goes at once, after sending what was gathered, so nothing changes order; a failed batch sends each read alone, so a bad read fails only its caller. `D1_GUARD` (d1Guard.ts, set by blueprint.sh and the test server's script, never in production) puts `X-D1-Round-Trips`, `X-D1-Rows-Read` and `X-D1-Rows-Written` on every answer and `X-D1-Last-Tick` after a cron run; off, `fetch` looks at one property. A route whose work can grow checks `tripsOf(db)` and stops while it can still answer: the assistant and the Companion (a tool runs only while a read's 8 or a write's 16 trips are left), a cancel for hundreds of guests and a host's delete (the next ticks finish the seats), a retainer's backlog of months. docs/performance.md has every number.
- **The API waits less.** Independent reads run together (`Promise.all`) on Daily, the Home brief, Pillars, the inbox, the feed, Profile, the leaderboard, a public page and Explore. Fan-outs are one batch (`notifyMany`, `withSubtasks`, `mediaForListings`, `inBatches`, and the data export, which went from 55 round trips to 2). The module gate keeps the flags and overrides for 5 seconds (`ACCESS_TTL_MS`), and an admin change drops them at once on that instance (`forgetAccessContext`).
- **Outbound calls.** Every call out of the API goes through `fetchT` with a named timeout (`TIMEOUT` in `http.ts`: quick 5 s, payments 15 s, research 15 s, assistant 60 s, strategist 90 s, the Agent Reach bridge 120 s). It is never retried, so a payment or a send cannot run twice because a clock ran out. A plain read over 1.5 seconds (`SLOW_READ_MS`) is logged as a warning. The Anthropic SDK is loaded on first use, not at cold start.
- **Emerging's compute.** A heavy rebuild went from about 160 ms to 11 ms on 2026-11-05: one time-zone formatter per zone, stamps and keys worked out once, no n² loops, ordered and capped reads, Discover's reads in the batch. `insights.golden.test.ts` proves the output did not change.
- **Placement.** `"placement": { "mode": "smart" }` in `wrangler.jsonc` runs the Worker near the database, since nearly every request makes several round trips to it.
- **Indexes.** Migration 0060 holds the performance indexes, each with its reason (see 04). Migration 0067 adds two unique indexes as a guard, and 0083 adds `idx_agency_items_user_due` for Emerging's agency-load read.
- **After the first paint.** How it works' card (`HowItWorksPanel`), `SummaryTiles`, the privacy card, the water panels (`ReminderPanels`) and the note landing each load as their own chunk after the first paint, which keeps the entry under its budget.
- **Left open on purpose:** the public pages are drawn in the browser, not on the server; the assistant answers once and does not stream; `track()` and `sendEmail()` are awaited inline (a call to `ctx.waitUntil` would take them off the person's tap).

## Known gaps

- On Workers Free the first daily limit is rows read, at about 115 people a day with three months of data (docs/performance.md). Past a limit, every D1 query fails until 05:30 IST, and every screen shows its plain error line.
- A new account writes about 307 rows, so about 325 sign-ups in a day use all of Free's writes. The starting time blocks stay in code until the person's first change to a block or a template (2026-11-07), which writes about 805 rows once.
- No staging environment. CI has not run on GitHub yet. A written restore procedure that has not been rehearsed. Nobody is paged by an alert.
- No idempotency key on checkout beyond the one-order-per-product rule.
- No time-based purge for `analytics_events` or `page_events`. They are deleted with the account.
- A PDF of an invoice or an agreement is the browser's print and save, because a Worker cannot make one.
- Calendar sync is one way (tasks, reviews and Agency days appear in a calendar; nothing changes back), and there is no two-way link to Google, Outlook, Slack or meeting-note tools.
- Reported in the 2026-11-01 bug sweep, re-checked in the code on 2026-11-07 and still open, because each needs a decision:
  - `/orgs` is not in `MODULE_FOR_PREFIX`, so it is treated as core and always open, even when Army is off for the person (see 05).
  - Invoice status can move between any two states (draft straight to paid books the income). The move itself is guarded, so two taps book once.
  - `approved_day`, when a client or their team approves at a link, uses the UTC date, not the person's zone.
  - `getStats` counts a Club badge for membership statuses `accepted`, `member` and `active`, but reviewers set `approved`.
  - A community mute uses `INSERT OR REPLACE`, so muting again resets the muter's rank. Bond chat messages have no block check.
  - An uploaded picture can never be deleted by its owner (the cap is 60 a person).
  - A KPI target of 0 means "no target".
- Reported on 2026-11-01 and not re-checked: a few screens ignore a failed mutation (Agency and review buttons) and keep stale error text when a sheet reopens.
- `go.ts` still adds a paid question with `WHERE NOT EXISTS`. Under a true race the unique index from 0067 now fails the insert instead of writing a twin; `INSERT OR IGNORE` would be cleaner.

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October, 25 migrations, about 110 tables) to the app as it stands: 57 migrations and 177 tables, 46 modules. New since then: the strategy session, the setup chat, the assistant with credits and plans, coaching, attendee codes, engagement (reactions, pins, event reminders, seasons), media and event extras, anonymous threads, water and reminders, card games, Discover and its add-ons, the app's own log, focus rounds and their settings, task dates, repeat, priority and subtasks, the device cap, Agency (clients, deliverables, time, invoices, agreements, templates, the client link), business metrics, the private calendar link, and scheduled reviews with reminders.
- 2026-11-01: the request flow now has the module gate and the per-person limits written out in order; the public routes are listed in one place (6); the cron lists all eleven jobs; and the Club-only Work gap from 0.3 is closed.
- 2026-11-01 (later): bug sweep and water pass. The cron now has two triggers (the fifteen-minute one and a two-hour one that sends only water), `LAST_TICK` 23:45 for late reminders, and `clearPastWaterNotes`; migration 0058 makes two hours the shortest water gap (58 migrations, still 177 tables). New guard patterns are written down in section 3, and the reported-but-not-changed list is under Known gaps. Counts: 857 smoke checks, 209 shared tests.
- 2026-11-01 (later, the legal, security, performance and accessibility pass): 60 migrations and 183 tables (0059 legal records, 0060 indexes and `web_vitals`). New sections 10 and 11. New files in `apps/api/src`: `headers.ts`, `safeurl.ts`, `http.ts`, `cachecontrol.ts`, `alerts.ts`, `routes/legal.ts` and `routes/vitals.ts`. The cron gained `tidyOld`, `securityAlerts` and `pruneVitals`. Three limits were added: 37 named limits and 90 routes. New Worker variables: `PUBLIC_URL`, `BUSINESS_*` and `DMCA_*`. Fonts are self-hosted. Counts: 910 smoke checks, 209 shared tests.
- 2026-11-05 (0.6): reconciled with the app after the work of 2 to 5 November. 83 migrations and 203 tables (0061 discount codes to 0083 the agency due index), still 46 modules, 71 route files.
  - Stack: `lucide-react` and `react-useanimations` joined the web app; the type is Google Sans Flex only (Geist, Geist Mono and Inter are gone; Caveat stays for the guides' lines).
  - Shared: `index.ts` is now a barrel of 45 domain files, with three subpath files beside it. Discover's answer keys moved into the API.
  - Request flow: the client link password gate (`portalDocGate`), the team link refusal (`refuseTeamSession`) and the Agency team gate (`X-Agency-Team`). New core routes `/insights` and `/me/teams`. New public routes for books, onboarding, password asks, unlocking, other documents and the team link (6). New status words: 401 `locked`, 409 `changed`, 410 for a closed link.
  - Limits: 52 named limits and 194 routes. `POST /me/password` is now limited and compares in constant time, so that gap is closed. `insights` is the one GET with a limit.
  - Cron: invoice notes, Agency due notes, the focus nudge, retainer months, stage sync, link session and closed-link pruning, and the release of discount uses. `tidyOld` also clears channel and run discussion lines and closed password asks.
  - Performance: the shared chunk gained the `shared-legal` leaf; `app-api` and the motion features file are split off; the budget now reads entry 466.8 kB, first download 1,453.6 kB. Emerging is one request a device day, and a heavy rebuild went from about 160 ms to 11 ms.
  - Gaps closed and removed from the list: the unlimited password change, the store checkout, School and Party points races, the coupon spent before a failed checkout, the Party cancel that refunded nothing, and the waitlist promotion that charged nothing.
  - Counts: 1,610 smoke checks, 553 shared tests. `LEGAL_VERSION` is 2026-11-05.
- 2026-11-07 (0.7): reconciled with the app after the work of 6 and 7 November. 107 migrations and 224 tables (0084 cohort discussions to 0113 lesson resources), 47 modules with Fitness, 75 route files.
  - Shared: 49 barrel lines and twelve subpath exports; `HOW_TO`, the Emerging rules and the coach's report left the barrel; `shared-base` and six new chunks.
  - Cron: one trigger. Water notes are gone; supplement reminders and their clearing are new.
  - New section 10b: CI, the data coverage guard, the note link guard, the app picture check, note landing, even rows and dates and times.
  - Limits: 63 named limits and 262 routes. `insights` is 240 an hour; `coachRead` and `coachLookup` are two more limited reads; `adminKey` guards the shared key.
  - New public routes: the coach's invite link and a client's brief answers.
  - Gaps closed and removed from the list: no CI, the review numbers on UTC day edges, and the grievance variables missing from `.dev.vars.example`.
  - Counts: 2,836 smoke checks, 871 shared tests in 46 files (10 November). `LEGAL_VERSION` is 2026-11-10. The budget reads entry 454.9 kB, first download 1,453.5 kB (the last gate, after wave 26, 10 November; 454.9 and 1,453.4 after wave 25; 453.0 and 1,448.8 after wave 24, 9 November; 452.9 and 1,448.7 after the seven calls, 452.8 and 1,448.6 after the phone pass, 448.7 and 1,444.4 after the spacing pass, 8 November).
