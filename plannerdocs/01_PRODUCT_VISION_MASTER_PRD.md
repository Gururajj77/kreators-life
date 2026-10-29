# 01 — Product vision and master PRD

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Owner:** Product founder
**Source of truth:** `CLAUDE.md` for rules, `README.md` for the description, `docs/DECISIONS.md` for why.

## 1. Executive summary

kreators.app is a daily game about the seven relationships in a person's life, with a creator super app built around it. The game gives a reason to open the app every day: three boxes, a streak, a pillar that grows. The modules around it are where a creator learns, earns, sells, meets people and looks after themselves, each behind a switch the person and an admin both control.

The v0.1 plan was a modular creator operating system where administrators enable modules without shipping a build. That part is true of what was built. The order changed: the game came first, and almost every module in the v0.1 "later" list shipped in the same push.

## 2. Vision and promise

**Vision:** help people express themselves, build skills, form real relationships and earn in a way that lasts.

**The daily promise:** open the app, tick three boxes, see the numbers move. Everything that pays has a wait or a reviewer, so the numbers mean something.

**The creator promise:** learn a skill in School, prove it in Work and Army, sell what you make in the Shop with the attribution to know which post sold it, and keep a public page that is the door into all of it.

**The brand promise:** a campaign with a brief, scope, shortlist, approvals, versions and usage rights written down; content rewards paid only on verified views.

## 3. Target users

### Primary
- Anyone who wants a daily practice around their relationships. The wording is universal: a teenager can read it (Flesch 60 or above).
- Aspiring and early-stage creators who need skills, a portfolio and paid work.
- Working creators who sell downloads, courses, sessions, memberships and events.

### Secondary
- Brands and agencies, as organizations with members, commissioning campaigns and funding content rewards.
- Mentors, who can be plain creators with the mentor permission.
- Staff: talent managers, cohort managers, event hosts, finance, moderators, support, reviewers.
- Admins, who hold every permission and change roles and flags.

## 4. Core user problems

Unchanged from v0.1, plus the one the game answers: people do not show up every day, so nothing compounds. The game makes showing up the first thing that pays.

## 5. Product principles, with status

1. **Results first, then what did it, then the one thing to do next.** Home, onboarding and every dashboard follow this order. Holds.
2. **Phone-first.** One column with bottom tabs on a phone; a PWA; a phone on its side keeps the phone layout. Holds.
3. **Human in the loop.** Views are confirmed by a reviewer, payouts need the finance permission, completion is a manager's decision, Club is reviewed, moderation is by guides. Holds.
4. **One identity, modular experiences.** One account, forty modules, each with a person's own switch and an admin's flag. Holds.
5. **Explicit permissions.** Roles, permissions, ownership and module flags are all checked on the server. Holds.
6. **Portable data.** Plain SQL migrations, one JSON export, no vendor lock beyond Cloudflare. Holds.
7. **Measurable outcomes.** Fifteen product events in our own table, Observability counts, period numbers in Reviews. Holds for product metrics; business metrics need queries, see §10.
8. **Trust and safety.** Signed webhooks, salted click hashes, journal and wellbeing kept private, consented introductions, aliases in chats. Holds; moderation is thin, see 08.
9. **No vanity-only scoring.** Trust is built from earned things; Rank never sorts by followers. Holds. Home does lead with xp, streak, points and level, on purpose: they are the game's results, not vanity, and every card under them is an action.
10. **Wellbeing is not clinical care.** Holds; see 08 §5.
11. **Plain words.** The seven are pillars, each a pyramid of six layers, the daily nudge is a small act, the list under tasks is not to do, reviews are by period. Never tower, floor, spark, habit, sprint, retro. Keys and routes keep old names.

## 6. The flywheel as built

1. The game brings people back daily (check in, small act, task, not-to-do).
2. Life, Wellbeing and the trackers read what the game logs and point back into it.
3. School teaches; Work and Army pay; Win pays per verified view; the Shop sells; Content and Auto-DM show which post sold.
4. Party, Run, Circles, Bond and Community put people in a room, under aliases where it matters.
5. Club, honors, badges and the trust score make a record that cannot be typed in.
6. The public page is the door for everyone else.

Whether each step moves retention is still a hypothesis. The product events and Observability are there to find out.

## 7. Product scope

