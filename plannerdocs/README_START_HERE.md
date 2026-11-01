# kreators.app planner docs: start here

**Last updated:** 2026-11-01

**Product:** kreators.app. The identifiers keep their old name: the Worker and database `kreators-life`, the `@kreators/*` packages, storage keys and the repo.
**Version:** 0.5, reconciled with the app on 1 November 2026, including that day's bug sweep, water-trigger change and legal, security and performance pass (v0.1 was the pre-build blueprint; 0.2 the audit; 0.3 on 26 October after the gaps it found were closed; 0.4 after the week that added Agency, planning, scheduled reviews and the redesign).
**Status:** these docs describe the app as built. When a doc and the code disagree, the doc is wrong unless it records a rule the app broke; those are listed under "Known gaps" at the end of each doc.

Where the truth lives:
- `CLAUDE.md` at the repo root is the rulebook. Its "Non-negotiable rules" and "Done means" override anything here.
- `README.md` is the long-form description of every part of the app.
- `docs/DECISIONS.md` is the dated history: one line per decision that changed the plan.
- `docs/security/` is the security pack: `SECURITY_REPORT.md` (the owner's 27 checks plus 7 bonus checks, each with status and evidence, the open items and the owner's own steps), `SECURITY_MAP.md` (what each route and secret guards), `SECURITY_RUNBOOK.md` (where to look, what each alert means, first actions), `SECRETS.md` (every secret and how to rotate it) and `RESTORE.md` (D1 Time Travel and the restore drill). `docs/performance.md` is the 31-item performance list with the budgets, the sizes before and after, and the query-count table.
- `10_Legal_Policies.pdf`, `11_App_Performance.pdf` and `12_App_Security.pdf` sit in this folder as the owner's own files. They are not specs and are not edited here.
- `docs/whop-study.md` and `docs/superfocus-study.md` are the two studies of other products: what was taken, where it went, and what was left out and why. `docs/copy-brief.md` is the one brief for the public site's words.
- `apps/web/src/lib/buildMap.ts` is the map of what is built and where things live, shown under Operations, Observability.
- The code: `packages/shared/src/index.ts` (the domain model), `apps/api/src` (the Worker), `apps/web/src` (the app and the public site), `apps/api/migrations` (the schema).

## What kreators.app is

Seven relationships as a daily game, with a creator super app around it.

- **The game.** Seven *pillars* (Servant leader, Friendship, Parent and child, Lover and partner, With yourself, With the guru, With the divine), each a *pyramid* of six layers built from a short vibe check: foundation, guiding principle, value goal, goal outcome, project, task. *Daily* is three boxes a day (check in, the small act, one task) plus a *not to do* list, and a *Plan my week* that suggests a day for each task that has none. Xp fills levels and pillars; points are spendable; badges are earned by the app's own count; honors are given by the team or unlocked by time; a character and an identity evolve with xp and days.
- **The super app.** Forty-six modules in six groups: Essentials (Home, Daily, Pillars, Search, Leaderboard, Inbox, Help, Assistant), Contribution (School, Work, Army, Win, Agency), Creation (Public page, Shop, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund), Connection (Games, Party, Kreators Run, Community, Club, Bond, Circles), Reflection (Discover, Life, Wellbeing, Mood, Sleep, Stress, Mindful minutes, Journal, Reviews, Companion, Coaching) and Operations (Manage, Admin, Observability, team only). Only School, Work, Army, Journal, Life, Shop and Public page start on, beside the essentials.
- **The public site** at `/`: the story, `/features`, `/7rp`, Explore, certificates, policy pages, a public page per creator at `/u/<handle>` that works like a link-in-bio, and the links a creator sends: `/i/<token>` for an invoice, `/k/<token>` for an agreement and `/a/<token>` for a client's dashboard.
- **Agency** for a content agency or a freelance creator: a dashboard per client, a deliverables pipeline as a list or a board, time, an invoice designer and calculator, agreements from templates, and a client link where the owner chooses what the client sees.

## State of the project (1 November 2026)

