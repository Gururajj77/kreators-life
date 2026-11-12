# kreators.app answer engine kit

One file with every piece needed for search engines and AI answer engines (ChatGPT, Claude, Perplexity, Gemini, Copilot) to read kreators.app and describe it truly.

## 1. How to use this file

1. Fill in the placeholders in the table below. Leave a business field out of any block when it is not set yet. Never make one up.
2. Copy the four files in part 4 into `apps/web/public/`. Read the note on `sitemap.xml` first, since the Worker serves that path today.
3. Add the JSON-LD blocks in part 5 and the head tags in part 6, the way part 8 describes.
4. Run the checks at the end of part 8. Then ask the engines the questions in part 7 once a month and keep a log.
5. When an app, a price, the FAQ or the invite switch changes, follow part 10.

### Placeholders

| Placeholder | What goes there | Where it comes from |
|---|---|---|
| `{{SITE_URL}}` | Production origin, `https://` and no trailing slash | Worker variable `PUBLIC_URL` (documented as `https://kreators.app`; confirm it is set in the Cloudflare dashboard) |
| `{{BUSINESS_NAME}}` | Legal name of the business that runs kreators.app | `GET /api/public/business` → `business.name` |
| `{{BUSINESS_ADDRESS}}` | Its address | `GET /api/public/business` → `business.address` |
| `{{BUSINESS_EMAIL}}` | Its contact email | `GET /api/public/business` → `business.email`. While it is empty, leave the key out. Do not fill it with the site's fallback address, which is only for the site's own pages. |
| `{{BUSINESS_REGISTRATION}}` | Registration number | `GET /api/public/business` → `business.registration` |
| `{{BUSINESS_TAX_ID}}` | Tax number | `GET /api/public/business` → `business.vat` |
| `{{GRIEVANCE_NAME}}` / `{{GRIEVANCE_EMAIL}}` / `{{GRIEVANCE_PHONE}}` | Grievance Officer for India | `GET /api/public/business` → `business.grievanceName`, `business.grievanceEmail`, `business.grievancePhone` |
| `{{LOGO_URL}}` | Absolute URL of a square logo | A file already in `apps/web/public/` (`icon*.png` or `apple-touch-icon.png`) |
| `{{BOOK_COVER_1}}` to `{{BOOK_COVER_3}}` | Absolute URL of each book cover | `BOOKS[n].cover` in `packages/shared/src/books.ts` (files in `public/books/`) |
| `{{INVITE_ONLY}}` | Whether joining is by invite right now | `GET /api/public/join` → `inviteOnly` |
| `{{EVENT_…}}` | One public event's fields | `GET /api/public/events/:id` (see the Event block in part 5) |

The rule for every business field: an empty one is shown on the site as "not set yet". In structured data, leave the key out.

---

## Status (2026-11-12)

What is built, in the repo, not yet deployed:

| Part | Built | Where |
|---|---|---|
| One source of words | Every public page's title, description, opening and H1; the canonical answer; `SITE_FAQ`, `INVITE_FAQ`, `siteFaq`; the JSON-LD builders; `siteUrl`, `escapeHtml`, `jsonForHtml`. Words that depend on a switch (`PAYMENTS_LIVE`, a book's points in `REWARDS`) are built from it. | `packages/shared/src/siteMeta.ts` (`@kreators/shared/siteMeta`, chunk `shared-site-meta`), tested in `siteMeta.test.ts` |
| Part 4: robots.txt, llms.txt, llms-full.txt | Generated into `apps/web/dist` at build time from the same data, with the origin from `SITE_URL` (else https://kreators.app). The two robots groups as written; training crawlers allowed. | `scripts/seo/build-static.mjs`, run by `apps/web/package.json`'s build |
| Part 4: sitemap | One urlset on `PUBLIC_URL`: the stable pages, each upcoming public event with `lastmod`, and live members' switched-on pages with a live product. One D1 round trip. Not the sitemap index of option A. | `apps/api/src/routes/go.ts`, `apps/api/src/sitemap.ts` |
| Part 5: JSON-LD | `/`: Organization (business fields only from the Worker variables, left out when empty), WebSite, WebApplication, FAQPage. `/features`: ItemList and BreadcrumbList. A feature page: BreadcrumbList. `/features/books`: the three books. `/pricing`: WebApplication with a names-only Organization. `/events`: BreadcrumbList and ItemList. `/events/:id`: Event (left out for an event in person with no place typed) and BreadcrumbList. Other pages: none. | `build-static.mjs`, `go.ts` |
| Part 6: head tags | 54 stable pages as HTML at build time (title, description, absolute og tags, canonical, JSON-LD, a `<noscript>` of the page's words). The Worker writes the head of `/`, `/events` and `/events/:id` (a minute in the edge cache; a 503 with Retry-After over the shell when D1 fails; noindex off the production host). The client sets the title, description and a canonical on the production origin (`__SITE_URL__`) as people browse, and puts the shell's words back when a site page leaves. | `build-static.mjs`, `go.ts`, `apps/web/src/lib/usePageMeta.ts`, `apps/web/vite.config.ts` |
| Part 8: client and smoke | Manifest description fixed, the service worker's fallback denylist widened, FocusRounds keeps a page's new title, `/u/<handle>` names its own canonical and title. Smoke section "Search and answer engines". | `vite.config.ts`, `FocusRounds.tsx`, `screens/Public.tsx`, `scripts/smoke/smoke.mjs` |

Pending:

- **Deploy**, then the part 8 checklist against the live domain (curl as GPTBot, ClaudeBot and PerplexityBot; the Rich Results Test and validator.schema.org; Search Console and Bing Webmaster Tools). Step 3 of that checklist describes option A; the sitemap here is one urlset, so check that `/sitemap.xml` lists every URL instead.
- **`PUBLIC_URL`** confirmed in the Cloudflare dashboard, and `SITE_URL` set in the build when the domain is not https://kreators.app.
- **The workers.dev copy** (the founder's deploy choice): the Worker's pages there say noindex, but the static pages do not reach the Worker, so they rely on their canonical. Set `"workers_dev": false` in `apps/api/wrangler.jsonc` once the custom domain serves the site.
- **Business details** (`BUSINESS_*` Worker variables): until set, the Organization block carries names and addresses only.
- **The invite question on `/`'s FAQPage**: the home shows it while Invite only is on, but the Worker's FAQPage, written without a D1 read, never carries it; llms-full.txt says joining "may be" by invite.
- **Unknown URLs** still answer 200 with the shell (soft 404), as before.
- **Part 7**: asking the engines the question bank once a month and keeping the log, after the deploy.

## 2. What is in place, and what is missing

| Asset | Today | Gap |
|---|---|---|
| `<title>` | "kreators.app" on every URL | No title for each page |
| Meta description | The home page's line on every URL | No description for each page |
| `og:url`, `og:image` | Relative; made absolute only on `/` | Every other page's share card points to `/` |
| Canonical | None | Missing everywhere |
| Body for a crawler without JavaScript | `<div id="root"></div>`, empty | GPTBot, ClaudeBot, PerplexityBot and most link previews see no words at all |
| `robots.txt` | Missing; the path answers 200 with the app shell | Crawlers get HTML where they expect rules |
| `llms.txt`, `llms-full.txt` | Missing; same app shell | Nothing for a model to read in one go |
| `sitemap.xml` | Built by the Worker | Lists the dead `/features/observability`; misses `/features/books`, `/features`, `/7rp`, `/events`, each event, `/subprocessors`, `/copyright`, `/licences`; uses the request's host, not `PUBLIC_URL`; no `lastmod`; lists `/u/<handle>` pages whose owners switched them off |
| Structured data (JSON-LD) | None | No Organization, WebSite, app, FAQ, book or event data |
| Unknown URLs | Answer 200, then the app sends the browser to `/` | Soft 404s everywhere |
| Web manifest | Description says "Seven areas" | Should say seven relationships |
| `workers.dev` host | Probably live, not marked noindex | A second copy of the site for crawlers |

**Why this matters for answer engines.** kreators.app is a client-rendered app. Most AI crawlers do not run JavaScript, so today they read one title, one description and an empty page for the 56 stable public URLs, and for every event, public page and product page. With no robots, sitemap, `llms.txt` or structured data, an engine has nothing to quote. It will guess, or it will skip the product. The fix is to put the true words in the raw HTML and in plain text files.

---

## 3. The canonical answer

Use these words, unchanged, wherever a short definition is needed.

**One sentence (under 25 words)**

> kreators.app is a free-to-start web app: a daily game for the seven relationships of a life, with a creator's tools built in.

**Answer paragraph (40 to 60 words)**

> kreators.app is a web app that turns the seven relationships of a life into a daily game. Each day you check in, do one small act and tick one task. Courses, paid work, brand campaigns, client work, a shop and money tools are switches you turn on. It is free to start and free to stay.

**About paragraph (about 120 words)**

> kreators.app helps creators, freelancers, founders and students grow their work without losing their life. It sees your work as one of seven relationships: servitude, friends, family, love, yourself, teachers and faith. Each relationship is a pillar with its own guide, and each pillar is a pyramid from a foundation down to today's task. The daily ask is three moves: check in, do one small act, tick one task. Around it sit 42 apps, each one a switch, from School and Agency to Journal, Circles and the Shop. Only a few are on to start. It runs in the browser on a phone or laptop, India first, for people 18 or over. It is free to start and free to stay.

### Facts table

| Fact | Value |
|---|---|
| Name | kreators.app (always lowercase, with the dot) |
| What it is | A daily game for the seven relationships that make a life, with the tools a creator needs built in |
| Line | Grow your work without losing your life |
| Touchstone | One small act a day, for all seven. Free to start, free to stay. |
| For whom | Anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students. The seven relationships are for everyone. |
| The seven relationships | Servitude, friends, family, love, yourself, teachers, faith |
| The five areas of life | Physical, financial, mental, emotional, spiritual (always in this order) |
| Apps | 42 public apps in five groups, each one a switch |
| Pricing model | Free to start and free to stay. The Shop takes 5% of each sale. Typing to the assistant needs a plan from ₹1,499 for 30 days (not on sale yet). An optional live call with a coach costs ₹10,000 (not on sale yet). Brand campaigns are priced per brief. |
| Payments | Points work today. Money checkout runs in test mode until payments are switched on. Prices are in Indian rupees, with GST shown before you pay. |
| Where based | Built in India by BrandingBum. India first: rupees, `en-IN`, India time by default, Indian phone numbers, GST, the DPDP Act 2023. Legal name and address: `{{BUSINESS_NAME}}`, `{{BUSINESS_ADDRESS}}`. |
| Age rule | 18 or over. Sign-up asks for a phone number and a date of birth, and neither is shown to anyone else. |
| Joining | May be by invite. While Invite only is on, a new account needs an invite code or a place from the waitlist. Neither costs anything. |
| Platforms | Web app in the browser on phone or laptop, installable as a PWA. Nothing to install from a store. |
| Founder | Shubham Aggarwal, who wrote the three books the app draws on |

---

## 4. Copy-paste files

### `apps/web/public/robots.txt`

Replace `{{SITE_URL}}` before you commit; robots.txt is served as is. A crawler obeys only the one group that names it, so each group repeats the same `Disallow` lines.

```text
# robots.txt for kreators.app
# Replace {{SITE_URL}} with the production origin before committing.
# A crawler follows only the group that names it, else the * group,
# so each group repeats the same Disallow lines.

# Group 1: model training crawlers and training tokens.
# Allowed as written. This is the founder's choice:
# to opt out of training, change "Allow: /" to "Disallow: /" here.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /
Disallow: /api/
Allow: /api/public/
Disallow: /api/public/agency/
Disallow: /api/public/contracts/
Disallow: /api/public/invoices/
Disallow: /api/public/team-link/
Disallow: /api/public/calendar/
Disallow: /api/public/coach-join/
Disallow: /api/public/invite/
Disallow: /api/public/unsubscribe/
Disallow: /api/public/waitlist
Disallow: /go/
Disallow: /out/
Disallow: /a/
Disallow: /i/
Disallow: /k/
Disallow: /d/
Disallow: /t/
Disallow: /c/
Disallow: /unsubscribe/
Disallow: /join/
Disallow: /coach/join/
Disallow: /signin
Disallow: /signup
Disallow: /forgot
Disallow: /onboarding
Disallow: /session
Disallow: /vibe-check
Disallow: /home
Disallow: /today
Disallow: /tower
Disallow: /you
Disallow: /inbox
Disallow: /insights
Disallow: /plans
Disallow: /rewards
Disallow: /library
Disallow: /manage
Disallow: /admin
Disallow: /internal/
Disallow: /leaderboard
Disallow: /help
Disallow: /school
Disallow: /work
Disallow: /army
Disallow: /win
Disallow: /agency
Disallow: /community
Disallow: /run
Disallow: /club
Disallow: /party
Disallow: /bond
Disallow: /circles
Disallow: /cards
Disallow: /life
Disallow: /journal
Disallow: /reviews
Disallow: /mindful
Disallow: /fitness
Disallow: /wellbeing
Disallow: /mood
Disallow: /sleep
Disallow: /stress
Disallow: /coaching
Disallow: /companion
Disallow: /discover
Disallow: /shop
Disallow: /profile
Disallow: /finance
Disallow: /fund
Disallow: /tv
Disallow: /knowledge
Disallow: /tools
Disallow: /store
Disallow: /apps
Disallow: /search
Disallow: /time-blocks
Disallow: /realm/
Disallow: /resources$
Disallow: /studio
Disallow: /book$
Disallow: /*?add=

# Group 2: search and answer engines, and everyone else.
User-agent: Googlebot
User-agent: Bingbot
User-agent: Applebot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: *
Allow: /
Disallow: /api/
Allow: /api/public/
Disallow: /api/public/agency/
Disallow: /api/public/contracts/
Disallow: /api/public/invoices/
Disallow: /api/public/team-link/
Disallow: /api/public/calendar/
Disallow: /api/public/coach-join/
Disallow: /api/public/invite/
Disallow: /api/public/unsubscribe/
Disallow: /api/public/waitlist
Disallow: /go/
Disallow: /out/
Disallow: /a/
Disallow: /i/
Disallow: /k/
Disallow: /d/
Disallow: /t/
Disallow: /c/
Disallow: /unsubscribe/
Disallow: /join/
Disallow: /coach/join/
Disallow: /signin
Disallow: /signup
Disallow: /forgot
Disallow: /onboarding
Disallow: /session
Disallow: /vibe-check
Disallow: /home
Disallow: /today
Disallow: /tower
Disallow: /you
Disallow: /inbox
Disallow: /insights
Disallow: /plans
Disallow: /rewards
Disallow: /library
Disallow: /manage
Disallow: /admin
Disallow: /internal/
Disallow: /leaderboard
Disallow: /help
Disallow: /school
Disallow: /work
Disallow: /army
Disallow: /win
Disallow: /agency
Disallow: /community
Disallow: /run
Disallow: /club
Disallow: /party
Disallow: /bond
Disallow: /circles
Disallow: /cards
Disallow: /life
Disallow: /journal
Disallow: /reviews
Disallow: /mindful
Disallow: /fitness
Disallow: /wellbeing
Disallow: /mood
Disallow: /sleep
Disallow: /stress
Disallow: /coaching
Disallow: /companion
Disallow: /discover
Disallow: /shop
Disallow: /profile
Disallow: /finance
Disallow: /fund
Disallow: /tv
Disallow: /knowledge
Disallow: /tools
Disallow: /store
Disallow: /apps
Disallow: /search
Disallow: /time-blocks
Disallow: /realm/
Disallow: /resources$
Disallow: /studio
Disallow: /book$
Disallow: /*?add=

Sitemap: {{SITE_URL}}/sitemap.xml
```

Notes:
- Public pages stay open: `/`, `/features`, `/features/*`, `/7rp`, `/explore`, `/events`, `/events/*`, the policy pages, `/start`, `/u/*`, `/people/*`, `/p/*`, and the static files (`/assets/`, `/fonts/`, `/books/`, `/app-art/`).
- `Disallow: /book$` closes the signed-in book page only; the covers under `/books/` stay open. `Disallow: /resources$` closes only the old redirect, so the lesson files under `/resources/` stay open.
- `Allow: /api/public/` lets a crawler fetch what the public pages render from (a page's words, Explore, events and uploaded pictures under `/api/public/media/`). Google and Bing take the longest matching rule, so the token APIs listed after it stay closed.
- `Disallow: /*?add=` keeps a friend-code QR link (`/u/<handle>?add=<code>`) out, since the code is a live key.
- `/c/` holds certificate pages. Delete that line if you want certificates found.
- A `Disallow` stops crawling, not indexing. A disallowed URL that is linked from elsewhere can still be listed by its address alone, and a crawler never sees a noindex on it. That is acceptable here, because these paths serve the same empty app shell and their data needs a session or a token. If a URL must never be listed, take it out of robots.txt and send `X-Robots-Tag: noindex` for it instead.

### `apps/web/public/sitemap.xml`

The Worker answers `/sitemap.xml` today (`GO_PATHS` in `apps/api/src/index.ts` and `run_worker_first` in `wrangler.jsonc`), so a static file at that path is never served. Pick one:

- **A (recommended).** Save this file as `apps/web/public/sitemap-pages.xml`. Make the Worker's `/sitemap.xml` a sitemap index that points to `sitemap-pages.xml` and to a Worker-built `sitemap-events.xml` (upcoming public events and `/u/<handle>` pages that are switched on). The Worker sees `/sitemap-events.xml` only once it is in `GO_PATHS` and `run_worker_first` (part 8); otherwise the app shell answers it with 200. Both names pass `blockedPath` today; check again after any change to it.
- **B.** Take `/sitemap.xml` out of `GO_PATHS` and `run_worker_first`, and serve this file as is. Events and public pages then go unlisted.

No private or token routes are listed. Add `<lastmod>` with a real `YYYY-MM-DD` date when you have one.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{{SITE_URL}}/</loc></url>
  <url><loc>{{SITE_URL}}/features</loc></url>
  <url><loc>{{SITE_URL}}/7rp</loc></url>
  <url><loc>{{SITE_URL}}/explore</loc></url>
  <url><loc>{{SITE_URL}}/events</loc></url>
  <url><loc>{{SITE_URL}}/pricing</loc></url>
  <url><loc>{{SITE_URL}}/features/books</loc></url>
  <url><loc>{{SITE_URL}}/features/school</loc></url>
  <url><loc>{{SITE_URL}}/features/work</loc></url>
  <url><loc>{{SITE_URL}}/features/army</loc></url>
  <url><loc>{{SITE_URL}}/features/win</loc></url>
  <url><loc>{{SITE_URL}}/features/agency</loc></url>
  <url><loc>{{SITE_URL}}/features/life</loc></url>
  <url><loc>{{SITE_URL}}/features/journal</loc></url>
  <url><loc>{{SITE_URL}}/features/reviews</loc></url>
  <url><loc>{{SITE_URL}}/features/mindful</loc></url>
  <url><loc>{{SITE_URL}}/features/fitness</loc></url>
  <url><loc>{{SITE_URL}}/features/wellbeing</loc></url>
  <url><loc>{{SITE_URL}}/features/mood</loc></url>
  <url><loc>{{SITE_URL}}/features/sleep</loc></url>
  <url><loc>{{SITE_URL}}/features/stress</loc></url>
  <url><loc>{{SITE_URL}}/features/coaching</loc></url>
  <url><loc>{{SITE_URL}}/features/companion</loc></url>
  <url><loc>{{SITE_URL}}/features/discover</loc></url>
  <url><loc>{{SITE_URL}}/features/community</loc></url>
  <url><loc>{{SITE_URL}}/features/run</loc></url>
  <url><loc>{{SITE_URL}}/features/club</loc></url>
  <url><loc>{{SITE_URL}}/features/party</loc></url>
  <url><loc>{{SITE_URL}}/features/bond</loc></url>
  <url><loc>{{SITE_URL}}/features/circles</loc></url>
  <url><loc>{{SITE_URL}}/features/cards</loc></url>
  <url><loc>{{SITE_URL}}/features/shop</loc></url>
  <url><loc>{{SITE_URL}}/features/profile</loc></url>
  <url><loc>{{SITE_URL}}/features/content</loc></url>
  <url><loc>{{SITE_URL}}/features/audience</loc></url>
  <url><loc>{{SITE_URL}}/features/automations</loc></url>
  <url><loc>{{SITE_URL}}/features/finance</loc></url>
  <url><loc>{{SITE_URL}}/features/fund</loc></url>
  <url><loc>{{SITE_URL}}/features/tv</loc></url>
  <url><loc>{{SITE_URL}}/features/knowledge</loc></url>
  <url><loc>{{SITE_URL}}/features/tools</loc></url>
  <url><loc>{{SITE_URL}}/features/store</loc></url>
  <url><loc>{{SITE_URL}}/features/library</loc></url>
  <url><loc>{{SITE_URL}}/features/home</loc></url>
  <url><loc>{{SITE_URL}}/features/today</loc></url>
  <url><loc>{{SITE_URL}}/features/tower</loc></url>
  <url><loc>{{SITE_URL}}/features/leaderboard</loc></url>
  <url><loc>{{SITE_URL}}/features/help</loc></url>
  <url><loc>{{SITE_URL}}/features/assistant</loc></url>
  <url><loc>{{SITE_URL}}/terms</loc></url>
  <url><loc>{{SITE_URL}}/privacy</loc></url>
  <url><loc>{{SITE_URL}}/refunds</loc></url>
  <url><loc>{{SITE_URL}}/contact</loc></url>
  <url><loc>{{SITE_URL}}/subprocessors</loc></url>
  <url><loc>{{SITE_URL}}/copyright</loc></url>
  <url><loc>{{SITE_URL}}/licences</loc></url>
</urlset>
```

### `apps/web/public/llms.txt`

Follows the llmstxt.org format: an H1, a blockquote summary, then sections of links with one-line notes. Replace `{{SITE_URL}}` before you commit.

```markdown
# kreators.app

> kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay. It runs in the browser on a phone or laptop, India first, for people 18 or over.

Key facts:

- The seven relationships, each a pillar with its own guide: servitude, friends, family, love, yourself, teachers, faith.
- The five areas of life, in order: physical, financial, mental, emotional, spiritual.
- The daily ask: check in, do one small act, tick one task.
- 42 apps in five groups, each one a switch. Only a few are on to start.
- Free to start and free to stay. The Shop takes 5% of each sale. Typing to the assistant needs a plan from ₹1,499 for 30 days, not on sale yet.
- Points work today. Money checkout runs in test mode until payments are switched on.
- Joining may be by invite: while Invite only is on, a new account needs a code or a place from the waitlist.
- Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.

## Start here

- [Home]({{SITE_URL}}/): The story, the five villains, how each is beaten, the offer and the FAQ.
- [Features]({{SITE_URL}}/features): Every app by group, one page each.
- [7RP: the seven relationships]({{SITE_URL}}/7rp): Each pillar, its guide and the apps that serve it; also the five areas of life.
- [Pricing]({{SITE_URL}}/pricing): What is free and the three things that cost money.
- [Events]({{SITE_URL}}/events): Public meetups, workshops and days you can join.
- [Explore]({{SITE_URL}}/explore): Search content rewards, opportunities, events, programs, tools, campaigns and circles.
- [Books]({{SITE_URL}}/features/books): Three books by the founder, Shubham Aggarwal, each with a course.
- [Full text for models]({{SITE_URL}}/llms-full.txt): Everything on this list in one plain-text file.

## Apps: Contribution

- [School]({{SITE_URL}}/features/school): Learn with a cohort, not alone.
- [Work]({{SITE_URL}}/features/work): Opportunities that fit your skills.
- [Army]({{SITE_URL}}/features/army): Campaigns, run properly.
- [Win]({{SITE_URL}}/features/win): Get paid for views that are real.
- [Agency]({{SITE_URL}}/features/agency): Run clients like a studio.

## Apps: Reflection

- [Life]({{SITE_URL}}/features/life): Five areas, one picture.
- [Journal]({{SITE_URL}}/features/journal): Write it down.
- [Reviews]({{SITE_URL}}/features/reviews): Look back, from a day to a year.
- [Mindfulness]({{SITE_URL}}/features/mindful): Breathe, focus, and see how it went.
- [Fitness]({{SITE_URL}}/features/fitness): Move, eat, and see the week.
- [Wellbeing]({{SITE_URL}}/features/wellbeing): One score, four signals.
- [Mood]({{SITE_URL}}/features/mood): How are you, really?
- [Sleep]({{SITE_URL}}/features/sleep): Hours and quality.
- [Stress]({{SITE_URL}}/features/stress): Level, and what is behind it.
- [Coaching]({{SITE_URL}}/features/coaching): A life coach in your corner.
- [Companion]({{SITE_URL}}/features/companion): A chat that knows how you are doing.
- [Discover]({{SITE_URL}}/features/discover): Find out what you are good at.

## Apps: Connection

- [Community]({{SITE_URL}}/features/community): A kind room to ask and share.
- [Kreators Run]({{SITE_URL}}/features/run): Run with people, not past them.
- [Club]({{SITE_URL}}/features/club): A curated circle.
- [Party]({{SITE_URL}}/features/party): Meet the people behind the handles.
- [Bond]({{SITE_URL}}/features/bond): Introductions, with consent.
- [Circles]({{SITE_URL}}/features/circles): Five strangers who fit. One table.
- [Games]({{SITE_URL}}/features/cards): Games for the people you are with.

## Apps: Creation

- [Shop]({{SITE_URL}}/features/shop): Sell what you make.
- [Public page]({{SITE_URL}}/features/profile): One page for everything you are.
- [Content]({{SITE_URL}}/features/content): Find the posts that sell.
- [Audience]({{SITE_URL}}/features/audience): Know the people who want more.
- [Auto-DM]({{SITE_URL}}/features/automations): Comment a word, get the link.
- [Finance]({{SITE_URL}}/features/finance): See your money clearly.
- [Fund]({{SITE_URL}}/features/fund): Backing for a project.
- [TV]({{SITE_URL}}/features/tv): Pitch a series.
- [Knowledge]({{SITE_URL}}/features/knowledge): Articles and exercises, with sources.
- [Tools]({{SITE_URL}}/features/tools): Tools creators actually use.
- [Store]({{SITE_URL}}/features/store): Gear for creators, new and pre-owned.
- [My purchases]({{SITE_URL}}/features/library): Everything you own, in one place.

## Apps: Essentials

- [Home]({{SITE_URL}}/features/home): Your numbers, your day, and a door into everything.
- [Daily]({{SITE_URL}}/features/today): Three small boxes. One better day.
- [Pillars]({{SITE_URL}}/features/tower): Seven pillars, one life.
- [Leaderboard]({{SITE_URL}}/features/leaderboard): Climb on effort, not followers.
- [Help]({{SITE_URL}}/features/help): Answers, and a line to the team.
- [Assistant]({{SITE_URL}}/features/assistant): Say what you did. It is done.

## Policies

- [Terms of use]({{SITE_URL}}/terms): Plain-language terms, 18 or over, what points are.
- [Privacy]({{SITE_URL}}/privacy): What is kept and why, rights under India's DPDP Act 2023, and EU and UK rights.
- [Refunds]({{SITE_URL}}/refunds): Money goes back the way you paid, through Razorpay.
- [Contact]({{SITE_URL}}/contact): The team, and the Grievance Officer for India.
- [Subprocessors]({{SITE_URL}}/subprocessors): Companies that handle personal data, what they do and where.

## Optional

- [Copyright]({{SITE_URL}}/copyright): Send a notice or a counter-notice.
- [Licences]({{SITE_URL}}/licences): The open-source parts the app is built on.
```

### `apps/web/public/llms-full.txt`

The whole explainer in plain text. Replace the placeholders before you commit. Keep the invite paragraph only while `{{INVITE_ONLY}}` is on.

```markdown
# kreators.app: the full explainer

Site: {{SITE_URL}}
Short file: {{SITE_URL}}/llms.txt

## What it is

kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. Its line is "Grow your work without losing your life." Its touchstone is "One small act a day, for all seven. Free to start, free to stay."

Your work is one of seven relationships. kreators.app is a daily game that keeps all seven moving. Let one relationship slide and the others feel it. Keep all seven moving and the work gets better too.

- Who: anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students. The seven relationships are for everyone, and the creator apps stay off until you want them.
- When: a few minutes a day, and a short look back each week and month.
- Where: on your phone or laptop, in the browser. Nothing to install.
- Built in India by BrandingBum. India first: prices in Indian rupees, GST shown before you pay, Indian phone numbers by default.

## How it starts

1. A short chat. Answer a few questions. It shows the apps that fit, and nothing else.
2. Your pillars. A short session maps your seven and builds a pyramid for the ones that need you most.
3. Three boxes a day. Check in, do one small act, tick one task. Every tick climbs your pyramid to the reason you started.

Each day: a tick. On Sunday: your first week review. Each month: a look back with the numbers next to the month before.

## The seven relationships (pillars) and their guides

Each relationship is a pillar of your life, and each pillar is a pyramid. Tick a task and the whole pyramid grows. Its layers, top to bottom: a foundation you will not let break, a guiding principle you live by, a value goal for how you want to feel, a goal outcome you would see when it is real, a project, and tasks at the tip. Give a project a due day and it shows its pace: on track, slipping or behind.

1. Servitude. Guide: Ember, guide to servitude. "I'm Ember. I look after the people who count on you." Daily question: Who did you serve today?
2. Friends. Guide: Pip, guide to friends. "I'm Pip. Two lobes, one heart. Who's in your corner?" Daily question: Who did you show up for?
3. Family. Guide: Sunny, guide to family. "I'm Sunny. I carry the little one on my shoulder. Family first, everything else second." Daily question: Did family hear from you?
4. Love. Guide: Clover, guide to love. "I'm Clover. Love is a daily act, not a yearly highlight." Daily question: Was there phone-free time?
5. Yourself. Guide: Dew, guide to yourself. "I'm Dew. One drop, very clear. How are you really?" Daily question: Did you rest, move, breathe?
6. Teachers. Guide: Sage, guide to teachers. "I'm Sage. Everyone you admire had a teacher. Who's yours?" Daily question: What did you learn on purpose?
7. Faith. Guide: Lumen, guide to faith. "I'm Lumen. Something bigger than the daily rush is watching over you." Daily question: Did you pause for awe?

The app's own guide is Bumling, guide to the app. The seven relationships come from Shubham Aggarwal's book The Relationship Method.

## The five areas of life

Always in this order, since each one holds up the next:

1. Physical: sleep, movement, breath and eating.
2. Financial: what comes in, what goes out, where you are heading.
3. Mental: stress, focus, and what you are learning.
4. Emotional: mood, what you wrote, and the people close to you.
5. Spiritual: stillness, awe, teachers and faith.

The Life app scores each one from what you already log. Only you see them.

## The problem it answers: five villains

- The Grind: one more video, one more hour. It takes your sleep first. Beaten by a routine built from your real day, a daily brief, and focus sessions with breaks (Daily, Life, Sleep, Mindfulness).
- The Scatter: ten apps, ten logins, and nothing talks to anything. Beaten by one place and one login for learning, paid work, campaigns, clients, your shop and your money (Agency, School, Work, Shop, Finance).
- The Silence: you work alone. Beaten by small circles, run clubs, events, a kind community, and a life coach if you want one (Circles, Kreators Run, Party, Community, Games, Coaching).
- The Drift: goals sit in a note you never open. Beaten by seven pillars, Plan my week, weekly and monthly reviews, and a strengths quiz (Pillars, Discover, Reviews, Journal).
- The Squeeze: money comes late, or not at all. Beaten by paid gigs and campaigns, Win's pay per verified view, your own shop at 5% of a sale, and Agency invoices with GST and TDS worked out (Army, Agency, Shop, Win, Finance).

## The apps

42 apps in five groups. Each one is a switch. Only a few are on to start. The setup chat shows up to five that fit what you tell it and hides the rest. Showing or hiding an app is one tap, and nothing is deleted.

### Contribution

- School: Learn with a cohort, not alone. Programs with lessons, assignments and a mentor who reads your work. You finish when a mentor says your work meets the bar, not when a timer runs out. Your first course, Onboarding into kreators.app, is free and always open. Three courses come from Shubham Aggarwal's books. Each cohort has its own discussion; you stay private unless you choose to show your @username.
- Work: Opportunities that fit your skills. Brands and the team post gigs, campaigns, roles and collabs. Apply once with your portfolio attached, then follow every step in one place.
- Army: Campaigns, run properly. A brand's campaign from brief to approved work, with every version and its feedback in one thread. Usage rights and exclusivity are written down before anyone shoots.
- Win: Get paid for views that are real. A brand funds a pool and sets a rate per thousand verified views. No follower count needed. Once the views are checked and a reviewer confirms, points land in your balance.
- Agency: Run clients like a studio. For a content agency or a freelance creator. Each client has a dashboard: what is waiting, what is coming, what went live. Move deliverables from idea to published, log your time, design invoices with a calculator for GST and TDS, and write agreements from templates. A client's page never shows your fees or your private notes. Switched off until you want it.

### Reflection

- Life: Five areas, one picture. Physical, financial, mental, emotional and spiritual, each scored from what you already log. See your life by day, week, month, quarter, half year or year. Emerging points out what goes together in what you log; it never says one thing caused another.
- Journal: Write it down. Entries with an emotion and a stress level. Gratitude for today: three short lines, each under a prompt. Prompt me gives a question from sixteen categories. Nobody else sees it: not brands, not staff, not the leaderboard.
- Reviews: Look back, from a day to a year. See the numbers from every app for the period you pick, next to the one before. Then answer a few questions and keep one line. Each built-in question says the idea it comes from, such as CBT, ACT or the Gita.
- Mindfulness: Breathe, focus, and see how it went. A breathing timer, and focus sessions with breaks: work for 25 minutes, rest for five, and take a longer break after four. Background sounds are made in your browser.
- Fitness: Move, eat, and see the week. Log a run, a walk or a workout, and tick your meals once a day. Add up protein against a goal you set. No sizes, no calories, and your weight is never saved. It pays nothing, so the numbers stay honest.
- Wellbeing: One score, four signals. Mood, sleep, stress and mindful minutes roll into one number you can watch week by week.
- Mood: How are you, really? Pick a face and see the week.
- Sleep: Hours and quality. Log last night in a few seconds.
- Stress: Level, and what is behind it. Name the stress and the cause.
- Coaching: A life coach in your corner. Life coaches the team chose. You pick what they see, never your journal. Every step they take is in a change log you both read.
- Companion: A chat that knows how you are doing. It reflects and asks questions back. It is not a therapist and never pretends to be one.
- Discover: Find out what you are good at. A quiz that gives your top three strengths across the seven relationships, a read on five personality traits and on your reasoning. It is not an IQ test. Add-ons: emotional intelligence, 16 personality types (MBTI-style, not the official MBTI), love languages, how your mind works (signs, never a diagnosis), Human design and numerology (for reflection, not science).

### Connection

- Community: A kind room to ask and share. Each topic has its own room, and guides keep it calm. Post under your name or a made-up one.
- Kreators Run: Run with people, not past them. Run clubs anyone can start. Every run has a start code the host shows at the line: enter it and your run is logged once.
- Club: A curated circle. Apply once. Approved members get club-only events, first look at opportunities, a named manager and an honor on their profile.
- Party: Meet the people behind the handles. Meetups anyone can host, plus workshops and parties from the team. RSVP, join a waitlist and check in at the door.
- Bond: Introductions, with consent. Contact details move only after the other person says yes. Block anyone, any time.
- Circles: Five strangers who fit. One table. Circles run every week in your city. Two days before, you are seated at a table of people nearby whose interests complement yours. Everyone has an alias.
- Games: Games for the people you are with. Nine card games for dating, family, friends and teams, work, and a quiet look at your hidden self. Unlock a game once with points, then play it on screen.

### Creation

- Shop: Sell what you make. Downloads, courses, memberships, sessions, events, payment links, bundles, locked posts and paid questions. Coupons, affiliates and refunds included. The Shop takes 5% of each sale, nothing up front.
- Public page: One page for everything you are. Bio, skills, portfolio, links and everything you sell, at your own address.
- Content: Find the posts that sell. Every post gets a tracked link, and the dashboard shows clicks, sales and revenue per piece.
- Audience: Know the people who want more. Followers, leads, broadcasts, and an affiliate link that pays twenty percent.
- Auto-DM: Comment a word, get the link. Sends a tracked link to anyone who comments the word on your post.
- Finance: See your money clearly. Money in, money out, by category and by month. Yours alone to see.
- Fund: Backing for a project. Apply for a grant or backing and see each stage: submitted, review, diligence, decision.
- TV: Pitch a series. Submit a pitch and a budget, then follow it from review to diligence to release.
- Knowledge: Articles and exercises, with sources. Curated reading on the seven relationships, written by the team and always attributed.
- Tools: Tools creators actually use. A directory verified by the team. Suggest your own.
- Store: Gear for creators, new and pre-owned. New gear through partner links (kreators.app may earn a share, and every card says so), and pre-owned gear with offers and a chat built in.
- My purchases: Everything you own, in one place.

### Essentials

- Home: Your numbers, your day, and a door into everything. Opens with a short brief: three signals and three next steps, worked out by plain rules, not an AI.
- Daily: Three small boxes. One better day. Check in, do one small act, tick one task. Every tick pays xp, and the check-in pays points. Tasks have a do date, an optional due date, a priority from P0 to P3, repeats and reminders. Plan my week gives a day to each task that has none.
- Pillars: Seven pillars, one life. Each relationship is a pyramid you build in a short session.
- Leaderboard: Climb on effort, not followers. Opt in to rank on xp, streaks and badges. Never follower counts, and never your journal or your wellbeing.
- Help: Answers, and a line to the team.
- Assistant: Say what you did. It is done. Bumling sits at the corner of every screen. Tapping is free. Typing needs a plan. It asks before it removes anything, and you can undo with one tap.

## Pricing

- Play: free. The daily game, your seven pillars and every app you switch on, Agency included.
- Sell: 5% of each sale in the Shop, with nothing up front. Refer a creator and earn 20% of their referred sales.
- Assistant: typing to it needs a plan. Pro ₹1,499, Pro Max ₹12,499, Ultra ₹49,999, each for 30 days. Tapping its ready-made choices stays free. Plans do not renew by themselves. Plans are not on sale yet.
- Live call: an optional live call with a coach costs ₹10,000. It is not on sale yet.
- Brands: campaigns and content-reward pools are priced per brief.
- Agency: we take nothing from the invoices you make.
- Prices are in Indian rupees. GST is added where it applies and shown before you pay.
- Points are earned by showing up and spent inside kreators.app. They are not money and cannot be cashed out.
- Money checkout runs in test mode until payments are switched on. Points work today.

## For brands and agencies

Pay for views that are checked, not claimed. Write a brief, approve a shortlist and review every version in one thread, with usage rights written down first. Or fund a content reward that pays creators per verified view.

## Joining

You need to be 18 or older. Sign-up asks for your date of birth and a phone number, and neither is ever shown to anyone else. One account can be signed in on up to three devices at once.

While joining is by invite, a new account needs an invite code. Each code works once, for one account. No code? Join the waitlist, and we will email you when there is a place.

## Fair questions

Q: What's the catch?
A: Fair question. The daily game and every app are free to start and free to stay, Agency included: we take nothing from what you invoice. Three things cost money. Typing to the assistant needs a plan, because the model costs us money; plans are not on sale yet. The Shop takes 5% of each sale. An optional live call with a coach costs ₹10,000, and it is not on sale yet either. Partner links in the Store may earn us a share, and every card says so.

Q: How is this different from self-help?
A: Most self-help picks one part of your life. kreators.app works on all seven relationships at once, because each one holds up the others. And you do not only read a plan: you tick it, one small act and one task a day, on pyramids you built.

Q: I run a small agency. Is this for me?
A: Yes. Agency is for a content agency or a freelance creator. Each client gets a dashboard with their deliverables moving from idea to published, your time, invoices and agreements. You can share one page with a client, and they can approve or send back what is waiting. It is switched off until you want it.

Q: What can my client see?
A: Only what you switch on. You pick the parts (what is waiting, what is coming, what is live, the month so far) and whether they can approve, send back or write a note. They never see your fees, your private notes, your time line by line or your other clients. You can preview the page first, and a fresh link closes the old one.

Q: Can I see my tasks in my own calendar?
A: Yes. Under Profile, switch on the calendar link and subscribe to it in Google, Apple or Outlook Calendar. It shows each open task that has a day, and the reviews you planned. It carries only a title, a pillar and a priority, never your notes or your journal. It shows your tasks there; it does not change them.

Q: Can I use it on my phone and my laptop?
A: Yes. One account can be signed in on up to three devices at once. A fourth signs out the oldest, and it tells that device why.

Q: I don't have time for another app.
A: That is the point of it. The daily ask is three moves: check in, do one small act, tick one task. It takes a few minutes. It counts reps, not hours. The rest is there when you want it, and switched off when you don't.

Q: Who sees my journal and Discover results?
A: Only you. Your journal, wellbeing numbers and Discover results never reach brands, staff, the leaderboard or Club selection, and a life coach never sees your journal or your quiz. The assistant reads your journal only when you ask, and a short Discover summary only if you switch that on, both through models that keep nothing. Discover is a self-check, not an IQ test or a diagnosis.

Q: I'm not a creator. Is it for me?
A: Yes, if you are 18 or over. The seven relationships are for everyone: servitude, friends, family, love, yourself, teachers and faith. The creator apps, like the Shop and Win, stay off until you want them.

Q: I'm doing fine. Is it still for me?
A: Yes. It is not only for fixing what hurts. Your pillars keep the good parts strong, and reviews show what is working, so you keep doing it.

Q: Apps like this never stick for me.
A: That isn't you. Most apps track one part of life and forget the other six. Here each tick climbs a pillar you chose, toward a foundation you wrote. And a task can only be ticked from its do date, so the plan stays honest.

Q: Is the pay real?
A: It is real, and it is careful. Win pays per verified view, not per follower, and a reviewer checks before anything pays. Everything that pays out has a wait or a person who checks it. Points work today; money checkout turns on when payments go live.

Q: Will I be on my own?
A: No. Bumling, the app's own guide, and seven characters walk with you. A free first course shows you around, every app ends with a How it works section, Help answers questions, and you can work with a life coach if you want one.

Q: I'm not ready for groups or events.
A: Start on your own. Circles, Run, Party and Community stay hidden until you or the setup chat bring them in, and your journal and Discover results are yours alone. Join people when you are ready.

Q: Is there proof it works?
A: We will not show you a rating or a study we cannot point to. What we can show is how it works: the rules on this page are the rules the app keeps. Try it for a week and see what your first review says.

Q: Can I leave?
A: Any time. From the Profile tab you can export everything, erase your progress, or delete your account. Hiding an app is one tap, and nothing is deleted.

Q: Why do you ask for my phone and birthday?
A: So that everyone here is 18 or over. Nobody under 18 gets an account. Neither your phone number nor your birthday is ever shown to anyone else, and you can change the phone number under the Profile tab.

## The books

Shubham Aggarwal, the founder of kreators.app, wrote three books. He left college to live as a monk and came back with this idea: seven relationships make a life. Each book has a course in School. Each lesson marks what comes from the book, and anything it adds is the app's own. The books are not sold for money on the site yet; each can be reserved for 2,000 points in Rewards.

1. The Relationship Method: Clearing Your Emotional Backlog to Unlock Life's Natural Abundance. "Unlock abundance with the 7 relationships pyramid." Where the seven relationships come from. Chapters: The Invisible Weight; The Bucket Model; Energy in Storage; The 7 Relationships Pyramid; The Spiritual Infrastructure; The Internal Core; The Social Ecosystem; Living in Perpetual Flow.
2. Dictionary of Mistakes for Creators: A Diagnostic Manual for Breaking the Pattern of Invisibility. Written by Shubham Aggarwal, published by FyndFlow. Chapters: The Invisible Mistake Loop; Identity & Authenticity Mistakes; Communication & Speaking Mistakes; Consistency, Procrastination & Compounding; Imposter Syndrome & Self-Doubt; Creator Relationships & Social Capital; Attention, Positioning & Growth Mistakes; Monetization & Leverage Mistakes.
3. Dictionary of Mistakes for 20s: A Field Guide to Fixing the Invisible Patterns Ruining Your 20s. Written and published by Shubham Aggarwal. Chapters: The Invisible Mistake Loop: Why Awareness Isn't Enough; Health: The Slow Decay of the Infinite Resource; Wealth: Leaks, Leads, and Behavioral Levers; Connections: Relationships as Pattern Problems; Career: The Transition from Employee to Leader; Creation: Mistakes in the Creator Economy; Identity: The Error of the Static Self; The Anti-Mistake OS: Living by Design.

## Privacy and safety

- Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.
- We never use what you write to train AI models.
- We do not sell your personal information, and we do not share it for advertising on other sites. There are no third-party advertising trackers.
- In India, under the Digital Personal Data Protection Act 2023, you are the data principal and we are the data fiduciary. You can ask for a summary of your data, fix it, erase it, take back a consent, name someone to act for you, and complain to the Grievance Officer and then the Data Protection Board of India.
- Three privacy choices start as no: remember which link brought me; show videos from YouTube and Vimeo; send me news and offers by email.
- Wellbeing tools are not medical care, a diagnosis or a treatment. Money tools are not financial, tax or investment advice. Agreement templates are a starting point, not legal advice.
- The terms are a plain-language draft that a lawyer still has to review for each country.
- Companies that handle personal data: Cloudflare (hosting and database), Resend (email, United States), Razorpay (payments, India), Anthropic (Content writing, United States), OpenRouter and its model hosts (the assistant and the Companion, with a plan), Cloudflare Workers AI, YouTube (Google) and Vimeo, Google YouTube Data API (view counts), Agent Reach (our own research bridge).
- Refunds go back the way you paid, by UPI, card or bank, through Razorpay. That usually takes five to seven working days from when the refund is issued.

Emergency: kreators.app cannot help in an emergency. If you might hurt yourself, call your local emergency number or go to the nearest hospital, and tell someone you trust. In India, call Tele-MANAS on 14416, day or night.

## Contact

- Business: {{BUSINESS_NAME}}, {{BUSINESS_ADDRESS}}
- Email: {{BUSINESS_EMAIL}}
- Grievance Officer for India: {{GRIEVANCE_NAME}}, {{GRIEVANCE_EMAIL}}, {{GRIEVANCE_PHONE}}
- Help inside the app is fastest. A person answers.
```

---

## 5. Structured data (JSON-LD)

Each block goes in the page `<head>` as `<script type="application/ld+json">…</script>`. That is a data block, not a script, so the current Content-Security-Policy does not block it and needs no change. Escape any text a person typed (see part 8).

| Page | Blocks |
|---|---|
| `/` | Organization, WebSite, WebApplication, FAQPage |
| `/features` | ItemList of apps, BreadcrumbList |
| `/features/<slug>` | BreadcrumbList |
| `/features/books` | Book × 3, BreadcrumbList |
| `/pricing` | WebApplication (for its offers) |
| `/events/:id` | Event |
| Every other public page | Organization only, or nothing |

Leave out any key whose placeholder is not set. Add `sameAs` to Organization only with real profile URLs. Never add `aggregateRating` or `review`: there is no rating to point to.

### Organization

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "{{SITE_URL}}/#organization",
  "name": "kreators.app",
  "legalName": "{{BUSINESS_NAME}}",
  "url": "{{SITE_URL}}/",
  "logo": "{{LOGO_URL}}",
  "email": "{{BUSINESS_EMAIL}}",
  "address": "{{BUSINESS_ADDRESS}}",
  "taxID": "{{BUSINESS_TAX_ID}}",
  "identifier": "{{BUSINESS_REGISTRATION}}",
  "founder": {
    "@type": "Person",
    "name": "Shubham Aggarwal"
  },
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "{{BUSINESS_EMAIL}}",
      "url": "{{SITE_URL}}/contact"
    },
    {
      "@type": "ContactPoint",
      "contactType": "Grievance Officer (India)",
      "name": "{{GRIEVANCE_NAME}}",
      "email": "{{GRIEVANCE_EMAIL}}",
      "telephone": "{{GRIEVANCE_PHONE}}",
      "areaServed": "IN"
    }
  ]
}
```

### WebSite

`/explore?q=` searches the public listings (rewards, opportunities, events, programs, tools, campaigns, circles).

Google no longer shows a sitelinks search box (retired November 2024). The SearchAction is kept only as plain schema.org for other engines; it is optional.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "{{SITE_URL}}/#website",
  "name": "kreators.app",
  "url": "{{SITE_URL}}/",
  "inLanguage": "en-IN",
  "description": "A daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay.",
  "publisher": { "@id": "{{SITE_URL}}/#organization" },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "{{SITE_URL}}/explore?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### WebApplication

This block will never earn Google's app rich result: Google requires a rating or review, and we have none to point to. The Rich Results Test will report that error; leave it. The block is still valid schema.org and answer engines read it.

The plan offers carry "Not on sale yet". When payments go live, add `"availability": "https://schema.org/InStock"` to each.

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": "{{SITE_URL}}/#app",
  "name": "kreators.app",
  "url": "{{SITE_URL}}/",
  "description": "kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. Check in, do one small act and tick one task each day. 42 apps, each one a switch.",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "Web",
  "browserRequirements": "Requires JavaScript. Works in a modern browser on a phone or laptop.",
  "inLanguage": "en-IN",
  "isAccessibleForFree": true,
  "image": "{{SITE_URL}}/og.png",
  "publisher": { "@id": "{{SITE_URL}}/#organization" },
  "audience": {
    "@type": "PeopleAudience",
    "audienceType": "Anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students",
    "suggestedMinAge": 18
  },
  "featureList": [
    "Daily: check in, do one small act, tick one task",
    "Seven pillars, each a pyramid from a foundation down to today's task",
    "Life: five areas scored from what you log",
    "School: learn with a cohort and a mentor",
    "Work and Army: gigs and brand campaigns",
    "Win: content rewards paid per verified view",
    "Agency: client dashboards, invoices with GST and TDS, agreements",
    "Shop: sell downloads, courses, memberships and sessions",
    "Finance: money in and out by category and month",
    "Journal, Mood, Sleep, Stress, Mindfulness and Fitness",
    "Community, Circles, Party, Bond and Kreators Run",
    "Bumling, the assistant: free taps, typing with a plan"
  ],
  "offers": [
    {
      "@type": "Offer",
      "name": "Free",
      "price": "0",
      "priceCurrency": "INR",
      "description": "The daily game, your seven pillars and every app you switch on, Agency included."
    },
    {
      "@type": "Offer",
      "name": "Pro (assistant plan)",
      "price": "1499",
      "priceCurrency": "INR",
      "description": "10,000 credits for 30 days for typing to the assistant. Not on sale yet."
    },
    {
      "@type": "Offer",
      "name": "Pro Max (assistant plan)",
      "price": "12499",
      "priceCurrency": "INR",
      "description": "1,00,000 credits for 30 days for typing to the assistant. Not on sale yet."
    },
    {
      "@type": "Offer",
      "name": "Ultra (assistant plan)",
      "price": "49999",
      "priceCurrency": "INR",
      "description": "4,00,000 credits for 30 days for typing to the assistant. Not on sale yet."
    }
  ]
}
```

### FAQPage

Answers copied word for word from the home page's "Fair questions". Google shows FAQ rich results only for a few kinds of site now, but answer engines still read this block.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What’s the catch?",
      "acceptedAnswer": { "@type": "Answer", "text": "Fair question. The daily game and every app are free to start and free to stay, Agency included: we take nothing from what you invoice. Three things cost money. Typing to the assistant needs a plan, because the model costs us money; plans are not on sale yet. The Shop takes 5% of each sale. An optional live call with a coach costs ₹10,000, and it is not on sale yet either. Partner links in the Store may earn us a share, and every card says so." }
    },
    {
      "@type": "Question",
      "name": "How is this different from self-help?",
      "acceptedAnswer": { "@type": "Answer", "text": "Most self-help picks one part of your life. kreators.app works on all seven relationships at once, because each one holds up the others. And you do not only read a plan: you tick it, one small act and one task a day, on pyramids you built." }
    },
    {
      "@type": "Question",
      "name": "I run a small agency. Is this for me?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Agency is for a content agency or a freelance creator. Each client gets a dashboard with their deliverables moving from idea to published, your time, invoices and agreements. You can share one page with a client, and they can approve or send back what is waiting. It is switched off until you want it." }
    },
    {
      "@type": "Question",
      "name": "What can my client see?",
      "acceptedAnswer": { "@type": "Answer", "text": "Only what you switch on. You pick the parts (what is waiting, what is coming, what is live, the month so far) and whether they can approve, send back or write a note. They never see your fees, your private notes, your time line by line or your other clients. You can preview the page first, and a fresh link closes the old one." }
    },
    {
      "@type": "Question",
      "name": "Can I see my tasks in my own calendar?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Under Profile, switch on the calendar link and subscribe to it in Google, Apple or Outlook Calendar. It shows each open task that has a day, and the reviews you planned. It carries only a title, a pillar and a priority, never your notes or your journal. It shows your tasks there; it does not change them." }
    },
    {
      "@type": "Question",
      "name": "Can I use it on my phone and my laptop?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. One account can be signed in on up to three devices at once. A fourth signs out the oldest, and it tells that device why." }
    },
    {
      "@type": "Question",
      "name": "I don’t have time for another app.",
      "acceptedAnswer": { "@type": "Answer", "text": "That is the point of it. The daily ask is three moves: check in, do one small act, tick one task. It takes a few minutes. It counts reps, not hours. The rest is there when you want it, and switched off when you don’t." }
    },
    {
      "@type": "Question",
      "name": "Who sees my journal and Discover results?",
      "acceptedAnswer": { "@type": "Answer", "text": "Only you. Your journal, wellbeing numbers and Discover results never reach brands, staff, the leaderboard or Club selection, and a life coach never sees your journal or your quiz. The assistant reads your journal only when you ask, and a short Discover summary only if you switch that on, both through models that keep nothing. Discover is a self-check, not an IQ test or a diagnosis." }
    },
    {
      "@type": "Question",
      "name": "I’m not a creator. Is it for me?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes, if you are 18 or over. The seven relationships are for everyone: servitude, friends, family, love, yourself, teachers and faith. The creator apps, like the Shop and Win, stay off until you want them." }
    },
    {
      "@type": "Question",
      "name": "I’m doing fine. Is it still for me?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. It is not only for fixing what hurts. Your pillars keep the good parts strong, and reviews show what is working, so you keep doing it." }
    },
    {
      "@type": "Question",
      "name": "Apps like this never stick for me.",
      "acceptedAnswer": { "@type": "Answer", "text": "That isn’t you. Most apps track one part of life and forget the other six. Here each tick climbs a pillar you chose, toward a foundation you wrote. And a task can only be ticked from its do date, so the plan stays honest." }
    },
    {
      "@type": "Question",
      "name": "Is the pay real?",
      "acceptedAnswer": { "@type": "Answer", "text": "It is real, and it is careful. Win pays per verified view, not per follower, and a reviewer checks before anything pays. Everything that pays out has a wait or a person who checks it. Points work today; money checkout turns on when payments go live." }
    },
    {
      "@type": "Question",
      "name": "Will I be on my own?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. Bumling, the app’s own guide, and seven characters walk with you. A free first course shows you around, every app ends with a How it works section, Help answers questions, and you can work with a life coach if you want one." }
    },
    {
      "@type": "Question",
      "name": "I’m not ready for groups or events.",
      "acceptedAnswer": { "@type": "Answer", "text": "Start on your own. Circles, Run, Party and Community stay hidden until you or the setup chat bring them in, and your journal and Discover results are yours alone. Join people when you are ready." }
    },
    {
      "@type": "Question",
      "name": "Is there proof it works?",
      "acceptedAnswer": { "@type": "Answer", "text": "We will not show you a rating or a study we cannot point to. What we can show is how it works: the rules on this page are the rules the app keeps. Try it for a week and see what your first review says." }
    },
    {
      "@type": "Question",
      "name": "Can I leave?",
      "acceptedAnswer": { "@type": "Answer", "text": "Any time. From the Profile tab you can export everything, erase your progress, or delete your account. Hiding an app is one tap, and nothing is deleted." }
    },
    {
      "@type": "Question",
      "name": "Why do you ask for my phone and birthday?",
      "acceptedAnswer": { "@type": "Answer", "text": "So that everyone here is 18 or over. Nobody under 18 gets an account. Neither your phone number nor your birthday is ever shown to anyone else, and you can change the phone number under the Profile tab." }
    }
  ]
}
```

While Invite only is on (`{{INVITE_ONLY}}`), insert this object as the second item of `mainEntity`, as the home page does. Take it out when the switch goes off.

```json
{
  "@type": "Question",
  "name": "Do I need an invite?",
  "acceptedAnswer": { "@type": "Answer", "text": "Right now, yes: joining is by invite. If someone gave you a code or a link, Start free asks for it. Each code works once, for one account. No code? Join the waitlist on the same page, and we will email you when there is a place." }
}
```

The "What’s the catch?" answer is built from `LIVE_CALL_CENTS` and `PLAN_CURRENCY` in code. Generate this block from `SITE_FAQ` in `apps/web/src/site/content.ts` so it can never drift.

### BreadcrumbList for `/features/<slug>`

Fill `{{APP_NAME}}` and `{{SLUG}}` from the table in part 6.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "kreators.app", "item": "{{SITE_URL}}/" },
    { "@type": "ListItem", "position": 2, "name": "Features", "item": "{{SITE_URL}}/features" },
    { "@type": "ListItem", "position": 3, "name": "{{APP_NAME}}", "item": "{{SITE_URL}}/features/{{SLUG}}" }
  ]
}
```

### ItemList of apps for `/features`

In the site's order: Contribution, Reflection, Connection, Creation, Essentials.

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "The apps in kreators.app",
  "numberOfItems": 42,
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "School", "url": "{{SITE_URL}}/features/school" },
    { "@type": "ListItem", "position": 2, "name": "Work", "url": "{{SITE_URL}}/features/work" },
    { "@type": "ListItem", "position": 3, "name": "Army", "url": "{{SITE_URL}}/features/army" },
    { "@type": "ListItem", "position": 4, "name": "Win", "url": "{{SITE_URL}}/features/win" },
    { "@type": "ListItem", "position": 5, "name": "Agency", "url": "{{SITE_URL}}/features/agency" },
    { "@type": "ListItem", "position": 6, "name": "Life", "url": "{{SITE_URL}}/features/life" },
    { "@type": "ListItem", "position": 7, "name": "Journal", "url": "{{SITE_URL}}/features/journal" },
    { "@type": "ListItem", "position": 8, "name": "Reviews", "url": "{{SITE_URL}}/features/reviews" },
    { "@type": "ListItem", "position": 9, "name": "Mindfulness", "url": "{{SITE_URL}}/features/mindful" },
    { "@type": "ListItem", "position": 10, "name": "Fitness", "url": "{{SITE_URL}}/features/fitness" },
    { "@type": "ListItem", "position": 11, "name": "Wellbeing", "url": "{{SITE_URL}}/features/wellbeing" },
    { "@type": "ListItem", "position": 12, "name": "Mood", "url": "{{SITE_URL}}/features/mood" },
    { "@type": "ListItem", "position": 13, "name": "Sleep", "url": "{{SITE_URL}}/features/sleep" },
    { "@type": "ListItem", "position": 14, "name": "Stress", "url": "{{SITE_URL}}/features/stress" },
    { "@type": "ListItem", "position": 15, "name": "Coaching", "url": "{{SITE_URL}}/features/coaching" },
    { "@type": "ListItem", "position": 16, "name": "Companion", "url": "{{SITE_URL}}/features/companion" },
    { "@type": "ListItem", "position": 17, "name": "Discover", "url": "{{SITE_URL}}/features/discover" },
    { "@type": "ListItem", "position": 18, "name": "Community", "url": "{{SITE_URL}}/features/community" },
    { "@type": "ListItem", "position": 19, "name": "Kreators Run", "url": "{{SITE_URL}}/features/run" },
    { "@type": "ListItem", "position": 20, "name": "Club", "url": "{{SITE_URL}}/features/club" },
    { "@type": "ListItem", "position": 21, "name": "Party", "url": "{{SITE_URL}}/features/party" },
    { "@type": "ListItem", "position": 22, "name": "Bond", "url": "{{SITE_URL}}/features/bond" },
    { "@type": "ListItem", "position": 23, "name": "Circles", "url": "{{SITE_URL}}/features/circles" },
    { "@type": "ListItem", "position": 24, "name": "Games", "url": "{{SITE_URL}}/features/cards" },
    { "@type": "ListItem", "position": 25, "name": "Shop", "url": "{{SITE_URL}}/features/shop" },
    { "@type": "ListItem", "position": 26, "name": "Public page", "url": "{{SITE_URL}}/features/profile" },
    { "@type": "ListItem", "position": 27, "name": "Content", "url": "{{SITE_URL}}/features/content" },
    { "@type": "ListItem", "position": 28, "name": "Audience", "url": "{{SITE_URL}}/features/audience" },
    { "@type": "ListItem", "position": 29, "name": "Auto-DM", "url": "{{SITE_URL}}/features/automations" },
    { "@type": "ListItem", "position": 30, "name": "Finance", "url": "{{SITE_URL}}/features/finance" },
    { "@type": "ListItem", "position": 31, "name": "Fund", "url": "{{SITE_URL}}/features/fund" },
    { "@type": "ListItem", "position": 32, "name": "TV", "url": "{{SITE_URL}}/features/tv" },
    { "@type": "ListItem", "position": 33, "name": "Knowledge", "url": "{{SITE_URL}}/features/knowledge" },
    { "@type": "ListItem", "position": 34, "name": "Tools", "url": "{{SITE_URL}}/features/tools" },
    { "@type": "ListItem", "position": 35, "name": "Store", "url": "{{SITE_URL}}/features/store" },
    { "@type": "ListItem", "position": 36, "name": "My purchases", "url": "{{SITE_URL}}/features/library" },
    { "@type": "ListItem", "position": 37, "name": "Home", "url": "{{SITE_URL}}/features/home" },
    { "@type": "ListItem", "position": 38, "name": "Daily", "url": "{{SITE_URL}}/features/today" },
    { "@type": "ListItem", "position": 39, "name": "Pillars", "url": "{{SITE_URL}}/features/tower" },
    { "@type": "ListItem", "position": 40, "name": "Leaderboard", "url": "{{SITE_URL}}/features/leaderboard" },
    { "@type": "ListItem", "position": 41, "name": "Help", "url": "{{SITE_URL}}/features/help" },
    { "@type": "ListItem", "position": 42, "name": "Assistant", "url": "{{SITE_URL}}/features/assistant" }
  ]
}
```

