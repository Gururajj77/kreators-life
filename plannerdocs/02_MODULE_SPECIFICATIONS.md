# 02 — Module specifications

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** `MODULES`, `HOW_TO` and `TERMS` in `packages/shared/src/index.ts`; one route file per module in `apps/api/src/routes`; the smoke test in `scripts/smoke/smoke.mjs`.

## How a module is specified here

Every module is one entry in `MODULES` with a key, a name, a group, a path, a default (on or off for a new person), a minimum role, and an accent colour. Its rules are written once in `HOW_TO` (three to five steps with the numbers) and shown at the bottom of its main screen; the words it uses are defined in `TERMS` and listed under Help. The shared test insists every module has a `HOW_TO` entry and only uses defined words.

The flag for a module is its key, in `module_settings`. There are no `module.*`, `feature.*` or `ops.*` flags. Every API prefix maps to its module in `access.ts`, and a module that is not available to the person answers 403 on every route. Every long list a module serves is a page at a time (`page` and `size`, 10 to 100 rows, `Page` in the answer); a module with two lists on one screen prefixes them.

Rate limits are in `apps/api/src/limits.ts`, one line per limit with the route it guards.

Each block below gives: purpose, path and default, who can do what, tables, the rules, the smoke checks that prove them, and gaps.

## The index

| Group (shown as) | Key | Name | Path | Default | Min role |
| --- | --- | --- | --- | --- | --- |
| core (Essentials) | home | Home | /home | on, locked | user |
| core | today | Daily | /today | on, locked | user |
| core | tower | Pillars | /tower | on, locked | user |
| core | search | Search | /search | on, locked | user |
| core | notifications | Inbox | /inbox | on | user |
| core | help | Help | /help | on | user |
| earn (Contribution) | school | School | /school | on | user |
| earn | work | Work | /work | on | user |
| earn | army | Army | /army | on | user |
| earn | win | Win | /win | off | user |
| community (Connection) | party | Party | /party | off | user |
| community | run | Kreators Run | /run | off | user |
| community | community | Community | /community | off | user |
| community | club | Club | /club | off | user |
| community | bond | Bond | /bond | off | user |
| community | circles | Circles | /circles | off | user |
| wellbeing (Reflection) | life | Life | /life | on | user |
| wellbeing | wellbeing | Wellbeing | /wellbeing | off | user |
| wellbeing | mood | Mood | /mood | off | user |
| wellbeing | sleep | Sleep | /sleep | off | user |
| wellbeing | stress | Stress | /stress | off | user |
| wellbeing | mindful | Mindful minutes | /mindful | off | user |
| wellbeing | journal | Journal | /journal | on | user |
| wellbeing | reviews | Reviews | /reviews | off | user |
| wellbeing | companion | Companion | /companion | off | user |
| creator (Creation) | profile | Public page | /profile | on | user |
| creator | shop | Shop | /shop | on | user |
| creator | store | Store | /store | off | user |
| creator | audience | Audience | /shop/audience | off | user |
| creator | content | Content | /shop/content | off | user |
| creator | automations | Auto-DM | /shop/automations | off | user |
| creator | finance | Finance | /finance | off | user |
| creator | library | My purchases | /library | off | user |
| creator | knowledge | Knowledge | /knowledge | off | user |
| creator | tools | Tools | /tools | off | user |
| creator | tv | TV | /tv | off | user |
| creator | fund | Fund | /fund | off | user |
| manage (Operations) | manage | Manage | /manage | on | sub_admin |
| manage | admin | Admin | /admin | on | admin |
| internal (Internal) | observability | Observability | /internal/observability | on | sub_admin |

Not modules, but screens: Apps (the grouped list with the switches), the Profile tab (`/you`: account, badges, honors, features, appearance, sign out), Rank (`/leaderboard`) and Rewards (`/rewards`) which are part of the game and live under Profile, onboarding (`/vibe-check`), sign-in and sign-up, the public page (`/u/<handle>`, `/people/<id>`), and the site.

## A. Core platform

