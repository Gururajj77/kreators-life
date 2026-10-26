# kreators.app planner docs: start here

**Product:** kreators.app. The identifiers keep their old name: the Worker and database `kreators-life`, the `@kreators/*` packages, storage keys and the repo.
**Version:** 0.3, reconciled with the app on 26 October 2026 (v0.1 was the pre-build blueprint; 0.2 the audit; 0.3 after the gaps it found were closed).
**Status:** these docs describe the app as built. When a doc and the code disagree, the doc is wrong unless it records a rule the app broke; those are listed under "Known gaps" at the end of each doc.

Where the truth lives:
- `CLAUDE.md` at the repo root is the rulebook. Its "Non-negotiable rules" and "Done means" override anything here.
- `README.md` is the long-form description of every part of the app.
- `docs/DECISIONS.md` is the dated history: one line per decision that changed the plan.
- `docs/build-map.html` is the map of where things live, embedded under Internal, Observability.
- The code: `packages/shared/src/index.ts` (the domain model), `apps/api/src` (the Worker), `apps/web/src` (the app and the public site), `apps/api/migrations` (the schema).

## What kreators.app is

Seven relationships as a daily game, with a creator super app around it.

- **The game.** Seven *pillars* (Servant leader, Friendship, Parent and child, Lover and partner, With yourself, With the guru, With the divine), each a *pyramid* of six layers built from a short vibe check: foundation, guiding principle, value goal, goal outcome, project, task. *Daily* is three boxes a day (check in, the small act, one task) plus a *not to do* list. Xp fills levels and pillars; points are spendable; badges are earned by the app's own count; honors are given by the team or unlocked by time; a character and an identity evolve with xp and days.
- **The super app.** Forty modules in seven groups: Essentials (Home, Daily, Pillars, Search, Inbox, Help), Contribution (School, Work, Army, Win), Connection (Party, Kreators Run, Community, Club, Bond, Circles), Reflection (Life, Wellbeing, Mood, Sleep, Stress, Mindful minutes, Journal, Reviews, Companion), Creation (Public page, Shop, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund), Operations (Manage, Admin) and Internal (Observability, team only). Only School, Work, Army, Journal, Life, Shop and Public page start on.
- **The public site** at `/`: feature pages, Explore, certificates, invoices, policy pages, and a public page per creator at `/u/<handle>` that works like a link-in-bio.

## How the v0.1 blueprint turned out

| v0.1 said | What happened |
| --- | --- |
| Four engines first: Army, School, Work, Party | All four are built. They are four of forty modules; School, Work and Army start on, Party starts off. |
| Thirteen composable roles | Three roles (Creator, Staff, Admin), eight staff permissions, and organizations for brands. See 01 §8. |
| Flags named `module.army`, `feature.*`, `ops.*` | Flags are the bare module keys (`army`, `store`) in `module_settings`, with overrides, a minimum role and a rollout percentage. Each person also has their own on/off per app. See 05. |
| Phases 0 to 6 over months | Built between 23 and 25 October 2026, in the order DECISIONS.md records. |
| AI companion only after review | Companion is built with its boundaries written in (not a therapist, crisis line), off by default, with an optional Workers AI binding. See 08 §5. |
| Parked: stored-value currency, random video chat, celebrity shout-outs, meme library, house or cafe, native apps, clinical claims | Still parked. Points are the only in-app unit and are not money. |
| Standalone URL shortener parked | Tracked links exist at `/go/<code>` as part of Content, not as a product. |
| Shop as affiliate bundles before inventory | Shop sells a creator's own products (points or money through Razorpay). The Store adds partner links and creator-to-creator pre-owned gear; kreators.app never holds goods or money. |

## How to use this pack

1. Read `CLAUDE.md` first. Then the doc for the part you are changing.
2. `01` is scope, roles, journeys, metrics and the open decisions. `02` is the module index with the rules and the smoke check that proves each one. `03`, `04` and `05` are the architecture, the data dictionary and the flags. `06` is the design system. `07` is every number that pays or charges. `08` is security, privacy and the Companion's limits. `09` is testing, deployment and how to brief a coding agent.
3. Each doc ends with **Known gaps**: things the docs ask for that the app does not do yet. Fix the app or change the rule; then update the doc and add a line to `docs/DECISIONS.md` the same day.
4. `creator-commerce-playbook.md` is research dated 24 October 2026 about a codename ("Booth") that became the Shop, Content, Auto-DM and Audience modules. Its status note at the top says what was adopted. It is not a spec.

## The v0.1 constraints and where they stand

- **One app, not one giant file.** Holds. One route file per module, each module's own tables, one shared domain model.
- **Modules independently enabled, hidden and permission-checked.** Holds. The server refuses the API of a module that is not available to the person (05).
- **Hiding a feature is not authorization.** Holds. Roles, permissions, ownership and module flags are all checked on the server.
- **The 10 TB collection and 25,000 books.** Nothing is ingested. Knowledge is curated resources seeded by migration 0005. The books idea in `shubham.md` must pass the rights review in 08 §6 first.
- **The Companion is not a therapist.** Holds in the module blurb, the screen, the system prompt and Help.
- **No stored-value "Kreators Cash".** Holds. The terms page says points are not money and cannot be cashed out.
- **Follower count is not the measure.** Holds. Trust scores use only what was earned here; Rank sorts by xp, streak or badges and never by followers.
- **Do not build every concept in the first release.** Not followed: nearly everything was built. The mitigation is defaults and flags: seven apps on, the rest off until a person switches them on, and every module behind a server-resolved flag an admin can turn off.

## Open assumptions

- First segment: aspiring and early-stage creators, college students. Unchanged and still unvalidated.
- School wedge: the two seeded programs teach editing and AI-assisted editing with ChatCut. The vox-pop program from v0.1 is not built.
- India first: INR is the default currency, Razorpay the provider, Tele-MANAS the crisis line, PAN and IFSC in KYC.
- A responsive web app installed as a PWA. No native app.
- Sign-up asks for a phone number and a date of birth. The minimum age is 18 and the server refuses anyone younger.
