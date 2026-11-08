# 01 — Product vision and master PRD

Last updated: 2026-11-07

**Product:** kreators.app
**Version:** 0.7, reconciled with the app on 7 November 2026
**Owner:** Product founder
**Source of truth:** `CLAUDE.md` for rules, `README.md` for the description, `docs/DECISIONS.md` for why, `docs/whop-study.md` and `docs/superfocus-study.md` for what two studies took and left, `docs/copy-brief.md` for how text reads on a phone, `docs/swiftui-rules.md` for the screen checklist, `docs/security/SECURITY_REPORT.md` for the security checks and `docs/performance.md` for the performance checks.
**Status (8 November 2026):** built for the scope in section 7. It is checked by 859 shared tests and 2,607 smoke checks. Typecheck, build, the size budget and the scans pass. The layout probes report 0 overflow, lone pill, unequal card and uneven tile row hits at 360, 390, 768 and 1280, and the few rag, orphan and contrast hits that remain are listed in 09 §4. The work up to migration 0100 is committed; the work of 7 November (migrations 0101 to 0115 and more than 350 changed files) is not committed yet. What still stands between it and a launch: commit and deploy that work (see Known gaps), payments are in test mode, the pages still need a lawyer's review, and the business details on the legal pages are Worker variables that are empty in the repo. The owner's own steps (rotating two pasted keys, a second factor on the provider accounts, spending caps, mail DNS, a rehearsed restore) are written down in the security report and not done. See Known gaps.

## 1. Executive summary

kreators.app is a daily game about the seven relationships in a person's life, with a creator super app built around it. The game gives a reason to open the app every day: three boxes, a streak, a pillar that grows. The modules around it are where a creator learns, earns, runs client work, sells, meets people, plans and looks after themselves. Each sits behind a switch the person and an admin both control. There are 47 modules in all, counting the core screens and the team's own (`MODULES` in `packages/shared/src/modules.ts`).

The v0.1 plan was a modular creator operating system where administrators enable modules without shipping a build. That part is true of what was built. The order changed: the game came first, and almost every module in the v0.1 "later" list shipped in the same push. Since v0.3 the app has grown a planning side (a week plan, time blocks, a month calendar, scheduled reviews), an agency side (Agency, with a client lifecycle, a team and documents) and a self-knowledge side (Discover). Since v0.4 it also reads patterns across a person's own apps (Emerging) and names good and bad habits. Since v0.6 a day has a shape (time blocks and day templates), the body has an app (Fitness), the journal has gratitude, a review walks one layer of the person's own pyramids, and a life coach can read a report the student agreed to. See "What changed since this was written" at the end.

## 2. Vision and promise

**Vision:** help people express themselves, build skills, form real relationships and earn in a way that lasts.

**The daily promise:** open the app, tick three boxes, see the numbers move. Everything that pays has a wait or a reviewer, so the numbers mean something.

**The creator promise:** learn a skill in School, prove it in Work and Army, sell what you make in the Shop with the attribution to know which post sold it, run your client work in Agency, and keep a public page that is the door into all of it.

**The agency promise:** for a content agency or a freelance creator, every client moves through nine stages from first contact to monthly delivery. Every piece moves from idea to published. The client opens one link, behind a password the owner sets, sees only what the owner chose to show, and approves or sends back. Invoices, agreements and other documents are made, sent and signed from the same place. The owner can bring in a team, and the client can share a work-only link with their own team.

**The brand promise:** a campaign with a brief, scope, shortlist, approvals, versions and usage rights written down; content rewards paid only on verified views.

## 3. Target users

### Primary
- Anyone who wants a daily practice around their relationships. The wording is universal: a teenager can read it (Flesch 60 or above). India is the default and someone abroad changes it: rupees, +91 and Indian dates to start, and any currency, time zone and date format under Profile. Every time on a screen follows the person's own zone and format.
- Aspiring and early-stage creators who need skills, a portfolio and paid work.
- Working creators who sell downloads, courses, sessions, memberships and events.
- Content agencies and freelance creators who make videos, posts, scripts and newsletters for clients (Agency). The app says plainly that Agency is for these two, not for agencies in general.

### Secondary
- Brands and agencies, as organizations with members, commissioning campaigns and funding content rewards.
- An agency owner's team: a content creator, a videographer, a video editor or a client, asked into one person's Agency with Off, View or Edit for each tab.
- An agency's clients, who open their own link, fill a short onboarding form, approve work and sign papers. A client's own team can get a second, work-only link.
- Mentors, who can be plain creators with the mentor permission.
- Life coaches, who can be plain creators with the coach permission and work only with students who said yes.
- Staff: talent managers, cohort managers, event hosts, finance, moderators (the guides of Community), support, reviewers.
- Admins, who hold every permission except Life coach and change roles and flags. A super admin (role `admin`) can also give xp and badges by hand and read the app's log.

## 4. Core user problems

Unchanged from v0.1, plus the one the game answers: people do not show up every day, so nothing compounds. The game makes showing up the first thing that pays. Three more since:
- People plan badly: too much on one day, nothing on another, no look back. So Daily plans the week and Reviews schedules the look back.
- Agencies and freelancers run client work across chats, spreadsheets and PDFs. So Agency holds it in one place, papers included.
- People cannot see what goes together in their own days. So Emerging reads their own apps and says, in plain words, what went together, never what caused what.
- A day has no shape, so tasks pile up anywhere. So a day template lays named blocks on the clock, and Daily places tasks inside them.

## 5. Product principles, with status

