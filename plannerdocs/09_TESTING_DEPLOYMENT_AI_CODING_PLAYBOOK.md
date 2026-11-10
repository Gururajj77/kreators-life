# 09 — Testing, deployment and the coding playbook

**Last updated:** 2026-11-07

**Product:** kreators.app
**Version:** 0.7, reconciled with the app on 7 November 2026 (0.6 was 5 November; 0.5 was 1 November 2026, 0.3 was 26 October 2026)
**Source of truth:** the "Commands" and "Done means" sections of `CLAUDE.md`; the shared tests in `packages/shared/src/*.test.ts`; `scripts/smoke/` (its file headers say how each script is used); `scripts/scan.sh`; `scripts/data-coverage.mjs`; `scripts/check-note-links.mjs`; `.github/workflows/ci.yml`; `scripts/flesch.py`; `scripts/check-exposed.sh`; `scripts/perf-budget.mjs`; `scripts/hooks/pre-commit`; the root `package.json`; `docs/DECISIONS.md`; `docs/security/`, `docs/performance.md` and `docs/launch-checklist.md`.

## 1. The core rule

One bounded slice at a time, with `CLAUDE.md` read first. `docs/DECISIONS.md` shows how the app was built that way: one dated line per slice. A slice is done when the "Done means" list passes and the thing has been looked at in a real browser. It is not done when the types agree or the happy path works.

## 2. Repository layout as built

```text
CLAUDE.md                 the rulebook (read first; it overrides these docs)
README.md                 the long description
SPEC.md                   the founder's original asks, ticked
docs/DECISIONS.md         dated decisions, newest at the bottom
docs/whop-study.md        what was taken from Whop, and what was left
docs/superfocus-study.md  what was taken from Superfocus, and what was left
docs/swiftui-rules.md     the 37-rule screen checklist (wave 8)
docs/launch-checklist.md  the legal launch checklist, with the open human steps
docs/security/            SECURITY_REPORT (27 checks + 7 bonus), SECURITY_MAP, SECURITY_RUNBOOK, SECRETS, RESTORE
docs/performance.md       the 31 items, the budgets, the query-count table
docs/copy-brief.md        the one brief for the public site's words
docs/time-blocks.md       the design for time blocks, day templates and the weekly pattern
docs/content-placement.md where each change is told: Help, the course, the site or the Admin guide
.github/workflows/ci.yml  the checks on every push and pull request (no smoke suite, no secrets)
apps/web/src/lib/buildMap.ts   where things live (shown under Dev Tools, Build map)
plannerdocs/              these docs
design/figma-tokens.json  the kit's values, frozen
apps/web/src              App.tsx, app.css, components/ (fx/ is the motion kit), screens/, site/, lib/
apps/web/public           icons, the share card, fonts/ (Google Sans Flex in two subsets, and Caveat), books/ (covers),
                          licences.json, resources/ (the skill files School links), app-art/ (Home's tile pictures)
apps/api/src              index.ts, access.ts, limits.ts, db.ts, ops.ts, payments.ts, credits.ts, rewards.ts, cron.ts, engage.ts,
                          logs.ts, account.ts, discounts.ts, unlocks.ts, attendee.ts, coaching.ts, discoverKeys.ts, lifecycle.ts,
                          agencyCycles.ts, agencyPaper.ts, agencyStats.ts, portalAccess.ts, agencyTeamAccess.ts, teamLinkAccess.ts,
                          headers.ts, safeurl.ts, alerts.ts, cachecontrol.ts, http.ts, notes.ts, fitness.ts, coachReport.ts, timeBlocks.ts,
                          liveCall.ts, assistant/, routes/
apps/api/migrations       0001 to 0128, plain SQL (122 files; 0090 to 0094 and 0107 were never used)
packages/shared/src       index.ts (a barrel of `export * from './<domain>.ts'`), one file per domain, twelve subpath
                          files outside the barrel, 42 test files (including insights.golden.test.ts, its fixtures and __golden__/)
scripts/                  scan.sh, data-coverage.mjs, check-note-links.mjs, flesch.py, icons.sh, icons/, figma-pull.py, figma-sections.py,
                          check-exposed.sh, perf-budget.mjs, app-art/ (the tile pictures and their check), admin-guide/ and onboarding-guide/ (the two guides),
                          licences.mjs, hooks/ (the pre-commit secret scan), assistant/ (the eval), books/ (the book courses and
                          draft Shop products), cards/ (the card seeds), reach/ (the Agent Reach bridge), smoke/
scripts/smoke             blueprint.sh, smoke.mjs, shoot.mjs, shots-all.mjs, the probes (contrast, overflow, orphan, rag, height, lone,
                          target, density, box, cut, bento, perf), csp-browse.mjs, the drive scripts, state/ and shots/ (ignored)
```

## 3. Done means

From `CLAUDE.md`: typecheck and build pass, shared tests pass, the smoke test passes, the spacing and colour scans are clean, and `docs/DECISIONS.md` has a line if the plan changed. In practice also:

- wording scores Flesch 60 or above (`python3 -I scripts/flesch.py --strings <file>`);
- after any edit to shared, `node --experimental-strip-types -e "import('./packages/shared/src/index.ts')"` must load (the smoke scripts load shared this way, so a new file needs its line in the barrel, with the `.ts` ending);
- a new app has a `HOW_TO` entry and its words are in `TERMS` (the shared test insists);
- a new badge uses a stat that already has a column in `getStats`; a new stat needs both;
- a new route file has a line in `MODULE_FOR_PREFIX` (`apps/api/src/access.ts`) or it is treated as core and always open;
- a new write route is in `ROUTE_LIMITS` (`apps/api/src/limits.ts`);
- a new table with a column naming a person has a line in `scripts/data-coverage.mjs`, saying its export key and what the delete does (`scan.sh` fails until it has one, and checks the line against `routes/me.ts` and `account.ts`);
- a new inbox note is written by `noteStmt`, with an `InboxKind`, and links to a real route and a hash the app draws (`scan.sh` runs `check-note-links.mjs`); a link it cannot work out carries a `note-link:` comment;
- a new app brings its picture for Home's tiles (`scripts/app-art/build.mjs`; `scan.sh` runs `--check`);
- a new tile grid uses `evenGrid` and `evenTile` from `lib/bento.ts`;
- a new name in a subpath file gets its own `manualChunks` line in `vite.config.ts` and an export in `packages/shared/package.json`, so the `shared` chunk does not grow;
- after touching colours, the contrast probe runs over every route in dark mode;
- after touching text or layout, these probes report 0: orphan on a laptop, overflow on a phone, lone and bento at 360, 390, 768 and 1280, cut at 360 and 390, height at phone, tablet and laptop, target, and box (with no sheet open); rag and orphan hits are read against the accepted list in §4;
- after touching a tab, a filter or a switch between views, `drive-scroll.mjs` reports 0;
- after touching a section heading, `drive-headings.mjs` reports 0 not level;
- a new fetch of an address a person influenced goes through `safeFetch` or `publicHttpsUrl` (`safeurl.ts`), and a typed link field is read with `httpUrl`;
- a change to the security headers or the policy is made in `headers.ts` and `_headers` together, then `csp-browse.mjs` runs over the shot list (0 violations);
- a new hidden or private path pattern goes in `blockedPath` and in `run_worker_first` in `wrangler.jsonc`, and `check-exposed.sh` still reports nothing at 200;
- after touching the web bundle, `pnpm build && pnpm perf:budget` says "Within budget";
- a new file is added to git in the same change (see §6);
- a screen that was built is opened in a browser and looked at.

