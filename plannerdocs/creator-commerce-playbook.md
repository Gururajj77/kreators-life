# Booth: Technical Playbook

> **Status note, 26 October 2026.** This is research, not a spec. "Booth" became the Shop, Content, Auto-DM and Audience modules of kreators.app (`apps/web/src/screens/Studio*.tsx`, `Content.tsx`, `Automations.tsx`, `StudioAudience.tsx`; `apps/api/src/routes/studio.ts`, `growth.ts`, `buyer.ts`, `go.ts`). The three tiers were adopted on 24 October 2026 (`docs/DECISIONS.md`): parity features built plainly, content-to-revenue attribution and funnels as the difference, the white-label app, the marketplace and instalments skipped. The "no marketplace" line was partly reversed on 25 October 2026 for the Store (partner links and creator-to-creator pre-owned gear, with no money moving through kreators.app). The `CLAUDE.md` in §14.2 is superseded by the real one at the repo root; the data model in §7 is superseded by `plannerdocs/04_DATA_MODEL.md`. Competitor pricing is as of 24 October 2026 and should be re-checked before any of it is quoted.

A creator commerce app (link-in-bio storefront, bookings, digital products, webinars and courses, with content-to-revenue attribution as the differentiator), built with AI coding tools, competing with TagMango, SuperProfile and Topmate on features.

"Booth" is a working codename. Rename it everywhere once you pick a real name.

Last researched: 24 Oct 2026. Re-check competitor pricing before you publish anything that quotes it.

---

## 0. Read this first

**Pricing is not the game here. Features are.** This playbook competes on what the product does, not on fees. Set your fee close to market and move on.

**The trap with feature competition.** Between them, TagMango, SuperProfile and Topmate ship 30+ features with funded teams who have years of head start. If your plan is "match all of it, then add more", you will be behind on parity forever and never get to the part that makes you different.

**So the strategy is three tiers:**
1. **Parity:** the table-stakes features every creator expects. Build them well, build them once, do not innovate here.
2. **Differentiators:** 2 or 3 features where you are clearly better than all three. This is the only reason anyone switches.
3. **Skip:** each competitor's moat feature. Fighting there means fighting on their ground with less money.

Section 1 maps every feature. Section 2 sorts them into these tiers. Everything after that builds the plan.

---

## 1. Competitive teardown

### 1.1 Who each one really is

| | TagMango | SuperProfile | Topmate |
|---|---|---|---|
| Core identity | Courses, coaching and community for educators, with a white-label app | Link-in-bio store wrapped around an Instagram growth engine | Services storefront for experts selling their time |
| Moat feature | Engagement: community with points and streaks, challenges, branded app | Instagram Auto-DM, scheduler, lead magnets, email, all in one | Bookings, Priority DM, packages, cohorts, plus a marketplace that sends buyers |
| Who it fits | Coaches running paid programs with an existing cohort | Instagram-first creators selling digital goods | Professionals and mentors selling calls and advice |
| Payouts (for reference) | Razorpay or Stripe based on buyer location | Own checkout, KYC, T+1 in India | Bank payout within 7 days |

### 1.2 Feature matrix

"Yes" means the competitor's own site describes it. "Not seen" means it was not on their feature pages when researched, not proof it does not exist. Confirm during your teardown (1.4).

| Feature | TagMango | SuperProfile | Topmate |
|---|---|---|---|
| **Storefront** | | | |
| Link-in-bio profile or creator site | Yes | Yes | Yes |
| AI landing page generator | Yes | Not seen | Not seen |
| **Selling formats** | | | |
| 1:1 bookings with calendar sync | Coaching (listed) | Yes, Google Calendar | Yes |
| Intake forms before a session | Not seen | Not seen | Yes |
| Webinars and live events | Yes, recordings auto-added to course | Yes, Zoom, any link or in person, tickets and check-in | Yes, built-in Zoom Pro, auto-recording, replay sales |
| Cohorts (multi-week programs) | Workshops (listed) | Not seen | Yes, seats and peer groups |
| Recorded courses | Yes, drip and quizzes | Yes, drip, quizzes, assignments, live classes | Yes, modules, lessons, live calls |
| Certificates | Not seen on current site | Yes, verified | Not seen |
| Digital downloads | Not seen | Yes, ebooks, templates, bundles | Yes |
| Locked content (one paid post) | Not seen | Yes | Not seen |
| Paid async advice (Priority DM) | Not seen | Not seen | Yes |
| Packages and bundles | Not seen | Bundles | Yes, sessions plus products plus DMs |
| Instalment payments | Yes | Not seen | Not seen |
| **Community and engagement** | | | |
| Native community space | Yes, points and streaks | No, gates Telegram and Discord instead | Not seen |
| Paid Telegram or Discord access | Not seen | Yes, auto add and remove | Not seen |
| Challenges and gamification | Yes | Not seen | Not seen |
| **Growth and marketing** | | | |
| Instagram and Messenger Auto-DM | Not seen | Yes, comments, story replies, follow-ups, email capture | Not seen |
| Instagram post scheduler | Not seen | Yes, Reels, carousels, Stories | Not seen |
| Lead magnets | Not seen | Yes | Not seen |
| Email broadcasts and automations | Automated reminders, replays, win-backs | Yes, segments plus post-purchase flows | Not seen |
| Affiliates and referrals | Yes, member referral links | Via CJ Affiliate and Trackier | Not seen |
| Marketplace that brings buyers | No | No | Yes |
| **Operations** | | | |
| CRM of all buyers | Not seen | Not seen | Yes, unified |
| Analytics | Yes, sales, unsold offers, inactive members | Through Google Analytics and Meta Pixel | Earnings overview |
| Multi-currency or global tax | INR, USD | 16 buyer currencies, country pricing | GST and VAT handling in 150+ countries |
| Integrations | Wide: ConvertKit, Zoom, Slack, Zoho, and more | Zapier, Pabbly, Kit, Mailchimp, Klaviyo, Zoom | Not seen |
| **Platform** | | | |
| White-label mobile app | Yes, about 60 days to go live | No | No |
| Custom tools hosted for learners | Yes | No | No |
| AI assistant or MCP | Mango AI | MCP server for Claude and ChatGPT | Not seen |

### 1.3 What this tells you

- **Table stakes are the same everywhere:** profile, checkout, bookings, webinars, courses, digital products. Nobody wins on these. You just cannot lose on them.
- **Each competitor owns one job:** TagMango keeps students engaged, SuperProfile turns Instagram attention into leads, Topmate sells an expert's time.
- **Nobody connects attention to revenue.** SuperProfile runs the DMs. Others take the money. None of their pages show a creator "this Reel made ₹18,400 from 41 buyers". That is a hypothesis, so confirm it in your teardown, but if it holds it is the most obvious gap.
- **AI is shallow everywhere.** Landing page generators and assistants that edit products. None of them build the product for you from content you already made.