1. **Results first, then what did it, then the one thing to do next.** Home, onboarding and every dashboard follow this order. Holds.
2. **Phone-first.** One column with bottom tabs on a phone; a PWA; a phone on its side keeps the phone layout. Holds.
3. **Human in the loop.** Views are confirmed by a reviewer, payouts need the finance permission, completion is a manager's decision, Club is reviewed, moderation is by guides, a client approves a deliverable. Holds.
4. **One identity, modular experiences.** One account, forty-seven modules, each with a person's own hide and unhide and an admin's flag. An account can be signed in on three devices at a time. Holds.
5. **Explicit permissions.** Roles, permissions, ownership and module flags are all checked on the server. An Agency team member's access is read from their row on every request. Holds.
6. **Portable data.** Plain SQL migrations (113 of them), one JSON export, no vendor lock beyond Cloudflare. Holds.
7. **Measurable outcomes.** Fifteen product events in our own table, Dev Tools counts (including how much Discover and Agency are used, as counts only), period numbers in Reviews. Holds for product metrics; company-level business metrics need queries, see §10.
8. **Trust and safety.** Signed webhooks, salted click hashes, journal and wellbeing kept private, consented introductions, aliases in chats, no clickable links in what people write to each other, blocking, a rank-based mute. Since the launch pass also: the terms agreed to on purpose at sign-up and kept as a record, three privacy choices that start off, an enforcing content security policy, no cross-site reads of the API, and a note to the admins when sign-ins fail in bulk. Since then: a password the owner sets on every client link, and an emergency line in the public footer. Holds; moderation is thin, see 08.
9. **No vanity-only scoring.** Trust is built from earned things; the Leaderboard never sorts by followers. Holds. Home does show xp, streak, points and level, on purpose: they are the game's results, not vanity, and every card under them is an action.
10. **Wellbeing is not clinical care.** Holds; see 08 §5. The terms now say so in their own section, "Wellbeing, not medical care", and money tools are "not advice". Discover's "how your mind works" is never a diagnosis and says so; Human design and numerology are shown as reflection, not science.
11. **Plain words.** The seven are pillars, each a pyramid of six layers (foundation, guiding principle, value goal, goal outcome, project, task). The daily nudge is a small act, the list under tasks is not to do, and reviews are by period (a day, a week, a month, a quarter, a half year or a year; the half is the mid-year check-in in July and the start-of-year setting in January). The tabs are Home, Daily, Pillars, Apps and Profile. The servant_leader pillar is Servitude, and the focus app is Mindfulness (mindful minutes stays the measure). Never tower, floor, spark, ladder, rule, feeling, proof, sprint, cycle or retro. The not to do list is never called habits, vices or avoidances; a repeating task does wear a Habit tag, and an item of the list can show under Bad habit. Keys and routes keep old names. No word stands alone on the last line of a heading, a card or a paragraph; a probe measures it.
12. **Rules, not a model, wherever a rule will do.** The daily brief, Plan my week and its plan strength, a project's pace, the block hints, the review reminders, the focus numbers, Emerging's patterns, the good and bad habits and a coach's suggestions are plain rules. So they cost no credits and a free person gets them. A model is used only by the assistant (paid in credits), the Content strategist, the Companion with a plan (the built-in companion answers free otherwise) and the optional "Read with AI" on the strategy session's map card.

## 6. The flywheel as built

1. The game brings people back daily (check in, small act, task, not to do).
2. Daily plans the week and tasks flagged for a review land in it; Life, Wellbeing, the trackers and Reviews read what the game logs and point back into it. Emerging reads across them and offers one next step, such as making a task a habit.
3. School teaches; Work and Army pay; Win pays per verified view; the Shop sells; Content and Auto-DM show which post sold; Agency runs the client work and bills it.
4. Party, Run, Circles, Bond and Community put people in a room, under aliases where it matters; channels and run discussions keep them talking. Games and Discover give people something to do and learn together.
5. Club, honors, badges and the trust score make a record that cannot be typed in.
6. The public page is the door for everyone else; a client link, a team link, an invoice link, an agreement link and a document link are doors for the people a creator works with.

Whether each step moves retention is still a hypothesis. The product events and Dev Tools are there to find out.

## 7. Product scope

### Built and on by default
School, Work, Army, Journal, Life, Shop, Public page and the Leaderboard (on for everyone; a person appears only after they opt in), plus the core tabs (Home, Daily, Pillars, Search, Inbox, Help) and the assistant (locked on; typing to it needs a plan). Manage for staff, Admin for admins, Dev Tools (the Observability module) for both, in the Operations group. That is 18 of the 47.

### Built and off by default
Win, Agency, Party, Kreators Run, Community, Club, Bond, Circles, Games (the card games), Discover, Coaching, Wellbeing, Mood, Sleep, Stress, Mindfulness, Fitness, Reviews, Companion, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund. That is the other 29. A person hides or unhides one under Profile, Features or on Apps; an admin can switch any of them off for everyone, for a role, for a brand or for one person. The setup chat switches on the apps that fit what the person said. A hidden app's widgets leave Home too.

The groups always come in one order: Contribution, Reflection, Connection, Creation, Essentials, then the team's Operations. Each person picks which groups start open and the order of the apps inside a group, under Profile, Features. Until they pick, Contribution and Essentials start open, and the apps inside a group come in one default order the founder set (05 §12). Apps stay where they were last seen; they no longer move by context.

### Built and not an app
- Rewards (`/rewards`, a catalog of books, card games, merch and experiences bought with points).
- The strategy session (`/session`).
- Emerging's page (`/insights`), the patterns read across a person's own apps, by period, with a life dashboard.
- The Time blocks page (`/time-blocks`), where a person makes blocks, day templates and a weekly pattern.
- The Book page (`/book`), the founder's three books with their School courses.
- The private calendar link.
- The client link (`/a/`), the team link (`/t/`), and the invoice, agreement and document links (`/i/`, `/k/`, `/d/`).
- A life coach's invite link (`/coach/join/<token>`).
- The public site: `/`, `/features` (with a page for each feature and `/features/books`), `/7rp` and `/explore`.
- The legal pages (`/terms`, `/privacy`, `/refunds`, `/contact`, `/pricing`, `/subprocessors`, `/copyright`, `/licences`), with the privacy choices a person makes once and can change under Profile.

