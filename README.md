# Kreators Life

Seven relationships, one tower, a few boxes to tick every day. Around that daily game sits everything a creator needs: learning, paid work, brand campaigns, content rewards paid per verified view, events, a shop with attribution, a money tracker, and a public site that shows all of it before anyone signs in.

## Stack

- `apps/web`: React 19 + Vite 7 + Tailwind 4, installable PWA. The public site and the app are one bundle.
- `apps/api`: Cloudflare Worker (Hono) with a D1 database. It serves the built web app as static assets, so one deploy ships everything. `/api/*`, `/go/*` and `/__scheduled` run in the Worker; everything else is a file or the SPA shell.
- `packages/shared`: the domain model both sides use: relationships, the ladder, XP rules, questions, modules, listings, commerce, finance.

## Run it locally

```bash
pnpm install
pnpm db:migrate:local      # creates or upgrades the local D1 database (migrations 0001 to 0010)
pnpm dev                   # web on http://localhost:5173, api on http://localhost:8787
```

- http://localhost:5173 is the live dev server with hot reload. It proxies `/api` and `/go` to the Worker.
- http://localhost:8787 is the Worker serving the last `pnpm build`. Use it to check the production bundle and the PWA.
- To test the cron locally, run the api with `wrangler dev --port 8787 --test-scheduled` and open `http://localhost:8787/__scheduled?cron=*+*+*+*+*`. The job posts post-purchase sequences and monthly finance entries and refreshes YouTube numbers.

Secrets go in `apps/api/.dev.vars` locally and `wrangler secret put` in production:

| Name | What it does |
| --- | --- |
| `ADMIN_KEY` | Opens `/admin` before the first admin account exists. |
| `YOUTUBE_API_KEY` | Reads view counts for YouTube links in Content and content rewards. Without it, numbers are typed and a reviewer confirms. |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN` | Turn on the Instagram comment webhook and private replies for Auto-DM. Without them, matched comments queue for you to send by hand. |
| `CLICK_SALT` | Salt for hashing click IPs on tracked links. |

## Deploy

```bash
pnpm --filter @kreators/api exec wrangler login
pnpm --filter @kreators/api exec wrangler d1 create kreators-life
# paste the printed database_id into apps/api/wrangler.jsonc
pnpm db:migrate
pnpm deploy
```

## Design source

Colors, type, radii and shadows come from the freud UI Kit v1.5 in Figma. The values are frozen in `design/figma-tokens.json`, so builds never call Figma. To re-pull, put a read-only Figma token in `.env` as `FIGMA_TOKEN` and run `python3 -I scripts/figma-pull.py . <fileKey> <nodeId> <outDir>` followed by `scripts/figma-sections.py`, then update the theme block in `apps/web/src/app.css` and the floor colors in `packages/shared/src/index.ts`.

Dark mode keeps the same hues and turns them inside out: the cream page becomes deep brown, cards become brown, pale tints become the deep end of their own family (pale purple turns deep purple, not grey). Everything is a CSS variable on `:root`; the theme switch (device, light, dark) sits on every page, including onboarding, and in the laptop sidebar.

On a phone the app is a single column with tabs along the bottom. On a laptop the tabs become a sidebar and each screen's sections flow into two columns. The public site is fully responsive on its own.

## Accounts and roles

Everyone starts with an anonymous device session. Under You, Account, a person can add an email and password; the tower on the device becomes that account. Signing in from a public page brings you straight back to it.

Three roles: Creator (`user`), Staff (`sub_admin`) and Admin. Staff hold permissions, each a job they are trusted with: talent (campaigns), cohorts (School), events (Party), finance (payouts), moderation, support, review (Club, rewards, tools, TV and Fund) and mentor (assignment feedback). Admins hold them all. Brands are organizations: whoever creates one owns it and adds teammates by email.

## Modules and feature switches

Every part of the app is a module in `MODULES` (`packages/shared`). People switch modules on and off under You, Features. Admins control each module with a global switch, a minimum role, a rollout percentage and overrides for one person, one role or one brand, with an optional expiry. The server resolves all of that into `access` on `/api/me`, so the client never guesses.

Learn and earn: School (programs, cohorts, lessons, assignments, mentor feedback, sessions, completion), Work (opportunities, one application each with the portfolio attached, status tracking), Army (brand campaigns: brief, scope, shortlist, approval, production, versions and feedback, usage rights), Win (content rewards).

People: Party (meetups anyone can host, staff events, RSVP, waitlist with promotion, check-in, feedback), Community, Club (curated membership with a reviewer queue), Bond (introductions that only share details after consent, with blocking).

Wellbeing: score, Mood, Sleep, Stress, Mindful minutes, Journal, Companion. Journal and wellbeing data never reach brands, staff, the leaderboard or Club selection.

Creator: Profile (handle, bio, skills, portfolio), Shop, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund.

Core: Today, Tower, Search, Inbox, Help (FAQ and support tickets), Rank, Rewards. Team: Manage (queues per permission), Admin.

## The public site

`/` is the site: no account needed. The seven characters walk along the bottom of the page as you scroll and whichever relationship is on screen takes the lead. Each floor lists the features that serve it. `/explore` searches every listing (content rewards, opportunities, events, programs, tools, public campaigns) with a sign-in button that returns you to the thing you picked. `/features/:key` is a page per module with the pitch, how it goes, which floors it serves and the live listings for it. `/c/:code` verifies a course certificate; `/i/:token` shows an invoice to a client.

Listings come from the admin console (Admin, Listings: create, publish, feature) and from the modules themselves (a published opportunity, a verified tool, a brand making its campaign public).

## Content rewards and view tracking

A reward has a brand, a brief, a platform, a pool of points, a rate per thousand verified views, a cap per creator and a minimum view count. Creators submit a public link. YouTube numbers are read automatically when a key is set; everything else is typed by the creator and confirmed by a reviewer, with the full metric history kept. Payout is computed from confirmed views, never exceeds the pool, and is released by someone with the finance permission. Rejections can be disputed.

## Shop and growth

Product kinds: download, course (drip, quizzes, certificates), membership, session (availability, intake questions, race-safe slots), event (replays for sale afterwards), link, payment link (fixed or pay what you want), bundle, locked post and priority DM (a paid question answered within promised days). Free downloads can capture leads. Coupons, affiliates at twenty percent, a platform fee in basis points per creator, refunds, a customers list with CSV export and a payout breakdown.

Content: every post gets a tracked link at `/go/<code>`; clicks carry an id into checkout so the dashboard shows clicks, sales and revenue per post, with profile-direct sales shown honestly. Auto-DM: a keyword on a post sends a tracked link by private reply (queued for you when Meta is not connected; a simulator exercises the flow). Funnels chain posts, automations, links, leads, products and broadcasts with the count at each step. Sequences deliver a message to a buyer's inbox some days after purchase.

## Finance

Money in and out with a category, who it was with, and optional splits (someone else's share of a payment, marked paid later). Dues track what people owe you and what you owe them, settle in one tap, and can repeat monthly. Recurring entries post on a day of the month. Budgets per expense category, goals (save up, or earn by a date), invoices with a public link that book the income when marked paid, and all-time totals next to the month. Points earned on the platform appear alongside.

## How the game works

A branching vibe check derives your ladders. Every day: check in, do the spark, tick a task. Tasks can carry a time and a length so Today shows the day's plan. Waits stop farming: ten minutes before a new task can be ticked, six rewarded ticks a day, server-checked dates, time-gated evolution. XP ripples up the ladder; points come from showing up and can be spent on rewards, products and tickets.

## Admin

`/admin` works with the admin key or an admin's session. People (search, role, permissions, Pro, honors, points, and a preview of exactly what one person sees), Flags (switch, minimum role, rollout, overrides), Listings, Redemptions and the Audit log of every change.
