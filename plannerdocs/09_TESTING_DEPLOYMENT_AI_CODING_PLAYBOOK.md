# 09 — Testing, deployment and the coding playbook

**Last updated:** 2026-11-01

**Product:** kreators.app
**Version:** 0.5, reconciled with the app on 1 November 2026, after that day's bug sweep, water-trigger change and legal, security and performance pass (0.3 was 26 October 2026)
**Source of truth:** the "Commands" and "Done means" sections of `CLAUDE.md`; `packages/shared/src/index.test.ts`; `scripts/smoke/` (its file headers say how each script is used); `scripts/scan.sh`; `scripts/flesch.py`; `scripts/check-exposed.sh`; `scripts/perf-budget.mjs`; `scripts/hooks/pre-commit`; the root `package.json`; `docs/DECISIONS.md`; `docs/security/` and `docs/performance.md`.

## 1. The core rule

One bounded slice at a time, with `CLAUDE.md` read first. `docs/DECISIONS.md` shows how the app was built that way: one dated line per slice. A slice is done when the "Done means" list passes and the thing has been looked at in a real browser, not when the types agree or the happy path works.

## 2. Repository layout as built

```text
CLAUDE.md                 the rulebook (read first; it overrides these docs)
README.md                 the long description
SPEC.md                   the founder's original asks, ticked
docs/DECISIONS.md         dated decisions, newest at the bottom
docs/whop-study.md        what was taken from Whop, and what was left
docs/superfocus-study.md  what was taken from Superfocus, and what was left
docs/security/            SECURITY_REPORT (27 checks + 7 bonus), SECURITY_MAP, SECURITY_RUNBOOK, SECRETS, RESTORE
docs/performance.md       the 31 items, the budgets, the query-count table
docs/copy-brief.md        the one brief for the public site's words
apps/web/src/lib/buildMap.ts   where things live (shown under Observability, Build map)
plannerdocs/              these docs
design/figma-tokens.json  the kit's values, frozen
apps/web/src              App.tsx, app.css, components/, screens/, site/, lib/
apps/web/public           icons, the share card, resources/ (the skill files School links)
apps/api/src              index.ts, access.ts, limits.ts, db.ts, ops.ts, payments.ts, credits.ts, rewards.ts, cron.ts, logs.ts, account.ts, agencyStats.ts, headers.ts, safeurl.ts, alerts.ts, cachecontrol.ts, http.ts, assistant/, routes/
apps/api/migrations       0001 to 0060, plain SQL
packages/shared/src       index.ts (the domain model), index.test.ts
scripts/                  scan.sh, flesch.py, icons.sh, figma-pull.py, check-exposed.sh, perf-budget.mjs, licences.mjs, hooks/ (the pre-commit secret scan), assistant/ (the eval), cards/ (the card seeds), reach/ (the Agent Reach bridge), smoke/
scripts/smoke             blueprint.sh, smoke.mjs, shoot.mjs, shots-all.mjs, the probes (contrast, overflow, orphan, perf), csp-browse.mjs, the drive scripts, state/ and shots/ (ignored)
```

## 3. Done means

From `CLAUDE.md`: typecheck and build pass, shared tests pass, the smoke test passes, the spacing and colour scans are clean, and `docs/DECISIONS.md` has a line if the plan changed. In practice also:

- wording scores Flesch 60 or above (`python3 -I scripts/flesch.py --strings <file>`);
- a new app has a `HOW_TO` entry and its words are in `TERMS` (the shared test insists);
- a new route file has a line in `MODULE_FOR_PREFIX` (`apps/api/src/access.ts`) or it is treated as core and always open;
- a new write route is in `ROUTE_LIMITS` (`apps/api/src/limits.ts`);
- a new table that holds a person's data is in the export (`routes/me.ts`) and in `deleteAccount` (`account.ts`);
- after touching colours, the contrast probe runs over every route in dark mode; after touching text or layout, the orphan probe must report 0 hits on a laptop and the overflow probe 0 on a phone;
- after touching a tab, a filter or a switch between views, `drive-scroll.mjs` reports 0;
- a new fetch of an address a person influenced goes through `safeFetch` or `publicHttpsUrl` (`safeurl.ts`), and a typed link field is read with `httpUrl`;
- a change to the security headers or the policy is made in `headers.ts` and `_headers` together, then `csp-browse.mjs` runs over the shot list (0 violations);
- a new hidden or private path pattern goes in `blockedPath` and in `run_worker_first` in `wrangler.jsonc`, and `check-exposed.sh` still reports nothing at 200;
- after touching the web bundle, `pnpm build && pnpm perf:budget` says "Within budget";
- a screen that was built is opened in a browser and looked at.

