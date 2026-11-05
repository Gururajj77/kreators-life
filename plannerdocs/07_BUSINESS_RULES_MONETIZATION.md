# 07 — Business rules and monetization

**Last updated:** 2026-11-05

**Product:** kreators.app
**Version:** 0.6, reconciled with the app on 5 November 2026 (0.4 was 1 November 2026, after that day's bug sweep and its legal, security and performance pass; 0.3 was 26 October 2026)
**Source of truth:** the constants in the shared model. Since 4 November 2026 `packages/shared/src/index.ts` is only a barrel over one file per domain, so each name lives in its own file: `XP` and `WAIT` in `pillars.ts`; `POINTS`, `REWARDS`, `REWARD_GROUPS` and `CARD_GAMES` in `rewards.ts`; `SOCIAL_REWARDS` and `trustScore` in `community.ts`; `RUN_REWARD` and the attendee-code numbers in `events.ts`; `FEATURE_FEE_POINTS` in `store.ts`; `AFFILIATE_SHARE` in `account.ts`; `PLANS`, `TOPUP_PACKS`, `AGENT_LIMITS`, `PAYMENTS_LIVE` and `creditsFor` in `assistant.ts`; `BADGES`, `HONORS`, `unlockFor` and `earningGuide` in `badges.ts`; `bountyPayout` in `work.ts`; `typedCents`, `productPayWays`, `money` and `feeBps` in `money.ts`; `invoiceTotals` in `invoice.ts`; `retainerMonthlyCents` and `kpiStatus` in `agency.ts`; the discount rules in `discounts.ts`; `LEGAL_VERSION`, `RETENTION` and `CONSENT_PURPOSES` in `legal.ts`. Then `apps/api/src/payments.ts`, `rewards.ts`, `credits.ts`, `discounts.ts`, `routes/finance.ts`, `routes/store.ts`, `routes/growth.ts`, `routes/party.ts`, `routes/agencyDocs.ts`, the policy pages at `/terms`, `/privacy`, `/refunds`, `/pricing`, `/contact`, `/subprocessors` (`apps/web/src/site/Policy.tsx`), and `docs/DECISIONS.md`.

## 1. Purpose

Every number that pays, charges or gates, as the app applies it today. The v0.1 hypotheses that were never built are kept at the end, marked as hypotheses.

## 2. Points and money: the line between them

Points are the only unit that moves inside the app. The terms page says it plainly: points are earned by showing up and can be spent inside kreators.app; they are not money, cannot be cashed out and have no value outside the app. Xp is never spent. There is no stored-value balance, no transfer between people, and no "Kreators Cash" (decision of 24 October 2026).

Money exists in three places only:

- A creator's own **Shop**: a buyer pays a creator through the payment provider; kreators.app takes a platform fee in points.
- A creator's own **Finance** tracker: a private ledger of their business. It adds up only the person's own currency (`users.currency`, rupees unless changed under Profile). An entry in another currency is listed with its own sign and left out of the sums; nothing is converted.
- A creator's own **invoices** (Agency, and the older invoice API under Finance): a document and a status. The money moves between the creator and their client, outside the app. kreators.app takes nothing from an invoice and never moves the money; marking one paid books it as income in the creator's own ledger, and taking that back removes it.

kreators.app never holds goods or money for the Store. Paying for a plan, a top-up or the live strategy call (13) is the one place the app itself would charge, and nothing is charged until payments are switched on.

All money is whole paise or cents and all points are whole numbers. `money()` writes rupees in lakh and crore and other currencies in thousands. An amount a person types is read from its digits with `typedCents` (16).

## 3. The game's pay table

| What | Pays | Rule |
| --- | --- | --- |
| Check in | 10 xp, 10 points | Once a day, for the person's own date (at most one day from the server's). Keeps the streak. |
| Seventh day in a row | 50 points more | Every 7th day of a check-in streak. |
| The small act | 15 xp | Once a day, for the weakest pillar. |
| A task | 20 xp | Six rewarded ticks a rolling day; the rest count as done. The first three ticks ever are free; after that ten minutes of age and a ten-minute gap. A dated task waits for the day. |
| The ripple | project 10, goal outcome 8, value goal 6, guiding principle 4, pillar 2 | On every ticked task, to each layer under it. |
| Clearing a project | 30 xp | Every task in it done. |
| A kept not-to-do day | 5 xp | Once per item per day, never clawed back; the streak is the prize. |
| Levels | | Level n starts at 60 × n × (n − 1) xp: 0, 120, 360, 720, 1200. |
| Character stages | | Spark 0 xp, Glow 150 xp and 2 days, Blaze 500 and 10 days, Beacon 1200 and 30 days. Days are a floor however much xp there is. |
| Identity stages | | Seed 0, Sprout 300 and 3 days, Climber 900 and 14, Steady hand 2000 and 45, Luminary 4000 and 120. |
| Badges | pays nothing | 59 medals in ten families (Daily habits, Pillars, Focus, Reflection, Community, Creator, Money, Fitness, Learning, Milestones), each bronze, silver, gold or platinum. Each is one count reaching a number (`BADGE_STATS`, read in one query by `getStats`). A badge is written down the first time it is seen (`badge_awards`, migration 0065) and is never taken back. Reflection, Focus and Money badges are private: never on a public page, in the leaderboard count or in an unlock picker. Community counts only posts and replies that are not anonymous. |
| Honors | pays nothing | Given by the team (Founding member, Community star, Team player), following a plan (Pro), unlocked by time here (7, 30, 90, 365 days), or won: the monthly leaderboard's top three get `season_top` when the cron closes the month. |
| Given by hand | as given | A super admin can give or take xp (at most 100,000 at a time, never below zero) and give badges (`badge_grants`, migration 0045) from Admin, People. Both are audited, and a given badge counts for unlocks and the leaderboard. |
| Planning and tags | pays nothing | A priority (P0 to P3), Remember, Bring it to my review, the Habit tag, subtasks, Kind of day, Plan my week and its plan strength, time blocks, a project's pace, focus sessions and their quality rating, water, a scheduled review and Emerging's patterns (good and bad habits among them) never change what a tick pays. |
| Rewards | cost points | 41 items on nine shelves (books, card games, apparel, tech, drinkware, stationery, lifestyle, novelty, experiences), every cost whole points, from 400 (laptop stickers, a lip balm, a stress ball) to 4,500 (the hoodie). The three books are the founder's own, 2,000 each; on the shelf they keep their reward names (The Relationship Method, Dictionary of Mistakes for Kreators, Dictionary of Mistakes for 20 Somethings). The merch brand is "Kreators" (the Kreators tee is 2,500); a meetup ticket is 1,500 and a one-to-one call 4,000. Gear is a reservation until a drop ships; cancelling returns the points. The reservations list is paged. Rewards are not an app. |
| A card game | 1,000 to 2,000 points, and an xp floor | Nine games (`CARD_GAMES`), each a reward of kind `unlock`: redeeming one opens it at once and for good (`card_unlocks`, kept through an erase, never cancelled) and switches Games on. The xp floors are 0, 100, 250 or 500. A locked game's button says what it asks, its price included; a super admin is never locked out. |