**Purpose:** accounts, sessions, modules, inbox, help, search, export and deletion.

**Routes:** `auth.ts` (sign-up, sign-in, sign-out, anonymous start, forgot, reset), `me.ts` (profile, password, modules, portfolio, link clicks, export, delete), `inbox.ts`, `support.ts`, `search.ts`, `home.ts`, `today.ts`, `nodes.ts`, `onboarding.ts`, `leaderboard.ts`, `rewards.ts`.

**Tables:** `users`, `sessions`, `relationship_scores`, `onboarding_answers`, `nodes`, `xp_events`, `spark_completions`, `honors`, `points_ledger`, `redemptions`, `notifications`, `support_tickets`, `not_to_do`, `not_to_do_days`, `password_resets`, `rate_limits`.

**Rules**
- Sign-up asks for an email, a password, a phone number and a date of birth; anyone under 18 is refused (`MIN_AGE`, `birthDateProblem`, `phoneProblem` in shared). It creates the user and seven zero scores and nothing else. A device session can come first; adding an email keeps its progress and asks the same questions.
- The password rule `passwordProblem` is the one rule for the form and both endpoints (8 to 128 characters, not common, not one character repeated, not your email).
- The game: check in 10 xp and 10 points, every seventh day in a row 50 points more; the small act 15 xp; a task 20 xp with a ripple (project 10, outcome 8, value goal 6, principle 4, pillar 2); clearing a project 30 xp; a kept not-to-do day 5 xp. Six rewarded ticks a day. The first three ticks are free; then ten minutes of age and a ten-minute gap. A task with a date waits for the day. Level n starts at 60·n·(n−1) xp.
- Not to do: at most 7 items, titles up to 60 characters, one row per item per day, only today or yesterday markable, the streak rule in `notToDoStreak`.
- Rank: top twenty by xp, streak or badges, opt-in only, never followers, never journal or wellbeing.
- Rewards: stickers 600, meetup ticket 1500, tee 2500, mentor call 4000 points; a redemption is a reservation; cancelling returns the points.
- Export is one JSON file. Delete needs the word DELETE, anonymises the person, deletes the private rows, keeps money rows for the books.

**Proof (smoke):** "no session means 401", "security headers on every answer", the password checks, "founder email becomes admin on sign-up", "sign-up creates nothing but the account", "unknown email answers the same as a wrong password", "password change signs out every other device", "forgot answers the same for any email", "a device session keeps its progress when an email is added", "only the default apps start on", the onboarding and pyramid checks, "a task with a date waits for the day", "the fourth tick waits", "a second check-in pays nothing", the not-to-do checks, "export is one JSON file", "an account can be deleted", "money rows stay for the books", "sign-in is limited to ten a minute per address".

**Gaps:** no email or phone verification; a module with no flag row is enabled by default (see 05).

## B. Army (`army`)

**Purpose:** brand campaigns run properly: lead, brief, scope, shortlist, approval, production, versions, feedback, delivery, report.

**Who:** a brand member submits a lead and reviews versions for their own organization; talent staff (`talent`) write briefs, shortlist, assign, mark work done; an assigned creator submits versions.

**Tables:** `organizations`, `organization_members`, `campaigns` (budget, currency, dates, status from `CAMPAIGN_STATUSES`: lead, brief, scoping, shortlist, approved, production, review, delivered, reported, cancelled; usage rights, exclusivity, restrictions, `public`), `campaign_deliverables`, `campaign_assignments` (unique per campaign and creator), `deliverable_versions`, `feedback_items`, `campaign_events`.

**Rules:** `whoFor` decides staff, brand or creator per campaign; "not your organization" is a 403; every change logs a campaign event; a public campaign shows on the site as a listing.

**Proof:** code review of `army.ts` (`orgRole`, `can(user, 'talent')`). Not in the smoke test.

**Gaps:** no smoke coverage of brand isolation; deliverables are links, not uploads (by design: no file storage).

## C. School (`school`)

**Purpose:** programs with lessons, assignments, mentor feedback, sessions and completion.

