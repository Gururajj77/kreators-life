# 01 — Product vision and master PRD

Last updated: 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026
**Owner:** Product founder
**Source of truth:** `CLAUDE.md` for rules, `README.md` for the description, `docs/DECISIONS.md` for why, `docs/whop-study.md` and `docs/superfocus-study.md` for what two studies took and left.

## 1. Executive summary

kreators.app is a daily game about the seven relationships in a person's life, with a creator super app built around it. The game gives a reason to open the app every day: three boxes, a streak, a pillar that grows. The modules around it are where a creator learns, earns, runs client work, sells, meets people, plans and looks after themselves, each behind a switch the person and an admin both control. There are 46 modules in all, counting the core screens and the team's own.

The v0.1 plan was a modular creator operating system where administrators enable modules without shipping a build. That part is true of what was built. The order changed: the game came first, and almost every module in the v0.1 "later" list shipped in the same push. Since v0.3 the app has also grown a planning side (a week plan, time blocks, scheduled reviews), an agency side (Agency, for content agencies and freelance creators) and a self-knowledge side (Discover); see "What changed since this was written" at the end.

## 2. Vision and promise

**Vision:** help people express themselves, build skills, form real relationships and earn in a way that lasts.

**The daily promise:** open the app, tick three boxes, see the numbers move. Everything that pays has a wait or a reviewer, so the numbers mean something.

**The creator promise:** learn a skill in School, prove it in Work and Army, sell what you make in the Shop with the attribution to know which post sold it, run your client work in Agency, and keep a public page that is the door into all of it.

**The agency promise:** for a content agency or a freelance creator, every client has a dashboard; every deliverable moves from idea to published; the client opens one link, sees only what you chose to show, and approves or sends back; invoices and agreements are made and sent from the same place.

**The brand promise:** a campaign with a brief, scope, shortlist, approvals, versions and usage rights written down; content rewards paid only on verified views.

## 3. Target users

### Primary
- Anyone who wants a daily practice around their relationships. The wording is universal: a teenager can read it (Flesch 60 or above).
- Aspiring and early-stage creators who need skills, a portfolio and paid work.
- Working creators who sell downloads, courses, sessions, memberships and events.
- Content agencies and freelance creators who make videos, posts, scripts and newsletters for clients (Agency). The app says plainly that Agency is for these two, not for agencies in general.

### Secondary
- Brands and agencies, as organizations with members, commissioning campaigns and funding content rewards.
- Mentors, who can be plain creators with the mentor permission.
- Life coaches, who can be plain creators with the coach permission and work only with students who said yes.
- Staff: talent managers, cohort managers, event hosts, finance, moderators, support, reviewers.
- Admins, who hold every permission except Life coach and change roles and flags. A super admin (role `admin`) can also give xp and badges by hand and read the app's log.

## 4. Core user problems

Unchanged from v0.1, plus the one the game answers: people do not show up every day, so nothing compounds. The game makes showing up the first thing that pays. Two more since: people plan badly (too much on one day, nothing on another, no look back), so Daily plans the week and Reviews schedules the look back; and agencies and freelancers run client work across chats, spreadsheets and PDFs, so Agency holds it in one place.

## 5. Product principles, with status