Everything that pays has a wait or a reviewer. An undo takes the xp back.

## 4. With people

| What | Pays | Cap |
| --- | --- | --- |
| A post | 5 xp | 3 a day |
| A reply | 2 xp | 5 a day |
| A like you give | 1 xp | 10 a day |
| A like on your post | 1 point to the author | 20 a day, once per person per post |
| A new follower | 2 points | 20 a day, once per person |
| A run with a club | the run's own xp (20 unless the host sets it, up to 50) and 10 points | 2 paid runs a day, counted inside the batch that pays; once per run; only with the start code inside the window; a void reverses it |
| An attendee code at a Party event or a circle | the xp the host set, up to 50 | Guests only, once each, 3 in any 24 hours, counted inside the batch that pays. The xp is fixed once the code opens, thirty minutes before the start. Whoever is shown the code never claims it. |

Each pays once per thing (`source_id` or `ref`), so unliking and liking again never pays twice. Only the first reaction on a post is the like that pays; changing it pays nothing, and reactions on replies pay nothing. A first post held for a guide pays when the guide says okay. Lines in channels, event conversations and run discussions pay nothing. No self-reported run ever pays.

## 5. Making and selling

- **Products** are priced in points, in cents, or pay what you want. `productPayWays` is the one rule for how each can be paid: points when it has a points price, is free or is pay what you want; money when it has a money price. A points order on a money-only product is refused (400) before any coupon is used. A buyer pays points instantly, taken first with a guarded update; the seller receives the points minus the platform fee. A money order is created at the provider, the buyer pays in the provider's checkout, and the order becomes `paid` only in the webhook after the signature checks out; an order nobody pays within half an hour is closed by the cron.
- **Platform fee:** per creator, in basis points (`users.fee_bps`), applied with `feeBps` (integer maths, rounded). Recorded on the order as `platform_fee_points`.
- **Affiliates:** 20 percent of a sale brought in by an affiliate link (`AFFILIATE_SHARE`).
- **Coupons:** a creator's own, a percentage off, optionally one product, with a use cap and an expiry; unique per owner. The use is taken after the points, guarded on the cap, and given back if the checkout then fails. A creator coupon and a team discount code (18) are never used together.
- **Refunds:** in full, by the creator from their own shop (`POST /studio/orders/:id/refund`) or by an admin from the order's timeline, with a reason, logged and tracked (`refund_issued`). The buyer gets back what they paid; the seller and any affiliate give back what they were credited. Money goes back through the provider. The refunds page says money returns by UPI, card or bank through Razorpay, and points return at once.
- **Memberships** carry a period in months; entitlement checks the order's expiry; buying again renews.
- **Sessions:** availability in the creator's zone with overrides, a buffer, minimum notice and a horizon; one booking per slot by a unique index; a buyer can move a booking up to two hours before.
- **Payout details:** legal name, PAN (hash and last four), bank (last four), IFSC and address, submitted from Customers and reviewed under Admin, KYC. Bank payouts themselves happen outside the app.
- **Pro** is a paid plan (13): a plan starts the Pro mark (`is_pro` and the `pro` honor follow it), and ending the plan ends the mark. Until payments are live only an admin starts one.
- **Unlocks:** a product, a store item, a tool or a game can ask for a points balance, an xp floor, a badge, or any mix (`min_points`, `min_xp`, `badge`). `unlockFor` is the one rule. A locked button says "Unlocks at 500 xp, 2,000 points and the First tick badge" (`unlockAt`, counts through `formatCount`), then what this person still lacks. Only public badges and honors can be asked for. A gated checkout is a 403; a locked item's link is blanked; a super admin is never locked out. A creator can add up to six questions and answers to a product's page (`MAX_FAQ`), and a reward page shows a live "What could I earn?" worked out by the same `bountyPayout` the reviewer uses.
- **The founder's books** are Shop products made as drafts, with no price, under an admin account (`scripts/books/create-products.mjs`). A draft reads "Book: coming soon"; the founder prices and publishes each one.