Everything described in 01 to 09 is built and tested locally: 60 migrations, 46 modules, 209 shared test cases and 910 smoke checks (the figures are date-stamped and change every slice). The work up to this date is committed; whether it has been deployed is not recorded in the repo. 09 §6 lists the migrations to apply before a deploy (0052 to 0060) and the order (migrate first, then deploy; the deploy adds a second cron trigger for water), the Worker variables to set (`PUBLIC_URL`, `BUSINESS_*`, `DMCA_*`) and the checks to make on the live site. On 1 November a bug sweep fixed what it proved; what it only reported is listed as open items, awaiting a decision, in 08 §13 and 07 Known gaps. The same day three launch checklists were worked through: legal and privacy (terms boxes, three privacy choices that start off, retention, policy pages; 07 §17 and 08 §14), security (an enforcing content security policy, no CORS, blocked paths, alerts; `docs/security/`, 08 §14) and performance (pages loaded on demand, the first download down from 2,488 kB to 417 kB for the entry, 22 new indexes; `docs/performance.md`). What is not built is listed under "Known gaps" at the end of each doc: no report button, no email or phone verification, no payments for plans and top-ups yet (`PAYMENTS_LIVE` is false), no staging step, no CI, no second factor, alerts only in the inbox, and the restore drill not yet done. What only the owner can do (rotate keys, two-factor, spending caps, mail records, the Worker variables) is at the end of 08 §14.

## How the v0.1 blueprint turned out

| v0.1 said | What happened |
| --- | --- |
| Four engines first: Army, School, Work, Party | All four are built. They are four of forty-six modules; School, Work and Army start on, Party starts off. |
| Thirteen composable roles | Three roles (Creator, Staff, Admin), nine staff permissions (Life coach is given on purpose, never held by an admin by default), and organizations for brands. See 01 §8. |
| Flags named `module.army`, `feature.*`, `ops.*` | Flags are the bare module keys (`army`, `store`) in `module_settings`, with overrides, a minimum role and a rollout percentage. Each person also has their own on/off per app. See 05. |
| Phases 0 to 6 over months | Built between 23 October and 1 November 2026, in the order DECISIONS.md records. |
| AI companion only after review | Companion is built with its boundaries written in (not a therapist, crisis line), off by default, with an optional Workers AI binding. See 08 §5. A second AI door exists, the assistant, which acts as the person with the same limits as a tap, is paid in credits and reads the journal only on request through a model that keeps nothing. See 07 §13 and 08 §7. |
| Parked: stored-value currency, random video chat, celebrity shout-outs, meme library, house or cafe, native apps, clinical claims | Still parked. Points are the only in-app unit and are not money. |
| Standalone URL shortener parked | Tracked links exist at `/go/<code>` as part of Content, not as a product. |
| Shop as affiliate bundles before inventory | Shop sells a creator's own products (points or money through Razorpay). The Store adds partner links and creator-to-creator pre-owned gear; kreators.app never holds goods or money. |

## What was added after v0.1

Not planned in v0.1 and now built: Discover (quizzes, add-ons, Human design, numerology); Coaching (life coaches, with links the student controls); the assistant, plans and credits; Agency; Mindful minutes with focus sessions and sounds; scheduled reviews, business metrics and a private calendar link; tasks with dates, repeat and priority; a leaderboard; card games and a rewards catalog; and the setup chat and the strategy session. Two studies (Whop and Superfocus) decided which ideas to take and which to leave.

## How to use this pack

1. Read `CLAUDE.md` first. Then the doc for the part you are changing. `CLAUDE.md` overrides a doc when they disagree.
2. `01` is scope, roles, journeys, metrics and the open decisions. `02` is the module index with the rules and the smoke check that proves each one. `03`, `04` and `05` are the architecture, the data dictionary and the flags. `06` is the design system and the patterns. `07` is every number that pays or charges, including plans and credits and Agency's billing. `08` is security, privacy and the Companion's and the assistant's limits, including what a client link can and cannot show and (§14) the full state after the security and privacy pass. `09` is testing, deployment (migrate first, then deploy), the probes and scripts and how to run each, and how to brief a coding agent.
3. Each doc ends with **Known gaps**, things the docs ask for that the app does not do yet, and **What changed since this was written**, a dated summary. Fix the app or change the rule; then update the doc and add a line to `docs/DECISIONS.md` the same day.
4. `creator-commerce-playbook.md` is research dated 24 October 2026 about a codename ("Booth") that became the Shop, Content, Auto-DM and Audience modules. Its status note at the top says what was adopted, and its last section says how it was used. It is not a spec.