## 4. Test layers as built

- **Unit (Vitest, shared):** 859 tests passing (2026-11-08) in 44 files. `index.test.ts` covers the older rules. These are money and fees in basis points; content reward payouts; time zones across daylight saving; booking slots; the circle matcher and interest groups; rollout buckets; the app defaults, groups and how-tos against the glossary; passwords; not to do streaks; periods, templates and scheduled reviews; store pictures and featured spots; trust and social reward caps; unlocks and the earning guide; Kreators Run; the sign-up age and phone rules; tasks (repeat, priority, dates); Discover; the week plan, plan strength, time blocks, pace and focus quality; the private calendar file; the setup chat's matching. Files of their own cover Human design and numerology (`design.test.ts`, pinned to published values), the invoice, documents, email notes and client onboarding for Agency, the Agency team, discount codes, journal prompts, the line of the day and the books, the breath patterns and the focus run, kind of day, app prefs, run discussions, the locale and Indian phone display, listing facts, the activity grid, Emerging (`insights.test.ts`, `emergence.test.ts`) and `fixes.test.ts`. **`insights.golden.test.ts`** pins Emerging's whole output for three fixtures (light, heavy and zoned, in `__golden__/*.json`), so a speed change can never change what a person is told.
- **End to end (the smoke test):** `bash scripts/smoke/blueprint.sh` builds the web app if there is no build, migrates and starts a second Worker on port 8788 with its own database under `scripts/smoke/state`. `--keep` leaves it up, `--fresh` wipes it first, `SMOKE_BUILD=1` rebuilds first. It then runs `scripts/smoke/smoke.mjs`, which imports the shared model straight from TypeScript and makes 2,607 checks (2026-11-08) in 71 sections. They run from health, auth, onboarding and the setup chat through tasks, kind of day, Daily, wellbeing, finance, the Shop, Community, Run and its discussions, School, Club and Work, the strategy session, the content strategist, admin, the assistant and credits (against a stand-in model it serves itself on port 8799), the Companion, attendee codes, life coaches and engagement. Agency has six sections of its own: the core, the lifecycle, documents, the team link, Agency across the app and the Agency team. Then come the week plan and calendar link, legal, security, export and delete, the month calendar, limits, channels, discount codes, badges, money guards (two taps pay or refund once), the feelings reader, Emerging, and good and bad habits. Every run sends its own `CF-Connecting-IP` so limits never block a rerun; the founder is `founder@smoke.test`. `SMOKE_MODEL=real SMOKE_RUN=eval ASSISTANT_API_KEY=… bash scripts/smoke/blueprint.sh` sends real messages to a real model and checks the tool calls (`scripts/assistant/eval.mjs`).
- **The free plan's limits (2026-11-07).** The suite's last check fails when any route or cron tick passes 45 D1 round trips (the test server sets `D1_GUARD`, which adds the numbers to each answer; `SMOKE_D1_REPORT=<file>` keeps them all, and the top twenty print). `scripts/smoke/cron-stress.mjs` runs with no server: every migration on a scratch file, a thousand people, 100 and then 900 of each reminder due at once, and a tick stopped dead at each of 40 points, held to the platform's 50 queries by `scripts/smoke/d1-shim.mjs`. `scripts/smoke/drive-day.mjs` drives one person's day in a real browser and prints how many people fit under each daily limit (`DRIVE_DAY_TOKEN` for an account with months of data). Numbers: docs/performance.md.
- **Reading a smoke result.** Write every run to its own new log file and read the count that run printed. Two things have gone wrong before: a monitor read an old log and reported an earlier count, and a test passed vacuously (an `|| true`, or a condition on a value that was never found). A check that can pass whatever the app does is not a check. Make it fail first on the old code, then pass.
- **CI (2026-11-07):** `.github/workflows/ci.yml` runs on every push and pull request: a frozen install, typecheck, shared tests, `scan.sh`, build and `pnpm perf:budget`. It is read-only, holds no secrets and pins each action to a commit. It has not run on GitHub yet: it starts on the next push, and that push must carry the uncommitted work or the checks may fail on missing files. The smoke suite stays local.
- **Design and data scans:** `bash scripts/scan.sh` checks spacing tokens, arbitrary pixels, raw spacing in `app.css`, hex colours, white on ink, raw HTML (`dangerouslySetInnerHTML`), an `<img>` without `alt`, the old product name, `font-extrabold` outside printed paper (nothing on a screen is heavier than 600), any `INTO notifications` outside `notes.ts`, every note's link (`check-note-links.mjs`), every app's picture (`app-art/build.mjs --check`) and what the export and the delete do with every table (`data-coverage.mjs`). `python3 -I scripts/flesch.py` scores the words.
- **Probes** (each is a `probeFile` for `shoot.mjs`: `SHOOT_PROBE=scripts/smoke/<name>.js`, run over a list of routes):
  - `contrast-probe.js`: every text node against its real background, judged by WCAG 2.2 AA (4.5:1 under 24px, 3:1 for large text). Fixed or sticky chrome under 88 percent opaque is a hit too. Run it in both modes: `SHOOT_THEME=both SHOOT_PROBE=scripts/smoke/contrast-probe.js SHOOT_LIST=shots.json node scripts/smoke/shoot.mjs`. It still misreads the sidebar's sliding pill and the white labels in the life map's funnel; both were checked on screen.
  - `overflow-probe.js`: a page that scrolls sideways, or an element that pokes past the screen. Must be 0 on a phone.
  - `orphan-probe.js`: a block of text that wraps and ends on one word. Must be 0 on a laptop; a phone may keep a rare long word.
  - `lone-probe.js`: a wrapping row of pills or buttons whose last line holds one item alone. Must be 0 at 360, 390, 768 and 1280.
  - `target-probe.js`: a tappable control smaller than 44 by 44 (inline links in running text are left out). Must be 0.
  - `height-probe.js`: a row of sibling cards of different heights. Must be 0 at phone, tablet and laptop width.
  - `cut-probe.js`: a one-line row of tabs or pills that scrolls sideways or cuts a pill (it should be a `TabRow`). Must be 0 at 360 and 390.
  - `box-probe.js`: a control that draws a shadow, fill or edge with square corners. Must be 0 with no sheet open.
  - `bento-probe.js`: a row of a tile grid that stops short of the full width, a row whose tiles are not one width, and a row of one beside rows of three or more. Seven columns, sideways rows and paper are left out. Must be 0 at 360, 390, 768 and 1280.
  - `rag-probe.js`: a line under 80% of the widest line above it since the last break made on purpose. Run after touching text or layout; it keeps a handful of accepted hits.
  - `density-probe.js`: copy too heavy for a phone, per docs/copy-brief.md; run at 390. Reading pages are left out, and a hit that stays is a reading page said so.
  - `csp-browse.mjs`: browses every route of a shot list in Chrome, opens a few sheets, loads the Razorpay checkout script and prints each Content-Security-Policy violation. It exits 1 if there is one. Recorded runs: 118 pages on 3 November and 114 on 4 November, 0 violations each. Run it: `bash scripts/smoke/blueprint.sh --keep`, then `node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json`, then `SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json node scripts/smoke/csp-browse.mjs`.
  - `perf-probe.mjs`: page speed on a slow phone (CPU slowed 4 times, "Slow 4G", cold cache) for the landing page, Home and Daily. It reports LCP, CLS, long tasks and JavaScript sent, and never passes or fails. `SHOOT_TOKEN=<token> node scripts/smoke/perf-probe.mjs` against the smoke server (`PERF_ORIGIN`, `PERF_CPU`, `PERF_RUNS` change it).