## 6. Army and Work

- A campaign records the organization, an owner, the brief, a budget and currency, dates, usage rights, exclusivity terms and brand restrictions, and moves through lead, brief, scoping, shortlist, approved, production, review, delivered, reported or cancelled. Every move is logged. Fees per assignment are recorded in `campaign_assignments`.
- The v0.1 rule that nothing goes to production before scope, budget, deliverables, rights, owner and timeline are recorded is a status discipline for staff, not enforced by code.
- An opportunity shows its type, skills, location mode, compensation range and currency, deliverables, deadline and eligibility before anyone applies. Closed or past-deadline listings take no applications. Status changes are logged and audited.
- No placement fee exists on either side.
- A TV or Fund pitch's `budget_amount` is the one older money field kept in whole units, not cents. It is read with `typedCents` (`budgetOf`), so ₹ and lakh commas work. The author can edit or withdraw a pitch only while it is Submitted.

## 7. Content rewards (Win)

A reward states its brand, brief, platform, pool of points, rate per thousand verified views, cap per creator, minimum view count, the rule in words, eligibility and a window, all visible before anyone submits. If any of that changes after launch, the version goes up, the change is audited, every entrant gets an inbox note saying what changed, and the pool can never drop under what was paid. `bountyPayout` is floor(views ÷ 1000) × rate, zero below the minimum, capped per creator. YouTube numbers are read by the app; other platforms are typed by the creator and confirmed by a reviewer, with every reading kept. Verify first; then finance pays from the pool and never past what is left; the pay is audited. A rejection can be disputed. The reward's own leaderboard shows names and views, never payouts.

## 8. Store and Tools

- New gear is stocked only by staff and bought elsewhere through a partner link. The card says "Partner link. Kreators may earn a share." The tap is counted with a salted hash.
- Pre-owned gear is listed by anyone (up to 20 open listings), takes offers (one open per buyer; accepting marks it agreed and declines the rest) and a chat per buyer. Money and the handover are settled between the two people; kreators.app takes nothing and never moves the money.
- Kits are staff-made and add up live.
- A featured spot is 7 days at the top: free from staff on anything, 200 points for a seller's own live listing (ledger reason `feature`). The same spot exists for tools.

## 9. School, Club, Party

- Programs carry a price in points or cents and a currency. All five seeded programs are free: the two skill programs (migration 0016) and the three courses from the founder's books (migration 0078). They are online and self-paced in cohorts that are always open. Enrolling with points takes them first with a guarded update. Completion is a manager's decision; a certificate is issued on completion and verified at `/c/<code>`.
- Club has no fee. A reviewer decides; membership runs twelve months by default (1 to 24); the Club honor and badge follow. Benefits as written, all built: club-only events, club-only Work listings that only members see and can apply to, a named manager on staff picked by a reviewer, the honor.
- Events can cost points for a ticket, taken first with a guarded update. Cancelling a seat refunds the points that seat actually paid (`paid_points`). When a host cancels an event, each guest's row moves first and only a row that moved is refunded. A waitlist place costs nothing; when a seat opens, the first person who can pay takes it and the price is taken then, guarded; someone who cannot pay stays on the list and is told. Capacity is enforced; private events are link-only; club events need membership. One event engine serves meetups, parties, workshops, camps and days.

