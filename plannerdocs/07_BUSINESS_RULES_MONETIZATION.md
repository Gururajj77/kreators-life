# 07 — Business rules and monetization

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** the constants in `packages/shared/src/index.ts` (`XP`, `POINTS`, `WAIT`, `REWARDS`, `SOCIAL_REWARDS`, `RUN_REWARD`, `FEATURE_FEE_POINTS`, `AFFILIATE_SHARE`, `trustScore`, `bountyPayout`, `unlockFor`, `earningGuide`), `apps/api/src/payments.ts`, `apps/api/src/rewards.ts`, the policy pages at `/terms`, `/privacy`, `/refunds`, `/pricing`.

## 1. Purpose

Every number that pays, charges or gates, as the app applies it today. The v0.1 hypotheses that were never built are kept at the end, marked as hypotheses.

## 2. Points and money: the line between them

Points are the only unit that moves inside the app. The terms page says it plainly: points are earned by showing up and can be spent inside kreators.app; they are not money, cannot be cashed out and have no value outside the app. Xp is never spent. There is no stored-value balance, no transfer between people, and no "Kreators Cash" (decision of 24 October 2026).

Money exists in two places only: a creator's own Shop (a buyer pays a creator through the payment provider; kreators.app takes a platform fee in points) and a creator's own Finance tracker (a private ledger of their business). kreators.app never holds goods or money for the Store.

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
| Honors | | Given by the team (Pro, Founding member, Community star, Team player) or unlocked by time here (7, 30, 90, 365 days). |
| Rewards | cost points | Sticker pack 600, meetup ticket 1500, kreators.app tee 2500, a forty-minute mentor call 4000. A redemption is a reservation until it ships; cancelling returns the points. |

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
- **Pro** is a flag an admin sets plus the Pro honor; it is not billed inside the app.
- **Unlocks:** a product, a store item or a tool can ask for a points balance, a badge, or both. `unlockFor` is the one rule and the one wording ("Needs 500 points, you have 120 and the Full week badge."). A gated checkout is a 403; a locked item's link is blanked.

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

## Known gaps

- Rights and consent beyond the campaign fields are legal text, not product.
- No reconciliation of provider settlements against orders exists beyond the webhook log and replay.