- **Beyond the smoke test (scripts at the repo root):**
  - `bash scripts/check-exposed.sh <domain or http://127.0.0.1:8788>` asks a site for files that must never be public (`.env`, `.git`, backups, dumps, config, source, maps). Any 200 is marked and exits 1.
  - `pnpm perf:budget` (after `pnpm build`) fails when the entry chunk is over 480 kB raw, the first download over 1,500 kB or any other chunk (vendor files excepted) over 400 kB. On 2026-11-08, after the trim, the entry was 447.9 kB, the first download 1,443.6 kB and the shared chunk 371.2 kB; after the spacing pass the same day, 448.7 kB and 1,444.4 kB; after the phone pass on 2026-11-09, 452.8 kB and 1,448.6 kB. Shared stays under 400 kB because `legal.ts` is split off as `shared-legal`, a leaf like `shared-lines`.
  - `pnpm audit --prod` must say "No known vulnerabilities".
  - `node scripts/licences.mjs` rewrites `apps/web/public/licences.json` (46 production packages at its last run, 2026-11-04). The two font families are listed on `/licences` and in `public/fonts/LICENSE.txt`.
  - `scripts/hooks/pre-commit` refuses a commit that adds something that looks like a key or a secrets file. It is installed in this machine's working repo (`.git/hooks/pre-commit`, the same file). A new clone needs `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` (or `git config core.hooksPath scripts/hooks`). `git commit --no-verify` skips it for one commit.
- **Drive scripts** (Chrome through puppeteer-core against the smoke server, with the shots-all account):
  - `drive-signup.mjs`: a new account must land on `/onboarding` (`DRIVE_START=welcome` takes the front door).
  - `drive-keep.mjs`: the chats are kept while you move around.
  - `drive-talk.mjs`: opens the assistant on a screen and drives it.
  - `drive-scroll.mjs`: clicks every tab and toggle from the middle of every screen; any that throws the page to the top is a hit. Must be 0.
  - `drive-cards.mjs`: deals six and nine cards in every game, in and out of focus mode. Cards covered, cards outside the table, cut cards with no Read all and hidden decks must all be 0. `CARDS_ORIGIN` and `CARDS_API` point it at a Vite server.
  - `drive-headings.mjs`: every section heading with an action. The action must sit level with the title, and a link action must carry its arrow icon.
  - `drive-home.mjs`: Home on a laptop at 1100, 1280 and 1600 pixels. The two halves of a row are one height, their cards start on one line, and the reads under Knowledge are one height.
  - `drive-plan.mjs`: Plan my week in a browser: stage a fix, find a task by name, add it, Keep, then check the server. It sweeps its own leftover tasks at the start and the end, and measures that a Fix row's day picker never squeezes the title.
  - `drive-focus-everywhere.mjs`: starts a focus clock and walks every signed-in page at phone and laptop width, checking the clock pill is there and counting. `FOCUS_PARTS=toggl,twotabs` drives the Toggl pass (Stop and Keep, Continue, the task sheet, keys, full screen) and checks that two tabs log one part once. Its default `FOCUS_ORIGIN` is the founder's dev app on 5173, so a coding agent sets `FOCUS_ORIGIN` and `FOCUS_API` to the smoke server on 8788.