## 10. Trust

`trustScore` builds a 0 to 100 score only from what was earned here: xp (weight 30), points earned (20), best streak (15), time here (15), sales with rating (10), honors (10). Labels: Well trusted at 75, Trusted at 50, Getting known at 25, New here below. Computed server-side for many people in one query and shown on the public page header, product pages and every pre-owned listing. Nothing in it can be typed in.

## 11. Rights and contracts

A campaign records usage rights, exclusivity terms, brand restrictions and the assignment's accepted terms. A deliverable version carries a note and a review status. Consent and releases for people in footage, music and stock rights, and takedown procedures are not modelled; they are terms for the legal text, which the terms page says is a draft for a lawyer to finish.

## 12. Hypotheses from v0.1, not built

- A three-month paid cohort at ₹1,00,000 for 50 learners, four times a year. The fields exist on `programs` and `cohorts`; no paid program is seeded; admissions, deposits, refunds, deferrals and minimum enrolment are undecided. Nothing promises earnings or placement.
- A ₹5,000 to ₹10,000 monthly Club fee and a 1.5× rate claim. Club is free and claims nothing about rates.
- A placement fee on Work.
- Bank payouts inside the app. KYC is collected; payment happens outside.

## 13. Plans, credits and the assistant

Credits pay for a language model, and three agents spend them (`AGENTS`): typing to the assistant, "Read with AI" in the strategy session's feelings reader, and the Companion when it answers through a model. The assistant's tap flows, "Read my words" and every other app never spend credits. The Companion never shows a paywall: without a plan, with no credits, with the day's cap used, or when the model fails before it says anything, the built-in companion answers free.

- **A credit** is a tenth of a US cent of model use, worked out from the tokens with whole numbers only (`creditsFor`). Prices per million tokens are in `MODEL_PRICES` or `ASSISTANT_PRICE_IN` and `ASSISTANT_PRICE_OUT`; a model with no price is charged `FALLBACK_PRICE`, high on purpose. A free model costs nothing, so it spends no credits, but a plan is still needed to type.
- **The three plans** (`PLANS`), each for 30 days (`PLAN_DAYS`), whose credits do not carry over:

| Plan | Price | Credits a month |
| --- | --- | --- |
| Pro | ₹1,499 | 10,000 |
| Pro Max | ₹12,499 | 100,000 |
| Ultra | ₹49,999 | 400,000 |

- Plans, top-ups and the live strategy call are priced and charged in rupees (`PLAN_CURRENCY` INR, prices in paise; the founder set them on 2026-11-03, replacing the dollar prices). A credit is still counted from the model's cost in US micro-dollars, which is cost, not price. Every screen says a plan's price through `planPriceLabel` ("₹1,499 for 30 days"). The live strategy call is `LIVE_CALL_CENTS`, ₹10,000.

- **Top-ups** (`TOPUP_PACKS`) are extra credits that stay until used and are spent after the plan's: ₹899 for 8,000, ₹2,299 for 20,000, ₹4,499 for 40,000.
- **Limits per plan and agent** (`AGENT_LIMITS`), for Pro / Pro Max / Ultra:

| Agent | Tokens read per message | Credits per message | Credits per 24 hours | Steps per message |
| --- | --- | --- | --- | --- |
| Assistant | 16,000 / 64,000 / 128,000 | 60 / 250 / 600 | 1,000 / 8,000 / 30,000 | 6 / 10 / 12 |
| Feelings reader | 2,000 / 3,000 / 4,000 | 10 / 20 / 40 | 200 / 800 / 2,000 | 1 |
| Companion | 8,000 / 16,000 / 32,000 | 20 / 60 / 120 | 400 / 2,000 / 6,000 | 3 / 4 / 4 |

- The feelings reader takes only a model that keeps nothing, sends the words once and never keeps them. The ledger keeps the tokens and the model.
- **The ledger** (`apps/api/src/credits.ts`, tables `credit_accounts` and `credit_ledger`): every grant, every use with its tokens, every expiry. A message is refused with a paywall (402 `plan` or `credits`, 429 `day`), stopped before a model call that could pass what it may spend, and charged once at the end, plan credits first, never below zero.
- **Not live yet:** `PAYMENTS_LIVE` is false. Plans and top-ups are shown and picked on `/plans`, but `POST /credits/checkout` answers that nothing was charged (409, with any discount quote). The live strategy call is a note until a payment provider is live; skipping it changes nothing. Only an admin starts a plan (`POST /admin/users/:id/plan`) or adds credits (`POST /admin/users/:id/credits`, up to `MAX_CREDIT_GRANT`); both are audited.

