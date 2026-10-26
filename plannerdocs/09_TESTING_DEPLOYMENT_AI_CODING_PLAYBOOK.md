# 09 — Testing, deployment and the coding playbook

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** the "Commands" and "Done means" sections of `CLAUDE.md`; `packages/shared/src/index.test.ts`; `scripts/smoke/`; `scripts/scan.sh`; `scripts/flesch.py`; the root `package.json`.

## 1. The core rule

One bounded slice at a time, with `CLAUDE.md` read first. `docs/DECISIONS.md` shows how the app was built that way: one dated line per slice, 23 to 25 October 2026. A slice is done when the "Done means" list passes, not when the happy path works.

## 2. Repository layout as built

```text
CLAUDE.md                 the rulebook
README.md                 the long description
SPEC.md                   the founder's original asks, ticked
docs/DECISIONS.md         dated decisions, newest at the bottom
docs/build-map.html       where things live (embedded under Observability)
plannerdocs/              these docs
design/figma-tokens.json  the kit's values, frozen
apps/web/src              App.tsx, app.css, components/, screens/, site/, lib/
apps/web/public           icons, the share card, resources/ (the skill files School links)
apps/api/src              index.ts, access.ts, db.ts, ops.ts, payments.ts, rewards.ts, cron.ts, routes/
apps/api/migrations       0001 to 0027, plain SQL
packages/shared/src       index.ts (the domain model), index.test.ts
scripts/                  scan.sh, flesch.py, icons.sh, figma-pull.py, smoke/
scripts/smoke             blueprint.sh, smoke.mjs, shoot.mjs, contrast-probe.js, state/ and shots/ (ignored)
```

## 3. Done means

From `CLAUDE.md`: typecheck and build pass, shared tests pass, the smoke test passes, the spacing and colour scans are clean, and `docs/DECISIONS.md` has a line if the plan changed. In practice also: wording scores Flesch 60 or above, a new app has a `HOW_TO` entry and its words are in `TERMS`, and after touching colours the contrast probe runs over every route in dark mode.

## 4. Test layers as built

- **Unit (Vitest, shared):** 40 cases in 17 groups: money and fees in basis points; content reward payouts; time zones across daylight saving; booking slots, buffers, overrides, notice and horizon; the circle matcher and interest groups; rollout buckets; Home's guidance line; circles' colours and weekly roll; the app defaults and groups; passwords; not-to-do streaks; periods and templates; store pictures and featured spots; trust and social reward caps; unlocks and the earning guide; how-tos against the glossary; Kreators Run windows, labels, streaks and badges; the sign-up age and phone rules.
- **End to end (the smoke test):** `bash scripts/smoke/blueprint.sh` builds the web app if needed, migrates and starts a second Worker on port 8788 with its own database under `scripts/smoke/state` (`--keep` leaves it up, `--fresh` wipes it), then runs `scripts/smoke/smoke.mjs`, which imports the shared model straight from TypeScript and makes 257 checks over the API: headers, auth (including the age and phone rules), onboarding, the game, not-to-do, wellbeing, journal, life, home, finance, shop, community, the public page, reviews, the store, Kreators Run, school, staff and admin, the Club's benefits, reward changes, pages, flags (a switched-off module answers 403), observability, search, export and delete, and the limits. Every run sends its own `CF-Connecting-IP` so limits never block a rerun; the founder is `founder@smoke.test`.
- **Design scans:** `bash scripts/scan.sh` (spacing tokens, arbitrary pixels, hex colours, white on ink, the old name); `python3 -I scripts/flesch.py`; `scripts/smoke/contrast-probe.js` as the `SHOOT_PROBE` step of `node scripts/smoke/shoot.mjs`.
- **Screenshots:** `node scripts/smoke/shoot.mjs [routes]` with puppeteer-core driving the installed Chrome, against the smoke server (or `SHOOT_ORIGIN`), in light, dark or both (`SHOOT_THEME`), phone, laptop and a phone on its side, with the service worker cleared first.
- **Typecheck and build:** `pnpm typecheck`, `pnpm build`.
- Not built: an integration suite against D1 apart from the smoke run; a security suite; load tests.