1. **Results first, then what did it, then the one thing to do next.** Home, onboarding and every dashboard follow this order. Holds.
2. **Phone-first.** One column with bottom tabs on a phone; a PWA; a phone on its side keeps the phone layout. Holds.
3. **Human in the loop.** Views are confirmed by a reviewer, payouts need the finance permission, completion is a manager's decision, Club is reviewed, moderation is by guides, a client approves a deliverable. Holds.
4. **One identity, modular experiences.** One account, forty-six modules, each with a person's own switch and an admin's flag. An account can be signed in on three devices at a time. Holds.
5. **Explicit permissions.** Roles, permissions, ownership and module flags are all checked on the server. Holds.
6. **Portable data.** Plain SQL migrations (58 of them), one JSON export, no vendor lock beyond Cloudflare. Holds.
7. **Measurable outcomes.** Fifteen product events in our own table, Observability counts (including how much Discover and Agency are used, as counts only), period numbers in Reviews. Holds for product metrics; company-level business metrics need queries, see §10.
8. **Trust and safety.** Signed webhooks, salted click hashes, journal and wellbeing kept private, consented introductions, aliases in chats, no clickable links in what people write to each other, blocking, a rank-based mute. Holds; moderation is thin, see 08.
9. **No vanity-only scoring.** Trust is built from earned things; the Leaderboard never sorts by followers. Holds. Home does lead with xp, streak, points and level, on purpose: they are the game's results, not vanity, and every card under them is an action.
10. **Wellbeing is not clinical care.** Holds; see 08 §5. Discover's "how your mind works" is never a diagnosis and says so; Human design and numerology are shown as reflection, not science.
11. **Plain words.** The seven are pillars, each a pyramid of six layers (foundation, guiding principle, value goal, goal outcome, project, task), the daily nudge is a small act, the list under tasks is not to do, reviews are by period (a week, a month, a quarter or a half year), the tabs are Home, Daily, Pillars, Apps and Profile. Never tower, floor, spark, ladder, rule, feeling, proof, sprint, cycle or retro; the not-to-do list is never called habits, vices or avoidances (a repeating task does wear a Habit tag). Keys and routes keep old names. No word stands alone on the last line of a heading, a card or a paragraph, on a laptop or a phone; a probe measures it.
12. **Rules, not a model, wherever a rule will do.** The daily brief, Plan my week and its plan strength, a project's pace, the review reminders and the focus numbers are plain rules, so they cost no credits and a free person gets them. A model is used only by the assistant (paid in credits), the Content strategist and the optional Companion reply.

## 6. The flywheel as built

1. The game brings people back daily (check in, small act, task, not-to-do).
2. Daily plans the week and tasks flagged for a review land in it; Life, Wellbeing, the trackers and Reviews read what the game logs and point back into it.
3. School teaches; Work and Army pay; Win pays per verified view; the Shop sells; Content and Auto-DM show which post sold; Agency runs the client work and bills it.
4. Party, Run, Circles, Bond and Community put people in a room, under aliases where it matters; Games and Discover give people something to do and learn together.
5. Club, honors, badges and the trust score make a record that cannot be typed in.
6. The public page is the door for everyone else; a client link, an invoice link and an agreement link are doors for the people a creator works with.

Whether each step moves retention is still a hypothesis. The product events and Observability are there to find out.

## 7. Product scope

### Built and on by default
School, Work, Army, Journal, Life, Shop, Public page and the Leaderboard (on for everyone; a person appears only after they opt in), plus the core tabs (Home, Daily, Pillars, Search, Inbox, Help) and the assistant (locked on; typing to it needs a plan). Manage for staff, Admin for admins, Observability for both, in the Operations group.

### Built and off by default
Win, Agency, Party, Kreators Run, Community, Club, Bond, Circles, Games (the card games), Discover, Coaching, Wellbeing, Mood, Sleep, Stress, Mindful minutes, Reviews, Companion, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund. A person switches one on from Profile, Features; an admin can switch any of them off for everyone, for a role, for a brand or for one person. The setup chat switches on the apps that fit what the person said.

### Built and not an app
Rewards (`/rewards`, a catalog of books, card games, merch and experiences bought with points), the strategy session (`/session`), the private calendar link, the client, invoice and agreement links, and the public site.