## 14. Agency: clients, invoices and agreements

Agency (Contribution, off by default) is for a content agency or a freelance creator. It is free, and kreators.app takes nothing from what a creator invoices.

- **Billing reuses the `invoices` table** and the helpers shared with Finance, so Agency needs no Finance switch. The numbers come from one rule, `invoiceTotals`, in whole cents and basis points: the discount comes off first, GST goes on what is left (optionally shown as half CGST and half SGST), and TDS is worked on the taxable amount. A person can have the client bear the TDS (`tdsMode` `grossup`): the extra is the smallest amount that leaves exactly the taxable amount after the client's TDS comes off, to the cent and tested. It starts at taxable × rate ÷ (1 − rate) and is nudged by a cent where rounding needs it. The invoice then shows "TDS adjusted*", the total, "TDS to deduct" and "To pay after TDS", with a footnote under the total. Or the invoice only shows what the client will deduct. `total_cents` is always that answer, and the total in words is written with lakh and crore for rupees.
- **Whose details:** the sender, tax numbers, bank and UPI, the look, the prefix, days to pay, GST and TDS defaults, the signer and the packages are the person's own business profile, saved once on their account. Nothing of anyone's is written in the code or seeded.
- **Packages:** up to 8 rows of name, count and fee in paise (`MAX_PROFILE_PACKAGES`), typed once on Agency settings. They fill the Trial agreement's section 6 table and its worked example, and "From a package" adds one as an invoice line (the fee shared to the cent). A retainer offer still prices from the client's retainer amount. With no packages the client's copy has no table.
- **A sent invoice** can be changed (the client then sees it marked Revised); a paid one must be marked sent again first, so the books stay true; marking it paid books the income and taking that back removes it. A copy takes the next number in its series. Every status change is guarded on the status that was read, so two taps on Mark paid book the income once, and one income line per invoice is also held by a unique index (migration 0067). A void keeps the status it came from (migration 0075): Restore brings it back with the same number and link, guarded on `status = 'void'`, and a paid invoice books its income again once. Deleting the account keeps an invoice for the books with its totals and removes who it was for, the lines, the bank and its link.
- **Agreements** start from a built-in template (trial and pilot, monthly retainer, one-off project) or one of the person's own, filled from their profile and the client. The packages table is the person's own prices; none ship with fees. A client accepts by typing their name, which is typed acceptance and not a certified e-signature, and says so on the screen. The templates say they are a starting point and not legal advice. A signed agreement is never edited, only revised into a new draft.
- **Retainers** (Agency lifecycle): the month's fee is the client's retainer amount less the discount of the length the client chose, in whole cents with the discount rounded to the nearest cent half up (`retainerMonthlyCents`, `feeBps`); the total is the month times the months. The amount reaches the client only inside an open offer. Each month of a running retainer makes one invoice in the owner's series (a draft, or sent when auto-send is on) exactly once; marking it paid is still the owner's (`setInvoiceStatus`). No payment is taken here. The agreements' "no reply in five working days counts as approved" is not enforced by the app. A paid change is only a note to the owner.
- **Client onboarding:** a new client fills a short form at their link (legal name, address, tax numbers, contact, billing email, the trial brief). On submit the details land on their record and the Trial agreement is made once, sent at once when the business side is complete.
- **Team and team link:** the owner can ask up to 25 people into their Agency (`MAX_TEAM`), each tab Off, View or Edit. A member's answers never carry the business profile or bank, private notes, fees, the retainer amount or the client link. The client's team link (migration 0081) never shows invoices, money, agreements, other documents or the retainer, and a paid change is never asked from it.
- **Templates** are the person's own, up to `MAX_TEMPLATES` (30) of each kind. An invoice template keeps the look, sender, bank, GST and TDS and the lines but never who it was billed to.
- **Limits:** up to 60 clients (`AGENCY_MAX_CLIENTS`) and 2,000 deliverables (`AGENCY_MAX_ITEMS`); the rate limits `agency`, `portal` and `docEmail` guard the writes.
- **Business metrics** in Reviews are for people who run a business: off until switched on, typed in each period or read from Agency (pieces published, approved first time, published on time, billable hours, utilisation, invoiced, paid, new clients), up to 12 (`MAX_KPIS`).

## 15. What is free, and what costs

