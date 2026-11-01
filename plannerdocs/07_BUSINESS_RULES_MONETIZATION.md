# 07 — Business rules and monetization

**Last updated:** 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026, after that day's bug sweep and its legal, security and performance pass (0.3 was 26 October 2026)
**Source of truth:** the constants in `packages/shared/src/index.ts` (`XP`, `POINTS`, `WAIT`, `REWARDS`, `REWARD_GROUPS`, `CARD_GAMES`, `SOCIAL_REWARDS`, `RUN_REWARD`, `FEATURE_FEE_POINTS`, `AFFILIATE_SHARE`, `PLANS`, `TOPUP_PACKS`, `AGENT_LIMITS`, `PAYMENTS_LIVE`, `trustScore`, `bountyPayout`, `unlockFor`, `earningGuide`, `invoiceTotals`), `apps/api/src/payments.ts`, `rewards.ts`, `credits.ts`, `routes/finance.ts`, `routes/agencyDocs.ts`, the policy pages at `/terms`, `/privacy`, `/refunds`, `/pricing`, `/contact`, `/subprocessors` (`apps/web/src/site/Policy.tsx`), `RETENTION` and `CONSENT_PURPOSES` in shared, and `docs/DECISIONS.md`.

## 1. Purpose

Every number that pays, charges or gates, as the app applies it today. The v0.1 hypotheses that were never built are kept at the end, marked as hypotheses.

## 2. Points and money: the line between them

Points are the only unit that moves inside the app. The terms page says it plainly: points are earned by showing up and can be spent inside kreators.app; they are not money, cannot be cashed out and have no value outside the app. Xp is never spent. There is no stored-value balance, no transfer between people, and no "Kreators Cash" (decision of 24 October 2026).

Money exists in three places only:

- A creator's own **Shop**: a buyer pays a creator through the payment provider; kreators.app takes a platform fee in points.
- A creator's own **Finance** tracker: a private ledger of their business.
- A creator's own **invoices** (Agency, and the older invoice API under Finance): a document and a status. The money moves between the creator and their client, outside the app. kreators.app takes nothing from an invoice and never moves the money; marking one paid books it as income in the creator's own ledger, and taking that back removes it.

kreators.app never holds goods or money for the Store. Paying for a plan or a top-up (13) is the one place the app itself would charge, and nothing is charged until payments are switched on.

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
| Badges | a badge on your page | Computed from counts, never stored: First tick, Three in a row, Full week, All seven, Ripple maker (ten tasks), Project cleared, Level five, Good hands (five small acts), Club member, First run, Ten runs, Hundred k. |
| Honors | | Given by the team (Pro, Founding member, Community star, Team player), unlocked by time here (7, 30, 90, 365 days), or won: the monthly leaderboard's top three get `season_top` when the cron closes the month. |
| Planning and tags | pays nothing | A priority (P0 to P3), Remember, Bring it to my review, subtasks, Plan my week and its plan strength, time blocks, a project's pace, a focus-quality rating, water and a scheduled review never change what a tick pays. |
| Rewards | cost points | 41 items on nine shelves (books, card games, apparel, tech, drinkware, stationery, lifestyle, novelty, experiences), every cost whole points, from 400 (stickers, a lip balm) to 4,500 (the hoodie). The three books are the founder's own, 2,000 each; the merch brand is "Kreators" (the Kreators tee is 2,500); a meetup ticket is 1,500 and a one-to-one call 4,000. Gear is a reservation until a drop ships; cancelling returns the points. Rewards are not an app. |
| A card game | 1,000 to 2,000 points, and an xp floor | Nine games (`CARD_GAMES`), each a reward of kind `unlock`: redeeming one opens it at once and for good (`card_unlocks`, kept through an erase, never cancelled) and switches Games on. The xp floors are 0, 100, 250 or 500, and a super admin is never locked out. |

Everything that pays has a wait or a reviewer. An undo takes the xp back.

## 4. With people

| What | Pays | Cap |
| --- | --- | --- |
| A post | 5 xp | 3 a day |
| A reply | 2 xp | 5 a day |
| A like you give | 1 xp | 10 a day |
| A like on your post | 1 point to the author | 20 a day, once per person per post |
| A new follower | 2 points | 20 a day, once per person |
| A run with a club | 20 xp, 10 points | 2 paid runs a day, once per run, only with the start code inside the window; a void reverses it |