### Parked, by decision
- Stored-value currency. Points are not money and cannot be cashed out.
- Open or random video chat.
- Celebrity shout-outs, a meme or trending-audio library, a creator house or cafe.
- Native apps. The PWA is the app. For the same reason, blocking other apps or websites during a focus session is not possible and Help says so.
- A white-label app, instalments, and a native chat transport (Store chats and Bond chats are polled tables).
- Automated clinical assessment of any kind.
- Magic-link sign-in: tried and removed (migrations 0018 and 0019).
- From the Whop study: a flat bonus per approved post and a campaign type for content rewards, a funding step before a reward opens, a welcome message after checkout, apps as pills along the top, an annual price with a discount, an affiliate marketplace.
- From the Superfocus study: two-way calendar sync and the Slack, Fathom, Granola and Outlook links (each needs partner keys and a sign-in we do not have), a licensed music playlist (the Lo-fi sound is made in the browser instead), a paid AI coach, "seasons", and anything its site does not explain.
- Comparing a person's Discover results with other people's, until there are real results and a method to back it.
- Certified electronic signatures. Agreements are accepted by a typed name and the app says so.
- A PDF made by the server. A PDF is the browser's own print and save.

## 8. Roles as built

Three roles in `ROLES`: `user` (Creator), `sub_admin` (Staff), `admin`. A role has a badge on the profile picture and under the sidebar logo; a creator who holds the `coach` permission wears a Life coach badge. Earned badges never go on the picture or the sidebar.

Staff hold permissions from `PERMISSIONS`, each a job: `talent` (Army campaigns, shortlists), `cohorts` (programs, cohorts, completion), `events` (any event, check-in, Run collabs, attendee codes, circles), `finance` (payouts, money orders), `moderation` (hide posts, reports), `support` (help tickets), `review` (Club, rewards, tools, TV, Fund), `mentor` (assignment feedback; a creator can hold it) and `coach` (life coaching; a creator can hold it, and alone among permissions an admin does not hold it unless given it). `can(user, permission)` in `apps/api/src/db.ts` is the one check; admins pass every check but `coach`. A permission on a plain user is not enough: the role must be staff, apart from `mentor` and `coach`.

Brands are `organizations` with `organization_members`. Whoever creates one owns it and adds teammates by email. A campaign belongs to an organization; a brand member sees only their organization's campaigns.

Founder addresses in `apps/api/src/admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in, audited. Only an admin changes a role, never their own. A super admin can give xp (down to zero) and badges by hand, delete a person from the People list (never an admin or themselves), allow or block any app for one person, and is the only reader of the app's log.

## 9. Core journeys as built

### Anyone joins
1. The site at `/`, a story told in the PASTOR order: the problem, the five villains, the hero, the five Ws, how each villain is beaten with the apps that do it, before and after with the live numbers, the offer, the one next step. It shows nothing made up. `/features` lists everything a creator needs by group and `/7rp` lists every app a relationship serves. "Start free" goes to Welcome; "Go to app" goes to sign-in, or to Home with a session.
2. Welcome opens an anonymous device session and the **setup chat** (`/onboarding`): one guide (Bumling), a few taps on small grouped lists (what brings you here, which of these sound like you, what you make if you make things, what usually gets in your way), every answer said back in plain words, a typing box that understands "what is Army?" and picks up tags from free text. The account is made inside it in two small cards (how you sign in; phone and birthday, which nobody else sees). Sign-up asks for an email, a password, a phone number and a date of birth, refuses anyone under eighteen, and creates the user and seven zero scores and nothing else; an email added to a device account keeps its progress. The chat ends by switching on the apps that fit (a short list with each one's reason) and offering the strategy session or the Discover quiz.
3. The **strategy session** (`/session`, opened from Pillars or from the setup chat's last card): one conversation hosted by Bumling and the seven characters in turn, every answer a tap or a short line, an explanation before each question: the frame; a placement on the map for each relationship (core and floor, names never numbers, evidence when placed high); fears and insecurities; a scorecard with a behaviour check; the real day; a focus of at most two (floors under Courage first and suggested, never forced); a routine of six blocks ramped from the real day; practices; a signed contract whose check-in time becomes the daily reminder; the optional live call.
4. Leaving halfway resumes at the same part, and a chat keeps its place while the person moves around the app. The vibe check then asks only the focus pillars inside the same chat, three taps each; the rest wait on Pillars. On the derived screen the person picks or writes the value goal and project per pillar. Then the pyramid is built and explained one card at a time.
5. Pillars ends with the life map (the `#life-map` section): all seven on the map, the focus, the scores, fears and insecurities, the routine and the contract, with a run-again button; each pillar page says where it sits and each project with a due day shows its pace (on track, slipping or behind). Daily shows the three boxes and, under the first, the routine. The first three task ticks are free; after that a task needs ten minutes of age and a ten-minute gap, and a task cannot be ticked before its do date.