## The v0.1 constraints and where they stand

- **One app, not one giant file.** Holds. One route file per module, each module's own tables, one shared domain model.
- **Modules independently enabled, hidden and permission-checked.** Holds. The server refuses the API of a module that is not available to the person (05).
- **Hiding a feature is not authorization.** Holds. Roles, permissions, ownership and module flags are all checked on the server.
- **The 10 TB collection and 25,000 books.** Nothing is ingested. Knowledge is curated resources seeded by migration 0005. The books idea in `shubham.md` must pass the rights review in 08 §6 first.
- **Never trained on what people write.** The terms and the privacy page say so; the assistant and the writing tool get only what the job needs, and the journal reaches only a model that keeps nothing. See 08 §7 and §14.
- **The Companion is not a therapist.** Holds in the module blurb, the screen, the system prompt and Help.
- **No stored-value "Kreators Cash".** Holds. The terms page says points are not money and cannot be cashed out.
- **Follower count is not the measure.** Holds. Trust scores use only what was earned here; Rank sorts by xp, streak or badges and never by followers.
- **Do not build every concept in the first release.** Not followed: nearly everything was built. The mitigation is defaults and flags: seven apps on (School, Work, Army, Journal, Life, Shop, Public page), the rest off until a person switches them on or the setup chat does, and every module behind a server-resolved flag an admin can turn off.

## Open assumptions

- First segment: aspiring and early-stage creators, college students. Unchanged and still unvalidated.
- School wedge: the two seeded programs teach editing and AI-assisted editing with ChatCut. The vox-pop program from v0.1 is not built.
- India first: INR is the default currency, Razorpay the provider, Tele-MANAS the crisis line, PAN and IFSC in KYC, GST and TDS in the invoice calculator. Plans are priced in US dollars.
- A responsive web app installed as a PWA. No native app, so no blocking of other apps and no two-way calendar sync (see `docs/superfocus-study.md`).
- Agency is for content agencies and freelance creators, not agencies in general. Agreements are a starting point and not legal advice, and a typed name is not a certified e-signature.
- Sign-up asks for a phone number and a date of birth. The minimum age is 18 and the server refuses anyone younger.

## What changed since this was written (2026-11-01)

Since 26 October 2026: the pack's figures were brought up to date (46 modules in six groups, nine permissions, 57 migrations); a state-of-the-project paragraph and a list of what was added after v0.1 were added; the reading order now includes the two studies and the copy brief; the Known-gaps rule gained a dated "What changed" section in each doc; and the notes on constraints now name the apps that start on and what a web app cannot do.

**2026-11-01 (later that day):** the figures are now 58 migrations (0001 to 0058), 209 shared cases and 857 smoke checks. 07 gained §16 (how points and money move safely), 08 gained §13 (what the bug sweep fixed and the open items it reported), and 09 gained the two cron triggers and how to run each by hand, the new browser drivers and two working lessons. 02 to 06 are updated separately.

**2026-11-01 (later still):** the figures are now 60 migrations (0001 to 0060), 209 shared cases and 910 smoke checks. New: `docs/security/` (five files) and `docs/performance.md`, both indexed above; 07 §17 (plans do not renew, the 14-day right to withdraw, marketing mail by recorded yes, seven-year records); 08 §14 (the state after the security, privacy and performance pass, the open items and the owner's manual actions); 09's new probes and scripts (`csp-browse.mjs`, `perf-probe.mjs`, `check-exposed.sh`, `pnpm perf:budget`, the contrast probe at AA), the pre-commit hook (not installed), and the deploy list (migrate 0052 to 0060, set the Worker variables, deploy, check headers, one test-mode payment, the restore drill). 01 to 06 are updated separately.