Each pays once per thing (`source_id` or `ref`), so unliking and liking again never pays twice. No self-reported run ever pays.

## 5. Making and selling

- **Products** are priced in points, in cents, or pay what you want. A buyer pays points instantly; the seller receives the points minus the platform fee. A money order is created at the provider, the buyer pays in the provider's checkout, and the order becomes `paid` only in the webhook after the signature checks out; an order nobody pays within half an hour is closed by the cron.
- **Platform fee:** per creator, in basis points (`users.fee_bps`), applied with `feeBps` (integer maths, rounded). Recorded on the order as `platform_fee_points`.
- **Affiliates:** 20 percent of a sale brought in by an affiliate link (`AFFILIATE_SHARE`).
- **Coupons:** a percentage off, optionally one product, with a use cap and an expiry; unique per owner.
- **Refunds:** by an admin from the order's timeline, with a reason, audited and tracked (`refund_issued`). The refunds page says how money and points move back.
- **Memberships** carry a period in months; entitlement checks the order's expiry; buying again renews.
- **Sessions:** availability in the creator's zone with overrides, a buffer, minimum notice and a horizon; one booking per slot by a unique index; a buyer can move a booking up to two hours before.
- **Payout details:** legal name, PAN (hash and last four), bank (last four), IFSC and address, submitted from Customers and reviewed under Admin, KYC. Bank payouts themselves happen outside the app.
- **Pro** is a paid plan (13): a plan starts the Pro mark (`is_pro` and the `pro` honor follow it), and ending the plan ends the mark. Until payments are live only an admin starts one.
- **Unlocks:** a product, a store item, a tool or a game can ask for a points balance, an xp floor, a badge, or any mix (`min_points`, `min_xp`, `badge`). `unlockFor` is the one rule and the one wording ("Needs 500 points, you have 120 and the Full week badge."). A gated checkout is a 403; a locked item's link is blanked; a super admin is never locked out. A creator can add up to six questions and answers to a product's page (`MAX_FAQ`), and a reward page shows a live "What could I earn?" worked out by the same `bountyPayout` the reviewer uses.

## 6. Army and Work

- A campaign records the organization, an owner, the brief, a budget and currency, dates, usage rights, exclusivity terms and brand restrictions, and moves through lead, brief, scoping, shortlist, approved, production, review, delivered, reported or cancelled. Every move is logged. Fees per assignment are recorded in `campaign_assignments`.
- The v0.1 rule that nothing goes to production before scope, budget, deliverables, rights, owner and timeline are recorded is a status discipline for staff, not enforced by code.
- An opportunity shows its type, skills, location mode, compensation range and currency, deliverables, deadline and eligibility before anyone applies. Closed or past-deadline listings take no applications. Status changes are logged and audited.
- No placement fee exists on either side.

## 7. Content rewards (Win)

A reward states its brand, brief, platform, pool of points, rate per thousand verified views, cap per creator, minimum view count, the rule in words, eligibility and a window, all visible before anyone submits. If any of that changes after launch, the version goes up, the change is audited, every entrant gets an inbox note saying what changed, and the pool can never drop under what was paid. `bountyPayout` is floor(views ÷ 1000) × rate, zero below the minimum, capped per creator. YouTube numbers are read by the app; other platforms are typed by the creator and confirmed by a reviewer, with every reading kept. Verify first; then finance pays from the pool and never past what is left; the pay is audited. A rejection can be disputed. The reward's own leaderboard shows names and views, never payouts.

## 8. Store and Tools

- New gear is stocked only by staff and bought elsewhere through a partner link. The card says "Partner link. Kreators may earn a share." The tap is counted with a salted hash.
- Pre-owned gear is listed by anyone (up to 20 open listings), takes offers (one open per buyer; accepting marks it agreed and declines the rest) and a chat per buyer. Money and the handover are settled between the two people; kreators.app takes nothing and never moves the money.
- Kits are staff-made and add up live.
- A featured spot is 7 days at the top: free from staff on anything, 200 points for a seller's own live listing (ledger reason `feature`). The same spot exists for tools.

## 9. School, Club, Party