### Parked, by decision
- Stored-value currency. Points are not money and cannot be cashed out.
- Open or random video chat.
- Celebrity shout-outs, a meme or trending-audio library, a creator house or cafe.
- Native apps. The PWA is the app. For the same reason, blocking other apps or websites during a focus session is not possible and Help says so.
- A white-label app, instalments, and a native chat transport (Store chats, Bond chats and channels are polled tables).
- Automated clinical assessment of any kind.
- Magic-link sign-in: tried and removed (migrations 0018 and 0019).
- From the Whop study: a flat bonus per approved post and a campaign type for content rewards, a funding step before a reward opens, a welcome message after checkout, apps as pills along the top, an annual price with a discount, an affiliate marketplace.
- From the Superfocus study: two-way calendar sync and the Slack, Fathom, Granola and Outlook links (each needs partner keys and a sign-in we do not have), a licensed music playlist (the Lo-fi sound is made in the browser instead), a paid AI coach, "seasons", and anything its site does not explain.
- From the Toggl study: projects and clients on focus sessions, tags, billable time, idle detection and a timeline of the day, since tasks and Agency already carry that.
- Comparing a person's Discover results with other people's, until there are real results and a method to back it.
- Certified electronic signatures. Agreements are accepted by a typed name and the app says so.
- A PDF made by the server. A PDF is the browser's own print and save.
- A rich-text editor for papers. Agency papers are edited as plain text in place.
- Taking payment inside Agency. The invoice and its status stay the owner's; an agreement's "no reply in five working days counts as approved" is not enforced.
- In Fitness: body weight, BMI, body size, calories, photos and alcohol. They are sensitive and invite comparison, so the app never asks. Water stays the water card's, and water sends no note.
- A second factor for staff (left out for now, 2026-11-07).

## 8. Roles as built

Three roles in `ROLES`: `user` (Creator), `sub_admin` (Staff), `admin`. A role has a badge on the profile picture and, in the open laptop sidebar, a tag beside the theme button. A creator who holds the `coach` permission wears a Life coach badge. Earned badges never go on the picture or the sidebar.

Staff hold permissions from `PERMISSIONS`, each a job: `talent` (Army campaigns, shortlists), `cohorts` (programs, cohorts, completion), `events` (any event, check-in, Run collabs, attendee codes, circles), `finance` (payouts, money orders, discount codes), `moderation` (hide posts, reports, pins, held first posts and channels; whoever holds it is a guide), `support` (help tickets), `review` (Club, rewards, tools, TV, Fund), `mentor` (assignment feedback; a creator can hold it) and `coach` (life coaching; a creator can hold it, and alone among permissions an admin does not hold it unless given it). `can(user, permission)` in `apps/api/src/db.ts` is the one check; admins pass every check but `coach`. A permission on a plain user is not enough: the role must be staff, apart from `mentor` and `coach`.

Brands are `organizations` with `organization_members`. Whoever creates one owns it and adds teammates by email. A campaign belongs to an organization; a brand member sees only their organization's campaigns.

Agency has its own team roles, which are not app roles. An owner asks a content creator, a videographer, a video editor or a client by email, @username or friend code, up to 25. Each member gets Off, View or Edit for each of four tabs (Overview, Pipeline, Clients, Paperwork). Overview is never Edit, and a client member only reads one view. A member never sees money, private notes, the business profile or the client link, and their writes are logged with their name.

Founder addresses in `apps/api/src/admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in, audited. Only an admin changes a role, never their own. A super admin can give xp (down to zero) and badges by hand, delete a person from the People list (never an admin or themselves), allow or block any app for one person, make Agency house templates, and is the only reader of the app's log.

## 9. Core journeys as built

### Anyone joins
1. The public site at `/` opens on a hero with no panel (the hook in metal ink, a knot of the seven pillar colours reaching a little over its last word, the pitch with Start free, and three fact cards, one of them the link to `/features`), then tells a story in the PASTOR order: the problem, the five villains, the hero, the five Ws, how each villain is beaten with the apps that do it, before and after with the live numbers, the offer, the one next step. It shows nothing made up. Three guides speak in handwritten lines, the founder's three books sit on a shelf, and the last call to action is a fluted glass card. The FAQ has twenty answers. `/features` lists everything a creator needs by group, `/features/books` holds the books, `/7rp` shows the apps one pillar or one area of life at a time, and `/explore` lists what is live. The footer has three link columns, the privacy line and an emergency line (Tele-MANAS 14416 in India). "Start free" goes to Welcome; "Go to app" goes to sign-in, or to Home with a session.
2. Welcome opens an anonymous device session and the **setup chat** (`/onboarding`). One guide, Bumling, asks a few questions as taps on small grouped lists: what brings you here (up to three), which of these sound like you, what you make if you make things, and what usually gets in your way. The roles include Agency or studio owner, Agency team member, Brand or client, Life coach and Run club host. Every answer is said back in plain words. A typing box understands "what is Army?" and picks up tags from free text. The account is made inside it in two small cards: how you sign in, then phone and birthday, which nobody else sees. Sign-up needs an email, a password, a phone number, a date of birth and a ticked box agreeing to the terms and privacy policy (kept as a record). It refuses anyone under eighteen and creates the user and seven zero scores and nothing else. An email added to a device account keeps its progress. The chat ends by switching on up to five apps that fit, each with its reason, and offering the strategy session or the Discover quiz.
3. The **strategy session** (`/session`, opened from Pillars or from the setup chat's last card) is one conversation. Bumling hosts most of it; Lumen hosts the practices, and each focus pillar's own character asks its questions. Each part is answered on one card with an explanation first: the frame; a placement on the map for each relationship (core and floor, names never numbers, evidence when placed high); fears and insecurities; a scorecard with a behaviour check; the real day; a focus of at most two (floors under Courage first and suggested, never forced); a routine of six blocks ramped from the real day; practices; a signed contract whose check-in time becomes the daily reminder; the optional live call, a paid service at ₹10,000 (a yes keeps the ask and tells the team; nothing is charged until payments are live).
4. Leaving halfway resumes at the same part, and a chat keeps its place while the person moves around the app. The vibe check then asks only the focus pillars inside the same chat, three taps each; the rest wait on Pillars. One card picks or writes the value goal and project per pillar. Then the pyramid is built and explained one card at a time.
5. Pillars ends with the life map (the `#life-map` section): all seven on the map, the focus, the scores, fears and insecurities, the routine and the contract, with a run-again button. Each pillar page says where it sits, and each project with a due day shows its pace (on track, slipping or behind). Daily shows the three boxes and, under the first, the routine. The first three task ticks are free; after that a task needs ten minutes of age and a ten-minute gap, and a task cannot be ticked before its do date.