### 1.4 Teardown checklist (do this yourself before building)

Sign up as a creator on all three. For each, record with screenshots and timestamps:

1. Time from signup to a live, payable profile (stopwatch it).
2. For every row in 1.2, mark Yes, No or Partial from your own account, and fix the matrix.
3. Buyer checkout: number of screens, UPI flow, what happens on failure.
4. Booking flow: timezone handling, reschedule, cancel, refund.
5. What the creator sees after a sale (email, WhatsApp, dashboard, analytics).
6. Can the creator tell which post, Reel or DM produced a sale? How?
7. Mobile Lighthouse score of a public profile page.
8. Three things that annoyed you.

Then buy a ₹49 product on each as a buyer. The annoyances list is your backlog. Question 6 decides your differentiator.

---

## 2. Feature strategy (decide before building)

### 2.1 Tier 1: Parity (build well, do not innovate)
Storefront, 1:1 bookings with calendar sync and intake forms, digital downloads, payment links, webinars with replay sales, courses with drip, quizzes and certificates, packages, locked content, discount codes, post-purchase emails, buyer CRM, analytics, payouts and refunds.

### 2.2 Tier 2: Differentiators (default pick, change only with teardown evidence)

**D1. Content to revenue attribution.** Every post, Reel, story and DM gets its own tracked link. The dashboard shows revenue, buyers and conversion per piece of content. "Your Tuesday Reel made ₹18,400. Your carousel made ₹0." Creators make more of what sells. No competitor shows this on its feature pages.

**D2. Connected funnels, not separate products.** One builder that chains steps: comment keyword → Auto-DM with a free lead magnet → email sequence → webinar → paid offer → upsell to a package. Each step reports drop-off. Today creators stitch these across separate screens or separate tools.

**D3 (v2). AI product builder.** Paste a YouTube playlist, Notion page or PDF and get a draft course with modules, quizzes and a sales page. The creator edits, it does not publish on its own.

Why these: D1 and D2 reuse a channel you already run in production (Dripwise publishes Reels on Cloudflare), so you start ahead on the hardest part, the Meta integration. D3 waits until there are creators with content to feed it.

### 2.3 Tier 3: Skip (their moats)
- White-label mobile app (TagMango): 60-day store reviews, huge support load.
- Marketplace (Topmate): needs buyers you do not have.
- Native community with streaks and challenges (TagMango): a full product on its own. Gate Telegram and Discord instead, like SuperProfile.
- Custom hosted learner tools (TagMango).

### 2.4 Positioning statement template (fill once you confirm D1)
For **[one creator type]** who **[one painful job]**, Booth is the **[category]** that **[single measurable benefit]**, unlike **[named competitor]** which **[specific gap you verified in 1.4]**.

If you cannot fill every bracket with a fact from your own teardown, you are not ready to build.

---

## 3. PRD

### 3.1 Problem
Creators get attention on Instagram and sell on a separate storefront, with DMs, email, calendar and checkout in between. Every tool reports its own number, and none answers the only question that matters: which piece of content made money? So creators guess what to post next.

### 3.2 Goals (MVP)
- A creator goes from signup to a live, payable page in under 10 minutes (excluding KYC review time).
- A buyer completes a UPI purchase in 3 screens or fewer on mobile.
- Zero double-booked slots.
- 80% or more of sales are attributed to a specific post, DM or link.
- Payouts reconciled to the paisa, every day.

### 3.3 Non-goals (MVP)
- White-label mobile apps, marketplace discovery, native community spaces, challenges and gamification, custom learner tools, global (non-INR) payments, instalments, affiliates.

Write these on a sticky note. When you feel the urge to add one, re-read 3.3.

### 3.4 Personas

**Priya, the creator.** Career coach, 18k Instagram followers. Sells resume reviews and 30-min calls. Uses a Google Form and asks people to UPI her, then manually sends a Meet link. Loses 20% of leads in the back and forth.

**Rahul, the buyer.** 24, saw Priya's reel, taps the bio link on his phone. Wants to pay by UPI and get a confirmed slot instantly. Will abandon if asked to create an account.

**You, the operator.** Need to see every payment, refund, dispute and payout, and fix a stuck one in under 5 minutes.

### 3.5 Jobs to be done
- When I post a reel, I want one link where people can pay me, so I stop doing manual UPI follow-ups.
- When someone books a call, I want the slot, payment and meeting link to be handled, so I never double book or chase money.
- When I sell a PDF, I want it delivered automatically, so I can sell while I sleep.
- When I check my earnings, I want to know exactly what lands in my bank and when.
- When I plan next week's content, I want to see which posts made money, so I make more of those.
- When someone comments a keyword on my Reel, I want them to get the right link in DMs instantly, so I never lose a warm lead.

### 3.6 Scope by release

**MVP (weeks 1 to 8): parity core plus D1**
1. Creator auth (email OTP and Google).
2. Public profile page at `booth.in/username` with avatar, bio, social links, product cards.
3. Product types: 1:1 booking, digital download, payment link (fixed or pay-what-you-want).
4. Buyer checkout without an account (name, email, phone), Razorpay UPI, cards, netbanking.
5. Availability rules, Google Calendar sync (read busy times, write events), auto Google Meet link.
6. Transactional email to buyer and creator (Resend).
7. Creator dashboard: sales, bookings, buyers list, CSV export.
8. KYC and payout setup (bank account, PAN), payouts via the gateway's split or route feature.
9. Refunds (full) by creator.
10. Admin panel for the operator.
11. **D1:** Instagram account connect, tracked links per post, Reel, story or DM, and a revenue-by-content dashboard.
12. **D1:** Comment keyword Auto-DM that sends a tracked link.

**v1 (weeks 9 to 16): rest of parity plus D2**
- Webinars (Meet or Zoom, seat limits, auto-recording, replay sales).
- Courses (Cloudflare Stream, drip, quizzes, certificates).
- Packages, locked content, Priority DM (paid async questions).
- Intake forms per booking, reschedule by buyer, discount codes, testimonials.
- Lead magnets, email broadcasts and post-purchase sequences.
- **D2:** Funnel builder chaining Auto-DM, lead magnet, email, webinar and offer, with drop-off per step.
- Instagram scheduler (port from Dripwise), WhatsApp notifications, custom domain.

**v2 (later)**
- Cohorts, paid Telegram and Discord access, memberships with recurring billing, affiliates, instalments, multi-currency with Stripe, MCP server, **D3** AI product builder.

**Skipped (see 2.3)**
- White-label app, marketplace, native community and gamification, custom learner tools.

### 3.6.1 Full feature backlog by tier