### Every day
Check in (10 xp, 10 points, the streak), the small act (15 xp), one task (20 xp, a ripple down the pyramid), the not-to-do list (5 xp per kept day). Six rewarded ticks a day; every seventh day in a row pays 50 points. Home opens with the daily brief (three signals and three next steps from plain rules) and, further down, a line of the day.

### A person plans the week and looks back
A task has a do date (the day it will be done, the only thing that holds a tick back) and an optional due date (the deadline, never a lock), a priority P0 to P3, a time and a length, subtasks and a repeat; a task with neither date waits under Not scheduled yet; a Remember tag sends an inbox note on the day or waits in To remember. **Plan my week** on Daily suggests a day for each open task that has none, the most important first and spread so no day is overloaded, shows a plan strength out of 100 with a few plain notes, and changes nothing until the person keeps a suggestion. Timed tasks show as time blocks with the free time between. A task can be brought to the review. In **Reviews** the person picks a period, sees the numbers from every app next to the period before, the tasks they brought, and writes the review; a calendar shows reviews written and reminders scheduled; a reminder for a chosen day and time (once or repeating) arrives as an inbox note that opens the right period. A private calendar link shows tasks and scheduled reviews in Google, Apple or Outlook Calendar, one way.

### A person focuses
In Mindful minutes: a breathing timer, or focus sessions in rounds (classic 25 and 5, or the person's own lengths), with sounds under one master switch and a volume (rain, ocean, wind, a soft hum, or Lo-fi), a rating of how the session felt, and settings saved on the account so they follow the person to every device. Start focus on a task opens the timer with that task picked.

### A creator applies for work
Browse published opportunities (closed or past-deadline ones take no applications; Club-only ones are seen only by members), apply once with a note and the portfolio snapshot, follow the status (submitted, reviewing, shortlisted, selected, rejected, withdrawn, completed) in Inbox. The listing's owner or a talent staffer reviews.

### A brand runs a campaign in Army
A brand member submits a lead or talent staff writes a brief; scope, budget, usage rights, exclusivity and restrictions are recorded; creators are shortlisted and assigned; versions, feedback and approvals sit in one thread; every step is logged in `campaign_events`. A creator on a campaign can bring its deliverables into Agency and send versions to the brand from there.

### A creator or agency runs client work in Agency
Add a client (what they pay a month, how many deliverables and hours they are owed, the channels, a renewal day). Every deliverable moves idea, script, making, review, approved, published, on a list or a board, with a notes thread, time and a due and a publish day. The client's dashboard opens on a tap: this month's numbers, the pipeline, time against the hours they pay for, invoices, agreements and the client link. The client link shows one page; the owner switches on or off each thing the client may see (waiting for approval, coming up, published, the month so far, notes, then channels, hours, invoices, agreements) and whether they may approve or send back and write notes; fees, private notes, time line by line, other clients and Army feedback are never in it. Invoices are made in a designer with a calculator (discount, GST with a CGST and SGST split, TDS added or shown, bank and UPI, total in words), and an agreement is made from a template (trial and pilot, monthly retainer, one-off project) or one of the person's own, with a brief the client answers and a packages table; each has its own link where the client reads it, saves a PDF, writes a comment to ask for a change and, for an agreement, accepts by typing a name. Either can be edited after it is sent and then says Revised; a signed agreement is revised into a new draft.

### A learner joins School
Pick a program and a cohort, do the lessons in order, submit assignments, get mentor feedback, attend sessions. Completion is the cohort manager's decision, never a timer. A certificate lands under My purchases.

### A person attends Party
RSVP; a full room waitlists, first in line; a cancelled seat promotes the next person and tells them; a reminder comes a day and an hour before; the host checks people in and sets the xp and the code guests claim on the day; afterwards a rating and an opt-in to introductions that Bond uses.

### A person learns about themselves in Discover
A quiz in five parts (most-and-least picks, adjusting pattern puzzles, descriptor words, real situations, an optional emotional intelligence part) scored on the server only, with three self-checks (a free 16-type check, love languages, how your mind works), Human design and numerology. Private to the person; two switches decide whether the result may shape their next steps and whether the assistant may read a short summary.

## 10. Success metrics

### Measured today
- Product events in `analytics_events` (`TRACKED_EVENTS`): creator signed up, profile published, product created, profile viewed, product viewed, checkout started, payment succeeded or failed, booking confirmed, refund issued, link created, automation created, content dashboard viewed, KYC submitted or approved. Admin, Ops shows funnels over them.
- Observability: people in numbers, people per app, every account with its apps on, roles; counts of games unlocked, Discover quizzes and add-ons finished, what super admins gave by hand, Agency use (people, clients, deliverables, invoices, agreements signed, client links on, business metrics on; counts only, never a client name or an amount) and the last day of the app's log. The build map is data in `apps/web/src/lib/buildMap.ts`, drawn in the page.
- The app's own log (`app_logs`, super admins only, thirty days): every change, refusal and server error with its area, cleaned path, status, time taken and who did it; never a body or anything private.
- Period numbers in `GET /reviews/summary`: check-ins, tasks, small acts, xp by pillar, kept days, mood, sleep, stress, mindful minutes, journal entries, money in and out, orders and sales, lessons, applications, events, posts, circles and runs, and the tasks brought to the review, next to the period before.
- Focus time and quality on the Mindful dashboard (minutes, sessions, the average rating of the sessions the person rated).
- Clicks per tracked link, taps per link block, outbound taps per store item and tool.
- For a person who switches on business metrics in Reviews: up to twelve of their own, typed in each period or read from Agency (pieces published, approved first time, published on time, billable hours, utilisation, invoiced, paid, new clients), judged against a target.

### Not measured yet
Company-level numbers: Army revenue and margin, repeat brands, on-time delivery, School completion and refund rates, time to shortlist, dispute rate, RSVP-to-attendance. The tables hold the rows; the queries and a dashboard do not exist. (These are the company's numbers, not the business metrics a person can switch on in Reviews.)

Total registered users and follower counts are never a success metric.

## 11. Non-functional requirements, with status

- Responsive, phone-first, installable PWA. Holds.
- Accessibility: aria labels and roles throughout, reduced motion respected, a contrast probe over every route in dark mode, an overflow probe and an orphan-word probe over the shot list at laptop and phone width, an opaque fallback for the glass under reduced transparency and more contrast. No WCAG level stated and no screen-reader pass yet. Partial.
- Secure authentication and sessions. At most three devices at once. Holds; see 08.
- Server-side authorization. Roles, ownership and module flags. Holds.
- Input validation and rate limits. Validation on every route through `str`, `num`, `oneOf` and shared parsers; every limit in one file (`apps/api/src/limits.ts`) covering the auth doors, posts, replies, likes, follows, chats, offers, listings, tickets, applications, run entries, attendee code claims, coaching, Agency work, a client at their link, and the saving of settings. Holds.
- Audit logs for privileged and financial changes. Holds (`audit_logs`, read under Admin).
- Backups and tested restore. Nothing written down; D1 is relied on. Gap.
- Error monitoring and logs. Wrangler observability is on; `pnpm cf:logs` tails; the app's own log (a Logs page for super admins) records changes, refusals, server errors, cron runs that did something and errors a browser reports. No alerting. Partial.
- Export and deletion. One JSON export (which includes Agency, templates, review schedules and focus settings); deletion anonymises the person, keeps money rows for the books (an invoice keeps its totals and loses who it was for, its lines, its bank and its link). Holds.
- Environments: development on 8787, a smoke server on 8788 with its own database, production. No staging. Gap.
- Migrations in source control. Holds (58 plain SQL files, 0001 to 0058). Every migration is applied to the live database with `pnpm db:migrate` before `pnpm deploy`; the new code expects the new tables.
- Automated tests for permissions, payments, flags and workflows. Unit tests in shared (209 cases) and an end-to-end smoke test (857 checks), both counted on 1 November 2026; see 09.

## 12. Decisions: resolved and open

### Resolved (date in `docs/DECISIONS.md`)
- Name: kreators.app everywhere people read; identifiers keep kreators-life (2026-10-25).
- Stack: React, Vite, pnpm; Hono on Cloudflare Workers with D1; one Worker serves both; plain SQL migrations (2026-10-23).
- Auth: anonymous device session first, email and password on top, hand-built; magic links tried and removed; no OTP (2026-10-23, 2026-10-25). Three devices at a time (2026-11-01).
- Money: points are the only in-app unit; Razorpay behind `payments.ts`; test mode without keys; no Kreators Cash (2026-10-24). Plans and top-ups for the assistant are shown, and checkout says nothing was charged until a provider is live (2026-10-29).
- Content rewards pay per thousand verified views; YouTube read with a key, the rest typed and confirmed; finance pays (2026-10-24).
- Brands can submit leads themselves; staff turn a lead into a brief.
- School is online and self-paced in open cohorts, with the two seeded programs (2026-10-25).
- Club has no fee; a reviewer decides; a year by default. Its benefits are built: club-only Work listings and a named manager (2026-10-26).
- Minimum age 18, asked at sign-up with a phone number (2026-10-26).
- Every long list is served a page at a time, 10 to 100 rows (2026-10-26).
- Design tokens frozen from the freud UI Kit; dark mode keeps hues; ink is a cool slate (2026-10-24, 2026-10-25); a calm glass-on-gradient redesign (2026-10-30); two pillar colours changed (2026-11-01).
- Analytics in our own table, not a third party (2026-10-24).
- The no-marketplace line partly reversed for the Store, within limits: no money moves through kreators.app (2026-10-25).
- Onboarding is a short setup chat; the strategy session moved inside Pillars as the pillars' own onboarding (2026-10-29).
- The assistant acts through the app's own routes as the person, is paid in credits, and may read the journal only through providers that keep no data (2026-10-29).
- The Leaderboard is an app, on for everyone, opt-in per person (2026-10-30). Card games are an app (2026-10-31). Discover and its add-ons are private to the person (2026-10-31, 2026-11-01).
- Tasks have a do date and a due date, a priority, repeats and subtasks (2026-11-01).
- Agency is for content agencies and freelance creators, owner only, and billing reuses invoices (2026-11-01).
- Plan my week, time blocks, a project's pace, focus quality, Lo-fi and the private calendar link, from the Superfocus study (2026-11-01).
- Reviews on a calendar with repeating reminders, and a task flag that brings a task to a review (2026-11-01).

### Still open
- Email or phone verification. The phone is collected but neither is verified; founder admin promotion relies on signing up first.
- Geography and currencies beyond INR (Agency lets a person pick a currency for their invoices; the platform's money is INR).
- A staging environment and a written backup and restore step.
- Refund and cancellation terms for paid programs, if any are ever priced.
- Creator contracts, rights and exclusivity as legal text for Army (the fields exist on a campaign). Agreements in Agency are templates and say they are a starting point, not legal advice.
- Rights for the book collection before any AI use.
- Hosting and data residency beyond Cloudflare's defaults.
- A live payment provider, and so priced plans, a funding step for rewards and anything that needs recurring billing.
- Serving the assistant's tools as an MCP server later, which needs OAuth in front of sessions, to be decided against the rule that auth is hand-built.
- Unlock prices for card games and the point costs in Rewards are first guesses, to be tuned once a drop is priced.

## What changed since this was written

Version 0.3 was written on 26 October 2026. Since then, in plain words:

- **Onboarding and the pillars.** A short setup chat is the first thing a new person sees; the strategy session moved inside Pillars. One guide, Bumling, hosts most of it. The seven areas became pillars with six named layers; the pyramid stands on its point.
- **Tasks and Daily.** Two dates (do and due), priority tags, repeats, subtasks, a Remember tag, Start focus, ticked tasks that stay in sight, a not-to-do list, water and reminders, Plan my week with a plan strength, time blocks, and a flag that brings a task to a review.
- **Pillars.** A project's pace, an editable routine, and a life map.
- **Mindful minutes.** Focus rounds with breaks, one master switch and a volume for sounds, Lo-fi, a focus-quality rating, settings kept on the account, and a dashboard in minutes or hours.
- **Reviews.** A calendar, scheduled and repeating reviews with inbox reminders, tasks brought to a review, templates, and business metrics for people who run a business.
- **Agency (new).** Clients, a deliverables pipeline as a list or a board, a client dashboard and link with a switch for each part, time, an invoice designer and calculator, agreements from templates and the person's own, comments, PDF by the browser, and a link to Army campaigns.
- **Discover (new).** A self-discovery quiz with reasoning and emotional intelligence, a 16-type check, love languages, how your mind works, Human design and numerology.
- **Games, Leaderboard, Rewards.** Nine card games unlocked with points; boards by goal, pillar, city, tag and level; a long rewards catalog with shelves.
- **Community and connection.** Six reactions, mentions, pinned posts, anonymous posting and threaded replies, blocking, rank-based mutes, event photo links and conversations, attendee codes in Party, Run and Circles, usernames and friend codes.
- **Life coaches (new).** A permission, a badge, links the student agrees to, and notes the student reads.
- **The assistant and credits (new).** Typing to the assistant, paid in credits on three plans; Stop and Undo; a model that keeps no data for anything private.
- **Content and the Shop.** A strategist with a path from research to script; earnings calculator on reward pages; creator-written questions on product pages.
- **Team tools.** Observability moved into Operations and counts the newer apps; a Logs page for super admins; super admins can give xp and badges and delete a person.
- **Design and words.** A calm glass-on-gradient look with bento layouts; two pillar colours changed; no orphan words (measured); tabs, filters and switches keep the page where it is; plain words checked at a teenager's reading level.
- **Studies.** Whop (an earnings calculator and product questions taken) and Superfocus (planning and focus ideas taken); what each left out is written down.
- **Safety and limits.** Three devices an account; words people write are never links; every limit is in one file; the journal and wellbeing numbers still never reach brands, staff, the leaderboard, Club selection or a coach.

## Known gaps

- No email or phone verification (§9, §12).
- No staging, no written backup and restore, no alerting (§11).
- Company-level business metrics are not computed (§10).
- Each deploy needs `pnpm db:migrate` first, by hand; nothing checks that production has the latest migration.
- A bug sweep on 1 November 2026 fixed what it proved and listed what it only reported: Party refunds and waitlist charges, a few missing guards on points, account delete and data export that miss some tables, and some limits and block checks. They await decisions and are listed in 07 and 08 §13.

**Update, 1 November 2026 (later):** a bug sweep fixed dates that were not real days, repeats that drifted after a short month, key lookups that crashed on a word like "constructor", and several places where points or money could move twice (see 07 §16 and 08 §13). Water reminders now have their own two-hour trigger, with a choice of every two or four hours, and the Water and reminders box lists the tasks tagged Remember. Section actions on Home and other screens are one See all style. The figures are 58 migrations, 209 shared cases and 857 smoke checks.