### Book × 3 for `/features/books`

Only the fields the site states. No `offers`: the books are not sold for money yet, and a reservation in points is not money. One block holding all three as a `@graph`.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Book",
      "@id": "{{SITE_URL}}/features/books#the-relationship-method",
      "name": "The Relationship Method",
      "alternativeHeadline": "Clearing Your Emotional Backlog to Unlock Life's Natural Abundance",
      "description": "Unlock abundance with the 7 relationships pyramid. Where the seven relationships come from.",
      "author": { "@type": "Person", "name": "Shubham Aggarwal" },
      "image": "{{BOOK_COVER_1}}",
      "url": "{{SITE_URL}}/features/books#the-relationship-method"
    },
    {
      "@type": "Book",
      "@id": "{{SITE_URL}}/features/books#dictionary-of-mistakes-for-creators",
      "name": "Dictionary of Mistakes for Creators",
      "alternativeHeadline": "A Diagnostic Manual for Breaking the Pattern of Invisibility",
      "author": { "@type": "Person", "name": "Shubham Aggarwal" },
      "publisher": { "@type": "Organization", "name": "FyndFlow" },
      "image": "{{BOOK_COVER_2}}",
      "url": "{{SITE_URL}}/features/books#dictionary-of-mistakes-for-creators"
    },
    {
      "@type": "Book",
      "@id": "{{SITE_URL}}/features/books#dictionary-of-mistakes-for-20s",
      "name": "Dictionary of Mistakes for 20s",
      "alternativeHeadline": "A Field Guide to Fixing the Invisible Patterns Ruining Your 20s",
      "author": { "@type": "Person", "name": "Shubham Aggarwal" },
      "publisher": { "@type": "Person", "name": "Shubham Aggarwal" },
      "image": "{{BOOK_COVER_3}}",
      "url": "{{SITE_URL}}/features/books#dictionary-of-mistakes-for-20s"
    }
  ]
}
```

### Event for `/events/:id`

Built by the Worker from one `PublicEvent` row (`GET /api/public/events/:id` fields). Field map:

| JSON-LD | From `PublicEvent` | Rule |
|---|---|---|
| `name` | `title` | Text only, escaped |
| `description` | `description` | Text only, cut near 300 characters, escaped |
| `startDate`, `endDate` | `startsAt`, `endsAt` | UTC ISO as stored |
| `eventStatus` | `status` | `published` → `EventScheduled`, `cancelled` → `EventCancelled`; for `done`, keep `EventScheduled` (the dates say it is past) |
| `eventAttendanceMode` | `online` | `true` → `OnlineEventAttendanceMode`, else `OfflineEventAttendanceMode` |
| `location` | `venue` / `online` | In person: `Place` with `venue` as name and address. Online: `VirtualLocation` with the page's own URL. **Never the room link.** |
| `organizer` | `hostName` | `Person` |
| `image` | first picture in `media` | First item whose `kind` is a picture or GIF (never a video). Make a relative url absolute with `PUBLIC_URL`. Leave out when there is none. |
| `maximumAttendeeCapacity`, `remainingAttendeeCapacity` | `capacity`, `seatsLeft` | Integers; leave out when unknown |
| `offers`, `isAccessibleForFree` | `pricePoints` | Only when `pricePoints` is 0: price "0", INR, and `InStock` while `seatsLeft` is null (no limit) or greater than 0, else `SoldOut`. A ticket in points is not money, so a points event gets no `offers`. |

No `performer`, no ratings. A private or missing event gets no block and `<meta name="robots" content="noindex">`.

In person, free:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "{{EVENT_TITLE}}",
  "description": "{{EVENT_DESCRIPTION}}",
  "startDate": "{{EVENT_STARTS_AT}}",
  "endDate": "{{EVENT_ENDS_AT}}",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "{{EVENT_VENUE}}",
    "address": "{{EVENT_VENUE}}"
  },
  "organizer": { "@type": "Person", "name": "{{EVENT_HOST_NAME}}" },
  "image": ["{{EVENT_IMAGE_URL}}"],
  "url": "{{SITE_URL}}/events/{{EVENT_ID}}",
  "isAccessibleForFree": true,
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "url": "{{SITE_URL}}/events/{{EVENT_ID}}"
  }
}
```