## 4. Test layers as built

- **Unit (Vitest, shared):** 209 cases (2026-11-01) in groups that cover money and fees in basis points; content reward payouts; time zones across daylight saving; booking slots, buffers, overrides, notice and horizon; the circle matcher and interest groups; rollout buckets; Home's guidance line; the app defaults, groups and how-tos against the glossary; passwords; not-to-do streaks; periods, templates and scheduled reviews; store pictures and featured spots; trust and social reward caps; unlocks and the earning guide; Kreators Run; the sign-up age and phone rules; tasks (repeat, priority, dates); Discover, the astronomy behind Human design (pinned to published values) and numerology; the invoice calculator, the total in words, the contract templates and what a client may see; the week plan, plan strength, time blocks, a project's pace and focus quality; the private calendar file; the setup chat's matching.
- **End to end (the smoke test):** `bash scripts/smoke/blueprint.sh` builds the web app if there is no build, migrates and starts a second Worker on port 8788 with its own database under `scripts/smoke/state` (`--keep` leaves it up, `--fresh` wipes it first, `SMOKE_BUILD=1` rebuilds first), then runs `scripts/smoke/smoke.mjs`, which imports the shared model straight from TypeScript and makes 910 checks (2026-11-01) over the API: health and headers, auth (including the age and phone rules, devices and reset), onboarding, the setup chat, tasks and the task plan, the daily game, wellbeing, finance, the shop, community, the public page, reviews, the store, Kreators Run, school and staff, Club and Work, reward changes, pages, the strategy session, the daily reminder, the content strategist, admin, the assistant and credits (against a stand-in model it serves itself on port 8799), attendee codes, life coaches, engagement, Agency (clients, the pipeline, the client link and its switches, time, invoices and their calculator, templates, agreements, Army, business metrics), the week plan, focus quality and the calendar link, review schedules and their reminder, export and delete, and the limits. Since the 1 November sweep it also covers real-calendar date checks, a starter named "constructor" (a typed key finds nothing), rewards redeemed and cancelled twice at once, the water choices (sixty minutes is refused), a task asked to be remembered showing in the reminders box, and the two-hour trigger running. The last 35 checks are the security section ("Security: headers, origin, exposed files, errors, addresses, alerts"): the headers on the site and the app, the policy in `_headers` equal to the one in code, HSTS, no wildcard CORS and no reflected origin, a write from another site refused (403) while the site's own, a missing Origin and a webhook go through, no stack in an error and no body in a log, blocked and shipped files, 26 addresses `publicHttpsUrl` must refuse, and the alerts and their levels. Every run sends its own `CF-Connecting-IP` so limits never block a rerun; the founder is `founder@smoke.test`. `SMOKE_MODEL=real SMOKE_RUN=eval ASSISTANT_API_KEY=… bash scripts/smoke/blueprint.sh` sends real messages to a real model and checks the tool calls (the assistant eval in `scripts/assistant/eval.mjs`).
- **Reading a smoke result.** Write every run to its own new log file and read the count that run printed. Two things have gone wrong: a monitor that read an old log and reported a count from an earlier run, and a test that passed vacuously (an `|| true`, or a condition on a value that was never found). A check that can pass whatever the app does is not a check; make it fail first, on the old code, then pass.
- **Design scans:** `bash scripts/scan.sh` (spacing tokens, arbitrary pixels, raw spacing in `app.css`, hex colours, white on ink, raw HTML, the old product name); `python3 -I scripts/flesch.py`.
- **Probes** (each is a `probeFile` for `shoot.mjs`: `SHOOT_PROBE=scripts/smoke/<name>.js`, run over a list of routes):
  - `contrast-probe.js`: every text node against its real background; since 2026-11-01 it reports against WCAG 2.2 AA (4.5:1 for text under 24px, 3:1 for large text and disabled controls), where it used to flag only under 2.2:1; fixed or sticky chrome under 88 percent opaque is still a hit. Run it in both modes over every route: `SHOOT_THEME=both SHOOT_PROBE=scripts/smoke/contrast-probe.js SHOOT_LIST=shots.json node scripts/smoke/shoot.mjs`. The ink and fill tokens in `app.css` were tuned so the count fell from 3,375 hits to 30; what is left is drawn map art and a few 12px lines.
  - `overflow-probe.js`: whether the page scrolls sideways and which elements poke past the screen. Must be 0 on a phone.
  - `orphan-probe.js`: every block of text that wraps and ends on one word. Must be 0 on a laptop; a phone may keep a rare long word that fills over half its line.
  - `csp-browse.mjs`: browses every route of a shot list in Chrome, opens a few sheets, loads the Razorpay checkout script address and prints each Content-Security-Policy violation (enforced or report-only); exits 1 if there is one. Last run: 102 routes, 0 violations. Run it: `bash scripts/smoke/blueprint.sh --keep`, then `node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json`, then `SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json node scripts/smoke/csp-browse.mjs`.
  - `perf-probe.mjs`: page speed on a slow phone (CPU slowed 4 times, "Slow 4G", cold cache) for the landing page, Home and Daily; it reports LCP, CLS, long tasks and JavaScript transferred and never passes or fails. `SHOOT_TOKEN=<token> node scripts/smoke/perf-probe.mjs` against the smoke server (`PERF_ORIGIN`, `PERF_CPU`, `PERF_RUNS` change it).