### Every day
Check in (10 xp, 10 points, the streak), the small act (15 xp), one task (20 xp, a ripple up the pyramid), the not to do list (5 xp per kept day). Six task ticks a day earn xp; more still count as done. Every seventh day in a row pays 50 points. Home opens with the daily brief (three signals and three next steps from plain rules) and, further down, a line of the day and Go to, picture tiles for every app that is shown. Daily also has a kind of day, Time blocks, a Habits section under Not to do, a Supplements fold for those who switch it on, and Emerging's patterns. Journal has gratitude for the day.

### A person plans the week and looks back
A task has a do date (the day it will be done, the only thing that holds a tick back) and an optional due date (the deadline, never a lock). It can carry a priority P0 to P3, a time and a length, subtasks and a repeat. A task with neither date waits under Not scheduled yet. A Remember tag sends an inbox note on the day or waits in To remember. **Plan my week** on Daily suggests a day for each open task that has none, the most important first and spread so no day is overloaded. It shows a plan strength out of 100 with a few plain notes, offers a fix for each, and changes nothing until the person keeps it. **Time blocks** give the day a shape. A block is a named stretch with a tag, a colour and maybe an area and a pillar. A day template lays blocks on the clock and carries a lead pillar, and it is the kind of day. A weekly pattern gives each weekday a template, and one date can change without breaking the week. By time block on Daily shows a task in the block it fits, marked Suggested, and quietly says when a task's time sits in a block meant for something else; nothing is written before a tap. A **month calendar** on Daily shows every day's tasks and its kind, adds one on a day and prints the month. A task can be brought to the review. **Reviews** run from a day to a year. Each built-in review walks one layer of the person's own pyramids, pillar by pillar: a day the tasks, a week the projects, a month the goal outcomes, a quarter the value goals, half a year the guiding principles, a year the foundations. The half is two parts, the mid-year check-in and the start-of-year setting. Each period has one built-in set of questions, stepped through one at a time with a tab for each, every answer kept while moving and one Save for all. The numbers from every app sit next to the period before. A calendar shows reviews written and reminders scheduled. A reminder for a chosen day and time (once or repeating) arrives as an inbox note that opens the right period on its questions. A private calendar link shows tasks and scheduled reviews in Google, Apple or Outlook Calendar, one way.

### A person focuses
Mindfulness has one panel with four tabs: Breathe (seven patterns, a cue at each step, and a count that can be held longer), Timer, Pomodoro (rounds with short and long breaks) and Stopwatch. Sounds sit under one master switch and a volume (rain, ocean, wind, a soft hum, or Lo-fi). After a focus session the person can rate how it felt. Today's sessions are listed with Continue, and a session can be changed, deleted or added if forgotten. An optional daily goal and daily nudge are off until switched on. Settings are saved on the account, so they follow the person to every device. A running clock follows the person around the app as a small coloured pill. Start focus on a task opens the timer with that task picked.

### A person moves and eats
Fitness logs movement (eight kinds, minutes, and an optional distance and effort) and a daily eating check-in of about thirty seconds: which meals, each Good fuel, Tasty or both, fruit and vegetables, protein added up by the serving against a goal of your own, and in a fold packaged food, how full and screens. Fasting is respected and left out of every average. Kreators Run has its own tool for a run or a walk, which writes the same log and works with Fitness off. A supplement list is off until switched on; it holds the person's own items, ticks them by part of the day, can show on Daily and can remind, and says plainly that the app does not check amounts or mixes. None of it pays. It never asks weight, calories or body size.

### A person writes gratitude
On Journal, three short lines a day, each under its own prompt from one of the seven pillars or the day itself. Prompts are the person's own: the next one they have not written under or skipped, none repeating until a group's round is done. A person can swap a prompt, pick another pillar, or make the day's three groups their usual three. It saves as they type, for today or yesterday, and a dot marks the day on the calendar. It stays with the journal's privacy.

### A life coach works with a student
An admin gives someone the coach permission. The coach adds a student by @username, friend code or email in one box, or shares an invite link. A student who says yes sees every switch first. The coach then reads a report by period (day, week, month or quarter), with charts, each pillar's layers and the routine, only for the parts the student shares. Patterns and suggestions come from rules, and Patterns needs the student's own switch. The coach leaves notes and adds tasks, never ticks one, and each section of the page can be hidden or folded. Never the journal, gratitude, money, water, focus, supplements or a review's snapshot.

### A creator applies for work
Browse published opportunities (closed or past-deadline ones take no applications; Club-only ones are seen only by members), apply once with a note and the portfolio snapshot, follow the status (submitted, reviewing, shortlisted, selected, rejected, withdrawn, completed) in Inbox. The listing's owner or a talent staffer reviews.

### A brand runs a campaign in Army
A brand member submits a lead or talent staff writes a brief; scope, budget, usage rights, exclusivity and restrictions are recorded; creators are shortlisted and assigned; versions, feedback and approvals sit in one thread; every step is logged in `campaign_events`. A creator on a campaign can bring its deliverables into Agency and send versions to the brand from there.