- Programs carry a price in points or cents and a currency; both seeded programs are free, online and self-paced in cohorts that are always open. Completion is a manager's decision; a certificate is issued on completion and verified at `/c/<code>`.
- Club has no fee. A reviewer decides; membership runs twelve months by default (1 to 24); the Club honor and badge follow. Benefits as written, all built: club-only events, club-only Work listings that only members see and can apply to, a named manager on staff picked by a reviewer, the honor.
- Events can cost points for a ticket; cancelling a seat refunds the points; capacity and the waitlist are enforced; private events are link-only; club events need membership. One event engine serves meetups, parties, workshops, camps and days.

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

Typing to the assistant is the one paid thing in the app. It costs credits because a language model costs money; the assistant's tap flows, and every other app, never spend credits.

- **A credit** is a tenth of a US cent of model use, worked out from the tokens with whole numbers only (`creditsFor`). Prices per million tokens are in `MODEL_PRICES` or `ASSISTANT_PRICE_IN` and `ASSISTANT_PRICE_OUT`; a model with no price is charged `FALLBACK_PRICE`, high on purpose. A free model costs nothing, so it spends no credits, but a plan is still needed to type.
- **The three plans** (`PLANS`), each for 30 days (`PLAN_DAYS`), whose credits do not carry over:

| Plan | Price | Credits a month |
| --- | --- | --- |
| Pro | US$15 | 10,000 |
| Pro Max | US$125 | 100,000 |
| Ultra | US$500 | 400,000 |

- **Top-ups** (`TOPUP_PACKS`) are extra credits that stay until used and are spent after the plan's: US$10 for 8,000, US$25 for 20,000, US$50 for 40,000.
- **Limits per plan** (`AGENT_LIMITS`, for the assistant): tokens read per message 16,000 / 64,000 / 128,000; credits per message 60 / 250 / 600; credits per 24 hours 1,000 / 8,000 / 30,000; steps per message 6 / 10 / 12.
- **The ledger** (`apps/api/src/credits.ts`, tables `credit_accounts` and `credit_ledger`): every grant, every use with its tokens, every expiry. A message is refused with a paywall (402 `plan` or `credits`, 429 `day`), stopped before a model call that could pass what it may spend, and charged once at the end, plan credits first, never below zero.
- **Not live yet:** `PAYMENTS_LIVE` is false. Plans and top-ups are shown and picked on `/plans`, but `POST /credits/checkout` answers that nothing was charged. Only an admin starts a plan (`POST /admin/users/:id/plan`) or adds credits (`POST /admin/users/:id/credits`, up to `MAX_CREDIT_GRANT`); both are audited.

## 14. Agency: clients, invoices and agreements

Agency (Contribution, off by default) is for a content agency or a freelance creator. It is free, and kreators.app takes nothing from what a creator invoices.

- **Billing reuses the `invoices` table** and the helpers shared with Finance, so Agency needs no Finance switch. The numbers come from one rule, `invoiceTotals`, in whole cents and basis points: the discount comes off first, GST goes on what is left (optionally shown as half CGST and half SGST), and TDS is worked on the taxable amount. A person can add the TDS to the total (the extra is taxable × rate ÷ (1 − rate), so that after the client deducts the rate the creator keeps the taxable amount), or only show what the client will deduct. `total_cents` is always that answer, and the total in words is written with lakh and crore for rupees.
- **Whose details:** the sender, tax numbers, bank and UPI, the look, the prefix, days to pay, GST and TDS defaults, and the signer are the person's own business profile, saved once on their account. Nothing of anyone's is written in the code or seeded.
- **A sent invoice** can be changed (the client then sees it marked Revised); a paid one must be marked sent again first, so the books stay true; marking it paid books the income and taking that back removes it. A copy takes the next number in its series. Deleting the account keeps an invoice for the books with its totals and removes who it was for, the lines, the bank and its link.
- **Agreements** start from a built-in template (trial and pilot, monthly retainer, one-off project) or one of the person's own, filled from their profile and the client. The packages table is the person's own prices; none ship with fees. A client accepts by typing their name, which is typed acceptance and not a certified e-signature, and says so on the screen. The templates say they are a starting point and not legal advice. A signed agreement is never edited, only revised into a new draft.
- **Templates** are the person's own, up to `MAX_TEMPLATES` of each kind. An invoice template keeps the look, sender, bank, GST and TDS and the lines but never who it was billed to.
- **Limits:** up to 60 clients (`AGENCY_MAX_CLIENTS`) and 2,000 deliverables; the rate limits `agency` and `portal` guard the writes.
- **Business metrics** in Reviews are for people who run a business: off until switched on, typed in each period or read from Agency (pieces published, approved first time, published on time, billable hours, utilisation, invoiced, paid, new clients), up to 12 (`MAX_KPIS`).