- **Beyond the smoke test (scripts at the repo root):** `bash scripts/check-exposed.sh <domain or http://127.0.0.1:8788>` asks a site you own for a long list of files that must never be public (`.env`, `.git`, backups, dumps, config, source, maps) and prints a status for each; any 200 is marked and exits 1. `pnpm perf:budget` (after `pnpm build`) fails when the entry chunk is over 480 kB raw, the first download over 1,500 kB or any other chunk (vendor files excepted) over 400 kB; the build at the time was an entry of 417 kB (119 kB gzip) and a first download of about 421 kB gzip, down from 2,488 kB raw. `pnpm audit --prod` must say "No known vulnerabilities". `node scripts/licences.mjs` rewrites `apps/web/public/licences.json` (44 production packages, no copyleft). `scripts/hooks/pre-commit` refuses a commit that adds something that looks like a key or a secrets file; it is **not installed** until you run `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` (or `git config core.hooksPath scripts/hooks`), and `git commit --no-verify` skips it for one commit.
- **Drive scripts** (Chrome through puppeteer-core against the smoke server, with the shots-all account): `drive-signup.mjs` (a new account must land on `/onboarding`), `drive-keep.mjs` (the chats are kept while you move around), `drive-talk.mjs` (opens the assistant on a screen and drives it), `drive-scroll.mjs` (clicks every tab and toggle from the middle of every screen and reports any that throws the page back to the top; must be 0), `drive-cards.mjs` (deals cards in focus mode, leaves it and counts cards outside the table; must be 0), `drive-headings.mjs` (every section heading with an action: the action must sit level with the title, and a link action must carry the See all chevron, so a plain text link there fails), `drive-home.mjs` (Home on a laptop at 1100, 1280 and 1600 pixels: the two halves of a row are one height and their cards start on one line, the reads under Knowledge are one height, and the Daily card's Check in button and round arrow are one height at the foot of the card; needs the shots-all account) and `drive-plan.mjs` (Plan my week in a browser: stage a fix, find a task by name, add it with its options, Keep, then check the server; it sweeps its own leftover tasks at the start and the end, because the plan lists at most twelve tasks with no estimate and earlier runs would crowd it).
- **Screenshots:** `node --experimental-strip-types scripts/smoke/shoot.mjs [routes]` against the smoke server (or `SHOOT_ORIGIN`), in light, dark or both (`SHOOT_THEME`), phone, laptop and a phone on its side, with the service worker cleared first, `SHOOT_MOTION=1` to keep animation, `SHOOT_OUT` for the folder, `SHOOT_LIST` for a JSON list of shots. `scripts/smoke/shots-all.mjs` prepares an account with real data behind every detail page (including Agency, scheduled reviews and the public client, invoice and agreement links), writes `scripts/smoke/state/shoot-token` and prints the list of every route; `SHOOT_TOKEN` reuses that account.
- **Typecheck and build:** `pnpm typecheck`, `pnpm build`, then `pnpm perf:budget` (see below).
- **Beyond the code:** a sound cannot be heard by a type check, so the sound switch and volume were checked in a browser by counting the audio sources started and stopped.
- Not built: an integration suite against D1 apart from the smoke run; load tests; a test of the webhook signature against a real provider; CI (nothing runs the suite on a push). A security section in the smoke test, the CSP browse and the exposed-files script now exist (above).
- Last results (2026-11-01): `pnpm typecheck` clean; shared tests 209 of 209; smoke 910 of 910, run twice (fresh and reused database); `scan.sh` clean; `pnpm audit --prod` clean; drivers pass (scroll: 77 clicks, 0 jumps; headings: 54 headings, all level; home, plan, cards, keep and signup on both paths); overflow and orphan probes 0 hits; CSP browse 0 messages; `perf:budget` within budget.

- **The two cron triggers, and running each by hand.** `apps/api/wrangler.jsonc` has two entries under `triggers.crons`: `*/15 * * * *` (`MAIN_CRON`, everything except water) and `0 */2 * * *` (`WATER_CRON`, only the water reminders), and `runScheduled(env, cron)` in `cron.ts` picks by the schedule it is given; any other schedule does both. Start the Worker with `--test-scheduled` (`pnpm dev` and `blueprint.sh` both do) and call it: `curl "http://127.0.0.1:8788/__scheduled?cron=0+*%2F2+*+*+*"` runs the two-hour trigger, `curl "http://127.0.0.1:8788/__scheduled?cron=*%2F15+*+*+*+*"` the fifteen-minute one, and `?cron=*+*+*+*+*` (what most of the smoke test uses) runs both. Use port 8787 for the dev server. The smoke test calls the two-hour one and the catch-all.

## 5. The critical scenarios, with status

The original twelve:

1. Anonymous visitor cannot access private pages: proven ("no session means 401").
2. A creator cannot view another's private data: proven for journal, finance, not-to-do, Agency records, templates and scheduled reviews; applications by code review only.
3. Brand A cannot view Brand B's campaigns: code review only (`orgRole`).
4. A disabled module rejects direct URL and API access: proven ("a switched-off app refuses its API" demands 403, "an override refuses the API too").
5. Club is inaccessible to unapproved or expired members: proven for club-only Work listings; club events by code review.
6. A closed opportunity rejects applications: code review (published only, deadline checked); not in the smoke test.
7. Capacity under simultaneous RSVPs: a conditional insert; not load-tested.
8. A duplicate webhook does nothing: code review (`INSERT OR IGNORE` on the event id); not in the smoke test because no provider runs locally.
9. Staff cannot act without the permission: proven ("a permission alone is not enough: the role must be staff", "taking the permission back closes it").
10. Deleting a person anonymises and keeps the books: proven, and Agency data goes with the account while an invoice stays with its totals only.
11. Journal entries never reach the page or Observability: proven.
12. A failed AI request stays safe: code review (the Companion falls back to the local reply).

Added since:

13. A client link never carries fees, private notes or other clients, and what is switched off is not sent: proven. A link set to looking only refuses approve and comment; a fresh link closes the old one.
14. An invoice's switches hide the bank, tax numbers, due date and notes before anything is sent: proven; a draft has no public page.
15. A signed agreement cannot be edited or signed twice; only the offered options are kept from a client's answers: proven.
16. Business metrics are refused until the person switches them on: proven.
17. The private calendar link carries no mood note, journal or task note, and a fresh link closes the old one: proven.
18. A scheduled review's reminder arrives once however often the cron runs, and moves the schedule on: proven.
19. A cap of three devices signs the oldest out and says why: proven.
20. A tab, a filter or a switch between views never throws the page back to the top, and the cards on the card table stay on the table when it shrinks: proven by `drive-scroll.mjs` and `drive-cards.mjs`, each shown to fail on the old code first.
21. The two-hour trigger sends only water, and the fifteen-minute one leaves water alone: the two-hour run is exercised in the smoke test (`water goes out every two hours at most`, `the two-hour water trigger runs`); which messages each trigger sends is by code review of `runScheduled`, not asserted.
22. A date that is not a real day (2026-11-31) is refused, and a typed key such as "constructor" finds nothing: proven in the smoke test.
23. A write that says it comes from another site is refused with 403 and changes nothing; a write from the site itself, with no Origin, or from a webhook goes through: proven.
24. An unknown origin gets no `Access-Control-Allow-Origin` on `/api/health`, `/api/me` or a preflight: proven.
25. Hidden, backup, dump, config and map files answer 404 while the files the site ships still answer 200: proven in the smoke test and by `check-exposed.sh`.
26. The site and the API carry the same enforcing policy and HSTS without preload, and the policy in `_headers` equals the one in code: proven. That the policy breaks nothing in a real browser: proven by `csp-browse.mjs` on 102 routes; with a real payment through bank pages, UPI and 3-D Secure: **not proven** (one test-mode payment with the console open is on the deploy list).
27. An address that is not public https (an IP number, localhost, an internal name, a login, an odd port) is refused by `publicHttpsUrl`: proven (26 addresses).
28. An alert is made only above its level and reaches every admin once an hour: proven.
29. A commit that adds something that looks like a key is refused by the pre-commit hook: proven on a throwaway repo; the hook is not installed in the working repo.

## 6. Deployment checklist as built

- [ ] `pnpm typecheck`, `pnpm build`, `pnpm perf:budget`, `pnpm --filter @kreators/shared test`, `bash scripts/smoke/blueprint.sh`, `bash scripts/scan.sh` and `pnpm audit --prod` all pass.
- [ ] `pnpm cf:whoami` shows the right account.
- [ ] **Migrate first, then deploy.** `pnpm db:migrate` applies the new migrations to the live database before the new code runs. If the code goes first, anything that touches a new table fails, and so do "Export my data" and "Delete account", until the migrations catch up. See which are pending with `pnpm --filter @kreators/api exec wrangler d1 migrations list kreators-life --remote`.
- [ ] Secrets set with `pnpm cf:secret <NAME>`: `ADMIN_KEY`, `CLICK_SALT`, and any in use of `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`, `YOUTUBE_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `REACH_URL`, `REACH_KEY`, `ASSISTANT_API_KEY`, `ASSISTANT_BASE_URL`, `ASSISTANT_MODEL`, `ASSISTANT_PRICE_IN`, `ASSISTANT_PRICE_OUT`, `ASSISTANT_ZDR`. The optional `AI` binding is the Companion's.
- [ ] **Worker variables** (plain variables, set in the Cloudflare dashboard or `wrangler.jsonc`, not secrets): `PUBLIC_URL` (the real site address; reset and unsubscribe links are built from it, so without it they use whatever address the request came to), `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_REG`, `BUSINESS_VAT`, and `DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, `DMCA_REGISTERED`. The contact, privacy, terms and copyright pages say "Being set up" for any that are empty, and marketing mail is not sent without a business address. `EMAIL_FROM` on the verified mail domain. Names are listed in `apps/api/.dev.vars.example`.
- [ ] `pnpm deploy` (it builds the web app, then deploys the Worker). This deploy also adds the second cron trigger (`0 */2 * * *`, water only) beside the fifteen-minute one, since both are listed in `apps/api/wrangler.jsonc`; check the Worker's triggers in the Cloudflare dashboard afterwards. Smart Placement (`placement` in `wrangler.jsonc`) is switched on by the same deploy.
- [ ] Sign up with the founder addresses before sharing the link.
- [ ] `pnpm cf:logs` open for the first minutes.
- [ ] A look at the live site: `/api/health` answers, a sign-in works, an app that is new opens.
- [ ] **Check the new rules on the live site:** `curl -sI https://<domain>/` shows the policy, HSTS and no `Access-Control-Allow-Origin`; `bash scripts/check-exposed.sh <domain>` reports nothing at 200; the privacy card appears once at the bottom left of a fresh browser and the footer's "Privacy choices" reopens it; the sign-up page will not submit with the terms box unticked.
- [ ] **One test-mode payment with the browser console open** (Razorpay test keys, a product priced in money): any line starting "Refused to..." is a policy gap. To roll back, change `Content-Security-Policy` to `Content-Security-Policy-Report-Only` in `apps/web/public/_headers` and `CSP_HEADER` in `apps/api/src/headers.ts`, then deploy. Bank pages, UPI apps and 3-D Secure were not exercised before.
- [ ] **Restore drill, once:** the practice steps in `docs/security/RESTORE.md` (a throwaway database from a `d1 export`, matching `users` counts), then write the date in that file. D1 Time Travel keeps 30 days.
- [ ] The owner's own steps from `docs/security/SECURITY_REPORT.md`: rotate the keys that were pasted in an earlier chat, two-factor everywhere, GitHub push protection and Dependabot, Cloudflare "Always Use HTTPS", spending caps, SPF, DKIM and DMARC, install the pre-commit hook.
- [ ] `docs/DECISIONS.md` has its line.
- **Pending migrations when this was written:** the files on disk run from 0001 to 0060. The ones added since 26 October 2026 were: 0052 product questions, 0053 timer settings on the account, 0054 Agency, 0055 Agency templates, 0056 focus quality and the calendar link, 0057 scheduled reviews and the review flag on a task, and (1 November) 0058 water reminders every two or four hours (it moves shorter choices to two hours and those between two and four hours to four), 0059 legal records (terms acceptances, privacy choices and their log, data requests, copyright notices) and 0060 performance (22 new indexes, three redundant ones dropped, and the `web_vitals` table; safe to run twice). The order is `pnpm db:migrate` for 0052 to 0060, then `pnpm deploy`. They were written and tested locally; whether each has been applied to the live database is for `migrations list --remote` to say.
- Not in place: a staging step, a database backup before migrating (take a `d1 export` first, see `RESTORE.md`), a rollback plan beyond redeploying the previous commit, CI, and alerting beyond the inbox (`alerts.ts`).
- The remote migration is run by the founder, not by a coding session.

## 7. How to brief a coding agent

`CLAUDE.md` is the system prompt; it is read automatically. A task should state the goal, the person and the screen, the rule from `CLAUDE.md` or the planner doc it touches, the tables and routes it may change, the pay or wait it adds, the smoke checks to add, the words to add to `TERMS` and the `HOW_TO` steps, and what it must not do. If a requirement conflicts with a decision in `docs/DECISIONS.md`, stop and name the decision. After the work, report changed files, migrations, the test runs with their output, and the DECISIONS line.

**Notes from building this way:**

- **Look at the real output.** A type check passes a sound that cannot play, a layout that clips, a card that sits outside its table and a button that scrolls the page away. Open it in a browser, or drive it with a script, and count what you can count. Make the new check fail on the old code before trusting it.
- **Parallel work edits disjoint files.** When several agents build at once, give each its own files, and keep the shared model and the API in one hand until they are done; two edits to one file at the same moment can lose one. Tell each agent what it must not touch and how to report a change it needs.
- **Do not run two servers on one port.** The smoke server is on 8788; a rebuild can stop it, so restart it before a browser check, and write each run to a new log.
- **One action, two callers.** The assistant, a coach and a screen all go through the same route and the same rule; never write a second version of an action for a second caller.
- **Never print a secret.** A key in a local `.dev.vars` is gitignored, but reading it into output exposes it; rotate any key that was printed.
- **A check must be able to fail.** Before trusting a new check, run it on the old code and watch it fail, then on the fix and watch it pass. A check that was never seen failing may be passing for the wrong reason (a condition on a value that was never found, an `|| true`, a log from an earlier run). `drive-home.mjs` and the late-task row in `drive-plan.mjs` were each shown to fail on the build that had the bug.
- **Local junk is safe to delete; the owner's material is not.** Safe: `apps/api/.wrangler/tmp`, `scripts/smoke/state` (the smoke database, its `v3/observability` folder and the saved account token; `blueprint.sh --fresh` or `shots-all.mjs` makes them again) and `scripts/smoke/shots`. Never delete `videos/` (the owner's recordings, gitignored) or `copyos/` (a source copy): they are the owner's material, not build output.
- **Keep what is true.** Update a doc in the same change as the code, with a line in `docs/DECISIONS.md` when the plan changed.