**Who:** cohort managers (`cohorts`) publish programs, run cohorts and mark completion; mentors (`mentor`) give feedback; learners enrol and submit.

**Tables:** `programs` (price in points or cents, delivery mode, published, outcomes, prerequisites, featured), `cohorts`, `enrollments` (unique per cohort and learner), `learning_items` (`content_ref` under `/resources/`), `course_assignments`, `submissions`, `submission_feedback`, `cohort_sessions`, `attendance`, `certificates`.

**Rules:** only published programs show to members; a cohort page needs enrolment or the mentor permission; completion is a manager's decision against the criteria, never elapsed time, audited; two real programs are seeded by migration 0016 (Editing fundamentals; Skills using ChatCut and AI), seven lessons each plus one assignment, in open self-paced cohorts, each lesson linking the skill file it came from; lesson bodies are the small markdown `Markdown.tsx` renders. Never seed placeholder programs; the smoke program is "Smoke test program".

**Proof:** "only cohort managers publish programs", "staff see unpublished programs", "members see only published programs", "the two real programs are seeded".

## D. Work (`work`)

**Purpose:** opportunities (gig, campaign, full time, part time, internship, collab) and one application each.

**Who:** a brand member or talent staff creates and publishes; anyone applies once; the owner or talent staff moves an application; a creator can only withdraw.

**Tables:** `opportunities` (compensation range, currency, location mode, deliverables, deadline, status draft/published/closed, eligibility, featured), `applications` (unique per opportunity and creator, status from `APPLICATION_STATUSES`), `application_events`.

**Rules:** the public list shows published listings whose deadline has not passed; a `club_only` listing is listed, opened and applied to only by an approved, unexpired Club member, and never shown on the public site; applying to an unpublished listing is 404 and past the deadline is "the deadline has passed"; the portfolio snapshot travels with the application; status changes are audited and land in Inbox; the list is paged.

**Proof:** "staff can post a club-only listing", "a non-member does not see a club-only listing", "nor open it", "nor apply", "the public site never lists it", "a Club member gets the first look", "and can apply".

## E. Party (`party`)

**Purpose:** meetups anyone can host; parties, workshops, camps and Kreators Days run by staff (`events`). Camp and Day are event types, as v0.1 suggested.

**Tables:** `events` (type from `EVENT_TYPES`, venue or online link, timezone, capacity, price in points, visibility public/private/club, status, featured), `event_registrations` (unique per event and person, registered or waitlisted, check-in, networking opt-in), `event_feedback` (unique per event and person).

**Rules:** a seat is taken by a conditional insert against the capacity; a full room waitlists; cancelling promotes the first waitlisted person and notifies them; a paid seat refunds its points on cancel; private events show only to the host and registrants; club events need an approved, unexpired membership; the host sees the registrant list, other attendees see only their own registration and the feedback average; cancelling an event notifies everyone registered or waitlisted.

**Proof:** code review of `party.ts`. Not in the smoke test.

**Gaps:** capacity under simultaneous RSVPs relies on the conditional insert and is not load-tested.

## F. Club (`club`)

**Purpose:** a curated membership. Apply with a note; a reviewer (`review`) approves, rejects, suspends, expires or activates; a year by default (1 to 24 months).

**Tables:** `memberships` (unique per person and type), the `community_star` honor on approval.

**Benefits as written in `CLUB_BENEFITS`, all built:** club-only events (enforced in Party), the first look at club-only Work listings (enforced in Work), a named manager (`memberships.manager_user_id`, a staff member a reviewer picks from the staff list, told to the member by inbox), the Club honor (given on approval). The `club_member` badge exists.

**Rules:** no fee; re-applying is allowed only after a rejection or expiry; every decision is audited and lands in Inbox.

**Proof:** "a member applies to the Club", "a reviewer sees the application and the staff list", "a reviewer approves", "only reviewers name a manager", "a manager must be on staff", "the member sees their manager by name", "and hears about it in the inbox".

**Gaps:** no appeal state.

## G. Win (`win`)