- **Free to use:** the daily game, every app, the leaderboard, the planning tools (Plan my week, time blocks, a project's pace, Kind of day), focus sessions and their sounds, scheduled reviews and reminders, the private calendar link, Emerging's patterns, Agency (clients, pipeline, invoice designer and calculator, agreements, templates, client links, team and team link), Discover and its add-ons, the daily brief, the School programs (all free today), the built-in Companion.
- **Costs credits, on a plan (13):** typing to the assistant, "Read with AI" in the feelings reader, and the Companion when it answers through a model. Nothing else spends credits.
- **Costs points:** a platform fee on a Shop sale (set per creator in basis points), a seller's featured spot (200 points), a ticket to a paid event, rewards and card games.
- **Costs money, through the provider:** a creator's own products, when a buyer pays by money checkout (live only with Razorpay keys), and plans, top-ups and the live strategy call once `PAYMENTS_LIVE` is switched on.
- **Taken from no one:** invoices, agreements, the client link and the calendar link; Store gear sales between people.

## 16. How points and money move safely (added 2026-11-01)

The bug sweep of 1 November 2026 closed the places where two taps at once, or a path meant for tests, could pay twice or pay nothing. The rules now:

- **Points are taken first, with a guarded update.** Redeeming a reward runs `UPDATE users SET points = points - cost ... WHERE points >= cost` and checks that one row changed; if none did, nothing is given. A balance cannot go under zero however fast the taps come.
- **The status moves first, then the money.** Cancelling a reward moves the redemption from `reserved` to `cancelled` before the points go back, so two cancels refund once. A win payout moves the submission from `verified` to `paid` before the pool is touched, and a paid submission cannot be sent in again. `refundOrder` flips the order to `refunded` first (`WHERE status != 'refunded'`), so two refunds credit the buyer once. A recurring finance entry moves its `next_date` first (`AND next_date = ?`), so it books once.
- **The test path is closed to anything free.** The test payment on the shop counts as money only when the amount is above zero, so a product priced in points alone is never free through it. A School enrolment may use the test path only when the program has a money price and no points price.
- **A product that has been sold is archived, not deleted** (`DELETE /studio/products/:id` sets `status = 'archived'`), so paid orders and the buyers' access stay.
- **A typed amount is read from its digits** (`typedCents` in shared: "1,250.50" is 125050, "1.005" is 101, anything else is NaN), never through `Math.round(Number(x) * 100)`. It is used for the money fields in Agency invoices and agreements, the Store forms and business metrics. The older `centsFrom`, used for the assistant and credits, refuses more than two decimals.
- **Finance "run now" touches the person's own rows only** (`runRecurring(db, onlyUser)`); the cron runs it for everyone.
- **Added since (2026-11-02 to 2026-11-04):** the Store, School and Party points paths debit with a guarded `UPDATE ... WHERE points >= ?` first and check the change. A Party cancel refunds only what each seat paid, and a waitlist promotion takes the price with the same guard. A creator coupon's use is taken after the points and given back if the checkout fails. Settling a due moves it from `open` first (409 if it already moved) and books it on the person's own day. A void invoice or agreement is restored once, guarded on `status = 'void'`. Migration 0067 adds unique indexes for one paid question per order and one income line per invoice.

## 17. Plans, withdrawal, marketing mail and records (added 2026-11-01, later)

The legal pass wrote down, in words and in code, rules that were already how the app behaved. No price, fee, xp or points amount changed: the plans in 13, the 5 percent shop fee and every table above are as they were.

- **A plan does not renew by itself.** A plan lasts `PLAN_DAYS` (30) days and ends. Nothing more is charged unless the person picks a plan again, the plan's credits end with it, and top-up credits stay until used. The terms, `/pricing` and `/refunds` all say so, and no job renews a plan, so there is nothing to cancel. The price shown is the price charged, and any tax is shown before the person pays.
- **The right to change your mind.** The refunds page (`/refunds`) tells people in the EU or the UK that they can withdraw from a distance purchase within 14 days without a reason (for goods from the day they arrive, for everything else from the day they buy). The one exception is digital content and services: the right ends once supply starts, if the person gave clear consent to start at once and acknowledged that they lose the right; if they ask for a service to start inside the 14 days and then withdraw, they pay for the part used. A refund goes out without delay and within 14 days of learning of the withdrawal, by the way it was paid; a refund in points is instant. Until a withdrawal form exists, Help and `/contact` are the way to withdraw, and the page says that.
- **Not built yet, before payments go live:** a consent box and acknowledgement at the checkout itself. Today the wording is on the page only, and plans and top-ups cannot be paid for (`PAYMENTS_LIVE` is false), so nothing depends on it. It must be built before the switch.
- **Marketing mail needs a recorded yes.** The third privacy choice (`CONSENT_PURPOSES` key `marketing`) starts off. `sendEmail({ marketing: true })` in `ops.ts` sends only to a person with a stored yes and only when the business address is set (the mail's footer carries it); every such mail carries an unsubscribe link and the `List-Unsubscribe` headers, and the public `/unsubscribe/:token` page (and `POST /api/public/unsubscribe/:token`, limit `unsubscribe`) turns the choice off and logs it. Receipts and password resets are never marketing and are not affected by the choice.
- **Records kept for the books.** Orders, invoices and money records are kept seven years, with the person's name taken off when they delete the account (`RETENTION` in shared, which the privacy page, the cron and these docs all read). Nothing deletes an order sooner. The raw text of a payment message is cleared after a year and the order stays; the email outbox is cleared after 90 days (`RETENTION_DAYS`, `tidyOld` in `cron.ts`).
- **Typed money.** An amount a person types is read from its digits with `typedCents` (see 16), never through a float.
- **The business behind the pages** (name, address, tax numbers, the Grievance Officer for India, copyright agent) comes from Worker variables the owner sets (`BUSINESS_*`, `DMCA_*`, `PUBLIC_URL`; see 09 §6) and is read from `GET /public/business`. An empty field is shown as "not set yet", so the pages and notices never carry a made-up company. A reply time is never stated unless the business sets one.
- **India first (2026-11-03):** prices are in rupees, and GST is added where it applies and shown before paying. The refunds page leads with UPI, card or bank through Razorpay; the privacy page leads with the DPDP Act 2023, and the EU and UK rules sit below it.
- **The terms as of 5 November 2026** (`LEGAL_VERSION` 2026-11-05, so every account sees the one-time terms notice again): two new sections, "Wellbeing, not medical care" and "Money tools, not advice". The second says Finance, Agency's tax sums and the money in reviews are not financial, tax or investment advice. Under Acceptable use, posts and chat lines are their writers' views, and nothing may be posted to put down a religion, a community, a company or a person. No price, fee, xp or points amount changed.

## 18. Discount codes (added 2026-11-05, built 2026-11-02)

Only the team makes discount codes, under Admin, Discount codes (`/admin/discounts`, migration 0061). It needs the finance permission, and every change is audited (`discount.create`, `discount.update`, `discount.off`). A code's word, kind and worth never change; a new deal is a new code.

- **Where a code works** (`DISCOUNT_AREAS`): a Shop product (points or money), a School program (points), a Party ticket (points), a plan and a top-up. A code can be held to one item and to a smallest price.
- **Where it does not:** the pre-owned feature fee, Club, Work, Win, Army, Rewards, Store partner links and Agency invoices (which have their own discount line).
- **The sum:** a percent takes off the price times the basis points over 10,000, rounded down (`percentOff`). A fixed amount is money only and never more than the price. Nothing goes below zero, and all of it is whole numbers.
- **The price comes from the server.** It is always worked out from the item's own price (`listPriceFor`, `quoteCode`), never from the request. `POST /discounts/check` only quotes and uses nothing. Checks are limited to 20 in ten minutes per person (`discount`) and 60 per address (`discountAddress`).
- **Limits on a code:** a total number of uses, a number per person (up to 100) and dates, the start inclusive and the end exclusive. `discountProblem` gives the one reason in plain words.
- **The platform pays.** The buyer is charged less, and the seller is credited and refunded on the list price. On a points sale the platform adds the difference to the seller; the order keeps `list_points` and `discount_points`. On a money order `cents` is what was charged and what the webhook checks; `list_cents` and `discount_cents` keep the rest. A 100% code makes a free order that is paid at once with no provider call.
- **Taking and giving back a use:** the use is taken with two guarded statements before any points move, so the last use cannot be taken twice (`redeem`). It is given back when a payment fails, expires or never starts (`release`; the cron runs `releaseDeadOrders`). A refund or a cancelled ticket does not give it back; a cancelled ticket returns the points actually paid.
- **One code at a time:** a creator's own coupon and a team code are never used together.
- **Plans and top-ups** are priced and checked at `POST /credits/checkout`, but no use is taken while `PAYMENTS_LIVE` is off.
- Redemptions are in the person's export and go with the account.

## Known gaps

- Rights and consent beyond the campaign fields are legal text, not product.
- No reconciliation of provider settlements against orders exists beyond the webhook log and replay.
- Plans and top-ups cannot be paid for yet (`PAYMENTS_LIVE` is false), and the checkout has no consent box for the digital-content exception to the 14-day right (17).
- Whether a client's own tax rules (GST place of supply, TDS sections) are right for a given invoice is the creator's call; the calculator only does the arithmetic.
- The money-records retention is seven years, worded as what the law asks where the business is registered. The Indian period (possibly eight years from the end of the financial year) waits for the founder.
- Found in the 2026-11-01 sweep and still open on 5 November 2026; each awaits a decision:
  - An invoice's status can move between any two states, so draft to paid books income without a sent step. Each move is now guarded, so it books once.
  - The Club badge count in `getStats` counts `accepted`, `member` and `active`, but reviewers set `approved`.
  - A KPI target of 0 means "no target" (`kpiStatus` answers `none`).
- Closed since 1 November: the Party refund and waitlist charge, the guarded points debit in the Store, School and Party, and the coupon spent before a failed checkout (see 16).

## What changed since this was written (2026-11-05)

Since 26 October 2026: plans, credits and top-ups for the assistant (13); the rewards catalog grew from four items to 41 on nine shelves, with nine card games that unlock for good; unlocks gained an xp floor; the monthly leaderboard's top three win an honor; Agency arrived with its invoice calculator (GST, TDS, total in words), templates, agreements and client links (14); business metrics in Reviews; planning and focus tools that pay nothing (Plan my week, time blocks, pace, focus quality); a product page can carry questions and answers and a reward page a live earnings calculator (from `docs/whop-study.md`); and Pro became a plan instead of a flag. Section 15 lists what is free and what costs.

**2026-11-01 (bug sweep):** section 16 is new. Points and money now move with a guard first (a guarded points update on redeem, the status moved before the refund, payout and cancel), the test payment path is closed for points-only products and points-priced programs, a sold product is archived instead of deleted, typed amounts are read as `typedCents`, and Finance's run-now touches only the person's own rows. The money-related items the sweep reported but did not change are under Known gaps.

**2026-11-01 (later, legal and privacy pass):** section 17 is new and records rules the policy pages now state: plans do not renew by themselves; the EU and UK 14-day right to withdraw, with the digital-content exception (the checkout consent box for it is not built, as nothing is chargeable yet); marketing email needs a recorded yes, with unsubscribe; orders, invoices and money records are kept seven years with the name removed on delete; typed amounts go through `typedCents`; and the business details come from Worker variables. No price, plan, fee, xp or points number changed.

**2026-11-02 (discount codes):** now written up as section 18. The entry as it was: the team can make codes that take a percent or a fixed amount off a Shop product, a School program, a Party ticket, a plan or a top-up (`discount_codes`, migration 0061). Rules: **the platform pays**. The buyer is charged less and the seller is credited on the list price (on a points sale the difference is points the platform adds; `orders.list_points` and `discount_points` keep it, and `refundOrder` gives the buyer what they paid and takes the list price back from the seller). On a money order `cents` is what was charged and is what the webhook checks; `list_cents` and `discount_cents` keep the rest for settlement. A 100% code makes a free order that is paid at once without the provider. A percent takes `floor(price x bps / 10000)` off, a fixed amount is money only and never more than the price, nothing is below zero, all in whole numbers. Codes have a smallest price, a total number of uses, a number per person and dates (start inclusive, end exclusive); the price is always worked out on the server from the item. The use is taken with two guarded statements before any points move (so the last use cannot be taken twice) and is given back when a payment fails, expires or never starts; a refund or a cancelled ticket does not give it back, and a cancelled ticket returns the points actually paid (`event_registrations.paid_points`). Not covered, on purpose: the pre-owned feature fee (a points fee to the platform), Club, Work, Win, Army, Rewards, Store partner links and Agency invoices. A creator's own coupon and a team code are never used together. Plans and top-ups are priced and checked at `POST /credits/checkout`, but nothing is used up while `PAYMENTS_LIVE` is off. This also closes two of the known problems above: the Store, School and Party points paths now debit with a guarded `UPDATE ... WHERE points >= ?` first and check the change.

**2026-11-05 (this reconciliation, covering 2 to 5 November):** no price, fee, xp or points amount changed. Section 18 holds the discount-code rules. Updated: the source-of-truth list for the shared model split into domain files; badges are 59 stored medals that pay nothing, and a super admin can give xp and badges by hand (3); runs pay the host's xp and attendee codes pay up to 50 xp (4); `productPayWays`, creator refunds, the guarded coupon and the founder's book products (5); pitch budgets in whole units (6); the five free School programs and the Party refund rules (9); the Companion and the feelings reader as agents that spend credits, with their limits (13); Agency's TDS gross-up to the cent, packages, void and restore, client onboarding, team and team link (14); what is free and what costs (15); the guards added since (16); India first, "not set yet" and the terms of 5 November (17). The Known gaps lose the three items that are fixed.