## 8. Example task

> Add a report button to Community posts.
>
> Read `CLAUDE.md`, then 02 K and 08 §4 here.
>
> Scope: a member can report a post once with a reason from a short list; reports land in a Manage queue for the `moderation` permission; hiding from the queue works as today; the author is told as today.
>
> Rules: a report is a row, not a hide; one report per person per post (unique index); reasons bounded by `oneOf`; the queue is a `DataTable`; the button is a checkbox row with the `toy` affordance; wording in `TERMS` if a new word is needed; a `HOW_TO` step under community; a rate limit on reports in `limits.ts`; the table goes in the export and in `deleteAccount`.
>
> Tests: smoke checks that a member can report once, a second report is a 409, a plain member cannot read the queue, a moderator can. Spacing and colour scans clean; the orphan and overflow probes run over the screen. A DECISIONS line.
>
> Not in scope: appeals, automated moderation, email.

## 9. Release history

What v0.1 planned as releases 0 to 7 shipped between 23 and 25 October 2026 in this order: the stack and the game; the super app's modules and listings; commerce, time and finance; circles and life; bond and the public page; school's real programs; links; sign-in rework; the not-to-do list; reviews; the store; unlocks, search and the glossary; Kreators Run; the move of the test tooling into the repo; then, on 26 October, the server-side module gate, the one limits file, the sign-up age and phone, the Club benefits, reward versions and paging everywhere.