**Purpose:** content rewards. A brand funds a pool of points and sets a rate per thousand verified views, a cap per creator and a minimum view count.

**Who:** reviewers or talent staff create a reward; anyone submits one public link per reward; YouTube numbers are read with `YOUTUBE_API_KEY`, other platforms are typed and confirmed by a reviewer; finance (`finance`) pays.

**Tables:** `bounties` (pool, rate, cap, minimum, rule text, eligibility, platform, window, status, version, featured), `bounty_submissions` (unique per reward and person; submitted, verified, rejected, paid, disputed; evidence, dispute note), `social_metrics` (every reading with source and recorder).

**Rules:** `bountyPayout` is floor(views ÷ 1000) × rate, 0 below the minimum, capped by the per-creator cap; a payout never exceeds what is left in the pool; verify first, then pay; the pay goes through `points_ledger` and is audited; the reward's leaderboard shows names and views, never payouts; a rejection can be disputed. A reward changes after launch only through `PATCH /win/:id` (its creator, or review or talent staff): the version goes up, the audit row names the fields that changed, every entrant gets an inbox note, and the pool cannot drop under what was paid.

**Proof:** the shared test "content rewards pay per thousand verified views, never past the cap or below the floor"; "only staff change a reward", "saving nothing new keeps the version", "a change bumps the version and says what changed", "the reward carries its version", "everyone who entered is told".

## H. TV (`tv`) and I. Fund (`fund`)

**Purpose:** one pipeline for both: a proposal moves through submitted, review, diligence, approved or rejected, in progress, released (`PROPOSAL_STAGES`); reviewers (`review`) move it; every move is a `decision_log` row.

**Tables:** `proposals`, `decision_log`.

**Rules:** no money moves; "released in steps" is a stage, not a disbursement. Fund does not implement investment instruments, as v0.1 required.

## J. Kreators Run (`run`)

**Purpose:** Party for runners. Clubs, runs with a start code, entries that pay, badges, brand collabs with giveaways.

**Tables:** `run_clubs`, `run_members`, `runs` (a six-letter `code` only the host sees), `run_entries` (unique per run and person), `run_collabs`, `run_collab_applications` (unique per collab and club).

**Rules:** anyone starts a club and is its first member; only the host adds runs and voids entries; an entry needs membership, the exact code, and the window from `runEntryState` (thirty minutes before the start to three hours after the end), once per run; a logged run pays 20 xp and 10 points, two paid runs a day, through `xp_events` source `run` and `points_ledger` reason `run`; a void writes the reverse; the minutes are a `move` wellbeing log; badges at the first run, ten runs and a hundred kilometres; collabs are posted by staff with `events` or a brand's own team and carry the giveaway before any club applies; only a host applies.

**Proof:** "only the host adds runs", "the host adds a run and sees its start code", "the code never reaches a member", "a wrong code is refused", "the code works only from thirty minutes before", "a run is logged once", "a void takes the pay back out", "run minutes count as movement in Life", "a plain member cannot post a collab", "only the host applies".

## K. Community (`community`)

**Purpose:** posts, replies and likes by category, sorted by recent, popular or most replies, filtered to everyone, following or mine; follow from a post.

**Tables:** `community_posts` (hidden by a moderator), `community_replies`, `community_likes`, `follows`.

**Rules:** `rewardSocial` pays a post 5 xp up to three a day, a reply 2 xp up to five, a like given 1 xp up to ten, a like received 1 point and a new follower 2 points up to twenty a day, each once per thing so unliking and re-liking never pays twice; moderators (`moderation`) hide posts and replies and the author is told why; you cannot follow yourself.

**Proof:** "unliking and liking again pays nothing", "the author is not paid twice for one liker", "a person can be followed from a post", "you cannot follow yourself", the feed filter and sort checks, "a plain member cannot moderate".

**Gaps:** no report button for members.

## L. Bond (`bond`) and Circles (`circles`)

**Bond:** friends (request, accept), introductions with consent to people met at events, anonymous one-to-one chats under aliases that never reveal, and blocking. **Tables:** `friendships`, `introductions`, `bond_chats`, `bond_messages`, `blocks`. A blocked person cannot ask again; a chat from a public page needs an accepted friendship and the other person's chat switch.