### Built and on by default
School, Work, Army, Journal, Life, Shop, Public page, plus the core tabs (Home, Daily, Pillars, Search, Inbox, Help). Manage for staff, Admin for admins, Observability for both.

### Built and off by default
Win, Party, Kreators Run, Community, Club, Bond, Circles, Wellbeing, Mood, Sleep, Stress, Mindful minutes, Reviews, Companion, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund. A person switches one on from Apps; an admin can switch any of them off for everyone, for a role, for a brand or for one person.

### Parked, by decision
- Stored-value currency. Points are not money and cannot be cashed out.
- Open or random video chat.
- Celebrity shout-outs, a meme or trending-audio library, a creator house or cafe.
- Native apps. The PWA is the app.
- A white-label app, instalments, and a chat transport (Store chats and Bond chats are polled tables).
- Automated clinical assessment of any kind.
- Magic-link sign-in: tried and removed (migrations 0018 and 0019).

## 8. Roles as built

Three roles in `ROLES`: `user` (Creator), `sub_admin` (Staff), `admin`. A role has a badge on the profile picture and under the sidebar logo.

Staff hold permissions from `PERMISSIONS`, each a job: `talent` (Army campaigns, shortlists), `cohorts` (programs, cohorts, completion), `events` (any event, check-in, Run collabs), `finance` (payouts, money orders), `moderation` (hide posts, reports), `support` (help tickets), `review` (Club, rewards, tools, TV, Fund), `mentor` (assignment feedback; a creator can hold it). `can(user, permission)` in `apps/api/src/db.ts` is the one check; admins pass every check. A permission on a plain user is not enough: the role must be staff.

Brands are `organizations` with `organization_members`. Whoever creates one owns it and adds teammates by email. A campaign belongs to an organization; a brand member sees only their organization's campaigns.

Founder addresses in `apps/api/src/admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in, audited. Only an admin changes a role, never their own.

## 9. Core journeys as built

### Anyone joins
1. The site at `/`. "Start free" goes to sign-up; "Go to app" goes to sign-in, or to Home with a session.
2. An anonymous device session can start first; an email and password can be added later and the device's progress comes with it. Sign-up asks for an email, a password, a phone number and a date of birth, and refuses anyone under eighteen. It creates the user and seven zero scores and nothing else.
3. The strategy session (`/session`, one conversation hosted by the seven characters in turn, every answer a tap or a short line, an explanation before each question): the frame; a placement on the map for each relationship (core and floor, names never numbers, evidence when placed high); fears and insecurities; a scorecard with a behaviour check; the real day; a focus of at most two (floors under Courage first and locked); a routine of six blocks ramped from the real day; practices; a signed contract whose check-in time becomes the daily reminder; the optional live call.
4. Leaving halfway resumes at the same part. The vibe check then asks only the focus pillars inside the same chat, three taps each; the rest wait on Pillars. On the derived screen the person picks or writes the value goal and project per pillar. Then the pyramid is built and explained one card at a time.
5. Pillars ends with the life map (the `#life-map` section): all seven on the map, the focus, the scores, fears and insecurities, the routine and the contract, with a run-again button; each pillar page says where it sits. Daily shows the three boxes and, under the first, the routine: the morning steps as tick rows, the other blocks, the week against the contract. The first three task ticks are free; after that a task needs ten minutes of age and a ten-minute gap.

### Every day
Check in (10 xp, 10 points, the streak), the small act (15 xp), one task (20 xp, a ripple down the pyramid), the not-to-do list (5 xp per kept day). Six rewarded ticks a day; every seventh day in a row pays 50 points.

### A creator applies for work
Browse published opportunities (closed or past-deadline ones take no applications), apply once with a note and the portfolio snapshot, follow the status (submitted, reviewing, shortlisted, selected, rejected, withdrawn, completed) in Inbox. The listing's owner or a talent staffer reviews.

### A brand runs a campaign in Army
A brand member submits a lead or talent staff writes a brief; scope, budget, usage rights, exclusivity and restrictions are recorded; creators are shortlisted and assigned; versions, feedback and approvals sit in one thread; every step is logged in `campaign_events`.

### A learner joins School
Pick a program and a cohort, do the lessons in order, submit assignments, get mentor feedback, attend sessions. Completion is the cohort manager's decision, never a timer. A certificate lands under My purchases.

### A person attends Party
RSVP; a full room waitlists, first in line; a cancelled seat promotes the next person and tells them; the host checks people in; afterwards a rating and an opt-in to introductions that Bond uses.