Between 26 October and 1 November 2026: the calm-glass redesign; the setup chat; the strategy session in one conversation; life coaches; Discover and its add-ons (16 types, love languages, how your mind works, Human design, numerology); anonymous and threaded conversations; engagement reactions; the assistant, plans and credits; the card games and rewards catalog; tasks with do and due dates, repeat, priority, subtasks and Remember; Mindful minutes with focus sessions and sounds; the leaderboard; three devices an account; the line of the day; the Whop study; orphan words killed with a probe; Agency (clients, pipeline, invoices, agreements, templates, client links, business metrics); the Superfocus study (Plan my week, time blocks, pace, focus quality, Lo-fi, the calendar link); scheduled reviews; tabs that keep the page where it is. The next slices are the gaps these docs list.

## Known gaps

- Scenarios 3, 6, 7 and 8 (and applications in 2) need smoke coverage.
- No staging, no scheduled backup, no CI, alerts reach only the inbox, no load test. The restore drill has not been done once.
- A webhook has never been verified against a live provider, and no real payment has been made with the console open.
- The pre-commit hook is written but not installed.
- The sweep's reported-but-unchanged items (08 §13, 07 Known gaps) have no smoke checks yet; they wait for a decision on what the right behaviour is.
- The count of shared cases and smoke checks in this doc goes out of date with every slice; read it as a date-stamped figure.

