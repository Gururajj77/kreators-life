# Whop study (2026-11-01)

What whop.com does well, what we took, and what we left. Whop is a marketplace where a creator builds a "whop" (a storefront with apps such as chat, courses and content rewards) and sells access to it.

## How this was gathered, and how far to trust it

Web searches and a read of Whop's own pages. Two of Whop's docs pages (`docs.whop.com/manage-your-business/growth-marketing/content-rewards` and `docs.whop.com/apps`) returned empty content, so the Content Rewards detail comes from `docs.whop.com/memberships-and-access/third-party-apps/content-rewards` and the structure and UX notes from Whop's own blog posts (the 4.0 announcement of November 2024 and a 2023 post on the dashboard, which says itself that it is out of date). Fee and payout-hold figures that appear on third-party blogs disagree with each other (9 percent against 10 percent, and a ten-day hold), so none of them is used here. Nothing in this note was tested against the live product.

## What Whop does

- **Content Rewards.** A brand sets a name (with the rate in it), a type (clipping existing video, or original content), a budget, a rate per 1,000 views, a minimum payout a video must reach before it is reviewed, a maximum payout per video, an optional flat bonus per approved post, the platforms allowed, and the requirements. A campaign waits as "Pending budget" until it is funded, then goes "Active". The brand approves or rejects each submission, and only approved posts are paid.
- **Storefront order.** A store page runs: a media gallery, a headline stating the outcome, "what you will get" (each part with a line), "about me" tied to the creator's profile, benefits, then FAQs, with reviews and social links as trust signals. FAQs are written to help search.
- **One dashboard.** Version 4 merged the hub and the creator dashboard into one page, with apps as pills along the top instead of a sidebar list. Mobile gets a Discover tab and a home feed limited to the places you joined.
- **Quick actions.** A creator's home lists new signups, referrals and cancellations to act on, with keyword search over cancellation feedback.
- **Onboarding.** About five questions (business model, industry, use, country, name), then the first offer, then a page; templates ("blueprints") are the fast path.

## What we already do

| Whop | Here |
| --- | --- |
| Minimum payout before review | `minViews` on a reward: nothing is paid under it |
| Maximum payout per video | `maxPayoutPoints` |
| Approve or reject each entry | A reviewer confirms, then finance pays from the pool |
| Reviews on the page | Ratings and testimonials on every product page |
| Creator bio tied to a profile | Trust badge and the creator's public page |
| Home limited to what you joined, recent first | Apps and shortcuts ordered by what is on, what fits, then what you open most |
| Short onboarding with templates | The setup chat, then the strategy session |

## What we took

1. **A live "what could I earn?" on every reward page** (`EarnCalc` in `screens/Win.tsx`). Type a view count and see the payout, where it starts, and where it stops growing, using the same `bountyPayout` the reviewer uses. Whop's docs explain the minimum and the cap with worked examples; a person should not need to do the sum.
2. **Creator-written questions and answers on a product page** (`faq_json`, migration 0052, up to six, `parseFaq`, edited in the product editor, shown as a fold-out list at the foot of the page). Whop puts FAQs last on the page, to answer the doubts that stop a sale.
3. **Observability counts the Discover add-ons** (not from Whop; done in the same pass).

## What we left, and why

- **A flat bonus per approved post, and a campaign type (clipping or original).** Both change how payouts are worked out. Payout rules sit under finance review and the pool can never drop below what was paid, so they need their own design, not a quick add.
- **A funding step ("pending budget" until funded).** We pay from points pools set when a reward is made; money funding waits for a live payment provider.
- **A welcome message after checkout.** Good idea, but a purchase can finish in four places (points, money order webhook, free claim, booking), and each needs the same note. Worth doing once the purchase paths share one function.
- **Apps as pills along the top.** A different navigation model from the one we just made consistent (sidebar groups on a laptop, a menu on a phone). Not worth the churn.
- **An annual price with a discount.** Needs subscriptions, and instalments and recurring billing are not built (see DECISIONS).
- **Cancellation feedback search.** We have no cancellations to search.
- **An affiliate marketplace.** Whop pays affiliates 30 percent by default. We have partner links and no affiliate payouts, and payouts need a reviewer and a wait before they could be added.