**Circles:** weekly anonymous tables near you. Staff open a circle in a city; signups close thirty-six hours before; the cron sets tables two days before using the matcher in shared (complementary interests, within twenty kilometres when positions exist, otherwise by city); everyone gets an alias and a character; the group chat opens twenty-four hours before and closes two days after; the table writes its own plan; joining asks how you will show up (single wears red, committed wears white, or rather not say), stored per signup and shown only to its owner. There is no reveal. Positions are rounded to three decimals and never returned. **Tables:** `circle_events`, `circle_signups`, `circle_groups`, `circle_members`, `circle_messages`.

**Proof:** the shared matching and circles tests; code review of `bond.ts` and `circles.ts`.

**Gaps:** no report on a message.

## M. Wellbeing, Life, Journal, Reviews, Companion

- **Life:** five areas (physical, financial, emotional, mental, spiritual) scored from what is logged, each a link to where you act; movement minutes logged from the dashboard; private.
- **Wellbeing, Mood, Sleep, Stress, Mindful minutes:** one `wellbeing_logs` table by kind (mood, sleep, stress, mindful, move); every tracker shows a thirty-day line; the wellbeing score is from the four signals.
- **Journal:** `journal_entries` with an emotion, a stress level and stressors; owner only; in the export; deleted with the account.
- **Reviews:** `reviews` (one per person, kind and period start, saved with the prompts and a snapshot of the numbers) and `review_templates` (up to 12 of your own, up to 10 prompts each); the period arithmetic is `periodFor`, `periodShift`, `periodLabel`, `periodDays`; a period that has not started is refused; the "By period" panel sits on Home, Life, Finance, Wellbeing, the trackers, Journal and the Shop.
- **Companion:** `chat_messages`; a local reply that reflects the person's own numbers, or Workers AI when the `AI` binding exists, with a system prompt that never diagnoses and sends anyone mentioning self-harm to emergency services or a crisis line; a hard-coded crisis reply names Tele-MANAS 14416.

**The rule above all of them:** journal and wellbeing data never reach brands, staff, the leaderboard, the public page, Observability or Club selection.

**Proof:** "journal entries stay with their owner", "journal and wellbeing never reach the page", "observability never carries journal entries or wellbeing logs", "life counts the movement minutes", the reviews checks, the periods tests.

## N. Public page (`profile`), Shop (`shop`), Audience, Content, Auto-DM, My purchases

- **Public page:** `users.handle`, `public_json` (`PublicSettings`: one switch for the page, then socials, links, portfolio, products, posts, activity, badges, friend requests, chats; the server enforces every switch in `pageFor`), `links_json` (`parseLinkBlocks`: link, header, text, image, video from youtube-nocookie, carousel; up to 30 blocks; https only), `portfolio_items`, `page_events` (taps counted for the owner only), a trust score in the header, the "Made with kreators.app" footer.
- **Shop:** `products` of kind download, course (lessons, drip, quizzes, certificates), membership (months, renews by buying again), session (availability in the creator's zone, overrides, buffer, notice, horizon; `slotsFor` is pure and tested; a unique index stops two bookings of one slot; move a booking up to two hours before), event (replay for sale), link, payment link (fixed or pay what you want), bundle, locked post, priority DM (answered within promised days). `orders` (points or money; money orders stay pending until the webhook; `platform_fee_points` by the creator's `fee_bps`; affiliate code; coupon; refund fields), `coupons`, `bookings`, `leads`, `testimonials`, `broadcasts`, `dm_requests`, `quiz_attempts`, `lesson_progress`, `certificates`, `kyc_profiles`, `invoices`. Unlocks: `min_points` and `badge` on a product; `unlockFor` is the one rule and wording; a gated checkout is 403.
- **Audience:** followers, leads, broadcasts, the affiliate link (20 percent).
- **Content and Auto-DM:** `content_items`, `tracked_links` (`/go/<code>`), `link_clicks`, `dm_automations`, `dm_sends`, `funnels`, `sequences`, `sequence_sends`. Clicks carry an id into checkout so revenue is attributed per post. Without the Meta secrets, matched comments queue for sending by hand.
- **My purchases:** everything bought, with lesson progress, quizzes, certificates and answers.