| Feature | Tier | Release |
|---|---|---|
| Storefront, checkout, payouts, refunds | Parity | MVP |
| 1:1 bookings with calendar sync | Parity | MVP |
| Digital downloads, payment links | Parity | MVP |
| Content-to-revenue attribution | Differentiator D1 | MVP |
| Comment keyword Auto-DM | Parity (SuperProfile) feeding D1 | MVP |
| Webinars with replay sales | Parity | v1 |
| Courses with drip, quizzes, certificates | Parity | v1 |
| Packages, locked content, Priority DM | Parity | v1 |
| Intake forms, discount codes, testimonials | Parity | v1 |
| Lead magnets, email broadcasts and sequences | Parity | v1 |
| Funnel builder | Differentiator D2 | v1 |
| Instagram scheduler | Parity (SuperProfile) | v1 |
| Cohorts, Telegram and Discord gating, memberships | Parity | v2 |
| Affiliates, instalments, multi-currency | Parity | v2 |
| MCP server | Parity (SuperProfile) | v2 |
| AI product builder | Differentiator D3 | v2 |
| White-label app, marketplace, native community | Skip | Not planned |

### 3.7 User stories with acceptance criteria (MVP)

**US-01 Create profile**
As a creator, I can claim a username and publish a profile.
- Username: 3 to 30 chars, lowercase letters, numbers, underscore. Unique. Reserved words blocked (admin, api, app, login, etc).
- Profile renders server-side, mobile Lighthouse performance 90+.
- Unpublished profiles return 404 to the public.

**US-02 Create a 1:1 booking product**
- Fields: title, description, duration (15, 30, 45, 60, 90), price (₹0 allowed), buffer before and after, min notice (hours), max days ahead, intake questions (optional, later).
- Price stored in paise as an integer. Never floats.

**US-03 Set availability**
- Weekly rules per weekday with multiple ranges, in the creator's timezone.
- Date overrides (block a day, or custom hours on a day).
- Busy events from connected Google Calendar are excluded.

**US-04 Book and pay**
As a buyer, I pick a slot in my local timezone, enter name, email, phone, and pay.
- Slot is held for 10 minutes when checkout starts. Held slots are hidden from others.
- If payment succeeds, the booking is confirmed only after the webhook is verified, not on the client redirect.
- If payment fails or the hold expires, the slot is released.
- Two buyers racing for one slot: exactly one wins, the other sees "slot just got taken" and fresh slots.

**US-05 Confirmation**
- Within 60 seconds of payment capture: buyer email with time in their timezone, Meet link, .ics file, reschedule and cancel link. Creator email with buyer details. Google Calendar event created on the creator's calendar.

**US-06 Digital download**
- After capture, buyer gets an email with a signed download link valid for 7 days, max 5 downloads. Files stored privately in R2.

**US-07 Refund**
- Creator can refund a sale in full from the dashboard. Booking is cancelled, calendar event deleted, buyer emailed. Refund state tracked until the gateway confirms.

**US-08 Payouts**
- Creator sees: gross, platform fee, gateway fee, net, and expected settlement date per sale.
- Daily reconciliation job flags any order where our ledger and the gateway disagree.

**US-09 Admin**
- Operator can search by order ID, payment ID, buyer email or creator username, see the full event timeline, and trigger a webhook replay or refund.

**US-10 Tracked links and attribution (D1)**
As a creator, I can create a tracked link for any product and tag it to a source (Reel, post, story, DM automation, YouTube, other).
- Short link format `booth.in/go/abc123`, redirects in under 50 ms.
- Instagram posts and Reels from the connected account are pulled in, so a link can be tied to a specific post with its thumbnail.
- The click stores a first-party attribution cookie (30 days) and a click id that travels through checkout.
- Every order records the source link and click id. Last click wins in MVP.
- Dashboard shows per source: clicks, checkouts started, sales, revenue, conversion rate, revenue per 1,000 views where Instagram gives view counts.
- Orders without a link fall back to "profile direct" so totals always add up.

**US-11 Comment keyword Auto-DM (D1)**
As a creator, I pick a Reel or post, set a keyword (for example "GUIDE") and a reply message with a product.
- When someone comments the keyword, they get a DM with a tracked link unique to that automation, within 60 seconds.
- Optional public reply to the comment from a list of variants, so it does not look spammy.
- One DM per person per automation. Respect Meta's messaging rules (private replies to comments, the messaging window). Verify current rules before building.
- Dashboard shows per automation: comments matched, DMs sent, clicks, sales, revenue.

### 3.8 Success metrics

| Metric | MVP target |
|---|---|
| Signup to published profile | 60% of signups |
| Published to first sale within 14 days | 25% |
| Checkout start to payment success | 70% or better |
| Double bookings | 0 |
| Ledger vs gateway mismatches unresolved after 24h | 0 |
| Median time signup to live page | under 10 min |
| Sales attributed to a specific source | 80% or more |
| Creators who open the attribution dashboard weekly | 50% of active creators |

North star: **weekly GMV from creators who were not your friends.** Leading signal for the differentiator: **creators who change what they post after seeing attribution data** (ask them).

---

## 4. Core user flows

### 4.1 Creator onboarding
```
Sign up (email OTP or Google)
  → Claim username
  → Add name, photo, bio (prefill from Google)
  → Create first product (template: "30-min call ₹499")
  → Set availability (default Mon to Fri 10:00 to 18:00)
  → Connect Google Calendar (skippable)
  → Preview live page
  → Publish (can sell once KYC approved; until then show "Payments activating")
  → KYC: PAN, bank account, address
```

### 4.2 Buyer booking
```
Open booth.in/priya
  → Tap "30-min career call ₹499"
  → Pick date, pick slot (shown in buyer timezone)
  → Enter name, email, phone (+ intake answers)
  → POST /checkout → slot hold + gateway order created
  → Razorpay checkout (UPI intent on mobile)
  → Payment success → redirect to /order/{id} which polls status
  → Webhook payment.captured → confirm booking, create calendar event, send emails
  → Order page flips to "Confirmed" with Meet link
```

### 4.3 Failure paths you must handle
- Buyer pays, webhook delayed: order page keeps polling, shows "confirming payment", email follows.
- Buyer pays after hold expired: if slot still free, confirm. If taken, auto-refund and email apology.
- Webhook arrives twice: idempotent, second is a no-op.
- Google token revoked: booking still confirmed, creator gets "reconnect calendar" banner and email, Meet link falls back to a creator-set static link.
- Gateway down: checkout shows a clear retry message, no orphaned holds.

### 4.4 Attention to sale (D1)
```
Creator posts Reel, sets Auto-DM keyword "GUIDE" → product "Resume template ₹199"
  → Rahul comments "GUIDE"
  → Meta webhook (comments) → match keyword → enqueue DM job
  → DM sent with booth.in/go/k7f2q9 (link tied to this Reel + automation)
  → Rahul taps → /go handler logs click, sets attribution cookie, redirects to product
  → Checkout carries click id → order stores source_link_id + click_id
  → Dashboard: Reel "3 resume mistakes" → 212 comments, 198 DMs, 141 clicks, 23 sales, ₹4,577
```

---

## 5. Screens and information architecture