## 10. Success metrics

### Measured today
- Product events in `analytics_events` (`TRACKED_EVENTS`): creator signed up, profile published, product created, profile viewed, product viewed, checkout started, payment succeeded or failed, booking confirmed, refund issued, link created, automation created, content dashboard viewed, KYC submitted or approved. Admin, Ops shows funnels over them.
- Observability: people in numbers, people per app, every account with its apps on, roles.
- Period numbers in `GET /reviews/summary`: check-ins, tasks, small acts, xp by pillar, kept days, mood, sleep, stress, mindful minutes, journal entries, money in and out, orders and sales, lessons, applications, events, posts, circles and runs, next to the period before.
- Clicks per tracked link, taps per link block, outbound taps per store item and tool.

### Not measured yet
Army revenue and margin, repeat brands, on-time delivery, School completion and refund rates, time to shortlist, dispute rate, RSVP-to-attendance. The tables hold the rows; the queries and a dashboard do not exist.

Total registered users and follower counts are never a success metric.

## 11. Non-functional requirements, with status

- Responsive, phone-first, installable PWA. Holds.
- Accessibility: aria labels and roles throughout, reduced motion respected, a contrast probe over every route in dark mode. No WCAG level stated and no screen-reader pass yet. Partial.
- Secure authentication and sessions. Holds; see 08.
- Server-side authorization. Roles, ownership and module flags. Holds.
- Input validation and rate limits. Validation on every route through `str`, `num`, `oneOf`; every limit in one file (`apps/api/src/limits.ts`) covering the auth doors, posts, replies, likes, follows, chats, offers, listings, tickets, applications and run entries. Holds.
- Audit logs for privileged and financial changes. Holds (`audit_logs`, read under Admin).
- Backups and tested restore. Nothing written down; D1 is relied on. Gap.
- Error monitoring and logs. Wrangler observability is on; `pnpm cf:logs` tails. No alerting. Partial.
- Export and deletion. One JSON export; deletion anonymises the person and keeps money rows for the books. Holds.
- Environments: development on 8787, a smoke server on 8788 with its own database, production. No staging. Gap.
- Migrations in source control. Holds (25 plain SQL files).
- Automated tests for permissions, payments, flags and workflows. Unit tests in shared and an end-to-end smoke test; see 09.

## 12. Decisions: resolved and open

### Resolved (date in `docs/DECISIONS.md`)
- Name: kreators.app everywhere people read; identifiers keep kreators-life (2026-10-25).
- Stack: React, Vite, pnpm; Hono on Cloudflare Workers with D1; one Worker serves both; plain SQL migrations (2026-10-23).
- Auth: anonymous device session first, email and password on top, hand-built; magic links tried and removed; no OTP (2026-10-23, 2026-10-25).
- Money: points are the only in-app unit; Razorpay behind `payments.ts`; test mode without keys; no Kreators Cash (2026-10-24).
- Content rewards pay per thousand verified views; YouTube read with a key, the rest typed and confirmed; finance pays (2026-10-24).
- Brands can submit leads themselves; staff turn a lead into a brief.
- School is online and self-paced in open cohorts, with the two seeded programs (2026-10-25).
- Club has no fee; a reviewer decides; a year by default. Its benefits are built: club-only Work listings and a named manager (2026-10-26).
- Minimum age 18, asked at sign-up with a phone number (2026-10-26).
- Every long list is served a page at a time, 10 to 100 rows (2026-10-26).
- Design tokens frozen from the freud UI Kit; dark mode keeps hues; ink is grey (2026-10-24, 2026-10-25).
- Analytics in our own table, not a third party (2026-10-24).
- The no-marketplace line partly reversed for the Store, within limits: no money moves through kreators.app (2026-10-25).

### Still open
- Email or phone verification. The phone is collected but neither is verified; founder admin promotion relies on signing up first.
- Geography and currencies beyond INR.
- A staging environment and a written backup and restore step.
- Refund and cancellation terms for paid programs, if any are ever priced.
- Creator contracts, rights and exclusivity as legal text (the fields exist on a campaign).
- Rights for the book collection before any AI use.
- Hosting and data residency beyond Cloudflare's defaults.

## Known gaps

- No email or phone verification (§9).
- No staging, no written backup and restore, no alerting (§11).
- Business metrics are not computed (§10).