Online, ticket in points (so no `offers`):

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "{{EVENT_TITLE}}",
  "description": "{{EVENT_DESCRIPTION}}",
  "startDate": "{{EVENT_STARTS_AT}}",
  "endDate": "{{EVENT_ENDS_AT}}",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
  "location": {
    "@type": "VirtualLocation",
    "url": "{{SITE_URL}}/events/{{EVENT_ID}}"
  },
  "organizer": { "@type": "Person", "name": "{{EVENT_HOST_NAME}}" },
  "url": "{{SITE_URL}}/events/{{EVENT_ID}}"
}
```

---

## 6. Head tags for each page

- Canonical is `{{SITE_URL}}` plus the path, no trailing slash. `og:url` is the same absolute URL. `og:image` is `{{SITE_URL}}/og.png`. `og:title` and `og:description` copy the title and description.
- On `/features/<slug>` the H1 is the app's name, as `Feature.tsx` renders it.
- For a policy page, keep the page's own H1, as `LegalPage` renders its `title`.

### Main pages

| Path | Title | Meta description | H1 |
|---|---|---|---|
| `/` | Grow your work without losing your life \| kreators.app | kreators.app is a daily game for the seven relationships that make a life, with a creator's tools built in. One small act a day. Free to start, free to stay. | Grow your work without losing your life |
| `/features` | Features: 42 apps, each one a switch \| kreators.app | Every app in kreators.app by group: courses, gigs, campaigns, clients, a shop, money, wellbeing and people. Each one is a switch. Keep only the apps you use. | Everything a creator needs, one switch at a time |
| `/7rp` | The seven relationships \| kreators.app | Servitude, friends, family, love, yourself, teachers and faith: the seven relationships of kreators.app. Each is a pillar with a guide and its own apps. | Seven relationships, one life. |
| `/events` | Events: meetups and workshops \| kreators.app | Meetups, workshops and days you can join on kreators.app. Pick an event to see when and where it is, then save your seat. Tickets are free or paid in points. | Events |
| `/explore` | Explore rewards, gigs and events \| kreators.app | Search content rewards, opportunities, events, programs, tools, campaigns and circles on kreators.app. Sign in to join, apply or submit, then come back. | Explore |
| `/pricing` | Pricing: free to start, free to stay \| kreators.app | kreators.app is free to start and free to stay. The Shop takes 5% of a sale. Typing to the assistant needs a plan from ₹1,499 for 30 days, not on sale yet. | Pricing |
| `/features/books` | Three books, three courses \| kreators.app | Three books by Shubham Aggarwal, founder of kreators.app: The Relationship Method and two Dictionaries of Mistakes, each with its own course in School. | Three books, three courses |
| `/terms` | Terms of use \| kreators.app | The terms of use for kreators.app in plain words: who can join (18 or over), what points are, what we take from a sale, and how the assistant's plans work. | Terms of use |
| `/privacy` | Privacy \| kreators.app | How kreators.app handles your data: what we keep and why, who sees what, how long it is kept, and your rights under India's DPDP Act and in the EU and UK. | Privacy |
| `/refunds` | Refunds \| kreators.app | How refunds work on kreators.app: money goes back the way you paid, by UPI, card or bank through Razorpay, usually in five to seven working days. | Refunds and cancellations |
| `/contact` | Contact \| kreators.app | Contact the kreators.app team. A person answers. For a complaint about your data or something posted here, write first to our Grievance Officer. | Contact |
| `/subprocessors` | Subprocessors \| kreators.app | The companies that handle personal data for kreators.app, what each one does and where: hosting, email, payments, the assistant's models and video. | Subprocessors |
| `/copyright` | Copyright notices \| kreators.app | Send kreators.app a copyright notice if something here copies your work, or a counter-notice if we took down yours by mistake. Here is how it works. | Copyright |
| `/licences` | Open-source licences \| kreators.app | The open-source parts kreators.app is built on, each with its licence, including the Google Sans Flex and Caveat fonts under the SIL Open Font License. | Open-source licences |

### App pages (`/features/<slug>`)

| Slug | Title | Meta description |
|---|---|---|
| school | School: learn with a cohort \| kreators.app | School on kreators.app: programs with lessons, assignments and a mentor who reads your work. You finish when your work meets the bar, not when a timer ends. |
| work | Work: opportunities for your skills \| kreators.app | Work on kreators.app: gigs, campaigns, roles and collabs from brands and the team. Apply once with your portfolio attached, then follow every step. |
| army | Army: brand campaigns, run properly \| kreators.app | Army on kreators.app runs a brand's campaign from brief to approved work, with every version and its feedback in one thread and usage rights written first. |
| win | Win: get paid for real views \| kreators.app | Win on kreators.app: content rewards where a brand funds a pool and pays per thousand verified views. No follower count needed. A reviewer checks first. |
| agency | Agency: run clients like a studio \| kreators.app | Agency on kreators.app is for a content agency or a freelance creator. Each client gets a page of work to do, with invoices that work out GST and TDS, and agreements. |
| life | Life: five areas, one picture \| kreators.app | Life on kreators.app scores five areas of life, physical, financial, mental, emotional and spiritual, from what you already log. Only you see the scores. |
| journal | Journal: write it down \| kreators.app | Journal on kreators.app: entries with an emotion and a stress level, plus gratitude prompts. Nobody else sees it: not brands, not staff, not the leaderboard. |
| reviews | Reviews: look back, a day to a year \| kreators.app | Reviews on kreators.app: pick a day, week, month, quarter, half year or year and see every app's numbers next to the period before. Then answer a few questions. |
| mindful | Mindfulness: breathe and focus \| kreators.app | Mindfulness on kreators.app: a breathing timer and focus sessions with breaks, background sounds made in your browser, and a rating of how focused you were. |
| fitness | Fitness: move, eat, see the week \| kreators.app | Fitness on kreators.app: log a run, a walk or a workout, and tick your meals once a day. No calories, no sizes, and your weight is never saved. |
| wellbeing | Wellbeing: one score, four signals \| kreators.app | Wellbeing on kreators.app rolls mood, sleep, stress and mindful minutes into one score you watch week by week. Only you see it, unless you share it. |
| mood | Mood: how are you, really? \| kreators.app | Mood on kreators.app: pick a face for how you really are and see the week. Two taps a day show a pattern over time, and only you see it unless you share. |
| sleep | Sleep: hours and quality \| kreators.app | Sleep on kreators.app: log last night's hours and quality in a few seconds, then see how your sleep lines up with everything else you log in the app. |
| stress | Stress: the level and the cause \| kreators.app | Stress on kreators.app: set the level and name the cause. Patterns show up faster than you expect, and only you see them unless you share with a coach. |
| coaching | Coaching: a life coach for you \| kreators.app | Coaching on kreators.app: work with a life coach the team chose. You pick what they see, never your journal, and every step is in a log you both read. |
| companion | Companion: a chat that knows you \| kreators.app | Companion on kreators.app: a chat that knows how your week is going, reflects and asks questions back. It is not a therapist and never pretends to be one. |
| discover | Discover: find your strengths \| kreators.app | Discover on kreators.app: a quiz that finds your top three strengths across the seven relationships, five traits and your reasoning. It is not an IQ test. |
| community | Community: ask and share \| kreators.app | Community on kreators.app: a kind room to ask and share, with a room for each topic and guides who keep it calm. Post under your name or a made-up one. |
| run | Kreators Run: run with people \| kreators.app | Kreators Run: run clubs anyone can start. The host shows a start code at the line, you enter it, and your run is logged once. Minutes count to your score. |
| club | Club: a curated circle \| kreators.app | Club on kreators.app: apply once. Approved members get club-only events, a first look at opportunities, a named manager and an honor on their profile. |
| party | Party: meet people at events \| kreators.app | Party on kreators.app: meetups anyone can host, plus workshops and parties from the team. RSVP, join a waitlist, check in at the door and meet people. |
| bond | Bond: introductions, with consent \| kreators.app | Bond on kreators.app: introductions with consent. Met someone at an event? Ask to be introduced, and contact details move only after they say yes. |
| circles | Circles: five strangers, one table \| kreators.app | Circles on kreators.app: every week in your city, a table of people nearby whose interests fit yours. Everyone has an alias, and a chat opens the day before. |
| cards | Games: card games to play \| kreators.app | Games on kreators.app: nine card games for dating, family, friends and teams, work, and your hidden self. Unlock a game once with points, then play on screen. |
| shop | Shop: sell what you make \| kreators.app | Shop on kreators.app: sell downloads, courses, memberships, sessions, events and more, with coupons, affiliates and refunds. We take 5% of each sale. |
| profile | Public page: one page for you \| kreators.app | Public page on kreators.app: your bio, skills, portfolio, links and everything you sell on one public page at your own address. Share one link everywhere. |
| content | Content: find the posts that sell \| kreators.app | Content on kreators.app gives every post a tracked link and shows clicks, sales and revenue for each piece, so you can make more of what sells. |
| audience | Audience: know who wants more \| kreators.app | Audience on kreators.app: see who follows you, collect leads from your page, send a broadcast and share an affiliate link that pays twenty percent. |
| automations | Auto-DM: comment a word, get the link \| kreators.app | Auto-DM on kreators.app sends a tracked link to anyone who comments your keyword, and funnels show where people drop off between the post and the sale. |
| finance | Finance: see your money clearly \| kreators.app | Finance on kreators.app: money in and out by category and by month, with dues, repeats, budgets and goals, and what the platform paid you. Yours alone. |
| fund | Fund: backing for a project \| kreators.app | Fund on kreators.app: apply for a grant or backing for a project, then follow each stage: submitted, review, diligence, and a decision with a reason. |
| tv | TV: pitch a series \| kreators.app | TV on kreators.app: pitch a series with a budget, then follow it from review to diligence to release, with every decision logged where you can see it. |
| knowledge | Knowledge: articles with sources \| kreators.app | Knowledge on kreators.app: articles and things to try on the seven relationships. The team writes them and always names where each idea came from. |
| tools | Tools: tools creators use \| kreators.app | Tools on kreators.app: a directory of tools for capture, editing, audio, design, scheduling and analytics, verified by the team. Suggest one we missed. |
| store | Store: creator gear, new and used \| kreators.app | Store on kreators.app: new gear picked by the team through partner links, and pre-owned gear from other creators, with offers and a chat built in. |
| library | My purchases: all in one place \| kreators.app | My purchases on kreators.app: the courses, downloads, memberships, tickets, sessions, certificates and paid answers you own, all kept in one place. |
| home | Home: your numbers and your day \| kreators.app | Home on kreators.app opens with a short brief: three signals and three next steps, worked out by plain rules, not AI. Then your numbers, water and reminders. |
| today | Daily: three small boxes \| kreators.app | Daily on kreators.app: check in, do one small act, tick one task. Tasks have do dates, priorities and repeats, and Plan my week suggests a day for each task that has none. |
| tower | Pillars: seven pillars, one life \| kreators.app | Pillars on kreators.app: each of the seven relationships is a pillar, and each pillar is a pyramid from a foundation down to today's task. Tick it to grow. |
| leaderboard | Leaderboard: climb on effort \| kreators.app | Leaderboard on kreators.app: opt in to climb on xp, streaks and badges. Never on follower counts, and never on your journal or your wellbeing. |
| help | Help: answers and the team \| kreators.app | Help on kreators.app: common questions answered, and a support ticket when you need a person. The reply comes to your own inbox inside the app. |
| assistant | Assistant: say it, it is done \| kreators.app | Bumling, the kreators.app assistant, logs a mood, adds a task or ticks a box when you tap. Typing to it needs a plan. Undo anything with one tap. |

### Answer-first openings

Put one of these as the first paragraph of the page's `<noscript>` summary (part 8). Each answers the page's main question in 40 to 60 words.

- **`/`** kreators.app is a daily game for the seven relationships that make a life, with a creator's tools built in. Each day you check in, do one small act and tick one task. Courses, paid work, brand campaigns, client work, a shop and money tools are switches you turn on. It is free to start and free to stay.
- **`/features`** kreators.app has 42 apps in five groups: Contribution, Reflection, Connection, Creation and Essentials. Each app is a switch. Only a few are on to start, and a short setup chat shows the ones that fit you. Hiding an app takes one tap, and nothing is deleted. Every app below has its own page.
- **`/7rp`** kreators.app is built on seven relationships: servitude, friends, family, love, yourself, teachers and faith. Each one is a pillar with its own guide, from Ember for servitude to Lumen for faith. Pick a pillar to see the apps that serve it, or switch to the five areas of life: physical, financial, mental, emotional and spiritual.
- **`/events`** Events on kreators.app are meetups, workshops and days you can join, online or in person. Each event page shows the start in your own time zone, the place and the seats left. A ticket is free or paid in points. You need to be 18 or older, and you can make your account right on the event's own page.
- **`/pricing`** kreators.app is free to start and free to stay: the daily game, your seven pillars and every app you switch on, Agency included. Three things cost money. The Shop takes 5% of each sale. Typing to the assistant needs a plan from ₹1,499 for 30 days. That plan and an optional ₹10,000 live call are not on sale yet.
- **`/features/books`** Shubham Aggarwal, the founder of kreators.app, wrote three books: The Relationship Method, Dictionary of Mistakes for Creators and Dictionary of Mistakes for 20s. The Relationship Method is where the seven relationships come from. Each book has a course in School, and each lesson marks what comes from the book. The books are not sold for money on the site yet; each can be reserved for 2,000 points in Rewards.
- **`/privacy`** kreators.app keeps your journal and wellbeing away from brands, staff, the leaderboard and Club selection. We never use what you write to train AI models, and we do not sell your data. In India, the Digital Personal Data Protection Act 2023 gives you rights, and our Grievance Officer answers complaints first.
- **`/features/agency`** Agency is the kreators.app app for a content agency or a freelance creator. Each client gets a dashboard of deliverables moving from idea to published, your time, invoices with GST and TDS worked out, and agreements from templates. A client's page never shows your fees or private notes. We take nothing from what you invoice.
- **`/features/win`** Win is how kreators.app pays for content: a brand funds a pool and sets a rate per thousand verified views. You pick a reward, post your video and submit the public link. Once the views are checked and a reviewer confirms, points land in your balance. No follower count is needed.
- **`/features/discover`** Discover is a self-discovery quiz in kreators.app. It finds your top three strengths across the seven relationships, reads five personality traits and your reasoning, and suggests one small thing to try. It is not an IQ test or a diagnosis. Add-ons include a free MBTI-style type check (not the official MBTI), love languages, and Human design for reflection, not science. Only you see it.
- **`/features/today`** Daily is the kreators.app tab for the day's three moves: check in, do one small act and tick one task. Every tick pays xp, and the check-in pays points. A task can have a do date, a due date, a priority from P0 to P3 and a repeat. Plan my week gives each undated task a day.
- **`/features/tower`** In kreators.app each of the seven relationships is a pillar, and each pillar is a pyramid with six layers: a foundation, a guiding principle, a value goal, a goal outcome, a project and tasks at the tip. A short session builds them for you. Tick a task and the whole pyramid grows.
- **`/features/assistant`** Bumling is the kreators.app assistant, in the corner of every screen. Tapping its ready-made choices is free: log a mood, add a task, tick a box. Typing to it needs a plan from ₹1,499 for 30 days, not on sale yet. It does the job in the app, lists what changed and asks before removing anything.

For every other app page, the opening is the app's tagline followed by its pitch from `FEATURES` in `content.ts`.

---

## 7. Question bank

Questions people type into answer engines, each with a direct answer of 40 to 60 words. Use them to write page copy, to check what the engines say, and as the monthly test in part 8.

### The basics

**What is kreators.app?**
kreators.app is a web app that turns the seven relationships of a life into a daily game, with a creator's tools built in. Each day you check in, do one small act and tick one task. Courses, gigs, brand campaigns, client work, a shop and money tools are switches you turn on when you want them.

**Who is kreators.app for?**
It is for anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students. The seven relationships are for everyone, so you do not have to be a creator. The creator apps, like the Shop and Win, stay off until you want them, and you can hide any app.

**Is kreators.app free?**
Yes. It is free to start and free to stay: the daily game, your seven pillars and every app you switch on, Agency included. Three things cost money. The Shop takes 5% of each sale, typing to the assistant needs a plan, and an optional live call with a coach costs ₹10,000.

**How is kreators.app different from self-help or a habit app?**
Most self-help picks one part of your life. kreators.app works on all seven relationships at once, because each one holds up the others. You do not only read a plan: you tick it, one small act and one task a day, on pyramids you built from what matters to you.

**Do I need to install anything?**
No. kreators.app runs in the browser on your phone or laptop, so there is nothing to install from a store. It is a web app you can add to your home screen. One account can be signed in on up to three devices at once, and a fourth signs out the oldest.

**How much time does it take each day?**
A few minutes. The daily ask is three moves: check in, do one small act and tick one task. It counts reps, not hours. On Sunday there is a short week review, and each month a look back with the numbers next to the month before. Everything else is there when you want it.

### The seven relationships and pillars

**What are the seven relationships in kreators.app?**
They are servitude, friends, family, love, yourself, teachers and faith. kreators.app treats your work as one of these seven, not the whole of your life. Each relationship is a pillar with its own guide and its own question for the day, such as "Who did you serve today?" for servitude.

**What is a pillar in kreators.app?**
A pillar is one of the seven relationships, shown as a pyramid you build. Its layers run from a foundation you will not let break, through a guiding principle, a value goal, a goal outcome and a project, down to tasks at the tip. Tick a task and the whole pyramid grows.

**How do I set up my pillars?**
A short strategy session maps where you stand in all seven relationships. Then it builds a pyramid for the ones that need you most, from a short vibe check, so you never fill in a form. Your tasks then show up on Daily, and each tick climbs the pyramid to the reason you started.

**Who are the guides in kreators.app?**
Each relationship has a guide: Ember for servitude, Pip for friends, Sunny for family, Clover for love, Dew for yourself, Sage for teachers and Lumen for faith. Bumling is the app's own guide. It shows you around, shows the apps that fit you and sits in the corner of every screen as the assistant.

**What are the five areas of life?**
They are physical, financial, mental, emotional and spiritual, always in that order, since each one holds up the next. The Life app scores each area from what you already log, such as sleep, money, focus, mood and stillness. Only you see the scores, and each part opens the screen where you act on it.

**Where do the seven relationships come from?**
They come from The Relationship Method, a book by Shubham Aggarwal, the founder of kreators.app. He left college to live as a monk and came back with one idea: seven relationships make a life. The book's course is in School, and each lesson marks what comes from the book.

### The apps

**How many apps does kreators.app have?**
It has 42 apps in five groups: Contribution, Reflection, Connection, Creation and Essentials. Each one is a switch. Only a few are on to start, and the setup chat shows up to five that fit what you told it and hides the rest. Hiding an app is one tap, and nothing is deleted.

**What is Agency in kreators.app?**
Agency is for a content agency or a freelance creator. Each client gets a dashboard of deliverables moving from idea to published, your logged time, invoices with GST and TDS worked out, and agreements from templates. A client's page never shows your fees or private notes, and kreators.app takes nothing from what you invoice.

**What is Win and how does it pay?**
Win is for content rewards. A brand funds a pool and sets a rate per thousand verified views, so no follower count is needed. You post your video and submit the public link. Once the views are checked and a reviewer confirms, points land in your balance. Everything that pays out has a check.

**Is the Discover quiz an IQ test or the MBTI?**
No. Discover is a self-check that finds your top three strengths across the seven relationships and reads five personality traits and your reasoning. It is not an IQ test or a diagnosis. Its 16 personality types add-on is a free check in the MBTI style, not the official MBTI test. Only you see it.

**Is the Companion a therapist?**
No. The Companion is a chat that knows how your week is going. It reflects and asks questions back, and it is not a therapist and never pretends to be one. In an emergency, call your local emergency number or go to the nearest hospital. In India, call Tele-MANAS on 14416.

**What does the kreators.app assistant do?**
Bumling, the assistant, sits in the corner of every screen. Tapping its ready-made choices is free: log a mood, add a task, tick a box. Typing to it needs a plan, because the model costs money. It does the job in the app, lists what changed, asks before removing anything and lets you undo with one tap.

**Can I find people and events on kreators.app?**
Yes, when you are ready. Party has meetups and workshops, Circles seats you at a weekly table of people nearby, Kreators Run has run clubs, and Community has a room for each topic. Bond makes introductions only after the other person says yes. These apps stay hidden until you bring them in.

### Joining

**Do I need an invite to join kreators.app?**
Joining may be by invite. While the team keeps Invite only on, a new account needs an invite code or a link from someone. Each code works once, for one account. With no code, you can join the waitlist on the Start free page, and you get an email when there is a place.

**How old do I have to be to use kreators.app?**
You need to be 18 or older. Sign-up asks for your date of birth and a phone number, and an account for anyone younger is refused. If the team learns an account belongs to someone under 18, they close it. Neither your birthday nor your phone number is ever shown to anyone else.

**Can I export or delete my data?**
Yes, any time. From the Profile tab you can export everything, erase your progress, or delete your account. Hiding an app is one tap and deletes nothing. In India, the Digital Personal Data Protection Act 2023 also lets you ask for a summary of your data, fix it, or erase it.

### Money, India and payments

**Is kreators.app an Indian app?**
It is built in India by BrandingBum and works India first. Prices are in Indian rupees with GST shown before you pay, an Indian phone number is assumed without a country code, and privacy follows India's DPDP Act 2023. Refunds run through Razorpay by UPI, card or bank, and a Grievance Officer for India answers complaints.

**How much does kreators.app take when I sell?**
The Shop takes 5% of each sale, with nothing up front. Refer a creator and you earn 20% of their referred sales. kreators.app takes nothing from the invoices you make in Agency. Partner links in the Store may earn kreators.app a share, and every card says so.

**How much does the assistant plan cost?**
Typing to the assistant needs a plan: Pro is ₹1,499, Pro Max is ₹12,499 and Ultra is ₹49,999, each for 30 days. Plans do not renew by themselves. Tapping the assistant's ready-made choices stays free. Plans are not on sale yet, so nothing is charged today.

**Are payments live on kreators.app?**
Not yet. Points work today: you earn them by showing up and spend them inside the app. Money checkout runs in test mode until payments are switched on, so plans and the live call are not on sale yet. Points are not money and cannot be cashed out.

**What is the live call with a coach?**
It is an optional live call with a coach, priced at ₹10,000 in Indian rupees. It is not on sale yet, so nothing is charged today. It is one of only three things that cost money. The daily game, your seven pillars and every app you switch on stay free.

**How do refunds work?**
Money refunds go back the way you paid, by UPI, card or bank, through Razorpay, the payment provider. That usually takes five to seven working days from when the creator or the team issues the refund. Money checkout runs in test mode until payments go live. The full rules are on the refunds page.

### Privacy and safety

**Who can see my journal on kreators.app?**
Only you. Your journal, wellbeing numbers and Discover results never reach brands, staff, the leaderboard or Club selection, and a life coach never sees your journal. The assistant reads your journal only when you ask, through models that keep nothing. A coach sees only the numbers you choose to share.

**Does kreators.app use my data to train AI?**
No. kreators.app never uses what you write to train AI models. It does not sell your personal information or share it for advertising on other sites, and it has no third-party advertising trackers. Three privacy choices, about tracked links, videos and marketing email, all start as no until you say yes.

**Is kreators.app medical or financial advice?**
No. Wellbeing tools are not medical care, a diagnosis or a treatment, and money tools are not financial, tax or investment advice. Agreement templates are a starting point, not legal advice. kreators.app cannot help in an emergency; in India, call Tele-MANAS on 14416, day or night.

### Books and brands

**What books did the founder of kreators.app write?**
Shubham Aggarwal wrote three books: The Relationship Method, Dictionary of Mistakes for Creators and Dictionary of Mistakes for 20s. The Relationship Method is where the seven relationships come from. Each book has a course in School, and each lesson marks what comes from the book and what the app adds. The books are not sold for money on the site yet; each can be reserved for 2,000 points in Rewards.

**How can a brand work with kreators.app?**
A brand writes a brief, approves a shortlist of creators and reviews every version in one thread, with usage rights written down first. Or it funds a content reward in Win that pays creators per verified view, checked by a reviewer. Campaigns and reward pools are priced per brief. To start, write to the team from the contact page at {{SITE_URL}}/contact.

---

## 8. Implementation path

### Files to touch

| File | Change |
|---|---|
| `apps/web/public/robots.txt` | New. Part 4. |
| `apps/web/public/llms.txt`, `llms-full.txt` | New. Part 4. Better: generate both at build time from `content.ts` and `BOOKS` so they never drift. |
| `apps/web/public/sitemap-pages.xml` | New, if you take option A in part 4. |
| `apps/api/src/routes/go.ts` | Make `/sitemap.xml` correct (or a sitemap index). Add `go.get('/sitemap-events.xml', …)` for option A. Add head tags and JSON-LD to `/`. Add `/events` and `/events/:id`. |
| `apps/api/src/sitemap.ts` | Use the same app list as `content.ts` (drop `observability`, add `books`). |
| `apps/api/src/routes/eventsPublic.ts` | Export `SELECT`, `Row` and `toPublic` so `go.ts` reuses them. |
| `apps/api/src/index.ts` | Add `^\/events(?:\/[^/]+)?$` and `^\/sitemap-events\.xml$` to `GO_PATHS`. |
| `apps/api/wrangler.jsonc` | Add `"/events"`, `"/events/*"` and `"/sitemap-events.xml"` to `run_worker_first` (54 of the 100 allowed). |
| `scripts/seo/build-static.mjs` | New. Writes a page per stable route (below). |
| `apps/web/package.json` | Run the generator after `vite build`. |
| `apps/web/vite.config.ts` | Fix the manifest description; widen `navigateFallbackDenylist`. |
| `packages/shared/src/siteMeta.ts` | New leaf with every title and description, exported as `@kreators/shared/siteMeta`. The web app, the generator and the Worker read the same strings. |
| `apps/web/src/lib/usePageMeta.ts` | New. Sets `document.title`, description and canonical for people browsing. |
| `scripts/smoke/smoke.mjs` | New checks (below). |
| `docs/DECISIONS.md` | One line for the plan change. |

### The split: build time for stable pages, the Worker for live ones

Workers Free allows 100,000 requests a day, and static files do not count. Past the limit, Worker-first paths fail with error 1027 while static files still load. So:

- **Stable pages** (`/features`, every `/features/<slug>`, `/7rp`, `/explore`, `/pricing` and the policy pages): write real HTML files at build time. They stay free, uncounted and up past the daily limit. **Do not add `/features/*` to `run_worker_first`.**
- **The Worker** handles only `/` (it already rewrites that page) and `/events`, `/events/:id`, where the words come from the database.

### Build-time pages

`scripts/seo/build-static.mjs` runs after `vite build` (so the files stay out of the service worker's precache):

```json
{ "build": "tsc -p tsconfig.json && vite build && node --experimental-strip-types ../../scripts/seo/build-static.mjs" }
```

It imports `FEATURES`, `SITE_FEATURES` and `SITE_FAQ` from `apps/web/src/site/content.ts`, and `MODULES`, `BOOKS` and `BOOK_AUTHOR` from `@kreators/shared` (both load under Node's strip-types). It reads `dist/index.html` and writes `dist/features/<slug>.html` for every key in `SITE_FEATURES`, `dist/features/books.html` (from `BOOKS` and `BOOK_CHAPTERS`, with the Book × 3 block), `dist/features.html`, `dist/7rp.html`, `dist/explore.html` and `dist/{terms,privacy,refunds,contact,pricing,subprocessors,copyright,licences}.html`. No `dist/events.html`: the Worker owns `/events`. Each one is a copy of `index.html` with:

1. `<title>` and `<meta name="description">` from the tables in part 6.
2. `<link rel="canonical" href="{{SITE_URL}}/features/agency">` from a `PUBLIC_URL` build variable, no trailing slash.
3. Absolute `og:url`, `og:title`, `og:description` and `og:image`.
4. The page's JSON-LD from part 5, escaped as below.
5. A `<noscript>` block right after `<div id="root"></div>` holding the H1, the answer-first opening, the pitch, the `more` lines and the steps as plain text. It says exactly what the page says, so it hides nothing from anyone.

Rules:
- Never change a `<script src>` or `modulepreload` line. `perf-budget.mjs` reads those to measure the entry and first download.
- Check on 8788 that Cloudflare serves `/features/agency` from `features/agency.html` and `/features` from `features.html` (the default `html_handling`).
- The static generator adds no client JavaScript. `usePageMeta` and `siteMeta` do (below); keep `siteMeta` a leaf in its own chunk and run `pnpm perf:budget` after adding them (entry 480 kB, first download 1,500 kB, chunk 400 kB).

### Worker rewriting for `/` and `/events/:id`

`go.ts` already fetches `index.html` from assets and runs `HTMLRewriter` on `/`. Extend it. A sketch:

```ts
// Escape JSON for an inline data block: no </script>, no line breaks a parser chokes on.
const jsonForHtml = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function withHead(res: Response, head: {
  title: string; description: string; url: string; image: string;
  jsonLd: unknown[]; summaryHtml: string; noindex?: boolean;
}) {
  const blocks = head.jsonLd
    .map((b) => `<script type="application/ld+json">${jsonForHtml(b)}</script>`)
    .join('');
  return new HTMLRewriter()
    .on('title', { element: (e) => e.setInnerContent(head.title) })            // text, escaped by default
    .on('meta[name="description"]', { element: (e) => e.setAttribute('content', head.description) })
    .on('meta[property="og:title"]', { element: (e) => e.setAttribute('content', head.title) })
    .on('meta[property="og:description"]', { element: (e) => e.setAttribute('content', head.description) })
    .on('meta[property="og:url"]', { element: (e) => e.setAttribute('content', head.url) })
    .on('meta[property="og:image"]', { element: (e) => e.setAttribute('content', head.image) })
    .on('head', {
      element: (e) => {
        e.append(`<link rel="canonical" href="${escapeHtml(head.url)}">`, { html: true });
        if (head.noindex) e.append('<meta name="robots" content="noindex">', { html: true });
        e.append(blocks, { html: true });                                     // already escaped above
      },
    })
    .on('div#root', { element: (e) => e.after(`<noscript>${head.summaryHtml}</noscript>`, { html: true }) })
    .transform(res);
}
```

Rules for the Worker side:

- **Text only for anything a person typed.** An event's title, description and host name go through `escapeHtml` before they enter `summaryHtml`, and through `jsonForHtml` inside JSON-LD. Only those escaped strings are inserted with `{ html: true }`. A typed web address is never made a link.
- **CSP stays as it is.** A `type="application/ld+json"` block is a data block, so `script-src` without `'unsafe-inline'` still holds and smoke's CSP check still passes. No new origin.
- **Business fields** come from `businessFrom(c.env)` (the same reader as `/api/public/business`). Leave out every empty one; never invent one.
- **D1:** read the event row directly with the exported `SELECT` (one read, plus its media in the same turn through `batchedReads`). Do not call `/api/public/events/:id` through `app.fetch`: that runs the per-address rate limit, which writes a `rate_limits` row on every bot hit. Stay far under 45 round trips; this is one or two.
- **Cache the data, not the HTML.** Keep the event row in `caches.default` under a made-up key such as `https://cache.internal/seo/event/<id>` for about 300 seconds. Cached HTML would hold hashed `/assets/` links that break on the next deploy.
- **Missing or private event:** serve the shell with `noindex` and no JSON-LD, as "Not open here" does on the page.
- **Headers:** keep `withPageHeaders` on every page answer.
- **Second host:** on any host that is not `PUBLIC_URL`'s (such as `workers.dev`), send `X-Robots-Tag: noindex`, or set `"workers_dev": false`. That is a deploy choice for the founder.

### The sitemap fix in `go.ts`

- Build every URL from `PUBLIC_URL`, never from the request.
- App pages from the same rule as `SITE_FEATURES` (drop `observability`, add `books`), plus `/features`, `/7rp`, `/events`, `/subprocessors`, `/copyright`, `/licences`.
- Each upcoming public event as `/events/<id>`, with `lastmod`.
- `/u/<handle>` only for live accounts whose page is switched on: `AND ${liveUser('u')} AND COALESCE(json_extract(u.public_json,'$.pagePublic'), 1) != 0`. Today it lists pages their owners switched off.
- Keep it to one batched read.

### Client side, for people

- `usePageMeta(path)` in each site screen (Home, Features, Feature, SevenRP, Events, Books, Policy, Subprocessors, Copyright, Licences) sets `document.title`, the description and the canonical from `@kreators/shared/siteMeta`. `Public` sets a canonical of `{{SITE_URL}}/u/<handle>` too, so `/people/<id>` points at the handle URL.
- `FocusRounds.tsx` saves the tab title once and restores it when a clock stops. Make it read the title again on restore, or a page change during a clock brings back the old title.
- `vite.config.ts`: widen the service worker's `navigateFallbackDenylist` to `[/^\/api\//, /^\/(?:go|out)\//, /^\/\.well-known\//, /\.(?:txt|xml|md)$/]`, so a person who opens `/robots.txt` sees the file, not the app. Change the manifest description from "Seven areas" to "A daily game for the seven relationships, with a creator's tools built in."
- `siteMeta.ts` must import nothing from the barrel that the barrel imports back. After the edit, `node --experimental-strip-types -e "import('./packages/shared/src/index.ts')"` must still load.

### Smoke checks to add

- `/robots.txt` and `/llms.txt` answer `text/plain`, not HTML.
- The sitemap holds `/features/books` and no `/features/observability`.
- The sitemap leaves out a handle whose `pagePublic` is false.
- `/events/<id>` HTML holds `application/ld+json`, and the JSON parses, tested with an event titled `</script><b>x`.
- An unknown event answers with `noindex`.
- Then run `node scripts/smoke/csp-browse.mjs` and `pnpm perf:budget`.

### Checklist to verify after deploy

1. `curl -sI -A GPTBot {{SITE_URL}}/robots.txt` shows `content-type: text/plain`. Repeat for `/llms.txt` and `/llms-full.txt`.
2. `curl -s -A GPTBot {{SITE_URL}}/features/agency | grep -E '<title>|canonical|ld\+json'` shows the Agency title, the canonical and a JSON-LD block. Repeat with `-A ClaudeBot` and `-A PerplexityBot`.
3. `curl -s {{SITE_URL}}/sitemap.xml` is a `<sitemapindex>` naming `sitemap-pages.xml` and `sitemap-events.xml` (option A). `curl -s {{SITE_URL}}/sitemap-pages.xml` lists every URL in part 4. `curl -sI {{SITE_URL}}/sitemap-events.xml` answers `application/xml`, not HTML. Neither lists a token route.
4. Paste `/`, `/features`, `/features/books` and one `/events/<id>` into Google's Rich Results Test and into validator.schema.org. Fix every error except the missing `aggregateRating`/`review` on WebApplication; warnings about optional fields can wait.
5. Submit the sitemap in Google Search Console and Bing Webmaster Tools. Check the coverage report a week later.
6. Once a month, ask ChatGPT, Claude, Perplexity, Gemini and Copilot ten questions from part 7. Log each answer in a sheet: date, engine, question, the answer in short, whether it is true, what it cited. Fix the page that the wrong answers came from.

---

## 9. Font styles

### Families and where they are used

| Family | Files | Where |
|---|---|---|
| **Google Sans Flex** (variable: weight and roundness) | `google-sans-flex-latin.woff2` (71,592 B), `google-sans-flex-latin-ext.woff2` (36,868 B); weight 300 to 800; `font-display: swap` | Every screen in the app and on the site, through `--font-display`, `--font-body` and `--font-mono`, which all name this one family. Set on `html`. |
| Google Sans Flex at ROND 100 | the same files | Only the two wordmarks: `BrandMark` (`.brand-mark-face`, weight 700) and the footer's large wordmark (`.site-footer-mark::before`, weight 800) |
| **Caveat** | `caveat-latin.woff2` (74,572 B); weight 500 to 700; latin only | Only a guide's handwritten line (`.guide-hand`) |
| Georgia stack: `Georgia, 'Times New Roman', Times, serif` | system | Default `--doc-font` for agreements and documents, on screen and in print |
| Document sans: `system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif` | system | Paper set to sans, and the Trial template on screen |
| `Arial, Helvetica, sans-serif`, 11pt | system | The typed agreement layout, print only |
| Founder invoice: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`, `#333333` | system | `.legal-invoice[data-design='founder']` |
| `ui-monospace, SFMono-Regular, Menlo, monospace`, 13px/1.5 | system | `.legal-text`, the text version of a paper |
| `'Segoe UI Symbol', 'Apple Symbols', system-ui, sans-serif`, 1.2em | system | The ☐ and ☑ boxes on paper |

- Only `/fonts/google-sans-flex-latin.woff2` is preloaded (`index.html`).
- Both families are under the SIL Open Font License 1.1, listed in `public/fonts/LICENSE.txt` and on `/licences`. The rupee sign is in the latin-ext file.
- `html { font-size: 100%; }`, so every rem follows the browser's text size.

### The type scale

Each utility sets size, line height, tracking and weight together. "Dark" is the weight on a dark surface; "Paper" is the weight inside printed paper.

| Role | Utility | Size | Line height | Tracking | Light | Dark | Paper | Used for |
|---|---|---|---|---|---|---|---|---|
| Large title | `text-large-title` | 34px / 2.125rem | 38px | -0.022em | 600 | 550 | 600 | Every tab root and screen H1 |
| Title 1 | `text-title1` | 28px / 1.75rem | 32px | -0.02em | 600 | 550 | 600 | Large title under 22.49em with a back button |
| Title 2 | `text-title2` | 22px / 1.375rem | 26px | -0.017em | 600 | 550 | 600 | Section and sheet titles |
| Title 3 | `text-title3` | 20px / 1.25rem | 24px | -0.015em | 600 | 550 | 550 | A title inside a card |
| Headline | `text-headline` | 17px / 1.0625rem | 21px | -0.01em | 550 | 500 | 550 | Card and two-line row titles, buttons |
| Body | `text-body` | 17px / 1.0625rem | 22px | -0.008em | 450 | 400 | 400 | Plain list rows, inputs |
| Callout | `text-callout` | 16px / 1rem | 20px | -0.008em | 450 | 400 | 400 | Secondary reading |
| Prose | `text-prose` | 16px / 1rem | 23px | -0.004em | 450 | 400 | 400 | Reading text of three lines or more |
| Subhead | `text-subhead` | 15px / 0.9375rem | 19px | -0.006em | 450 | 400 | 400 | The everyday secondary line |
| Footnote | `text-footnote` | 13px / 0.8125rem | 17px | -0.002em | 450 | 400 | 400 | Small notes |
| Caption | `text-caption` | 12px / 0.75rem | 15px | 0em | 450 | 400 | 400 | 12px captions |
| Caption 2 | `text-caption2` | 11px / 0.6875rem | 13px | 0.006em | 450 | 400 | 450 | The floor |
| Row title | `text-row-title` | 20px / 1.25rem | 24px | -0.015em | 450 | 400 | — | A tick row's title with a line under it |
| Card title | `text-card-title` | 20px / 1.25rem | 24px | -0.015em | 550 | 500 | — | `RowCard`, `CardHead` cards, icon rows |
| Card note | `text-card-note` | 13px / 0.8125rem | 17px | -0.002em | 450 | 400 | — | The line under a card title (+2px top margin) |
| Card prose | `text-card-prose` | 14px / 0.875rem | 19px | -0.004em | 450 | 400 | — | School's program description (+2px top margin) |
| Eyebrow | `text-eyebrow` / `.type-eyebrow` | 12px / 0.75rem | 16px | 0.05em | 500 | 450 | 550 | Capitals; `.type-eyebrow` adds uppercase and tabular figures |
| Figure large | `text-figure-lg` | 40px / 2.5rem | 1 | -0.026em | 550 | 500 | 500 | Numbers |
| Figure hero | `text-figure-hero` | 64px / 4rem | 1 | -0.03em | 550 | 500 | 500 | `HeroNumber` |
| Display 1 | `text-display-1` | 40 → 52 → 64px | 1.02 | -0.026 → -0.028 → -0.03em | 550 | 500 | 500 | Site hooks |
| Display 2 | `text-display-2` | 32 → 40 → 48px | 1.06 | -0.024 → -0.024 → -0.026em | 550 | 500 | 500 | Site hooks |
| Display 3 | `text-display-3` | 28 → 34 → 40px | 1.1 | -0.022em | 550 | 500 | 500 | Site hooks |
| Lede | `text-lede` | 18 → 18 → 20px | 25px; 27px at lg | -0.01em | 450 | 400 | 400 | The site's context line |

The steps are `md` (`width >= 48rem` and `height >= 30rem`) and `lg` (`width >= 64rem` and `height >= 30rem`). Only the display sizes and the lede step up; the app's own roles have no laptop step.

Fallbacks with no role: `h1, h2, h3` use `--font-display`, tracking -0.02em, line height 1.08 and bold; `h3` alone takes -0.01em and semibold; `p, li, dd` lead at 1.55; `button, input, select, textarea` take `font: inherit`.

### Weights

| Token (class) | Light surface | Dark surface | Paper |
|---|---|---|---|
| `--font-weight-normal` (`font-normal`, reading) | 450 | 400 | 400 |
| `--font-weight-medium` (`font-medium`, tags and small chrome) | 480 | 430 | 420 |
| `--font-weight-semibold` (`font-semibold`, labels, buttons, card titles) | 550 | 500 | 440 |
| `--font-weight-bold` (`font-bold`, titles) | 600 | 550 | 540 |
| `--font-weight-extrabold` (`font-extrabold`) | 600 | 550 | 620 |

- Dark surfaces, every weight 50 lighter: dark mode, `.night-card`, `.mf-panel`, `.text-on-fill`, `.fx-fglass-host`, `.bg-r1`, `.bg-r4` to `.bg-r7`, a fill set inline from the on-fill token, and `.bg-ink` and `.text-on-ink` in light mode.
- Back to the light weights: `.bg-ink` and `.text-on-ink` in dark mode (they turn cream), and the orange and yellow fills (`.bg-r2`, `.bg-r3`), which carry dark ink.
- Fixed weights: wordmark 700, footer wordmark 800, `.guide-hand` 600, `strong` and `b` outside paper at semibold.

### Features and rendering

- `html`: `font-kerning: normal; font-variant-ligatures: common-ligatures contextual; text-rendering: auto; text-wrap: balance;` (browsers that cannot balance fall back to `pretty`).
- No `font-feature-settings` anywhere: it would fight tabular figures.
- `text-rendering: optimizeLegibility` only on large-title, title1, display 1 to 3, figure-lg, figure-hero and `.type-hook`.
- Tabular figures on `.type-figure`, `.font-mono`, `.type-eyebrow`, `CountUp`, the ruler labels, the water days, the Mindfulness timer and the breath counts.
- Font smoothing is left at the browser default; no smoothing property is set.
- ROND 100 only on the two wordmarks. Everything else is ROND 0.
- Paper headings use small caps; the typed layout turns them off.

### `@font-face` and tokens

```css
@font-face {
  font-family: 'Google Sans Flex';
  font-style: normal;
  font-weight: 300 800;
  font-display: swap;
  src: url('/fonts/google-sans-flex-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Google Sans Flex';
  font-style: normal;
  font-weight: 300 800;
  font-display: swap;
  src: url('/fonts/google-sans-flex-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Caveat';
  font-style: normal;
  font-weight: 500 700;
  font-display: swap;
  src: url('/fonts/caveat-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* Inside @theme */
  --font-display: 'Google Sans Flex', system-ui, sans-serif;
  --font-body: 'Google Sans Flex', system-ui, sans-serif;
  --font-mono: 'Google Sans Flex', system-ui, sans-serif;
  --font-weight-normal: 450;
  --font-weight-medium: 480;
  --font-weight-semibold: 550;
  --font-weight-bold: 600;
  --font-weight-extrabold: 600;
  --text-large-title: 2.125rem;
  --text-large-title--line-height: 2.375rem;
  --text-large-title--letter-spacing: -0.022em;
  --text-large-title--font-weight: 600;
  --text-title1: 1.75rem;
  --text-title1--line-height: 2rem;
  --text-title1--letter-spacing: -0.02em;
  --text-title1--font-weight: 600;
  --text-title2: 1.375rem;
  --text-title2--line-height: 1.625rem;
  --text-title2--letter-spacing: -0.017em;
  --text-title2--font-weight: 600;
  --text-title3: 1.25rem;
  --text-title3--line-height: 1.5rem;
  --text-title3--letter-spacing: -0.015em;
  --text-title3--font-weight: 600;
  --text-headline: 1.0625rem;
  --text-headline--line-height: 1.3125rem;
  --text-headline--letter-spacing: -0.01em;
  --text-headline--font-weight: 550;
  --text-body: 1.0625rem;
  --text-body--line-height: 1.375rem;
  --text-body--letter-spacing: -0.008em;
  --text-body--font-weight: 450;
  --text-callout: 1rem;
  --text-callout--line-height: 1.25rem;
  --text-callout--letter-spacing: -0.008em;
  --text-callout--font-weight: 450;
  --text-prose: 1rem;
  --text-prose--line-height: 1.4375rem;
  --text-prose--letter-spacing: -0.004em;
  --text-prose--font-weight: 450;
  --text-subhead: 0.9375rem;
  --text-subhead--line-height: 1.1875rem;
  --text-subhead--letter-spacing: -0.006em;
  --text-subhead--font-weight: 450;
  --text-footnote: 0.8125rem;
  --text-footnote--line-height: 1.0625rem;
  --text-footnote--letter-spacing: -0.002em;
  --text-footnote--font-weight: 450;
  --text-caption: 0.75rem;
  --text-caption--line-height: 0.9375rem;
  --text-caption--letter-spacing: 0em;
  --text-caption--font-weight: 450;
  --text-caption2: 0.6875rem;
  --text-caption2--line-height: 0.8125rem;
  --text-caption2--letter-spacing: 0.006em;
  --text-caption2--font-weight: 450;
  --text-row-title: 1.25rem;
  --text-row-title--line-height: 1.5rem;
  --text-row-title--letter-spacing: -0.015em;
  --text-row-title--font-weight: 450;
  --text-card-title: 1.25rem;
  --text-card-title--line-height: 1.5rem;
  --text-card-title--letter-spacing: -0.015em;
  --text-card-title--font-weight: 550;
  --text-card-note: 0.8125rem;
  --text-card-note--line-height: 1.0625rem;
  --text-card-note--letter-spacing: -0.002em;
  --text-card-note--font-weight: 450;
  --text-card-prose: 0.875rem;
  --text-card-prose--line-height: 1.1875rem;
  --text-card-prose--letter-spacing: -0.004em;
  --text-card-prose--font-weight: 450;
  --text-eyebrow: 0.75rem;
  --text-eyebrow--line-height: 1rem;
  --text-eyebrow--letter-spacing: 0.05em;
  --text-eyebrow--font-weight: 500;
  --text-figure-lg: 2.5rem;
  --text-figure-lg--line-height: 1;
  --text-figure-lg--letter-spacing: -0.026em;
  --text-figure-lg--font-weight: 550;
  --text-figure-hero: 4rem;
  --text-figure-hero--line-height: 1;
  --text-figure-hero--letter-spacing: -0.03em;
  --text-figure-hero--font-weight: 550;
  --text-display-1: 2.5rem;
  --text-display-1--line-height: 1.02;
  --text-display-1--letter-spacing: -0.026em;
  --text-display-1--font-weight: 550;
  --text-display-2: 2rem;
  --text-display-2--line-height: 1.06;
  --text-display-2--letter-spacing: -0.024em;
  --text-display-2--font-weight: 550;
  --text-display-3: 1.75rem;
  --text-display-3--line-height: 1.1;
  --text-display-3--letter-spacing: -0.022em;
  --text-display-3--font-weight: 550;
  --text-lede: 1.125rem;
  --text-lede--line-height: 1.5625rem;
  --text-lede--letter-spacing: -0.01em;
  --text-lede--font-weight: 450;
  --leading-heading: 1.08;
  --leading-body: 1.55;
  --tracking-heading: -0.02em;