### A creator or agency runs client work in Agency
1. Add a client with a name, an email and a password the owner sets or generates. The client's page never opens without it, and only the owner changes it. A client who lost it can only ask for a new one, and the owner is told.
2. A new client fills a short onboarding form at their link: company, contact, address, tax numbers and the trial brief. That fills their record and makes the Trial agreement.
3. The client moves through nine stages: brand reaches out, agreement sent, agreement signed, strategy session, trial video, pilot month, retainer proposed, retainer active, monthly delivery. A progress bar shows it to both sides. The owner moves one step at a time; the app moves it forward only on what happened.
4. Every piece moves idea, script, making, review, approved, published, on a list or a board, with a notes thread, time and a due and a publish day. The client asks for a change (each piece has changes included) or comments.
5. After the pilot the owner offers retainer lengths; the client picks one and the owner confirms. Each month then makes its own invoice and pieces, once.
6. Invoices are made in a designer with a calculator: discount, GST with a CGST and SGST split, TDS added or shown, bank and UPI, total in words. Agreements come from templates (the Trial and pilot one is the founder's own word for word, monthly retainer, one-off project) or the person's own. Four more kinds of document share the same page. Every paper is edited in place on the page that prints, saved as you go, and "Fill in the details" lists every blank in one sheet. A paper can be emailed, printed by the browser, revised after it is sent, and a void can be restored. An emailed note names each paper with its own link, since a Worker makes no PDF, and a first send names the agreement and the invoice together. A client's brief answers save as they type, and a section left off the print can be switched on after signing without a revision.
7. The client link shows only the parts the owner switched on. Fees, private notes, time line by line, other clients and Army feedback are never in it. A second team link, with its own password, shows the client's own team the work and never the paperwork or money.
8. The owner can add team members (see §8). Daily, Finance, search, the brief, the calendar link and the assistant all know about Agency while it is on.

### A learner joins School
Pick a program and a cohort, do the lessons in order, submit assignments, get mentor feedback, attend sessions. Completion is the cohort manager's decision, never a timer. A certificate lands under My purchases. Six programs are open to members: Onboarding into kreators.app (first in the list, free, open all year), Editing fundamentals, Skills using ChatCut and AI, and three written from the founder's books, each lesson naming the chapter it comes from. The Admin guide is private to admins. A program is Draft, Private, Public or Archived. A lesson holds up to six resources (a video, one of the books, a file or a link), and each cohort has discussions, private by default.

### A person attends Party
RSVP; a full room waitlists, first in line; a cancelled seat promotes the next person and tells them; a reminder comes a day and an hour before; the host checks people in and sets the xp and the code guests claim on the day; afterwards a rating and an opt-in to introductions that Bond uses.

### A person learns about themselves in Discover
A quiz in five parts (most-and-least picks, adjusting pattern puzzles, descriptor words, real situations, an optional emotional intelligence part) scored on the server only. Three self-checks sit beside it (a free 16-type check, love languages, how your mind works), with Human design (its 36 channels each read in plain words) and numerology. Private to the person; switches decide whether the result may shape their next steps and whether the assistant may read a short summary.

### A person sees what goes together
Emerging reads the person's own apps by rules and shows a short card where it has something to say: on Home (the top three), Daily, Pillars, each pillar page, Fitness and the tracker screens. A card gives a number, one sentence, a small chart, how many days stand behind it, and one action. A task done again and again, or a slip on the not to do list, is set against the person's mood, sleep, stress, other tasks and focus on days with it and without. A clear lift is a Good habit; a clear dip is a Bad habit; anything less is Still watching. A line says things happened together, never that one caused the other. Nothing is stored, and nothing reaches the assistant, staff or the leaderboard. A coach gets patterns only through the student's own Patterns switch. `/insights` lists everything, and a period can be picked: a day to a year, with **Your life, this week** on top (the five areas, then the seven pillars, each number set beside the period before), and the patterns over those days, water, budgets and Fitness among them.

## 10. Success metrics

### Measured today
- Product events in `analytics_events` (`TRACKED_EVENTS`): creator signed up, profile published, product created, profile viewed, product viewed, checkout started, payment succeeded or failed, booking confirmed, refund issued, link created, automation created, content dashboard viewed, KYC submitted or approved. Admin, Ops shows funnels over them. A deleted account's events go with it, so the funnels drop them.
- Dev Tools: people in numbers, people per app, every account with its apps on, roles; counts of games unlocked, Discover quizzes and add-ons finished and how many switched "how your mind works" on, what super admins gave by hand, Agency use (people, clients, deliverables, invoices, agreements signed, client links on, business metrics on; counts only, never a client name or an amount) and the last day of the app's log. The build map is data in `apps/web/src/lib/buildMap.ts`, drawn in the page.
- The app's own log (`app_logs`, super admins only, thirty days): every change, refusal and server error with its area, cleaned path, status, time taken and who did it; never a body or anything private.
- Period numbers in `GET /reviews/summary`: check-ins, tasks, small acts, xp by pillar, kept days, mood, sleep, stress, mindful minutes, journal entries, money in and out (in the person's own currency), orders and sales, lessons, applications, events, posts, circles and runs, and the tasks brought to the review, next to the period before. Since 7 November also active minutes, days moved, eating, gratitude days, water, focus and its quality, habit and top-priority ticks, what was overdue at the end, routine days, budgets over, dues and savings goals, each only while its app is on, in the person's own zone.
- Focus time and quality on the Mindfulness dashboard (minutes, sessions, planned against actual, days the daily goal was met, the average rating of the sessions the person rated).
- Clicks per tracked link, taps per link block, outbound taps per store item and tool.
- Real-user web vitals (`web_vitals`): how long a page took to show, to respond and to settle, by route and by phone or desktop, with no person attached; staff read a summary from the API, with no screen for it yet.
- For a person who switches on business metrics in Reviews: up to twelve of their own, typed in each period or read from Agency (pieces published, approved first time, published on time, billable hours, utilisation, invoiced, paid, new clients), judged against a target.

### Not measured yet
Company-level numbers: Army revenue and margin, repeat brands, on-time delivery, School completion and refund rates, time to shortlist, dispute rate, RSVP-to-attendance. The tables hold the rows; the queries and a dashboard do not exist. (These are the company's numbers, not the business metrics a person can switch on in Reviews.)

Total registered users and follower counts are never a success metric.

## 11. Non-functional requirements, with status

- Responsive, phone-first, installable PWA. Holds.
- Accessibility: aria labels and roles throughout, reduced motion respected, a skip link, one keyboard rule for every dialog, a visible focus ring, an `alt` on every picture (a scan fails otherwise), and 44px tap targets (a probe reports 0 under that on 100 routes). Text sizes are in rem, so the browser's text size applies. A contrast probe measures WCAG 2.2 AA over every route in dark mode (colours were tuned; 3,375 hits became 30, mostly drawn map art). Overflow, orphan-word, lone-pill, cut-row, equal-height and even-row probes run over the shot list at phone, tablet and laptop width, and report 0 hits but for the listed orphans. The glass turns opaque under reduced transparency and more contrast. No screen-reader pass yet. Partial.
- Secure authentication and sessions. At most three devices at once. Holds; see 08.
- Server-side authorization. Roles, ownership, module flags and Agency team access. Holds.
- Input validation and rate limits. Validation on every route through `str`, `num`, `oneOf` and shared parsers. Every limit is in one file (`apps/api/src/limits.ts`). It covers the auth doors, posts, replies, likes, follows, chats and channel lines, offers, listings, tickets, applications, run entries, attendee code claims, coaching, Agency work and team invites, a client at their link and its password, discount checks, the shared admin key, a coach's reads, Emerging's reads (240 an hour) and the saving of settings. Holds.
- Audit logs for privileged and financial changes. Holds (`audit_logs`, read under Admin).
- Backups and tested restore. A restore procedure is written (`docs/security/RESTORE.md`) but has not been rehearsed; D1's own recovery is relied on. Gap.
- Error monitoring and logs. Wrangler observability is on; `pnpm cf:logs` tails; the app's own log (a Logs page for super admins) records changes, refusals, server errors, cron runs that did something and errors a browser reports, and every answer carries a request id. The cron writes to every admin's inbox when failed sign-ins, throttled requests or server errors pass a line, or a role changes (`securityAlerts`), and sends one private email with each new note once mail is set up; nobody is paged. Partial.
- Export and deletion. One JSON export and one delete cover every table that holds what a person wrote or what is about them. `scripts/data-coverage.mjs` holds a line for each table, `scan.sh` checks it against the code, and a new table fails the scan until someone decides. What is private goes; what other people or the books rely on stays with the name and words taken out. Each export and delete is logged without a name, and old outbox mail, link clicks, payment-message text and settled notices are removed on a schedule. Holds; what the delete leaves on purpose is in 04, Known gaps.
- Environments: development on 8787, a smoke server on 8788 with its own database, production. No staging. Gap. CI runs the checks on every push and pull request (`.github/workflows/ci.yml`), first on the next push.
- Migrations in source control. Holds once the last work is committed: 117 plain SQL files, 0001 to 0123; the commit "big changes" (8 November) holds up to 0119, and 0120 to 0123 are not yet tracked by git. Every migration is applied to the live database with `pnpm db:migrate` before `pnpm deploy`; the new code expects the new tables. 0101 and 0105 rebuild the two review tables, so back up first.
- Size. The main script is 475 kB of a 480 kB budget and the first download 1,469 kB of 1,500 kB (7 November); `pnpm perf:budget` fails the build past them. Holds.
- Automated tests for permissions, payments, flags and workflows. Unit tests in shared (859, including golden tests that pin Emerging's whole output) and an end-to-end smoke test (2,607 checks), both counted on 8 November 2026; see 09.

## 12. Decisions: resolved and open

### Resolved (date in `docs/DECISIONS.md`)
- Name: kreators.app everywhere people read; identifiers keep kreators-life (2026-10-25).
- Stack: React, Vite, pnpm; Hono on Cloudflare Workers with D1; one Worker serves both; plain SQL migrations (2026-10-23).
- Auth: anonymous device session first, email and password on top, hand-built; magic links tried and removed; no OTP (2026-10-23, 2026-10-25). Three devices at a time (2026-11-01).
- Money: points are the only in-app unit; Razorpay behind `payments.ts`; test mode without keys; no Kreators Cash (2026-10-24). Plans and top-ups for the assistant are shown, and checkout says nothing was charged until a provider is live (2026-10-29). Plans are priced and charged in rupees (2026-11-03).
- India first, open to all: rupees, +91, Indian dates and number grouping by default, with each person's own currency and zone; money is never converted between currencies (2026-11-03).
- Content rewards pay per thousand verified views; YouTube read with a key, the rest typed and confirmed; finance pays (2026-10-24).
- Brands can submit leads themselves; staff turn a lead into a brief.
- School is online and self-paced in open cohorts. Two programs were seeded from the skill files (2026-10-25), and three courses come from the founder's books (2026-11-04).
- Club has no fee; a reviewer decides; a year by default. Its benefits are built: club-only Work listings and a named manager (2026-10-26).
- Minimum age 18, asked at sign-up with a phone number (2026-10-26).
- Every long list is served a page at a time, 10 to 100 rows (2026-10-26).
- Design tokens frozen from the freud UI Kit; dark mode keeps hues; ink is a cool slate (2026-10-24, 2026-10-25); a calm glass-on-gradient redesign (2026-10-30); two pillar colours changed (2026-11-01); a motion kit drawn in our own code (2026-11-02); lucide icons instead of emoji (2026-11-03); dark mode made darker (2026-11-04).
- Type is one family, Google Sans Flex, self-hosted, with Apple's app text styles as the scale and weights after umbrel.com that follow the surface (titles 600, labels 550, tags 480, reading 450 on light surfaces, each 50 lighter on dark); only the two wordmarks are rounded, and Caveat stays for the guides' handwritten lines on the public site (2026-11-05).
- Analytics in our own table, not a third party (2026-10-24).
- The no-marketplace line partly reversed for the Store, within limits: no money moves through kreators.app (2026-10-25).
- Onboarding is a short setup chat; the strategy session moved inside Pillars as the pillars' own onboarding (2026-10-29).
- The assistant acts through the app's own routes as the person, is paid in credits, and may read the journal only through providers that keep no data (2026-10-29). The Companion is a third agent on the same model layer, read only, and free without a plan (2026-11-04).
- The Leaderboard is an app, on for everyone, opt-in per person (2026-10-30). Card games are an app (2026-10-31). Discover and its add-ons are private to the person (2026-10-31, 2026-11-01).
- Tasks have a do date and a due date, a priority, repeats and subtasks (2026-11-01). A repeating task counts as a habit unless the person says not (2026-11-04).
- Agency is for content agencies and freelance creators, owner only, and billing reuses invoices (2026-11-01). It has a lifecycle, a password the owner sets on each client link, and a retainer that makes each month once (2026-11-02). Papers are edited in place and the Trial agreement follows the founder's own word for word; new clients onboard themselves (2026-11-03). It has a team and a second, work-only team link that needs its own password (2026-11-04, 2026-11-05).
- Discount codes are made by the team only, and the platform bears the discount (2026-11-02).
- Badges are about sixty medals in ten families, and a badge once earned is never taken back (2026-11-02).
- Chat channels in Community and Bond, and discussions on runs, are polled tables (2026-11-02, 2026-11-04).
- Plan my week, time blocks, a project's pace, focus quality, Lo-fi and the private calendar link, from the Superfocus study (2026-11-01).
- Reviews on a calendar with repeating reminders, and a task flag that brings a task to a review (2026-11-01).
- Terms on record, three privacy choices that start off, an enforcing content security policy, no CORS, and screens that load when opened (2026-11-01, the launch pass). Terms written for India's DPDP Act (2026-11-03); the terms gained "Wellbeing, not medical care" and "Money tools, not advice", and `LEGAL_VERSION` is 2026-11-05.
- The app groups have one fixed order, and each person picks which start open and how the apps inside are arranged (2026-11-03, 2026-11-04).
- The five areas of life always go physical, financial, mental, emotional, spiritual (2026-11-04).
- Names: Servitude for the servant_leader pillar and Mindfulness for the focus app (2026-11-04).
- Emerging reads patterns by rules, computes them on read, stores nothing and never names a cause (2026-11-04). It is one request a day per device (2026-11-05).
- Deleting an account also deletes its product and page events (2026-11-05). The export and the delete cover every table that names a person, held by a scan (2026-11-07).
- Time blocks: a day template is the kind of day; nothing is written before a tap (2026-11-06, 2026-11-07).
- A hidden app's widgets leave Home, and apps are hidden and unhidden, never switched on and off, in what the screen says to do (2026-11-06). His own headlines keep the word switch until he says otherwise (2026-11-07).
- The live call is a paid service, the third thing that costs money, and nothing is charged until payments are live (2026-11-06).
- Fitness is its own app; both logs are ordinary tracker rows; it pays nothing and never asks weight, BMI or calories (2026-11-07). A supplement list is the person's own, with no starter list, and is kept from every other reader but one count in their own Reviews (2026-11-07).
- Reviews run from a day to a year and walk one layer of the pyramid; the half has two parts (2026-11-07).
- Gratitude prompts are per person; a prompt counts as seen only when written under or skipped (2026-11-07).
- Erasing progress keeps gratitude and Fitness logs, like the journal and the trackers (2026-11-07).
- Emerging reaches a coach only through a sixth share part, Patterns, off on every older link. Students are not asked again about the eating number, which stays under Reflection (2026-11-07).
- Times on screen follow the person's own zone and format, and a visitor reads India's clock (2026-11-07).
- Water notes are gone; water itself stays (2026-11-07).
- Apps inside a group have one fixed default order; the rule that lists moved by context has ended; Observability is called Dev Tools on screen (2026-11-07).
- The staff second factor is left out for now (2026-11-07).

### Still open
- Email or phone verification. The phone is collected but neither is verified; founder admin promotion relies on signing up first.
- How far beyond India: the app works for a person abroad, but nothing is converted between currencies and the platform's own prices are in rupees.
- A staging environment and a rehearsed backup and restore.
- Refund and cancellation terms for paid programs, if any are ever priced.
- Creator contracts, rights and exclusivity as legal text for Army (the fields exist on a campaign). Agreements in Agency are templates and say they are a starting point, not legal advice.
- A lawyer's review of the terms and privacy policy for each country the app is offered in (the terms say they are a plain-language draft), and the owner filling in the business details, the Grievance Officer and the copyright agent.
- The Indian period for keeping money records (the policy says seven years, worded as what the law asks, until the founder confirms).
- Rights for the book collection before any AI use.
- Hosting and data residency beyond Cloudflare's defaults.
- A live payment provider, and so priced plans, a funding step for rewards and anything that needs recurring billing.
- The refund rule for the live call: `/refunds` and the terms' Pricing and billing do not name it yet.
- What a deleted seller's paid, undelivered work should do (told today, refunded by hand), and how long an inbox note lives.
- Whether the anonymous block should stay a global row (the one signal noted on 2026-11-06 stays by his choice for now).
- Whether a small dated table should hold each amount put into a savings goal, so a review could show the period's own.
- Whether a tablet should fold the sidebar by default (the columns start at `lg` today).
- Serving the assistant's tools as an MCP server later, which needs OAuth in front of sessions, to be decided against the rule that auth is hand-built.
- Unlock prices for card games and the point costs in Rewards are first guesses, to be tuned once a drop is priced. The founder's books are draft Shop products with no price yet.

## What changed since this was written

### From version 0.6 to 0.7 (5 to 7 November 2026)

- **Time blocks (new).** Blocks, day templates with their own colours, a weekly pattern and a Time blocks page. By time block on Daily, with suggestions and a quiet line when a task sits in the wrong block. Your kinds of day in Emerging, Reviews and the month calendar.
- **Fitness (new).** Movement in eight kinds, a holistic eating check-in, a supplement list off until switched on, and Kreators Run's own tool. Nothing pays.
- **Gratitude for the day (new).** Three lines under per-person prompts on Journal, with a pillar picker and a usual three.
- **Reviews.** The day and the year are new. Each review walks one layer of the pyramids, with one built-in set of questions per period, a mid-year check-in and a start-of-year setting, tabbed steps, a read-only list of templates to copy, and fuller numbers in the person's own zone.
- **Emerging.** Six periods on `/insights`, Your life with the five areas and seven pillars, and patterns for water, budgets, moving, eating and gratitude. A rolling eight weeks stays when no period is picked.
- **Coaching.** A report by period with charts, sections that fold or hide, patterns and suggestions by consent, one box to add a student, an invite link, and First steps for a new coach.
- **School.** Program and course states, editing in place, cohort discussions, up to six resources on a lesson, an Onboarding course and an Admin guide.
- **Agency.** Email notes that name each paper with its link, a pricing P.S. and a clause reply, brief answers that save as the client types, Print this section on a signed paper, and a step back that sticks.
- **Home and apps.** Go to is picture tiles, a hidden app's widgets leave Home, apps are hidden and unhidden, one default order inside each group, and a bell in the sidebar.
- **Dates and inbox.** Times follow the person's zone and format. Every note has a tab, opens its page and lands on its section. Water notes are gone.
- **Design.** One red yes, every tile grid in even rows, and tablet columns that start at `lg`.
- **Under the hood.** Blocks, gratitude, Fitness, the coach's report and How it works became subpath exports. CI, the data coverage guard and the note link guard are new. The admin key has its own door, and alerts also go by email. The figures are now 117 migrations, 47 modules, 859 shared tests and 2,607 smoke checks (8 November).

### From version 0.4 to 0.6 (1 to 5 November 2026)

- **Type and look.** One font family, Google Sans Flex, with Apple's text styles as the one scale, umbrel's weights adjusted for light and dark surfaces and its tighter leading, card and row titles a step larger over a smaller line, and every block of text kept a rectangle (measured); Geist, Inter and Geist Mono are gone. Only the two wordmarks are rounded. A motion kit of our own, lucide icons instead of emoji, cover cards for app headers, a hero for apps with a number about the person, a matte finish on solid surfaces, a darker dark mode, a sidebar that folds to an icon rail, and the 45-degree arrow on every link.
- **Public site.** A new home hero (no panel, the seven-colour knot over the end of the hook, Start free under the pitch), lighter copy across the site, three button looks, guide lines handwritten in Caveat, the founder's books on a shelf and on `/features/books`, a fluted glass close, a new footer with an emergency line, twenty FAQ answers, and `/7rp` one pillar at a time. Cards follow one rule: tags in the corner, facts and actions at the foot.
- **Daily and tasks.** A month calendar that prints, Kind of day, tasks moved between pillars, "Count it as a habit", a Habits section, Add a task as a fold, and every mark on a task row at its right.
- **Emerging (new).** Patterns across a person's own apps by rules, with good and bad habits, on Home, Daily, Pillars and the trackers, and a page of its own.
- **Mindfulness (renamed from Mindful minutes).** One panel with Breathe, Timer, Pomodoro and Stopwatch, breathing patterns and cues, today's sessions, a daily goal and nudge, a corner pill that follows you, and full screen.
- **Journal.** "Prompt me": 16 categories and about 340 prompts, kept on the device only.
- **Agency.** A nine-stage lifecycle, a password the owner sets on each client link, client onboarding, retainers that make each month, documents beyond invoices and agreements, papers edited in place, the founder's own Trial agreement and invoice look, Fill in the details, restore after void, a team with per-tab access, and a team link for the client's own team.
- **Community and connection.** Chat channels in Community and Bond, discussions on runs, and the Companion on the assistant's model layer.
- **Badges, books and money.** 59 medals in ten families; the founder's three books as School courses and draft Shop products; discount codes the team makes; plans priced in rupees and a currency per person.
- **Profile and apps.** Each person picks which app groups start open and orders the apps inside them, saved on the account; "Your year" activity grid on Profile; a new public page look.
- **Legal and privacy.** Terms and privacy written for India's DPDP Act, two new sections in the terms, `LEGAL_VERSION` 2026-11-05, and a deleted account's events deleted with it.
- **Under the hood.** The shared model split into one file per domain, page-by-page loading tuned, and the figures now 83 migrations, 553 shared tests and 1,610 smoke checks.

### From version 0.3 to 0.4 (26 October to 1 November 2026)

- **Onboarding and the pillars.** A short setup chat is the first thing a new person sees; the strategy session moved inside Pillars. One guide, Bumling, hosts most of it. The seven areas became pillars with six named layers; the pyramid stands on its point.
- **Tasks and Daily.** Two dates (do and due), priority tags, repeats, subtasks, a Remember tag, Start focus, ticked tasks that stay in sight, a not to do list, water and reminders (with their own two-hour trigger), Plan my week with a plan strength, time blocks, and a flag that brings a task to a review.
- **Pillars.** A project's pace, an editable routine, and a life map.
- **Focus (then Mindful minutes).** Focus rounds with breaks, one master switch and a volume for sounds, Lo-fi, a focus-quality rating, settings kept on the account, and a dashboard in minutes or hours.
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
- **A bug sweep.** Dates that were not real days, repeats that drifted after a short month, key lookups that crashed on a word like "constructor", and several places where points or money could move twice were fixed (see 07 §16 and 08 §13).
- **Legal, security and performance (the launch pass).** Terms agreed to at sign-up and recorded; three privacy choices that start off and are asked once; legal pages in plain words; an enforcing content security policy, no cross-site reads, blocked paths, an address guard and alerts to the admins; pages that download when opened; indexes and timeouts; fonts served from this site; colours that meet WCAG AA, a skip link and one keyboard rule for dialogs.
- **Safety and limits.** Three devices an account; words people write are never links; every limit is in one file; the journal and wellbeing numbers still never reach brands, staff, the leaderboard, Club selection or a coach.

## Known gaps

- **The last work is not committed or deployed.** The commit "big changes" (8 November, 09:37) holds the work up to migration 0119. Before a deploy the rest must be committed, new files included (`git status` lists them as `??`: migrations 0120 to 0123, `routes/eventsPublic.ts`, `site/Events.tsx` and seventeen more).
- No email or phone verification (§9, §12).
- No staging; a restore procedure written but not rehearsed; nobody is paged by an alert (§11). CI has not run on GitHub yet.
- Company-level business metrics are not computed (§10).
- Each deploy needs `pnpm db:migrate` first, by hand; nothing checks that production has the latest migration.
- The bug sweep of 1 November listed what it only reported: Party refunds and waitlist charges, a few missing guards on points, and some limits and block checks. The points paths in Store checkout, School enrolment and Party RSVP now take points with a guarded update, a host's cancel refunds what each seat paid and a waitlist promotion charges with the same guard (2026-11-02); the rest await decisions and are listed in 07 and 08 §13.
- The launch pass left these open on purpose, each with its next step in `docs/security/SECURITY_REPORT.md` and `docs/performance.md`: one real test-mode payment with the console open (bank pages, UPI and 3-D Secure are untested against the content security policy), no second factor for staff, session tokens kept in `localStorage` (protected by the policy and the absence of outside scripts), public pages drawn in the browser and not on the server, and the assistant answering once instead of streaming. The owner's own steps (rotate the two keys pasted in an earlier chat, a second factor on the provider accounts, spending caps, mail DNS, Cloudflare Always Use HTTPS, GitHub push protection) are in the security report.
- Small items still open in the screens: Party's event page still shows its own media button; Daily's kind of day does not yet read the kind a person's tags imply; `/refunds` does not yet name the live call.
- The density probe reports 16 word-count hits on 103 routes (the public home, Profile, Help, Circles, the Store, Dev Tools), kept on purpose or waiting on the founder; the rectangle probe keeps a handful of hits on test data, policy text and narrow labels (09 §4).
- No screen-reader pass yet (§11).