**Proof:** "a seller can make a live product", "a product can carry an unlock", "a seller cannot buy their own product", "the same product is not bought twice", "the seller receives points, minus the fee", "a gated checkout is refused with the unlock wording", "a draft cannot be bought", "bought things appear in the library", "a handle can be set", "the public page carries a trust score", "a switched-off page returns only the name", the shared slots and money tests.

## O. Store (`store`), Tools (`tools`), Knowledge (`knowledge`)

- **Store:** three shelves. New gear (`store_items`) is stocked only by staff and bought through a partner link; the tap goes through `/out/store/:id` and is counted in `outbound_clicks` with a salted hash; the card says "Partner link. Kreators may earn a share." Pre-owned gear (`preowned_listings`, up to 20 open per person, a condition from `PREOWNED_CONDITIONS`, https pictures only) takes offers (`preowned_offers`: one open per buyer, accepting marks the listing agreed and declines the rest) and a chat per listing and buyer (`preowned_messages`, polled); money and handover are settled between the two people. Kits (`store_kits`, staff only) group both by stage and budget. A featured spot is seven days at the top: free from staff, 200 points for a seller's own live listing, ledger reason `feature`. Store items and tools can carry an unlock.
- **Tools:** a directory checked by reviewers; "Get it" goes through `/out/tool/:id`; anyone can suggest one and sees it at once; featured spots as in the Store.
- **Knowledge:** curated resources (article, exercise, video) with sources, seeded by migration 0005 and managed by staff. No AI, no book corpus.

**Proof:** the pre-owned, offer, chat, featured, kit and `/out` checks; "only the team stocks new gear"; "search finds pre-owned listings".

## P. Finance (`finance`)

Money in and out in integer cents with a category, counterparty and splits; dues both ways that settle in one tap and can repeat monthly; recurring entries posted by the cron; budgets per category; goals (save up, or earn by a date); the month next to all time; points earned shown alongside. Invoices stay as an API and a public page at `/i/<token>`; the Finance screen no longer lists them. Owner only. **Tables:** `finance_transactions`, `finance_dues`, `finance_recurring`, `finance_budgets`, `finance_goals`, `invoices`.

**Proof:** "an income is recorded in integer cents", "a fractional amount is rounded to whole cents", "a zero amount is refused", "finance rows stay with their owner".

## Q. Manage (`manage`), Admin (`admin`), Observability (`observability`)

- **Manage:** queues per permission (campaigns, cohorts, events, review, moderation, support, finance, mentoring), resources, moderation. Everything audited.
- **Admin:** with `ADMIN_KEY` before the first admin exists, or an admin's session. People (role, permissions, Pro, honors, points, a preview of exactly what one person sees), Modules and Flags (switch, minimum role, rollout, overrides), Listings (create, publish, feature), Orders (timeline, refund), Webhooks (replay), KYC, Ops (funnels, the email outbox), Redemptions, Audit. Every list is a `DataTable` served a page at a time.
- **Observability:** people in numbers, people per app, every account with its apps on, roles (an admin may change one, never their own, audited), the build map embedded from `docs/build-map.html`. Never journal or wellbeing. Only staff and admins by `minRole`.

**Proof:** "a permission alone is not enough: the role must be staff", "a wrong admin key is refused", "a plain member is not an admin", "an admin session works too", "every change is audited", "observability is closed to members", "an admin cannot change their own role".

## R. Parked

Random video chat, celebrity messages, a trending-audio or meme library, a standalone shortener, a cafe or house, an internal cash currency, an inventory-owning shop, a white-label app, instalments, a chat transport.

## Known gaps

- No member-facing report button in Community, Circles or Store chats.
- Army and Party have no smoke coverage of their access rules.