- **Screenshots:** `node --experimental-strip-types scripts/smoke/shoot.mjs [routes]` against the smoke server (or `SHOOT_ORIGIN`), in light, dark or both (`SHOOT_THEME`). It covers phone, laptop and a phone on its side, clears the service worker first, and takes `SHOOT_MOTION=1` to keep animation, `SHOOT_OUT` for the folder and `SHOOT_LIST` for a JSON list of shots. `scripts/smoke/shots-all.mjs` prepares an account with real data behind every detail page (Agency, the public client, team, invoice and agreement links, scheduled reviews), writes `scripts/smoke/state/shoot-token` and prints about a hundred routes. `SHOOT_TOKEN` reuses that account.
- **Typecheck and build:** `pnpm typecheck`, `pnpm build`, then `pnpm perf:budget`.
- **Beyond the code:** a sound cannot be heard by a type check. The sound switch and volume were checked in a browser by counting the audio sources started and stopped.
- Not built: an integration suite against D1 apart from the smoke run; load tests; a test of the webhook signature against a real provider; a smoke run in CI.
- **Last results (2026-11-07, the end gate):** `pnpm typecheck` clean in all three packages; shared tests 851 passing in 42 files; `scan.sh` clean; the barrel loads with 1,101 exports; build and budget within limits (above). Migrations from zero: all 113 applied, 226 tables. Smoke passed 2,508 of 2,508 on an empty database and on a database kept between runs. Over the 123 routes of `shots-all.mjs` at 360, 390, 768 and 1280, both themes, each run on its own fresh account and every page checked to have drawn: overflow, lone, cut, height, bento, target and box were 0 in all eight runs (bento 0 at 1024 and 1440 in light too). Contrast hits are only the two known misreads, the sidebar's active tab and the funnel's white labels. Rag hits were 31 and 27 at 360, 15 and 15 at 390, 11 and 9 at 768, 13 and 13 at 1280 (light and dark); orphan hits 10 and 10, 3 and 3, 1 and 1, 0 and 0. They are `/privacy` table cells and paragraphs, one `/terms` paragraph, the owner's editable paper, test names, lesson titles beside their tag on a phone, "The Relationship Method" on `/book` and Club's blurb. Density is report only: `/` at 857 words, `/you` at 1,312, `/time-blocks` at 1,228 and the Build map. Not tested: CI on GitHub, real email, Safari and Firefox. After the founder's last five answers the gate ran once more: 851 tests, 2,508 of 2,508 on an empty database and on a kept one, and the same 123 routes at 390 and 1280 in both themes: overflow, lone, cut, height, bento, target and box 0, contrast only the two misreads, rag 17 and 16 at 390, 15 and 13 at 1280 (the extra hits are the test accounts' own names), orphan 3 and 3 at 390, 0 and 0 at 1280. The last gate (2026-11-08), after Bottlenecks, the event pages, the QR code, the phone's bell and the pages: 859 tests in 44 files, 2,607 of 2,607 on an empty database and on a kept one, migrations 0001 to 0122 from zero, and 125 routes at 360, 390, 768 and 1280 in both themes with overflow, lone, cut, height, bento, target and box 0 and only the known rag, orphan, contrast and density hits. The gate after the trim and Home's bell (8 November): 859 tests in 44 files, 2,607 of 2,607 on an empty database and on a kept one, migrations 0001 to 0123 from zero with 0110 and 0111 as edited and as committed (the same lessons both ways), entry 447.9 kB and first download 1,443.6 kB, and the 125 routes at the four widths in both themes again 0 for overflow, lone, cut, height, bento, target and box; rag 32 and 28 at 360, 13 and 13 at 390, 11 and 9 at 768, 13 and 13 at 1280; orphan 11 and 11, 3 and 3, 1 and 1, 0 and 0. The gate after the spacing passes (8 and 9 November): 859 tests in 44 files, 2,607 of 2,607 on the kept database (highest route 31 round trips), entry 448.7 kB and first download 1,444.4 kB, and the 125 routes at the four widths in both themes 0 for overflow, lone, cut, height, bento, target and box; rag 34 and 29 at 360, 14 and 14 at 390, 11 and 9 at 768, 13 and 13 at 1280; orphan 10 and 10, 3 and 3, 1 and 1, 0 and 0; the new spacing probe one hit a run (the /features close, the founder's call) and 0 in 89 popups. The last gate after the phone pass (9 November): the same 859 tests and 2,607 of 2,607 (highest route 31), entry 452.8 kB and first download 1,448.6 kB, the same zeros at the four widths in both themes once Home's line of the day stopped widening the page at 768 (its hidden measuring copy now empties after each measure); rag 36 and 31 at 360, 14 and 14 at 390, 11 and 9 at 768, 13 and 13 at 1280; orphan 11 and 10, 3 and 3, 1 and 1, 0 and 0; spacing one a run and 0 in 87 popups. The last gate, after the seven calls that followed (9 November): 859 tests, 2,607 of 2,607 on the kept database (highest route 31), entry 452.9 kB and first download 1,448.7 kB, drive-headings 0 of 98 and 0 spacing hits in 89 popups, and the 125 routes at the four widths in both themes 0 for overflow, lone, cut, height, bento, target, box and now spacing; rag 30 and 26 at 360, 14 and 14 at 390, 11 and 9 at 768, 13 and 13 at 1280; orphan 10 and 10, 3 and 3, 1 and 1, 0 and 0. The last gate after wave 24 (Connect people, the design passes on Admin, Dev Tools; 9 November): 859 tests, 2,686 of 2,686 on the kept database (highest route 31; `POST /admin/connect` 17), migrations 0001 to 0124, entry 453.0 kB and first download 1,448.8 kB, drive-headings 0 of 98, 0 spacing hits in 109 popups (the five admin sheets among them), csp-browse 0 on 129 pages, the 125 routes at the four widths in both themes with the same rag and orphan numbers and 0 for the rest, and the 24 admin and team routes at 390 and 1280 in both themes 0 for overflow, lone, cut, height, bento, target, box, contrast and spacing (their rag and orphan hits are stamped test names in table cells). The last gate after wave 25 (joining by invite with the waitlist and invite codes, their rewards and badges, the words; 10 November): 868 tests in 45 files, 2,765 of 2,765 on the kept database (highest route 31; a first run failed one check, a badge count bound of 60 that the 65 badges outgrew, raised to 70 as the shared test was), migrations 0001 to 0126, entry 454.9 kB and first download 1,453.4 kB, drive-headings 0 of 98, drive-scroll 0 of 158, 0 spacing hits in 109 popups, csp-browse 0 on 133 pages, drive-signup through Welcome with Invite only off and through an invite link with it on both landing on `/onboarding`, the 125 routes at the four widths in both themes 0 for overflow, lone, cut, height, bento, target, box and spacing (rag 31 and 28, 13 and 13, 11 and 9, 13 and 13; orphan 11 and 11, 3 and 3, 1 and 1, 0 and 0; the changes at 360 are stamped test names), and `/start` gated and `/join/<bad>` 0 hits at 360, 390, 768 and 1280 in both themes. The last gate after wave 26 (staff in Connect people, a brand's team joined by a yes, a cohort's manager; 10 November): 871 tests in 46 files, 2,836 of 2,836 on the kept database (731 routes, highest 31), migrations 0001 to 0128, entry 454.9 kB and first download 1,453.5 kB, drive-headings 0 of 98, drive-scroll 0 of 158, 0 spacing hits in 108 popups, csp-browse 0 on 158 pages, the 125 routes at the four widths in both themes as at wave 25 (one stamped rag line fewer at 360) once two fixes were in: Manage's thirteen tiles for an admin now read in two categories, and Connect people's cohort cell ties the program's last two words; the admin, staff, brand and Profile pages at 390 and 1280 drew with 0 overflow, lone, cut, height, bento, target, box and spacing; their rag and orphan hits are stamped test names and words in narrow table cells (Admin's Ops, Orders, Listings and Discounts tabs and the Admin guide's lesson titles at 390), which no earlier gate measured.
- **A trap in probes.** A test account has hourly read limits (limit `insights` 240, `coachRead` 300). About 100 shots on one account use them up, and the page then shows only error lines, so a probe's 0 hits is false. Check that a page really drew before you trust its count, and make a fresh account when a limit is near.
- **The cron trigger, and running it by hand.** `apps/api/wrangler.jsonc` has one entry under `triggers.crons`: `*/15 * * * *` (`MAIN_CRON`). `runScheduled(env, cron)` in `cron.ts` does nothing for any other schedule except a run by hand. Start the Worker with `--test-scheduled` (`blueprint.sh` does) and call it: `curl "http://127.0.0.1:8788/__scheduled?cron=*%2F15+*+*+*+*"` runs the fifteen-minute one, and `?cron=*+*+*+*+*` (what most of the smoke test uses) is the run by hand. Coding agents use the smoke server on 8788 only; 8787 and 5173 belong to the founder's dev app.

## 5. The critical scenarios, with status

The original twelve:

1. Anonymous visitor cannot access private pages: proven ("no session means 401").
2. A creator cannot view another's private data: proven for journal, finance, not to do, Agency records, templates, scheduled reviews and Emerging; applications by code review only.
3. Brand A cannot view Brand B's campaigns: code review only (`orgRole`).
4. A disabled module rejects direct URL and API access: proven ("a switched-off app refuses its API" demands 403, "an override refuses the API too").
5. Club is inaccessible to unapproved or expired members: proven for club-only Work listings; club events by code review.
6. A closed opportunity rejects applications: code review (published only, deadline checked); not in the smoke test.
7. Capacity under simultaneous RSVPs: a conditional insert. The smoke test proves that a full event waitlists and that two RSVPs from one person at once take one seat and charge one ticket. Two people racing for the last seat is not tested, and nothing is load-tested.
8. A duplicate webhook does nothing: code review (`INSERT OR IGNORE` on the event id); not in the smoke test because no provider runs locally.
9. Staff cannot act without the permission: proven ("a permission alone is not enough: the role must be staff", "taking the permission back closes it").
10. Deleting a person anonymises and keeps the books: proven. Agency data goes with the account while an invoice stays with its totals only. Since 2026-11-05 the person's product events and the page events about them go too (proven).
11. Journal entries never reach the page or Dev Tools: proven.
12. A failed AI request stays safe: proven for the Companion with a plan (a model failure falls back to the built-in companion, never a paywall); the assistant's 502 path by code review.

Added since:

13. A client link never carries fees, private notes or other clients, and what is switched off is not sent: proven. A link set to looking only refuses approve and comment; a fresh link closes the old one, which answers 410.
14. An invoice's switches hide the bank, tax numbers, due date and notes before anything is sent: proven; a draft has no public page.
15. A signed agreement cannot be edited or signed twice; only the offered options are kept from a client's answers: proven.
16. Business metrics are refused until the person switches them on: proven.
17. The private calendar link carries no mood note, journal or task note, and a fresh link closes the old one: proven.
18. A scheduled review's reminder arrives once however often the cron runs, and moves the schedule on: proven.
19. A cap of three devices signs the oldest out and says why: proven.
20. A tab, a filter or a switch between views never throws the page to the top, and the cards on the card table stay on the table when it shrinks: proven by `drive-scroll.mjs` and `drive-cards.mjs`, each shown to fail on the old code first.
21. The two-hour trigger sends only water, and the fifteen-minute one leaves water alone: the two-hour run is exercised in the smoke test; which messages each trigger sends is by code review of `runScheduled`, not asserted.
22. A date that is not a real day (2026-11-31) is refused, and a typed key such as "constructor" finds nothing: proven.
23. A write that says it comes from another site is refused with 403 and changes nothing; a write from the site itself, with no Origin, or from a webhook goes through: proven.
24. An unknown origin gets no `Access-Control-Allow-Origin` on `/api/health`, `/api/me` or a preflight: proven.
25. Hidden, backup, dump, config and map files answer 404 while the files the site ships still answer 200: proven in the smoke test and by `check-exposed.sh`.
26. The site and the API carry the same enforcing policy and HSTS without preload, and the policy in `_headers` equals the one in code: proven. That the policy breaks nothing in a real browser: proven by `csp-browse.mjs`. With a real payment through bank pages, UPI and 3-D Secure: **not proven** (one test-mode payment with the console open is on the deploy list).
27. An address that is not public https (an IP number, localhost, an internal name, a login, an odd port) is refused by `publicHttpsUrl`: proven.
28. An alert is made only above its level and reaches every admin once an hour: proven.
29. A commit that adds something that looks like a key is refused by the pre-commit hook: proven on a throwaway repo.
30. Two taps at once pay or refund once: proven in "Money guards". Three cancels at once refund a ticket once, three voids take a run's pay back once, three taps on Mark paid book an invoice's income once, and two taps on a code's last use give it to one.
31. A discount code is priced on the server, used once per person where it says so, and a refund does not give the use back: proven.
32. A client link or a team link with a password shows names only until it is unlocked, and a wrong password and an unknown link answer the same: proven.
33. The team link never carries invoices, agreements, documents, the retainer, onboarding or hours, and a team session opens no paper and no client link: proven. Renewing or re-passwording one link leaves the other working.
34. An Agency team member reaches only the tabs and levels the owner gave, never fees, the bank, private notes or the client link, and a client member reads only their own client: proven.
35. Emerging never shows journal words or notes, says what went together and never a cause, shows nothing for an app that is off, shows another account nothing, and answers in under 200 ms on the smoke server: proven. Its whole output is pinned by the golden test.

36. The export and the delete cover what a person wrote: proven ("Export and delete cover what a person wrote", which searches every column of every table afterwards), and `data-coverage.mjs` fails the scan for a new table with no line.
37. Every inbox note has a tab and opens a real place: proven (`inbox.test.ts` holds each kind in one tab, and `check-note-links.mjs` fails a link with no route or a hash nothing draws). Fifteen kinds of note and five direct links were opened with a real click and tap at 390 and 1440 on 7 November.
38. The shared admin key is held to ten tries per address, a right key gives its place back, and an admin's session is never counted: proven (Admin section).
39. A coach's report holds only what the link shares, and patterns need the student's own switch: proven (Life coaches and Coaching report sections, `coachReport.test.ts`).
40. Supplements reach nobody but their owner, and a tick twice makes one row: proven (Fitness section, `fitness.test.ts`, which also checks no-claim words and that insights, home, badges and the earning guide never name them).
41. A period that has not started is refused, and a daily review reminder opens the right day: proven (the Reviews and Daily review and fuller numbers sections). That the numbers read the person's own midnights is read in the code (`periodWindow`).
42. Gratitude prompts never repeat inside a round, two open days never share one, and a save loses no newer words: proven (Gratitude prompts per person section, `gratitude.test.ts`).
43. A lesson's resources: up to six, no repeat, only whoever may edit the program; every old `content_ref` reads as the same kind: proven (`lessonResources.test.ts`, School editing section; 58 links checked against the migration on 7 November).
44. Times on screen follow the person's zone and format, and an invalid format is refused: proven (`datePrefs.test.ts`).

## 6. Deployment checklist as built

- [ ] **Add the new files to git first.** `pnpm deploy` builds from the working tree, but a deploy from a clean clone, or a rollback, would miss anything not committed. The last commit is "alphav2.1", which holds every migration up to 0123. 204 tracked files have changed since (the spacing and placement passes, the phone pass, the seven calls after it, wave 24, wave 25 and wave 26), 4 are new and already added to git (`components/StickyAction.tsx`, `components/FollowAction.tsx`, `site/FollowStart.tsx`, `scripts/smoke/spacing-probe.js`) and 31 are new and not yet added, migrations 0124 to 0128 among them, so use `git add -A`. Check `git status` for any `??` line. Allow GitHub Actions and read CI's first run after the push.
- [ ] `pnpm typecheck`, `pnpm build`, `pnpm perf:budget`, `pnpm --filter @kreators/shared test`, `bash scripts/smoke/blueprint.sh`, `bash scripts/scan.sh` and `pnpm audit --prod` all pass.
- [ ] `pnpm cf:whoami` shows the right account.
- [ ] **Back up, then migrate, then deploy, in that order.** Take a `d1 export` first (see `docs/security/RESTORE.md`). Do not skip it this time: migrations 0101 and 0105 rebuild `reviews` and `review_templates` (each makes a new table, copies every row and drops the old one), so the backup is what saves a person's written reviews if a copy goes wrong. `pnpm db:migrate` applies the new migrations to the live database before the new code runs. If the code goes first, anything that touches a new table fails, and so do "Export my data" and "Delete account", until the migrations catch up. See which are pending with `pnpm --filter @kreators/api exec wrangler d1 migrations list kreators-life --remote`.
- [ ] Secrets set with `pnpm cf:secret <NAME>`: `ADMIN_KEY`, `CLICK_SALT`, and any in use of `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`, `YOUTUBE_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `REACH_URL`, `REACH_KEY`, `ASSISTANT_API_KEY`, `ASSISTANT_BASE_URL`, `ASSISTANT_MODEL`, `ASSISTANT_PRICE_IN`, `ASSISTANT_PRICE_OUT`, `ASSISTANT_ZDR`. The optional `AI` binding is the Companion's.
- [ ] **Worker variables** (plain variables, set in the Cloudflare dashboard or `wrangler.jsonc`, not secrets): `PUBLIC_URL` (reset and unsubscribe links are built from it), `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_REG`, `BUSINESS_VAT`, the Grievance Officer for India (`BUSINESS_GRIEVANCE_NAME`, `BUSINESS_GRIEVANCE_EMAIL` and, if wanted, `BUSINESS_GRIEVANCE_PHONE`), and `DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, `DMCA_REGISTERED`. The policy pages show "not set yet" for any that are empty, and marketing mail is not sent without a business address. `EMAIL_FROM` is on the verified mail domain. Most names are in `apps/api/.dev.vars.example`; the three grievance names are in `env.ts` and in a comment in `wrangler.jsonc`.
- [ ] **Copy any lesson edited on the live site into its file first.** Migrations 0110, 0111, 0122 and 0123 are `--sync` runs that put back the files' words (0122 for Onboarding 04, 05 and 11 and Admin 03 only, 0123 for Onboarding 04, 05 and 06 and Admin 03 and 04) and, for Onboarding, 0110 resets the order an admin changed. Every id, enrolment and cohort stays.
- [ ] `pnpm deploy` (it builds the web app, then deploys the Worker). The one cron trigger and Smart Placement are in `apps/api/wrangler.jsonc`. Check the Worker's triggers in the Cloudflare dashboard afterwards: only `*/15 * * * *` should be left. The old two-hour trigger can fire once around a deploy, and `runScheduled` does nothing for it. An open tab still draws the old water panel, so the water settings answer still carries its four old fields (`OPEN_OLD_TAB`, to go with the next deploy).
- [ ] Sign up with the founder addresses before sharing the link.
- [ ] `pnpm cf:logs` open for the first minutes.
- [ ] **Settle the free plan's limit, once.** Cloudflare's pages disagree: 50 subrequests an invocation in one place, 1,000 to its own services in another, and D1's own page says 50 queries. The app is built to 50. Signed in as a super admin on the live site, open the browser console and run `fetch('/api/internal/platform-limit', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage['kreators.session']).state.token } }).then((r) => r.json()).then(console.log)`. It asks `SELECT 1` until it is refused, so it changes nothing and reads no rows, and it answers how many queries that invocation made. Write the number in docs/performance.md.
- [ ] **Watch the daily limits.** The Cloudflare dashboard, D1, the database, Metrics shows rows read and written per day. Past 5 million read or 100,000 written, every query fails until midnight UTC, 05:30 IST. See docs/performance.md, the Free plan section, before the app has 150 active people a day.
- [ ] A look at the live site: `/api/health` answers, a sign-in works, an app that is new opens, and the type is Google Sans Flex (`/fonts/google-sans-flex-latin.woff2` answers 200).
- [ ] **The terms changed.** `LEGAL_VERSION` is 2026-11-10, so every existing account with an email sees the one-time terms notice once more. Check it appears for an older account and goes after it is accepted.
- [ ] **Check the rules on the live site:** `curl -sI https://<domain>/` shows the policy, HSTS and no `Access-Control-Allow-Origin`; `bash scripts/check-exposed.sh <domain>` reports nothing at 200; the privacy card appears once at the bottom left of a fresh browser and the footer's "Privacy choices" reopens it; the sign-up page will not submit with the terms box unticked.
- [ ] **One test-mode payment with the browser console open** (Razorpay test keys, a product priced in money): any line starting "Refused to..." is a policy gap. To roll back, change `Content-Security-Policy` to `Content-Security-Policy-Report-Only` in `apps/web/public/_headers` and `CSP_HEADER` in `apps/api/src/headers.ts`, then deploy. Bank pages, UPI apps and 3-D Secure were not exercised before.
- [ ] **Restore drill, once:** the practice steps in `docs/security/RESTORE.md` (a throwaway database from a `d1 export`, matching `users` counts), then write the date in that file. D1 Time Travel keeps 30 days.
- [ ] The owner's own steps from `docs/security/SECURITY_REPORT.md` and `docs/launch-checklist.md`: rotate the keys that were pasted in an earlier chat, two-factor everywhere, GitHub push protection and Dependabot, Cloudflare "Always Use HTTPS", spending caps, SPF, DKIM and DMARC.
- [ ] `docs/DECISIONS.md` has its line.
- **Migrations to apply.** The files on disk run from 0001 to 0128, 122 in all (0124 `team_connections` came with wave 24 and only adds a table; 0125 `invites` adds three tables and a column and switches Invite only on; 0126 `invites_guides` changes only lesson words; 0127 `connect_staff_orgs` rebuilds `team_connections` with two more kinds, keeping every row, and marks any organization member neither active nor invited as active; 0128 `connect_guides` changes only lesson words). 04's index lists each. `migrations list --remote` says which are pending; 0101 to 0128 had not been applied to the live database at the last gate, as far as any report knows. Most only add tables, columns or indexes. These also change data:
  - 0063 sets every Agency client that is not a lead to the delivery stage;
  - 0067 deletes duplicate paid questions and invoice income lines (keeping the earliest) before its unique indexes;
  - 0068 rewrites seven FunFlow cards, and 0072 adds cards after each deck's last one;
  - 0078 adds three School programs with `INSERT OR IGNORE`, so it is safe to run twice;
  - 0080 copies Run lines from `event_messages` into `run_messages`, then deletes them from `event_messages`;
  - 0098 fills `day_templates.color` for the starting templates;
  - **0101 and 0105 make `reviews` and `review_templates` again, each row copied as it was, indexes and the one-review-per-period rule rebuilt (take the backup);**
  - 0106 marks every gratitude prompt already written under as seen;
  - 0110 and 0111 put back the guides' words and add three lessons, safe to run twice; 0122 and 0123 do the same for the lessons changed after those two were committed;
  - 0112 deletes every stored water note, read, unread or archived;
  - 0113 copies every lesson's `content_ref` across as its first resource (`INSERT OR IGNORE`).
  Run `pnpm db:migrate` for everything `migrations list --remote` says is pending, then `pnpm deploy`. Each was written and tested locally; whether each has been applied to the live database is for `migrations list --remote` to say.
- Not in place: a staging step, a scheduled backup, a rollback plan beyond redeploying the previous commit, and paging. Alerts reach the inbox and, once `RESEND_API_KEY` is set, one email (`alerts.ts`).
- **After a deploy:** the founder's dev database needs `pnpm db:migrate:local` and a restart of `pnpm dev` too; the smoke database has them all.
- The remote migration is run by the founder, not by a coding session.

## 7. How to brief a coding agent

`CLAUDE.md` is the system prompt; it is read automatically. A task should state the goal, the person and the screen, and the rule from `CLAUDE.md` or the planner doc it touches. It should name the tables and routes it may change, the pay or wait it adds, the smoke checks to add, the words for `TERMS` and the `HOW_TO` steps, and what it must not do. If a requirement conflicts with a decision in `docs/DECISIONS.md`, stop and name the decision. After the work, report changed files, migrations, the test runs with their output, and the DECISIONS line.

**Notes from building this way:**

- **Look at the real output.** A type check passes a sound that cannot play, a layout that clips, a card outside its table and a button that scrolls the page away. Open it in a browser, or drive it with a script, and count what you can count.
- **Parallel work edits disjoint files.** When several agents build at once, give each its own files. Keep the shared model and the API in one hand until they are done; two edits to one file at once can lose one. Tell each agent what it must not touch and how to report a change it needs.
- **Ports.** The founder's dev app owns 5173 and 8787. Coding agents and test servers use the smoke server on 8788 only. Do not run two servers on one port. A rebuild can stop the smoke server, so restart it before a browser check, and write each run to a new log.
- **One action, two callers.** The assistant, a coach, an Agency team member and a screen all go through the same route and the same rule. Never write a second version of an action for a second caller.
- **Never print a secret.** A key in a local `.dev.vars` is gitignored, but reading it into output exposes it. Rotate any key that was printed.
- **A check must be able to fail.** Run a new check on the old code and watch it fail, then on the fix and watch it pass. A check never seen failing may pass for the wrong reason. `drive-home.mjs` and the late-task row in `drive-plan.mjs` were each shown to fail on the build that had the bug.
- **A speed change must not change the answer.** Pin the output first, then make it faster. Emerging's speed pass (one formatter per zone, one `GET /insights` a device day, a heavy rebuild from about 160 ms to 11 ms) was held to the same output by `insights.golden.test.ts`.
- **Commit new files with the change.** An untracked file works locally and in a local deploy, then goes missing from a clean clone. Check `git status` for `??` lines before calling a slice done.
- **Local junk is safe to delete; the owner's material is not.** Safe: `apps/api/.wrangler/tmp`, `scripts/smoke/state` (the smoke database and the saved account token; `blueprint.sh --fresh` or `shots-all.mjs` makes them again) and `scripts/smoke/shots`. Never delete `videos/` (the owner's recordings, gitignored) or `copyos/` (a source copy).
- **A probe's 0 can be false.** A test account's hourly read limits turn a page into error lines, and a probe then finds nothing wrong (see §4). Check that the page drew.
- **Check the "fixed" list against the code.** On 7 November, going back over three items a report called fixed found two gaps (the Meta webhook's compare, and four link fields), so a status is worth re-reading.
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
> Tests: smoke checks that a member can report once, a second report is a 409, a plain member cannot read the queue, a moderator can. Spacing and colour scans clean; the orphan, overflow and target probes run over the screen. New files added to git. A DECISIONS line.
>
> Not in scope: appeals, automated moderation, email.

## 9. Release history

What v0.1 planned as releases 0 to 7 shipped between 23 and 25 October 2026 in this order: the stack and the game; the super app's modules and listings; commerce, time and finance; circles and life; bond and the public page; school's real programs; links; sign-in rework; the not to do list; reviews; the store; unlocks, search and the glossary; Kreators Run; the move of the test tooling into the repo; then, on 26 October, the server-side module gate, the one limits file, the sign-up age and phone, the Club benefits, reward versions and paging everywhere.

Between 26 October and 1 November 2026: the calm-glass redesign; the setup chat; the strategy session in one conversation; life coaches; Discover and its add-ons (16 types, love languages, how your mind works, Human design, numerology); anonymous and threaded conversations; engagement reactions; the assistant, plans and credits; the card games and rewards catalog; tasks with do and due dates, repeat, priority, subtasks and Remember; focus sessions and sounds in Mindfulness; the leaderboard; three devices an account; the line of the day; the Whop study; orphan words killed with a probe; Agency (clients, pipeline, invoices, agreements, templates, client links, business metrics); the Superfocus study (Plan my week, time blocks, pace, focus quality, Lo-fi, the calendar link); scheduled reviews; tabs that keep the page where it is; the legal, security and performance pass.

Between 2 and 5 November 2026: journal prompts; chat channels; discount codes; 59 badges; the Agency lifecycle, documents, the password on a client link, client onboarding, the retainer, restoring a void, the Agency team and the team link; paper edited in place and Fill in the details; India first (rupees, a person's currency, +91 phones, PIN codes); the Mindfulness panel with Breathe and the Toggl pass; the motion kit and the wensity pieces; Emerging, with good and bad habits; kind of day; the founder's books and their School courses; the Companion on the assistant's model layer; Run discussions; app groups each person arranges; the shared model split into one file per domain; Google Sans Flex with Apple's text styles; fractal glass on the public site; new terms of use. The next slices are the gaps these docs list.

Between 6 and 7 November 2026: time blocks and day templates; By time block with suggestions; School program states, editing in place and two guides; cohort discussions; areas of life on a task; ways in to Emerging and kinds of day; the live call as a paid service; hide and unhide; gratitude for the day; Fitness, the eating check-in, supplements and Kreators Run's own tool; reviews from a day to a year by layer; Emerging by period with Your life; the coach's report, patterns, sections and invite link; dates and times in the person's zone and format; every inbox note in a tab and landing on its section; water notes gone; Home's picture tiles; even rows; several resources on a lesson; Agency's email notes; the export and delete over every table; CI, the admin key's door and alert emails; the tablet layout; one default order inside each group; the sidebar's bell.

## Known gaps

- Scenarios 3, 6 and 8 (and applications in 2) need smoke coverage. Scenario 7 lacks a test of two people racing for the last seat.
- No staging, no scheduled backup, nobody paged, no load test. The restore drill has not been done once. CI has not run on GitHub yet.
- A webhook has never been verified against a live provider, and no real payment has been made with the console open.
- The pre-commit hook is installed on this machine only; nothing makes a new clone install it.
- The Admin funnel counts have no smoke check. A run on 4 November listed it as still open, with the cron checks that were run by hand.
- `drive-focus-everywhere.mjs` had one flaky detached frame (4 November); it was not recorded as fixed.
- The contrast probe still misreads the sidebar's sliding pill and the life map's SVG labels.
- One smoke check still uses an old font path (`/fonts/inter-latin.woff2`) as a sample path for `blockedPath`; the check is still right, only the sample name is stale.
- No full driver pass or CSP browse is recorded for 5 to 7 November, and `check-exposed.sh` is not recorded as run on 7 November. No new third-party origin was added on those days.
- `shoot.mjs` run detached with a probe writes its hits but does not exit; a foreground run exits normally.
- After a crashed smoke run, its own admin stays an admin, on 8788 only.
- The sweep's reported-but-unchanged items (08 §13, 07 Known gaps) have no smoke checks yet; they wait for a decision on what the right behaviour is.
- The counts of shared tests and smoke checks in this doc go out of date with every slice; read them as date-stamped figures.

## What changed since this was written (2026-11-05)

Since 26 October 2026: the smoke test grew from 298 to 857 checks and the shared tests to 256 cases; the migrations went from 0028 to 0058; the probes grew from contrast and overflow to include orphan words, and drive scripts check scrolling, cards, chats, the assistant and sign-up; scenarios 13 to 20 were added with proof; the deployment checklist says to migrate before deploying and lists the secrets in use; and the notes for a coding agent now say to look at real output, to give parallel agents separate files and to never print a secret.

**2026-11-01 (later that day):** a bug sweep (four reviewers) and a water-trigger change. The counts were 209 shared cases and 857 smoke checks, with migrations to 0058. New browser drivers: `drive-home.mjs`, and `drive-headings.mjs` also failed a link action without the See all chevron; `drive-plan.mjs` sweeps its own leftover tasks. The app has two cron triggers (every fifteen minutes, and every two hours for water), each runnable by hand with `/__scheduled?cron=...`. Two notes for a coding agent were added: a check must be able to fail, and which local files are safe to delete.

**2026-11-01 (later still, legal, security and performance pass):** the counts were 209 shared cases and 910 smoke checks (35 new, in a security section), with migrations 0001 to 0060. New tools: `csp-browse.mjs`, `perf-probe.mjs`, `scripts/check-exposed.sh`, `pnpm perf:budget`, `scripts/licences.mjs` and `scripts/hooks/pre-commit`; the contrast probe began reporting against AA. Scenarios 23 to 29 were added. The deploy list gained the Worker variables, a header and exposed-files check on the live site, one test-mode payment with the console open, and the restore drill.

**2026-11-05 (version 0.6):** the counts are now 553 shared tests in 23 files and 1,610 smoke checks in 49 sections, with migrations 0001 to 0083. New probes: `box-probe.js` and `cut-probe.js`; `height-probe.js` is now described, and `lone` and `target` are held to 0; new driver: `drive-focus-everywhere.mjs`. The golden test pins Emerging's whole output. `scan.sh` also refuses an `<img>` without `alt` and anything heavier than 600. The size budget held with `legal.ts` split off as `shared-legal`. Scenarios 30 to 35 were added (money guards, discount codes, link passwords, the team link, the Agency team, Emerging), and scenarios 7, 10 and 12 were brought up to date. The deploy list now starts with adding the new files to git. It takes a backup before migrating. It names the migrations among 0061 to 0083 that change data. It adds the grievance variables. It checks the terms notice, since `LEGAL_VERSION` moved to 2026-11-05. The pre-commit hook is installed on this machine. Notes were added on ports, pinning output before a speed change, and committing new files.

**2026-11-07 (version 0.7):** the counts are now 859 shared tests in 44 files and 2,607 smoke checks in 71 sections (as of 8 November), with migrations 0001 to 0123. New: CI; three more guards in `scan.sh` (`data-coverage.mjs`, `check-note-links.mjs`, `app-art/build.mjs --check`) and a fourth refusing any other `INTO notifications`; the probes `bento-probe.js` and `rag-probe.js` are listed here, with 768 counted for the first time. The cron has one trigger. The deploy list says to take the backup before 0101 and 0105, to copy lesson edits before 0110 and 0111, and to check that the old trigger is gone. Scenarios 36 to 44 were added. The size budget held: entry 447.9 kB, first download 1,443.6 kB after the trim (8 November).
