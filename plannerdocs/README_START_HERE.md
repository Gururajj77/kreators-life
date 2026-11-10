# kreators.app planner docs: start here

**Last updated:** 2026-11-07

**Product:** kreators.app. The identifiers keep their old name: the Worker and database `kreators-life`, the `@kreators/*` packages, storage keys and the repo.
**Version:** 0.7, reconciled with the app on 7 November 2026 (v0.1 was the pre-build blueprint; 0.2 the audit; 0.3 on 26 October after the gaps it found were closed; 0.4 after the week that added Agency, planning, scheduled reviews and the redesign; 0.5 on 1 November after that day's bug sweep and the legal, security and performance pass; 0.6 on 5 November).
**Status:** these docs describe the app as built. When a doc and the code disagree, the doc is wrong unless it records a rule the app broke; those are listed under "Known gaps" at the end of each doc.

Where the truth lives:
- `CLAUDE.md` at the repo root is the rulebook. Its "Non-negotiable rules" and "Done means" override anything here.
- `README.md` is the long-form description of every part of the app.
- `docs/DECISIONS.md` is the dated history: one line per decision that changed the plan.
- `docs/security/` is the security pack: `SECURITY_REPORT.md` (the owner's 27 checks plus 7 bonus checks, each with status and evidence, the open items and the owner's own steps), `SECURITY_MAP.md` (what each route and secret guards), `SECURITY_RUNBOOK.md` (where to look, what each alert means, first actions), `SECRETS.md` (every secret and how to rotate it) and `RESTORE.md` (D1 Time Travel and the restore drill). `docs/performance.md` is the 31-item performance list with the budgets, the sizes before and after, and the query-count table.
- `10_Legal_Policies.pdf`, `11_App_Performance.pdf` and `12_App_Security.pdf` sit in this folder as the owner's own files. They are not specs and are not edited here.
- `docs/launch-checklist.md` is the legal launch checklist, worked from `10_Legal_Policies.pdf`, with what is still open.
- `docs/whop-study.md` and `docs/superfocus-study.md` are the two studies of other products: what was taken, where it went, and what was left out and why. `docs/copy-brief.md` is the one brief for the public site's words. `docs/time-blocks.md` is the design for time blocks and day templates. `docs/content-placement.md` says where each change is told (Help, the course, the site or the Admin guide). `docs/swiftui-rules.md` is a checklist of 37 rules, translated from a SwiftUI skill into web terms. It sits under CLAUDE.md and never restyles anything.
- `apps/web/src/lib/buildMap.ts` is the map of what is built and where things live, shown under Operations, Dev Tools.
- The code: `packages/shared/src` (the domain model; `index.ts` is only a barrel over one file per domain, with twelve subpath files beside it), `apps/api/src` (the Worker), `apps/web/src` (the app and the public site), `apps/api/migrations` (the schema).

## What kreators.app is

Seven relationships as a daily game, with a creator super app around it.

- **The game.** Seven *pillars* (Servitude, Friends, Family, Love, Yourself, Teachers, Faith), each a *pyramid* of six layers built from a short vibe check: foundation, guiding principle, value goal, goal outcome, project, task. *Daily* is three boxes a day (check in, the small act, one task) plus a *not to do* list, a Habits list, a kind of day with time blocks that give the day a shape, a month calendar and a *Plan my week* that suggests a day for each task that has none. Xp fills levels and pillars; points are spendable. Badges are 59 medals in ten families, earned by the app's own count. Honors are given by the team or unlocked by time. A character and an identity evolve with xp and days.
- **Emerging.** Patterns read across a person's own apps, by rules and with no model, over the last eight weeks or any period from a day to a year, with a dashboard of the five areas and the seven pillars. A task done again and again can show as a good or a bad habit, set against mood, sleep and stress on days with it and without. Nothing is stored, a line never says one thing causes another, and a coach reads it only through the student's own switch.
- **The super app.** Forty-seven modules (counted from `MODULES` in shared `modules.ts`) in six groups, always in this order, with the apps in their default order: Contribution (School, Work, Army, Win, Agency), Reflection (Life, Journal, Reviews, Mindfulness, Fitness, Wellbeing, Mood, Sleep, Stress, Coaching, Companion, Discover), Connection (Community, Kreators Run, Club, Party, Bond, Circles, Games), Creation (Shop, Public page, Content, Audience, Auto-DM, Finance, Fund, TV, Knowledge, Tools, Store, My purchases), Essentials (Home, Daily, Pillars, Search, Leaderboard, Inbox, Help, Assistant) and Operations (Admin, Manage, Dev Tools, team only). Only School, Work, Army, Journal, Life, Shop and Public page start on, beside the essentials. Each person hides and unhides apps, and picks which groups start open and the order of the apps inside a group.
- **The public site** at `/`: the story, `/features`, `/7rp`, the founder's three books at `/features/books`, Explore, certificates, policy pages, a public page per creator at `/u/<handle>` that works like a link-in-bio, and the links an Agency owner sends: `/i/<token>` for an invoice, `/k/<token>` for an agreement, `/d/<token>` for another document, `/a/<token>` for a client's page and `/t/<token>` for the client's own team.
- **Agency** for a content agency or a freelance creator: a dashboard per client, a deliverables pipeline as a list or a board, time, an invoice designer and calculator, agreements and documents edited in place on the paper that prints, and a stage bar from first contact to a running retainer. Each client gets a link behind a password the owner sets, a short onboarding form, and a second team link that never shows money or paperwork. The owner can add a team and give each member Off, View or Edit per tab.

## State of the project (7 November 2026)

Everything described in 01 to 09 is built and tested locally: 126 migrations (0001 to 0132), 230 tables, 47 modules, 871 shared test cases and 2,921 smoke checks. These figures are date-stamped and change every slice. The last commit, "alphav2.2", holds every migration up to 0128 and everything through wave 26 (staff in Connect people, a brand's team joined by a yes, a cohort's manager). The work since (wave 27: Connect people by rank, place and pay, a referral paid once the person has used the app on three different days, a block that closes every waiting ask between two people, and the fixes from its break-it check) is not committed yet: seven files are new and not added, among them migrations 0129 (`invite_active`), 0130 (`rank_place_pay_guides`), 0131 (`connect_made_as`) and 0132 (`connect_rank_guide`). Once 0125 runs, Invite only is on: a new account needs an invite code until an admin turns it off. The live site runs an earlier deploy; `migrations list --remote` says which migrations it has, and as far as any report knows 0101 to 0132 are not on it.

Before the next deploy, 09 §6 gives the order: add the new files to git, take a backup, migrate, deploy. Migrations 0101 and 0105 rebuild the two review tables, so the backup matters. 0110 and 0111 put back the guides' words, so a lesson edited on the live site is copied into its file first. The old two-hour water trigger goes with the deploy. `LEGAL_VERSION` is now 2026-11-07, so every account with an email sees the one-time terms notice again.

The three launch checklists of 1 November still stand: legal and privacy (07 §17 and 08 §14), security (`docs/security/`, 08 §14) and performance (`docs/performance.md`). The performance budget holds: the entry is 454.9 kB of 480, the first download 1,453.5 kB of 1,500, and the shared chunk 373.2 kB of 400. What is not built is listed under "Known gaps" at the end of each doc. The main ones: no report button on posts and replies (a line in a chat channel, a run discussion or a cohort discussion can be reported, and becomes a help ticket), no email or phone verification, no payments for plans, top-ups and the live call yet (`PAYMENTS_LIVE` is false), no staging step, no second factor for staff (left out for now), nobody paged by an alert, CI not yet run on GitHub, and the restore drill not yet done. What only the owner can do (rotate keys, two-factor, spending caps, mail records, the Worker variables, allowing GitHub Actions) is at the end of 08 §14.

## How the v0.1 blueprint turned out

| v0.1 said | What happened |
| --- | --- |
| Four engines first: Army, School, Work, Party | All four are built. They are four of forty-seven modules; School, Work and Army start on, Party starts off. |
| Thirteen composable roles | Three roles (Creator, Staff, Admin), nine staff permissions (Life coach is given on purpose, never held by an admin by default), and organizations for brands. See 01 §8. |
| Flags named `module.army`, `feature.*`, `ops.*` | Flags are the bare module keys (`army`, `store`) in `module_settings`, with overrides, a minimum role and a rollout percentage. Each person also has their own on/off per app. See 05. |
| Phases 0 to 6 over months | Built between 23 October and 7 November 2026, in the order DECISIONS.md records. |
| AI companion only after review | Companion is built with its boundaries written in (not a therapist, not for emergencies, crisis line), off by default. With a plan it answers through the assistant's model layer and only reads; without one, the built-in companion answers free. Crisis words are checked before any model call. See 08 §5. A second AI door exists, the assistant, which acts as the person with the same limits as a tap, is paid in credits and reads the journal only on request through a model that keeps nothing. See 07 §13 and 08 §7. |
| Parked: stored-value currency, random video chat, celebrity shout-outs, meme library, house or cafe, native apps, clinical claims | Still parked. Points are the only in-app unit and are not money. |
| Standalone URL shortener parked | Tracked links exist at `/go/<code>` as part of Content, not as a product. |
| Shop as affiliate bundles before inventory | Shop sells a creator's own products (points or money through Razorpay). The Store adds partner links and creator-to-creator pre-owned gear; kreators.app never holds goods or money. |

## What was added after v0.1

Not planned in v0.1 and now built: Discover (quizzes, add-ons, Human design, numerology); Coaching (life coaches, with links the student controls); the assistant, plans and credits; Agency, with its lifecycle, client passwords, onboarding, retainers, a Team tab and a team link; Mindfulness with breathing, focus sessions and sounds; scheduled reviews, business metrics and a private calendar link; tasks with dates, repeat, priority and a habit tag; Emerging, with good and bad habits; a month calendar and a kind of day on Daily; journal prompts; badges as medals; chat channels in Community and Bond, and discussions in Run; discount codes; a leaderboard; card games and a rewards catalog; the founder's three books, as School courses and a Book page; the setup chat and the strategy session; and, on 6 and 7 November, time blocks, Fitness, gratitude for the day, reviews by layer, a coach's report and the live call as a paid service. Two studies (Whop and Superfocus) decided which ideas to take and which to leave.

## How to use this pack

1. Read `CLAUDE.md` first. Then the doc for the part you are changing. `CLAUDE.md` overrides a doc when they disagree.
2. `01` is scope, roles, journeys, metrics and the open decisions. `02` is the module index with the rules and the smoke check that proves each one. `03`, `04` and `05` are the architecture (with the guards and CI in §10b), the data dictionary and the flags. `06` is the design system and the patterns. `07` is every number that pays or charges, including plans and credits and Agency's billing. `08` is security, privacy and the Companion's and the assistant's limits, including what a client link can and cannot show, (§14) the full state after the security and privacy pass and (§16) the changes of 6 and 7 November. `09` is testing, deployment (migrate first, then deploy), the probes and scripts and how to run each, and how to brief a coding agent.
3. Each doc ends with **Known gaps**, things the docs ask for that the app does not do yet, and **What changed since this was written**, a dated summary. Fix the app or change the rule; then update the doc and add a line to `docs/DECISIONS.md` the same day.
4. `creator-commerce-playbook.md` is research dated 24 October 2026 about a codename ("Booth") that became the Shop, Content, Auto-DM and Audience modules. Its status note at the top says what was adopted, and its last section says how it was used. It is not a spec.

## The v0.1 constraints and where they stand

- **One app, not one giant file.** Holds. One route file per module, each module's own tables, one shared domain model.
- **Modules independently enabled, hidden and permission-checked.** Holds. The server refuses the API of a module that is not available to the person (05).
- **Hiding a feature is not authorization.** Holds. Roles, permissions, ownership and module flags are all checked on the server.
- **The 10 TB collection and 25,000 books.** Nothing is ingested. Knowledge is curated resources seeded by migration 0005. The books idea in `shubham.md` must pass the rights review in 08 §6 first. The founder's own three books are a separate case: his words, as School courses (migration 0078) and a Book page.
- **Never trained on what people write.** The terms and the privacy page say so; the assistant and the writing tool get only what the job needs, and the journal reaches only a model that keeps nothing. See 08 §7 and §14.
- **The Companion is not a therapist.** Holds in the module blurb, the screen, the system prompt and Help. The public footer also says the app cannot help in an emergency, and names Tele-MANAS (14416) for India.
- **No stored-value "Kreators Cash".** Holds. The terms page says points are not money and cannot be cashed out.
- **Follower count is not the measure.** Holds. Trust scores use only what was earned here; the leaderboard ranks by xp, this month, streak or badges and never by followers.
- **Do not build every concept in the first release.** Not followed: nearly everything was built. The mitigation is defaults and flags: seven apps on (School, Work, Army, Journal, Life, Shop, Public page), the rest off until a person switches them on or the setup chat does, and every module behind a server-resolved flag an admin can turn off.

## Open assumptions

- First segment: aspiring and early-stage creators, college students. Unchanged and still unvalidated.
- School wedge: the two seeded programs teach editing and AI-assisted editing with ChatCut. Three more are the founder's books (migration 0078). The vox-pop program from v0.1 is not built.
- India first: INR is the default currency, Razorpay the provider, Tele-MANAS the crisis line, PAN and IFSC in KYC, GST and TDS in the invoice calculator, PIN codes and Indian states in addresses, en-IN dates and lakh and crore grouping, Asia/Kolkata as the default zone, a bare phone number read as +91, and the DPDP Act first on the privacy page. Plans, top-ups and the live call are priced in rupees (Pro ₹1,499, Pro Max ₹12,499, Ultra ₹49,999; top-ups ₹899, ₹2,299, ₹4,499; the call ₹10,000). Open to all: someone abroad changes their currency, zone and date format under Profile.
- A responsive web app installed as a PWA. No native app, so no blocking of other apps and no two-way calendar sync (see `docs/superfocus-study.md`).
- Agency is for content agencies and freelance creators, not agencies in general. Agreements are a starting point and not legal advice, and a typed name is not a certified e-signature.
- Sign-up asks for a phone number and a date of birth. The minimum age is 18 and the server refuses anyone younger.

## What changed since this was written (2026-11-05)

Since 26 October 2026: the pack's figures were brought up to date (46 modules in six groups, nine permissions, 57 migrations); a state-of-the-project paragraph and a list of what was added after v0.1 were added; the reading order now includes the two studies and the copy brief; the Known-gaps rule gained a dated "What changed" section in each doc; and the notes on constraints now name the apps that start on and what a web app cannot do.

**2026-11-01 (later that day):** the figures are now 58 migrations (0001 to 0058), 209 shared cases and 857 smoke checks. 07 gained §16 (how points and money move safely), 08 gained §13 (what the bug sweep fixed and the open items it reported), and 09 gained the two cron triggers and how to run each by hand, the new browser drivers and two working lessons. 02 to 06 are updated separately.

**2026-11-01 (later still):** the figures are now 60 migrations (0001 to 0060), 209 shared cases and 910 smoke checks. New: `docs/security/` (five files) and `docs/performance.md`, both indexed above; 07 §17 (plans do not renew, the 14-day right to withdraw, marketing mail by recorded yes, seven-year records); 08 §14 (the state after the security, privacy and performance pass, the open items and the owner's manual actions); 09's new probes and scripts (`csp-browse.mjs`, `perf-probe.mjs`, `check-exposed.sh`, `pnpm perf:budget`, the contrast probe at AA), the pre-commit hook (not installed), and the deploy list (migrate 0052 to 0060, set the Worker variables, deploy, check headers, one test-mode payment, the restore drill). 01 to 06 are updated separately.

## 2026-11-03

The overhaul of 2026-11-03 is described where it belongs: icons (lucide through `Icon` and `AppIcon`, 44 animated icons, `MoreMenu`, segmented controls, 44px targets) in 06, the new indexes, the email templates and the server-only Discover keys in 04, and the Agency, search, brief, assistant and calendar additions in 02. The same day's interface pass (the Apple HIG rules translated to the app: one primary button per screen, segmented controls, 44px targets, folded detail, emoji turned into lucide icons) is in 06; the new Agency screens (four tabs and a gear, the client page in segments, Share and More on the documents, the Move button on boards), the onboarding chips and the confirm sheet for spending points are in 02; migrations 0062 to 0068 are in 04's index. `docs/launch-checklist.md` is the legal launch checklist worked from `10_Legal_Policies.pdf`, with what is still open (the business details as Worker variables, processor agreements, the DMCA agent).

## 2026-11-04

Waves 8 to 21 changed names, layout and a few rules; each is in DECISIONS.md and in the doc it belongs to. The names: the servant_leader pillar is Servitude, the app Mindful minutes is Mindfulness (mindful minutes stays the measure), and the games are DateFlow and 7RP Challenge. Keys are unchanged. Shared's one big `index.ts` became a barrel over one file per domain. App groups start open as each person picks, and the apps inside a group keep their order (migration 0074). Agency gained a Team tab (0076) and a team link (0081). Daily gained a kind of day (0077) and a habit tag on tasks (0082). The founder's books became School courses (0078). The Companion runs on the assistant's model layer (0079), and Run gained discussions (0080). Emerging, with good and bad habits, reads patterns across a person's apps. The five areas of life have one order: physical, financial, mental, emotional, spiritual.

## 2026-11-05

The pack is version 0.6. The figures are now 83 migrations (0001 to 0083), 46 modules, 553 shared test cases and 1,610 smoke checks. What changed in the app, and where it is described:
- **Type.** One family, Google Sans Flex, self-hosted, with Apple's text styles as one scale and weights after umbrel.com that follow the surface (titles 600, labels 550, tags 480, reading 450 on light surfaces, each 50 lighter on dark). Geist, Geist Mono and Inter are gone. Caveat stays for a guide's handwritten line on the public site. Only the two wordmarks are rounded. See 06.
- **Public site.** The last call to action and the Features close are fractal glass (`FractalGlass`), which replaced `GradientStripes`. The footer follows the founder's FyndFlow footer and ends with an emergency line. Every link shows the 45-degree arrow. Copy from FyndFlow was taken only where it is true of the app. See 06 and 02.
- **Terms.** Two new sections ("Wellbeing, not medical care" and "Money tools, not advice") and a line under Acceptable use. `LEGAL_VERSION` is 2026-11-05. See 07 and 08.
- **Emerging.** One `GET /insights` a day for every screen, a new limit (`insights`, 120 an hour), migration 0083 for the agency-load read, and golden tests that pin the output. See 02, 03, 04 and 05.
- **Delete and export.** Deleting an account now also deletes its `analytics_events` and `page_events` rows, and the export carries the person's `analytics_events` as `productEvents`. See 04 and 08.
- **New sections.** 05 gained §5b (Agency team members) and §12 (app groups and a person's app prefs), 07 gained §18 (discount codes) and 08 gained §15 (the changes from 2 to 5 November).
- **Text and the home hero.** Tighter leading and tracking after umbrel; card and row titles 3px larger over a line 2px smaller (`text-card-title`, `text-row-title`, `text-card-note`, `text-card-prose`); every block of text kept a rectangle (`lib/rectText.ts`, measured by `rag-probe.js`); the home hero rebuilt with no panel and a seven-colour knot reaching a little over the hook; about sixty lines of copy cut or made plainer. See 06.
- **Cards and forms.** `RowCard` is the one list card on the work and social screens. Agreements and documents gained Fill in the details. The team link needs a password. Inline toggles show their state with a turning chevron or a cross. See 02 and 06.
- **Cleanup.** Removed as unused: `Marquee`, `GradientStripes`, `Ornament`, `flowerShape`, `Book3D`, `PillChain`, `SummaryCard`, `docStyleSummary`, the `BentoSize` type and old smoke screenshots. `legal.ts` loads as its own chunk, `shared-legal`.

## 2026-11-07

The pack is version 0.7. The figures are now 126 migrations (0001 to 0132), 230 tables, 47 modules, 871 shared test cases and 2,921 smoke checks (10 November). What changed in the app on 6 and 7 November, and where it is described:
- **Planning.** Time blocks, day templates and the weekly pattern, By time block with suggestions, kinds of day. See 01 §9, 02 A and 04 §3.
- **Tracking.** Fitness with the eating check-in and supplements, Kreators Run's own log, gratitude for the day. See 01 §9, 02 M and J, 04 §8 and 08 §2.
- **Looking back.** Reviews from a day to a year, by layer, with one built-in set per period, steps, the mid-year check-in and the start-of-year setting. Emerging by period, with the life dashboard and the water, budget and Fitness patterns. See 02 A and M.
- **Coaching.** The student report, sections, patterns and suggestions by consent, adding a student and the invite link. See 02 M and 08 §2.
- **School.** Program states, editing in place, cohort discussions, several resources on a lesson, the Onboarding course and the Admin guide. See 02 C and 04 §5.
- **Agency.** Email notes that name each paper with its link. See 02 B2.
- **Home and apps.** Picture tiles, hide and unhide, the default order inside a group, the sidebar's bell, Dev Tools. See 05 §12 and 06.
- **Design.** The red yes, even rows, the tablet layout. See 06 §2 and §11.
- **Money.** The live call is the third thing that costs money, and nothing new pays. See 07 §15.
- **Security and privacy.** The admin key's door, alert emails, the wider link rule, an export and a delete that cover every table, the coach's consented door. The staff second factor stays not built. See 08 §1, §2, §12 and §16.
- **Guards and deploys.** CI, the data coverage guard, the note link guard, note landing. See 03 §10b and 09 §6.
- **Dates.** Times follow the person's zone and format. See 02 A and 03 §10b.