## 15. What is free, and what costs

- **Free to use:** the daily game, every app, the leaderboard, the planning tools (Plan my week, time blocks, a project's pace), focus sessions and their sounds, scheduled reviews and reminders, the private calendar link, Agency (clients, pipeline, invoice designer and calculator, agreements, templates, client links), Discover and its add-ons, the daily brief, the Companion.
- **Costs credits:** typing to the assistant, on a plan (13). Nothing else spends credits.
- **Costs points:** a platform fee on a Shop sale (set per creator in basis points), a seller's featured spot (200 points), a ticket to a paid event, rewards and card games.
- **Costs money, through the provider:** a creator's own products, when a buyer pays by money checkout (live only with Razorpay keys), and plans and top-ups once `PAYMENTS_LIVE` is switched on.
- **Taken from no one:** invoices, agreements, the client link and the calendar link; Store gear sales between people.

## 16. How points and money move safely (added 2026-11-01)

The bug sweep of 1 November 2026 closed the places where two taps at once, or a path meant for tests, could pay twice or pay nothing. The rules now:

- **Points are taken first, with a guarded update.** Redeeming a reward runs `UPDATE users SET points = points - cost ... WHERE points >= cost` and checks that one row changed; if none did, nothing is given. A balance cannot go under zero however fast the taps come.
- **The status moves first, then the money.** Cancelling a reward moves the redemption from `reserved` to `cancelled` before the points go back, so two cancels refund once. A win payout moves the submission from `verified` to `paid` before the pool is touched, and a paid submission cannot be sent in again. `refundOrder` flips the order to `refunded` first (`WHERE status != 'refunded'`), so two refunds credit the buyer once. A recurring finance entry moves its `next_date` first (`AND next_date = ?`), so it books once.
- **The test path is closed to anything free.** The test payment on the shop counts as money only when the amount is above zero, so a product priced in points alone is never free through it. A School enrolment may use the test path only when the program has a money price and no points price.
- **A product that has been sold is archived, not deleted** (`DELETE /studio/products/:id` sets `status = 'archived'`), so paid orders and the buyers' access stay.
- **A typed amount is read from its digits** (`typedCents` in shared: "1,250.50" is 125050, "1.005" is 101, anything else is NaN), never through `Math.round(Number(x) * 100)`. It is used for the money fields in Agency invoices and agreements, the Store forms and business metrics. The older `centsFrom`, used for the assistant and credits, refuses more than two decimals.
- **Finance "run now" touches the person's own rows only** (`runRecurring(db, onlyUser)`); the cron runs it for everyone.

## 17. Plans, withdrawal, marketing mail and records (added 2026-11-01, later)

The legal pass wrote down, in words and in code, rules that were already how the app behaved. No price, fee, xp or points amount changed: the plans in 13, the 5 percent shop fee and every table above are as they were.

- **A plan does not renew by itself.** A plan lasts `PLAN_DAYS` (30) days and ends. Nothing more is charged unless the person picks a plan again, the plan's credits end with it, and top-up credits stay until used. The terms, `/pricing` and `/refunds` all say so, and no job renews a plan, so there is nothing to cancel. The price shown is the price charged, and any tax is shown before the person pays.
- **The right to change your mind.** The refunds page (`/refunds`) tells people in the EU or the UK that they can withdraw from a distance purchase within 14 days without a reason (for goods from the day they arrive, for everything else from the day they buy). The one exception is digital content and services: the right ends once supply starts, if the person gave clear consent to start at once and acknowledged that they lose the right; if they ask for a service to start inside the 14 days and then withdraw, they pay for the part used. A refund goes out without delay and within 14 days of learning of the withdrawal, by the way it was paid; a refund in points is instant. Until a withdrawal form exists, Help and `/contact` are the way to withdraw, and the page says that.
- **Not built yet, before payments go live:** a consent box and acknowledgement at the checkout itself. Today the wording is on the page only, and plans and top-ups cannot be paid for (`PAYMENTS_LIVE` is false), so nothing depends on it. It must be built before the switch.
- **Marketing mail needs a recorded yes.** The third privacy choice (`CONSENT_PURPOSES` key `marketing`) starts off. `sendEmail({ marketing: true })` in `ops.ts` sends only to a person with a stored yes and only when the business address is set (the mail's footer carries it); every such mail carries an unsubscribe link and the `List-Unsubscribe` headers, and the public `/unsubscribe/:token` page (and `POST /api/public/unsubscribe/:token`, limit `unsubscribe`) turns the choice off and logs it. Receipts and password resets are never marketing and are not affected by the choice.
- **Records kept for the books.** Orders, invoices and money records are kept seven years, with the person's name taken off when they delete the account (`RETENTION` in shared, which the privacy page, the cron and these docs all read). Nothing deletes an order sooner. The raw text of a payment message is cleared after a year and the order stays; the email outbox is cleared after 90 days (`RETENTION_DAYS`, `tidyOld` in `cron.ts`).
- **Typed money.** An amount a person types is read from its digits with `typedCents` (see 16), never through a float.
- **The business behind the pages** (name, address, tax numbers, copyright agent) comes from Worker variables the owner sets (`BUSINESS_*`, `DMCA_*`, `PUBLIC_URL`; see 09 §6). Until they are set the pages say "Being set up", so the invoices and notices never carry a made-up company.

## Known gaps

- Rights and consent beyond the campaign fields are legal text, not product.
- No reconciliation of provider settlements against orders exists beyond the webhook log and replay.
- Plans and top-ups cannot be paid for yet (`PAYMENTS_LIVE` is false), and the checkout has no consent box for the digital-content exception to the 14-day right (17).
- Whether a client's own tax rules (GST place of supply, TDS sections) are right for a given invoice is the creator's call; the calculator only does the arithmetic.
- Found in the 2026-11-01 sweep and reported, not changed; each awaits a decision:
  - Party: when a host cancels an event the message says points are refunded, but nothing is refunded; a waitlist promotion never charges the points the ticket costs.
  - Store checkout can create more than one order from one debit when two requests run together; School and Party enrolment take points without a `points >= ?` guard; a coupon's use is spent before a checkout that then fails.
  - An invoice's status can move between any two states, so draft to paid books income without a sent step.
  - The Club badge count in `getStats` counts `accepted`, `member` and `active`, but reviewers set `approved`.
  - A KPI target of 0 means "no target".

## What changed since this was written (2026-11-01)

Since 26 October 2026: plans, credits and top-ups for the assistant (13); the rewards catalog grew from four items to 41 on nine shelves, with nine card games that unlock for good; unlocks gained an xp floor; the monthly leaderboard's top three win an honor; Agency arrived with its invoice calculator (GST, TDS, total in words), templates, agreements and client links (14); business metrics in Reviews; planning and focus tools that pay nothing (Plan my week, time blocks, pace, focus quality); a product page can carry questions and answers and a reward page a live earnings calculator (from `docs/whop-study.md`); and Pro became a plan instead of a flag. Section 15 lists what is free and what costs.

**2026-11-01 (bug sweep):** section 16 is new. Points and money now move with a guard first (a guarded points update on redeem, the status moved before the refund, payout and cancel), the test payment path is closed for points-only products and points-priced programs, a sold product is archived instead of deleted, typed amounts are read as `typedCents`, and Finance's run-now touches only the person's own rows. The money-related items the sweep reported but did not change are under Known gaps.

**2026-11-01 (later, legal and privacy pass):** section 17 is new and records rules the policy pages now state: plans do not renew by themselves; the EU and UK 14-day right to withdraw, with the digital-content exception (the checkout consent box for it is not built, as nothing is chargeable yet); marketing email needs a recorded yes, with unsubscribe; orders, invoices and money records are kept seven years with the name removed on delete; typed amounts go through `typedCents`; and the business details come from Worker variables. No price, plan, fee, xp or points number changed.