## 5. The twelve critical scenarios, with status

1. Anonymous visitor cannot access private pages: proven ("no session means 401").
2. A creator cannot view another's private data: proven for journal, finance and not-to-do; applications by code review only.
3. Brand A cannot view Brand B's campaigns: code review only (`orgRole`).
4. A disabled module rejects direct URL and API access: proven ("a switched-off app refuses its API" demands 403, "an override refuses the API too").
5. Club is inaccessible to unapproved or expired members: proven for club-only Work listings ("a non-member does not see a club-only listing", "nor open it", "nor apply"); club events by code review.
6. A closed opportunity rejects applications: code review (published only, deadline checked); not in the smoke test.
7. Capacity under simultaneous RSVPs: a conditional insert; not load-tested.
8. A duplicate webhook does nothing: code review (`INSERT OR IGNORE` on the event id); not in the smoke test because no provider runs locally.
9. Staff cannot act without the permission: proven ("a permission alone is not enough: the role must be staff", "taking the permission back closes it").
10. Deleting a person anonymises and keeps the books: proven.
11. Journal entries never reach the page or Observability: proven.
12. A failed AI request stays safe: code review (the Companion falls back to the local reply).

## 6. Deployment checklist as built

- [ ] `pnpm typecheck`, `pnpm build`, `pnpm --filter @kreators/shared test`, `bash scripts/smoke/blueprint.sh`, `bash scripts/scan.sh` all pass.
- [ ] `pnpm cf:whoami` shows the right account.
- [ ] `pnpm db:migrate` applied the new migrations to the live database.
- [ ] Secrets set with `pnpm cf:secret`: `ADMIN_KEY`, `CLICK_SALT`, and any of `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, `YOUTUBE_API_KEY`, `RAZORPAY_*`, `META_*` in use.
- [ ] `pnpm deploy`.
- [ ] Sign up with the founder addresses before sharing the link.
- [ ] `pnpm cf:logs` open for the first minutes.
- [ ] `docs/DECISIONS.md` has its line.
- Not in place: a staging step, a database backup before migrating, a rollback plan beyond redeploying the previous commit, alerting.

## 7. How to brief a coding agent

`CLAUDE.md` is the system prompt; it is read automatically. A task should state the goal, the person and the screen, the rule from `CLAUDE.md` or the planner doc it touches, the tables and routes it may change, the pay or wait it adds, the smoke checks to add, the words to add to `TERMS` and the `HOW_TO` steps, and what it must not do. If a requirement conflicts with a decision in `docs/DECISIONS.md`, stop and name the decision. After the work, report changed files, migrations, the test runs with their output, and the DECISIONS line.

## 8. Example task

> Add a report button to Community posts.
>
> Read `CLAUDE.md`, then 02 K and 08 §4 here.
>
> Scope: a member can report a post once with a reason from a short list; reports land in a Manage queue for the `moderation` permission; hiding from the queue works as today; the author is told as today.
>
> Rules: a report is a row, not a hide; one report per person per post (unique index); reasons bounded by `oneOf`; the queue is a `DataTable`; the button is a checkbox row with the `toy` affordance; wording in `TERMS` if a new word is needed; a `HOW_TO` step under community; a rate limit on reports.
>
> Tests: smoke checks that a member can report once, a second report is a 409, a plain member cannot read the queue, a moderator can. Spacing and colour scans clean. A DECISIONS line.
>
> Not in scope: appeals, automated moderation, email.

## 9. Release history

What v0.1 planned as releases 0 to 7 shipped between 23 and 25 October 2026 in this order: the stack and the game; the super app's modules and listings; commerce, time and finance; circles and life; bond and the public page; school's real programs; links; sign-in rework; the not-to-do list; reviews; the store; unlocks, search and the glossary; Kreators Run; the move of the test tooling into the repo; then, on 26 October, the server-side module gate, the one limits file, the sign-up age and phone, the Club benefits, reward versions and paging everywhere. The next slices are the gaps these docs list.

## Known gaps

- Scenarios 2, 3, 6, 7 and 8 need smoke coverage.
- No staging, no backup step, no alerting, no load test.