**Public**
- `/:username` profile
- `/:username/:productSlug` product page (booking calendar or buy button)
- `/order/:orderId` order status (tokenized link)
- `/b/:bookingToken` manage booking (reschedule, cancel)
- `/d/:downloadToken` download

**Creator app** (`/app`)
- Home (today's bookings, last 7 days revenue, setup checklist)
- Products (list, create, edit)
- Availability (weekly rules, overrides, calendar connection)
- Sales (orders table, filters, refund action)
- Bookings (upcoming, past)
- Customers (list, CSV export)
- Payouts (KYC status, bank, settlement table)
- Content (every connected post and Reel with clicks, sales, revenue, sortable; the D1 home)
- Automations (keyword Auto-DMs, status, per-automation funnel)
- Links (all tracked links, create, copy, QR)
- Settings (profile, username, notifications)

**Admin** (`/admin`, separate role)
- Search, order timeline, creator detail, KYC queue, reconciliation report, webhook log with replay.

Design rule: two screens decide whether creators stay. The public profile (buyers judge it) and the Content screen (creators open it every week). Spend design time there.

---

## 6. Technical architecture

### 6.1 Stack (final)

| Layer | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers | You already know it, global edge, cheap, no cold starts |
| App framework | React Router v7 (framework mode) on Workers | One codebase for SSR public pages and the SPA dashboard |
| API | Hono routes inside the same Worker for webhooks and public API | Clean, typed, fast |
| DB | Cloudflare D1 (SQLite) with Drizzle ORM | Relational, transactions, migrations, enough for years at this stage |
| Files | R2 (private bucket, signed URLs) | Digital products, avatars |
| Async jobs | Cloudflare Queues | Emails, calendar writes, reconciliation, retries |
| Slot locking | D1 unique index plus hold rows (Durable Object only if contention proves real) | Simplest thing that is correct |
| Scheduled | Cron Triggers | Expire holds, daily reconciliation, reminder emails |
| Auth | Better Auth with D1 adapter (email OTP, Google) | Self-hosted, no per-MAU bill |
| Payments | Razorpay (Route for split settlements to linked creator accounts) | India UPI coverage, marketplace split support |
| Email | Resend | Simple API, good deliverability |
| Calendar | Google Calendar API (OAuth, offline access) | Busy times, event creation, Meet links via conferenceData |
| Social | Instagram Graph API via Meta app (Instagram Login), comment and message webhooks | Post and Reel list, insights, comment triggers, DMs; reuse what you built for Dripwise |
| Short links | `/go/:code` route in the same Worker, click writes via Queue | Fast redirect, no write on the hot path |
| Observability | Workers Logs, Sentry, an `events` table for audit | You need a timeline per order |
| Analytics | PostHog | Funnels for 3.8 metrics |
| Styling | Tailwind plus shadcn/ui | Fast to build, easy for AI tools to generate correctly |

### 6.2 Diagram
```
             ┌────────────── Cloudflare Worker (booth) ──────────────┐
Buyer ──────▶│ SSR public pages  │  /app dashboard  │  /api (Hono)    │
Creator ────▶│                   │                  │  /webhooks/*    │
             └───────┬──────────────────┬───────────────┬────────────┘
                     │                  │               │
                   D1 (Drizzle)        R2            Queues ──▶ consumer Worker
                     │                                   │      (email, calendar,
                     │                                   │       reconcile, refunds)
                     ▼                                   ▼
               Cron Triggers                    Razorpay / Google / Resend
```

### 6.3 Repo layout
```
booth/
  app/                  React Router routes (public, app, admin)
  server/
    api/                Hono routers
    webhooks/           razorpay.ts, google.ts, meta.ts
    services/           booking, availability, checkout, payouts, email, calendar,
                        links, attribution, instagram, automations
    payments/           provider interface + razorpay adapter
    jobs/               queue consumers, cron handlers
  db/
    schema.ts           Drizzle schema
    migrations/
  lib/                  money.ts, time.ts, ids.ts, crypto.ts
  tests/
    unit/  integration/  e2e/
  docs/
    PLAYBOOK.md         this file
    DECISIONS.md        one line per decision with date
  CLAUDE.md
  wrangler.jsonc
```

### 6.4 Rules the code must follow
- Money is integer paise everywhere. One `money.ts` module formats it.
- Time is stored as UTC ISO strings or epoch ms. Timezone conversion only at the edges, using IANA zone names.
- Every external side effect (email, calendar, refund) goes through a queue with an idempotency key.
- Webhooks: verify signature, store raw payload, then process. Never trust client redirects.
- Payment provider sits behind an interface so Stripe can be added without touching business logic.

---

## 7. Data model (D1 / SQLite)

```sql
-- users & creators
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- ulid
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'creator', -- creator | admin
  created_at INTEGER NOT NULL
);

CREATE TABLE creators (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_key TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  socials_json TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 0,
  kyc_status TEXT NOT NULL DEFAULT 'none', -- none | pending | approved | rejected
  payout_account_id TEXT,                  -- gateway linked account id
  fee_bps INTEGER NOT NULL DEFAULT 500,    -- 5.00%, per creator so you can run deals
  created_at INTEGER NOT NULL
);

-- products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  type TEXT NOT NULL,                -- booking | download | payment_link
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_paise INTEGER NOT NULL,      -- 0 allowed
  pwyw_min_paise INTEGER,            -- pay what you want floor
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}', -- duration, buffers, notice, file_key...
  created_at INTEGER NOT NULL,
  UNIQUE (creator_id, slug)
);

-- availability
CREATE TABLE availability_rules (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  weekday INTEGER NOT NULL,          -- 0 Sunday .. 6 Saturday
  start_min INTEGER NOT NULL,        -- minutes from local midnight
  end_min INTEGER NOT NULL
);

CREATE TABLE availability_overrides (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  date TEXT NOT NULL,                -- YYYY-MM-DD in creator tz
  ranges_json TEXT NOT NULL          -- [] means blocked all day
);

-- buyers (no login in MVP)
CREATE TABLE buyers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_buyers_email ON buyers(email);

-- orders & payments
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  public_token TEXT NOT NULL UNIQUE,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  buyer_id TEXT NOT NULL REFERENCES buyers(id),
  status TEXT NOT NULL,              -- created | paid | refunded | partially_refunded | failed | expired
  amount_paise INTEGER NOT NULL,
  platform_fee_paise INTEGER NOT NULL,
  gateway_fee_paise INTEGER,         -- filled from gateway settlement data
  net_paise INTEGER,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX idx_orders_creator ON orders(creator_id, created_at);

-- bookings with race-safe slot claim
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  creator_id TEXT NOT NULL REFERENCES creators(id),
  start_at INTEGER NOT NULL,         -- epoch ms UTC
  end_at INTEGER NOT NULL,
  status TEXT NOT NULL,              -- held | confirmed | cancelled
  hold_expires_at INTEGER,
  manage_token TEXT NOT NULL UNIQUE,
  calendar_event_id TEXT,
  meet_url TEXT,
  created_at INTEGER NOT NULL
);
-- one active claim per creator per start time
CREATE UNIQUE INDEX uniq_active_slot
  ON bookings(creator_id, start_at)
  WHERE status IN ('held', 'confirmed');

-- downloads
CREATE TABLE download_grants (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  token TEXT NOT NULL UNIQUE,
  file_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 5
);

-- refunds
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL,              -- requested | processed | failed
  provider_refund_id TEXT UNIQUE,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- calendar connections (tokens encrypted at rest)
CREATE TABLE calendar_connections (
  creator_id TEXT PRIMARY KEY REFERENCES creators(id),
  provider TEXT NOT NULL DEFAULT 'google',
  refresh_token_enc TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'ok'  -- ok | revoked
);

-- raw webhooks and audit trail
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,               -- provider event id, dedupes retries
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at INTEGER,
  error TEXT,
  received_at INTEGER NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,              -- order | booking | creator
  entity_id TEXT NOT NULL,
  type TEXT NOT NULL,                -- order.created, payment.captured, email.sent...
  data_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_entity ON events(entity, entity_id, created_at);

-- D1: social accounts, content, links, clicks, automations
CREATE TABLE social_accounts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  platform TEXT NOT NULL DEFAULT 'instagram',
  external_user_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  token_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',  -- ok | expired | revoked
  UNIQUE (platform, external_user_id)
);

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  social_account_id TEXT NOT NULL REFERENCES social_accounts(id),
  external_media_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,                -- reel | post | carousel | story
  caption TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  posted_at INTEGER,
  views INTEGER,                     -- refreshed from insights
  insights_synced_at INTEGER
);

CREATE TABLE tracked_links (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  code TEXT NOT NULL UNIQUE,         -- the /go/:code part
  product_id TEXT REFERENCES products(id), -- null means profile page
  source_type TEXT NOT NULL,         -- content | automation | bio | youtube | other
  content_item_id TEXT REFERENCES content_items(id),
  automation_id TEXT,
  label TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE link_clicks (
  id TEXT PRIMARY KEY,               -- also the click id carried to checkout
  link_id TEXT NOT NULL REFERENCES tracked_links(id),
  creator_id TEXT NOT NULL,
  ip_hash TEXT,                      -- salted hash, never raw IP
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_clicks_link ON link_clicks(link_id, created_at);

CREATE TABLE dm_automations (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  content_item_id TEXT REFERENCES content_items(id), -- null means all posts
  keywords_json TEXT NOT NULL,       -- ["guide","link"]
  dm_message TEXT NOT NULL,
  public_replies_json TEXT NOT NULL DEFAULT '[]',
  link_id TEXT NOT NULL REFERENCES tracked_links(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE dm_sends (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES dm_automations(id),
  external_comment_id TEXT NOT NULL UNIQUE, -- dedupes webhook retries
  recipient_external_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- queued | sent | failed | skipped
  error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (automation_id, recipient_external_id) -- one DM per person per automation
);
```

Add to `orders`: `source_link_id TEXT REFERENCES tracked_links(id)` and `click_id TEXT`. Attribution reports are a join from `orders` to `tracked_links` to `content_items`, so no separate attribution table is needed in MVP.

**Slot claim logic:** inside one D1 batch, insert the order (status `created`) and the booking (status `held`, `hold_expires_at = now + 10 min`). The partial unique index makes the second concurrent insert fail. Catch that constraint error and return 409. A cron every minute flips expired holds to `cancelled` and orders to `expired`.

---

## 8. API spec (MVP)

All JSON. Creator routes need a session. Public routes are rate limited.

### Public
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/public/creators/:username` | Profile and active products |
| GET | `/api/public/products/:productId/slots?from=YYYY-MM-DD&days=7&tz=Asia/Kolkata` | Available slots |
| POST | `/api/public/checkout` | Create order, hold slot, create gateway order |
| GET | `/api/public/orders/:publicToken` | Order status for polling |
| POST | `/api/public/bookings/:manageToken/cancel` | Buyer cancel (per policy) |
| GET | `/d/:token` | Redirect to signed R2 URL, counts a use |

`POST /api/public/checkout` body:
```json
{
  "productId": "01J...",
  "slotStart": 1761298200000,
  "buyer": { "name": "Rahul", "email": "rahul@example.com", "phone": "+919800000000" },
  "amountPaise": 49900
}
```
Response `201`:
```json
{
  "orderId": "01J...",
  "publicToken": "q3...",
  "provider": "razorpay",
  "providerOrderId": "order_ABC",
  "amountPaise": 49900,
  "holdExpiresAt": 1761298800000
}
```
Errors: `409 slot_taken`, `410 product_inactive`, `422 validation_error`, `429 rate_limited`.

The checkout body also accepts an optional `"clickId"`. The server reads it from the attribution cookie if the client does not send it.

### Creator
| Method | Path |
|---|---|
| GET, PATCH | `/api/me/creator` |
| GET, POST | `/api/me/products` |
| PATCH, DELETE | `/api/me/products/:id` |
| GET, PUT | `/api/me/availability` |
| GET | `/api/me/orders?status=&cursor=` |
| POST | `/api/me/orders/:id/refund` |
| GET | `/api/me/bookings?range=upcoming` |
| GET | `/api/me/payouts` |
| POST | `/api/me/calendar/google/connect` (returns OAuth URL) |
| POST | `/api/me/uploads` (returns presigned R2 PUT URL) |
| POST | `/api/me/social/instagram/connect` (returns Meta OAuth URL) |
| GET | `/api/me/content?sort=revenue&range=30d` (posts with clicks, sales, revenue) |
| GET, POST | `/api/me/links` |
| GET | `/api/me/links/:id/stats?range=30d` |
| GET, POST | `/api/me/automations` |
| PATCH, DELETE | `/api/me/automations/:id` |
| GET | `/api/me/automations/:id/stats` |

### Short links
| Method | Path | Purpose |
|---|---|---|
| GET | `/go/:code` | Log click via Queue, set attribution cookie, 302 to product or profile |

### Webhooks
| Path | Events handled |
|---|---|
| `/webhooks/razorpay` | `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`, `transfer.processed`, `account.*` |
| `/webhooks/meta` | Verification challenge (GET), `comments`, `messages` (POST) |

Webhook handler order: verify HMAC signature with raw body, insert into `webhook_events` (primary key on event id stops duplicates), enqueue processing, return 200 fast.

---

## 9. Payments, payouts and compliance

This section decides whether you have a business. Treat it as the critical path, not a feature.

### 9.1 Model (final for MVP)
Platform collects through Razorpay and splits to creator linked accounts using Razorpay Route. This matches the "no gateway account needed, KYC once, paid next day" experience creators now expect from SuperProfile.

Apply for Route and marketplace approval on day one. Approval can take weeks and may ask for business registration, website with policies, and a description of what creators sell. Build in test mode meanwhile.

**Fallback if Route is delayed or refused:** let creators connect their own Razorpay keys. Keep the `PaymentProvider` interface so this is a config switch, not a rewrite.

### 9.2 Money flow per sale (example ₹499 at a 5% fee)
Pricing is not the wedge, so set the fee near market after the teardown. This example only shows how the numbers are stored.
```
Buyer pays            49,900 paise
Gateway fee (approx)  ~1,000 paise   (charged to platform)
Platform fee (5%)      2,495 paise
Transfer to creator   47,405 paise
Platform margin        ~1,495 paise  (before GST on your fee)
```
Store every number. Show creators the same breakdown. Trust is your feature.

### 9.3 Compliance checklist (verify with a CA and the gateway before launch)
- Register a business entity (LLP or Pvt Ltd) and get GST registration. Marketplaces usually cannot run as an individual.
- GST on your platform fee is owed by you. Show it on invoices to creators.
- E-commerce operator rules: as a platform collecting on behalf of sellers, you may have TCS obligations under GST and TDS obligations under section 194-O of the Income Tax Act. Rates and thresholds change, so get current numbers from a CA.
- Creator KYC: PAN, bank account verification, address. The gateway's linked account KYC may cover most of it.
- Policies on the site before approval: Terms, Privacy, Refund and Cancellation, Contact page with business address, Pricing page.
- Prohibited goods list for creators (no financial "tips" with guaranteed returns, no adult content, no counterfeit). Payment gateways will suspend your whole account for one bad creator.
- DPDP Act: you hold buyer personal data. Have a privacy notice, consent at checkout, a deletion process.

I am not a lawyer or a tax advisor. Treat this list as the questions to bring to one.

### 9.4 Reconciliation
Daily cron:
1. Pull yesterday's payments, refunds and transfers from the gateway API.
2. Match each to `orders` and `refunds` by provider IDs.
3. Fill `gateway_fee_paise` and `net_paise` from settlement data.
4. Write mismatches to a `recon_issues` table and email you.

If you skip this, you will find out about a missing ₹40,000 from an angry creator on Twitter.

---

## 10. Integrations

| Integration | MVP use | Gotchas |
|---|---|---|
| Google Calendar | Free/busy read, event create with `conferenceData` for Meet | Needs OAuth consent screen verification for sensitive scopes before public launch. Store refresh tokens encrypted. Handle `invalid_grant` as "revoked". |
| Resend | All transactional email | Set up SPF, DKIM, DMARC on your domain on day one. |
| Razorpay | Orders, checkout, Route, refunds, webhooks | Webhook secret per environment. Test mode and live mode keys never mixed. |
| Instagram Graph API (MVP) | Connect account, list posts and Reels, insights, comment webhooks, DMs | Needs Meta app review for messaging and comment permissions, a business or creator account, and token refresh. Keep to Meta's rules on private replies and messaging windows. Build the review screencast early, review can take weeks. |
| WhatsApp Business API (v1) | Booking confirmations and reminders | Template approval needed. Per-message cost. Huge for Indian buyers. |
| Cloudflare Stream (v2) | Course video | Signed URLs to stop link sharing. |

---

## 11. Security and abuse

- Auth: session cookies, `HttpOnly`, `Secure`, `SameSite=Lax`. CSRF protection on state-changing creator routes.
- Every creator query filters by `creator_id` from the session. Write one helper and use it everywhere. Add a test that tries to read another creator's order.
- Public tokens (order, booking, download) are 128-bit random, never sequential IDs.
- Webhook signature verification on raw body. Reject on failure, log it.
- Rate limits: checkout 10/min per IP, slot lookups 60/min per IP, OTP 5/hour per email.
- R2 bucket private. Downloads through short-lived signed URLs only.
- Encrypt OAuth refresh tokens with a key in Workers Secrets.
- Uploaded files: check MIME and size, block executables, max 500 MB.
- Fraud signals to watch: many failed payments from one card, new creator with a sudden spike of high-value sales, refund requests right after payout. Freeze payouts for review if triggered.
- Secrets never in the repo. `wrangler secret put` per environment.

---

## 12. Non-functional requirements

- Public profile TTFB under 200 ms from India, mobile Lighthouse performance 90+, works on a ₹8,000 Android phone on 4G.
- SEO: SSR profile pages, Open Graph image per creator (generated at the edge), sitemap of published creators.
- Accessibility: keyboard navigable checkout, labels on every input, 4.5:1 contrast.
- Availability: degrade gracefully if Google or Resend is down; payments must never be blocked by a non-payment dependency.
- Data retention: keep orders and ledger for 8 years for tax, delete buyer PII on request where law allows.

---

## 13. Analytics events

Track in PostHog, name them consistently:

| Event | Properties |
|---|---|
| `creator_signed_up` | method |
| `profile_published` | minutes_since_signup |
| `product_created` | type, price_paise |
| `kyc_submitted`, `kyc_approved` | |
| `profile_viewed` | creator_id, referrer |
| `product_viewed` | product_id |
| `checkout_started` | product_id, amount_paise |
| `payment_succeeded`, `payment_failed` | method, error_code |
| `booking_confirmed` | lead_time_hours |
| `refund_issued` | amount_paise, reason |
| `instagram_connected` | |
| `link_created` | source_type |
| `automation_created` | |
| `content_dashboard_viewed` | range, sort |

Build four funnels on day one: signup to published, published to first sale, checkout started to paid, Instagram connected to first attributed sale.

---

## 14. Vibe-coding operating system

AI tools write code fast and drift fast. These rules keep the codebase from rotting.

### 14.1 Rules
1. This playbook lives in `docs/PLAYBOOK.md`. Every prompt points to it.
2. One phase per session. Commit at the end of each phase.
3. Tests for money and time logic are written before the implementation.
4. Never accept a diff that touches payments without reading it line by line yourself.
5. Every decision that changes the plan goes into `docs/DECISIONS.md` with a date.

### 14.2 CLAUDE.md (put this at the repo root)
```markdown
# Booth

Creator commerce app: public profile, paid 1:1 bookings, digital downloads, plus content-to-revenue attribution and comment keyword Auto-DM for Instagram. India first, INR, Razorpay.
Full spec: docs/PLAYBOOK.md. Read the relevant section before changing anything.

## Stack
Cloudflare Workers, React Router v7 framework mode, Hono for /api, /webhooks and /go, D1 with Drizzle, R2, Queues, Cron Triggers, Better Auth, Razorpay, Resend, Google Calendar API, Instagram Graph API, Tailwind, shadcn/ui, Vitest, Playwright.

## Non-negotiable rules
- Money is integer paise. Use lib/money.ts. Never use floats for money.
- Times stored as UTC epoch ms. Convert with IANA zone names only in lib/time.ts.
- Every creator-scoped query must filter by the session creator id via server/services/scope.ts.
- Booking confirmation happens only in the webhook path after signature verification.
- External side effects (email, calendar, refunds) go through Queues with an idempotency key.
- Payment code talks to server/payments/provider.ts, never to the Razorpay SDK directly.
- The /go redirect never writes to D1 on the request path. It enqueues the click and redirects.
- Never store raw IP addresses. Store a salted hash.
- Do not add dependencies without saying why in the PR description.
- Do not build anything listed under Non-goals in docs/PLAYBOOK.md section 3.3.

## Commands
- npm run dev
- npm run test
- npm run test:e2e
- npm run db:migrate:local
- npm run typecheck

## Done means
Typecheck passes, unit tests pass, the feature's acceptance criteria from docs/PLAYBOOK.md section 3.7 are covered by tests, and docs/DECISIONS.md is updated if anything changed.
```

### 14.3 Phase prompts for Claude Code (copy and paste as is)

**Phase 0: Scaffold**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 6 and 7. Scaffold the Booth project as described in section 6.3: a single Cloudflare Worker using React Router v7 in framework mode, with Hono mounted for /api and /webhooks. Set up D1 with Drizzle and translate the SQL in section 7 into a Drizzle schema in db/schema.ts with a first migration. Add R2, a Queue named booth-jobs with a consumer, and a cron trigger every minute, all in wrangler.jsonc. Add Tailwind and shadcn/ui. Add Vitest and Playwright with one passing smoke test each. Create lib/money.ts with functions to format paise as rupees and to compute a percentage fee in basis points using integer math only, with unit tests covering rounding. Create lib/time.ts with functions to convert between UTC epoch ms and a local date and time in a given IANA timezone, with unit tests that include Asia/Kolkata and America/New_York across a daylight saving change. Create docs/DECISIONS.md with today's date and the stack decision. Stop when npm run typecheck, npm run test and npm run test:e2e all pass, then show me the file tree.
```

**Phase 1: Auth and public profile**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.7 (US-01), 5 and 11. Add Better Auth with the D1 adapter supporting email OTP and Google sign in. After first sign in, send the user to an onboarding route where they claim a username following the US-01 rules, including a reserved words list, and fill display name, bio, avatar upload to R2 through a presigned URL, and social links. Build the server-rendered public profile route at /:username that shows the creator and their active products, returns 404 when unpublished, sets Open Graph tags, and is mobile first. Create server/services/scope.ts with a helper that returns the current creator id from the session and throws if missing, and use it in every creator route. Write an integration test proving one creator cannot read or update another creator's data. Write a Playwright test that signs up, claims a username, publishes, and loads the public page. Stop when all tests pass and summarise what you built in five lines.
```

**Phase 2: Products and availability**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.7 (US-02, US-03), 7 and 8. Build creator CRUD for products of type booking, download and payment_link, storing type-specific settings in config_json with a Zod schema per type. Prices are entered in rupees in the UI and stored as integer paise. Build the availability editor for weekly rules with multiple ranges per weekday and date overrides, stored in the creator's timezone. Implement server/services/availability.ts with a pure function that takes rules, overrides, existing held or confirmed bookings, busy intervals, product duration, buffers, minimum notice, maximum days ahead and the current time, and returns available slot start times in UTC. Write thorough unit tests first for that function, covering buffers, overrides that block a full day, minimum notice, a booking that overlaps a slot partially, and a creator in Asia/Kolkata viewed by a buyer in Europe/London. Then expose GET /api/public/products/:productId/slots exactly as specified in section 8. Do not integrate Google Calendar yet; accept busy intervals as an empty list for now. Stop when all tests pass.
```

**Phase 3: Checkout, payments and confirmation**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.7 (US-04, US-05, US-06), 4.2, 4.3, 7, 8 and 9. Create server/payments/provider.ts defining a PaymentProvider interface with createOrder, verifyWebhook, refund and fetchSettlements, and implement a Razorpay adapter using test mode keys from Workers secrets. Implement POST /api/public/checkout: validate input with Zod, upsert the buyer, then in one D1 batch insert the order with status created and, for booking products, a booking with status held and hold_expires_at ten minutes ahead. If the partial unique index on bookings rejects the insert, return 409 slot_taken. Then create the Razorpay order and store its id. Build the buyer product page with a date picker, slot list in the buyer's detected timezone, a short form, and Razorpay checkout, followed by an order status page that polls GET /api/public/orders/:publicToken. Implement POST /webhooks/razorpay: verify the signature against the raw body, insert into webhook_events using the provider event id as the primary key so duplicates are ignored, enqueue processing, and return 200. In the queue consumer, on payment.captured mark the order paid, confirm the booking, compute platform fee using the creator fee_bps with lib/money.ts, and enqueue confirmation emails through Resend. If the hold had expired and the slot is now taken by someone else, refund automatically and email the buyer. For downloads, create a download grant and email a link to /d/:token that redirects to a short-lived signed R2 URL and counts uses. Add the every-minute cron that expires stale holds and orders. Log every state change to the events table. Write integration tests for: two concurrent checkouts for the same slot where exactly one succeeds, duplicate webhook delivery being a no-op, an invalid webhook signature being rejected, and an expired hold being released. Stop when all tests pass and list anything you could not verify without live keys.
```

**Phase 4: Google Calendar, dashboard, refunds**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.7 (US-07), 5 and 10. Add Google Calendar OAuth for creators with offline access, storing the refresh token encrypted with a key from Workers secrets. Feed busy intervals from the free/busy endpoint into the availability function, cached for five minutes per creator. When a booking is confirmed, enqueue a job that creates a Google Calendar event with a Google Meet link through conferenceData and saves the event id and Meet URL on the booking. If Google returns invalid_grant, mark the connection revoked, keep the booking confirmed, use the creator's fallback meeting link, and email the creator to reconnect. Build the creator dashboard pages from section 5: home with a setup checklist, sales table with filters and CSV export, bookings list, customers list, and a refund action that calls the provider refund through a queued job, cancels the booking, deletes the calendar event and emails the buyer. Write tests for the refund flow and the revoked token fallback. Stop when all tests pass.
```

**Phase 5: Payouts, admin, hardening**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.7 (US-08, US-09), 9.4, 11, 12 and 13. Build the payouts page showing per sale gross, platform fee, gateway fee, net and expected settlement date, plus KYC status. Add a daily cron that pulls the previous day's payments, refunds and transfers through PaymentProvider.fetchSettlements, matches them to orders and refunds, fills gateway_fee_paise and net_paise, writes mismatches to a new recon_issues table with a migration, and emails the admin when any exist. Build the admin area restricted to users with role admin: global search by order id, provider payment id, buyer email or creator username, an order timeline from the events table, and buttons to replay a stored webhook and to issue a refund. Add rate limits from section 11 using a Durable Object or the Workers rate limiting binding. Add PostHog with the events in section 13. Run a security pass against section 11 and list every item as done or not done with file references. Run Lighthouse on a seeded public profile and report the mobile performance score. Stop and give me a launch readiness report.
```

**Phase 6: Attribution and Auto-DM (the differentiator)**
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 2.2, 3.7 (US-10, US-11), 4.4, 7, 8 and 10. Add migrations for social_accounts, content_items, tracked_links, link_clicks, dm_automations and dm_sends exactly as in section 7, and add source_link_id and click_id to orders. Build Instagram connect through Meta OAuth using Instagram Login, storing the access token encrypted with a key from Workers secrets, with a daily cron that refreshes tokens before expiry and marks the account expired if refresh fails. Add a job that syncs the creator's posts and Reels into content_items and refreshes view counts from insights every six hours. Build the GET /go/:code route: look up the link, generate a click id, enqueue the click with a salted IP hash, set a first-party attribution cookie for 30 days holding the click id, and redirect with 302, with no D1 write on the request path. Make POST /api/public/checkout read the click id from the cookie or body and save source_link_id and click_id on the order, last click wins. Build the Links page to create and copy tracked links tied to a product and optionally a content item. Build POST and GET /webhooks/meta: answer the verification challenge, verify the X-Hub-Signature-256 header against the raw body with the app secret, and enqueue comment events. In the consumer, match the comment text case-insensitively against active automations for that media, insert into dm_sends using the comment id so retries are ignored and the unique pair of automation and recipient stops repeat DMs, send the DM as a private reply with the automation's tracked link, optionally post one random public reply from the list, and record sent or failed with the error. Build the Automations page and the Content page that lists posts with thumbnail, views, clicks, checkouts started, sales, revenue and conversion, sortable by revenue over 7, 30 or 90 days, with orders without a link shown as profile direct so totals match the sales page. Write tests for: a click id flowing from /go through checkout onto the order, duplicate Meta webhooks sending only one DM, the same commenter on the same automation getting one DM, an invalid Meta signature being rejected, and content revenue totals matching total sales. Stop when all tests pass and list every Meta permission the app needs for review.
```

---

## 15. Testing plan

| Layer | What | Tool |
|---|---|---|
| Unit | money math, timezone conversion, slot generation, fee calc | Vitest |
| Integration | checkout race, webhook idempotency, signature rejection, tenant isolation, refunds | Vitest with Miniflare local D1 |
| E2E | signup to publish, buyer booking with Razorpay test mode, download delivery | Playwright |
| Manual | real UPI payment of ₹1 in live mode, refund it, verify settlement next day | You, before launch |
| Integration (D1) | click id to order, Meta webhook dedupe, one DM per person, revenue totals match | Vitest |
| Load | 50 concurrent checkouts on one slot, 500 /go redirects per second | k6 or a simple script |

Golden rule: if a bug touches money or time, the fix ships with a test that would have caught it.

---

## 16. Launch checklist

**Before first real creator**
- [ ] Business entity, GST, bank account
- [ ] Razorpay live mode and Route approved
- [ ] Terms, Privacy, Refund policy, Contact, Pricing pages live
- [ ] Google OAuth consent screen verified
- [ ] Meta app review approved for comments and messaging permissions
- [ ] SPF, DKIM, DMARC passing
- [ ] Live ₹1 test: pay, confirm, refund, settlement reconciled
- [ ] Sentry alerts to your phone
- [ ] Backup: scheduled D1 export to R2

**First 10 creators**
- [ ] Hand-onboard each one on a call. Watch them, do not help unless stuck.
- [ ] Migrate their existing products for them.
- [ ] Waive fees for 60 days in exchange for weekly feedback.
- [ ] Pick them from one niche only.

**First 100**
- [ ] Referral credit (both sides get fee-free sales)
- [ ] Public case study: one creator's Content screen, "this Reel made ₹X, this one made ₹0", with permission
- [ ] Teardown content: "I tried to find which Reel made money on 3 platforms, here's what happened"

---

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gateway marketplace approval delayed or denied | Cannot launch platform payouts | Apply day one, ship BYO gateway fallback |
| One creator sells prohibited content, gateway freezes account | All creators stop earning | Prohibited list, manual review of first sales per creator, payout holds on spikes |
| Parity treadmill: always chasing competitor feature launches | Differentiator never ships | Parity list is frozen per release (3.6.1); D1 ships in MVP, not after parity |
| SuperProfile adds attribution next to its Auto-DM | D1 loses novelty | Go deeper than a counter: content insights, funnels (D2), and speed of iteration with real creators |
| Meta app review delayed, or Meta changes messaging rules | Auto-DM and post sync blocked | Start review in week 0, tracked links still work without Meta, keep Auto-DM behind a feature flag |
| Attribution is wrong (cookies blocked, in-app browser loses cookie) | Creators stop trusting the core feature | Click id in the URL as well as the cookie, show an "unattributed" bucket honestly, never inflate |
| Scope creep into white-label app, marketplace or community | Never ship | Section 2.3 and 3.3, re-read weekly |
| AI-generated code with silent money bugs | Lost trust, lost money | Section 14.1 rule 4, recon cron, tests first for money |
| Solo founder bandwidth with a full-time job | Slow progress | Eight-week MVP with a hard cut, one phase per weekend |

---

## 18. Eight-week MVP plan

| Week | Deliverable | Exit test |
|---|---|---|
| 0 | Teardown (1.4), confirm D1 gap, Razorpay and Meta app review applications, entity paperwork started | Feature matrix verified from your own accounts, positioning statement filled |
| 1 | Phase 0 and Phase 1 | Live public profile on a staging URL |
| 2 | Phase 2 | Correct slots across timezones, tests green |
| 3 | Phase 3 | Test-mode booking end to end, race test green |
| 4 | Phase 4 | Calendar event and Meet link created, refund works |
| 5 | Phase 6, part one: Instagram connect, content sync, tracked links, attribution on orders | A test sale shows up under the right Reel |
| 6 | Phase 6, part two: Auto-DM and Content screen | Comment keyword to DM to sale works end to end |
| 7 | Phase 5 | Recon report clean, admin works, Lighthouse 90+ |
| 8 | Live ₹1 test, first 3 creators onboarded | First attributed sale from someone who is not a friend |

---

## Sources

- [SuperProfile About (pricing, fees, payouts, MCP)](https://superprofile.bio/about)
- [SuperProfile Products](https://superprofile.bio/products)
- [SuperProfile Plans and Billing](https://support.superprofile.bio/en/articles/12153687-plans-billing)
- [Topmate Pricing](https://topmate.io/pricing)
- [Topmate Features](https://topmate.io/features)
- [TagMango homepage (features)](https://tagmango.com/)
- [TagMango plans (third-party pricing tracker)](https://getpulsesignal.com/compare/tagmango-vs-teachable)
- [Community platforms compared (TagMango commission and positioning)](https://businessabc.net/top-community-platforms-for-paid-memberships-compared)