@media (width >= 48rem) and (height >= 30rem) {
  :root {
    --text-display-1: 3.25rem; --text-display-1--letter-spacing: -0.028em;
    --text-display-2: 2.5rem;
    --text-display-3: 2.125rem;
  }
}
@media (width >= 64rem) and (height >= 30rem) {
  :root {
    --text-display-1: 4rem; --text-display-1--letter-spacing: -0.03em;
    --text-display-2: 3rem; --text-display-2--letter-spacing: -0.026em;
    --text-display-3: 2.5rem;
    --text-lede: 1.25rem; --text-lede--line-height: 1.6875rem;
  }
}

.brand-mark-face {
  font-family: var(--font-display);
  font-weight: 700;
  font-variation-settings: 'ROND' 100;
}
.site-footer-mark::before {
  font-variation-settings: 'ROND' 100;
}
```

### Rules

Do:
- Use one family on screen, Google Sans Flex. Caveat only for `.guide-hand`.
- Set every screen text with a role utility. For emphasis, add `font-semibold` to a role, never `font-bold`. Secondary ink stays at the reading weight.
- Let the tokens swap the weights on light and dark surfaces.
- Use tabular figures for numbers that line up or tick.

Don't:
- Add a family, or load a font from a third party.
- Use a serif on a screen. Only paper keeps Georgia, Arial and the system stacks.
- Round anything but the two wordmarks.
- Go under weight 400, though the files allow 300.
- Use `font-extrabold` outside paper (`scan.sh` refuses it).
- Set a px font size on screen text. The only exceptions are the Mindfulness timer, the ruler, the activity grid, chart SVG text and glyph sizes.

Small mismatches to clean up later, none of which changes what is drawn:
- The comment at the top of `app.css` still speaks of three faces and Inter; there are two families and no Inter.
- Three comments say figures and display drop to 500; on a light surface the tokens are 550.
- `.type-hook em` uses the reading weight token: 450 on light, 400 on dark.
- On paper, extrabold is 620 and bold 540, so they are not the same there.

---

## 10. Keep it true

Update this kit and the files it made whenever one of these changes:

- **An app is added, renamed or removed.** Update the sitemap, `llms.txt`, `llms-full.txt`, the ItemList (and its `numberOfItems`), the per-page table and every "42 apps". The count is `SITE_FEATURES` in `content.ts`; quote what it computes. Rewards, Search, Inbox, Manage, Admin and Dev Tools are not counted.
- **A price changes, or payments go live.** Update the WebApplication offers (add `availability` once plans are on sale), the pricing lines in `llms-full.txt`, the `/pricing` description and every "not on sale yet" in part 7. Prices come from `PLANS`, `TOPUP_PACKS` and `LIVE_CALL_CENTS`; never type them by hand where code can generate them.
- **The FAQ changes.** Regenerate FAQPage and the "Fair questions" in `llms-full.txt` from `SITE_FAQ`.
- **Invite only is switched off or on.** Add or remove the invite question in FAQPage and the invite paragraph in `llms-full.txt`. Keep the question-bank answer conditional.
- **Business details are set.** Fill the Organization block and the contact lines from `GET /api/public/business`. An empty field stays out.
- **The production domain changes.** Update `robots.txt`'s `Sitemap:` line and `PUBLIC_URL`.
- **A book, a policy page or a subprocessor changes.** Update the Book blocks, the policy summary and the subprocessor list in `llms-full.txt`.

Never add a rating, review, user count, certification, uptime figure or customer logo. Live numbers (members, events, opportunities, points paid) are shown on the site only when above 0 and are never written into these files.

This file does not change `LEGAL_VERSION`. Only a change to the words of the terms or privacy policy, to `RETENTION` or to `SUBPROCESSORS` moves it.