## What changed since this was written (2026-11-01)

Since 26 October 2026: the smoke test grew from 298 to 857 checks and the shared tests to 256 cases; the migrations went from 0028 to 0058; the probes grew from contrast and overflow to include orphan words, and drive scripts check scrolling, cards, chats, the assistant and sign-up; scenarios 13 to 20 were added with proof; the deployment checklist says to migrate before deploying and lists the secrets in use; and the notes for a coding agent now say to look at real output, to give parallel agents separate files and to never print a secret.

**2026-11-01 (later that day):** a bug sweep (four reviewers) and a water-trigger change. The counts are 209 shared cases and 857 smoke checks, with migrations to 0058. New browser drivers: `drive-home.mjs`, and `drive-headings.mjs` now also fails a link action without the See all chevron; `drive-plan.mjs` sweeps its own leftover tasks. The app has two cron triggers (every fifteen minutes, and every two hours for water), each runnable by hand with `/__scheduled?cron=...` against a Worker started with `--test-scheduled`. The deploy order is `pnpm db:migrate` for 0052 to 0058, then `pnpm deploy`, which adds the second trigger. Two notes for a coding agent were added: a check must be able to fail, and which local files are safe to delete.

**2026-11-01 (later still, legal, security and performance pass):** the counts are now 209 shared cases and 910 smoke checks (35 new, in a security section), with migrations 0001 to 0060 (0059 legal records, 0060 indexes and `web_vitals`). New tools: `csp-browse.mjs` (102 routes, 0 violations), `perf-probe.mjs` (slow-phone numbers, report only), `scripts/check-exposed.sh`, `pnpm perf:budget`, `scripts/licences.mjs` and `scripts/hooks/pre-commit` (not installed); the contrast probe now reports against AA (3,375 hits down to 30 after the tokens were tuned). Scenarios 23 to 29 were added. The deploy list gained the Worker variables (`PUBLIC_URL`, `BUSINESS_*`, `DMCA_*`), the order `pnpm db:migrate` for 0052 to 0060 then `pnpm deploy` (which adds the second cron trigger), a header and exposed-files check on the live site, one test-mode payment with the console open, and the restore drill. `docs/security/` and `docs/performance.md` hold the detail.
