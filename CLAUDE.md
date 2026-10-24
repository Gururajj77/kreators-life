# Kreators Life

Seven relationships as a daily game, with a creator super app on top: public site, learn-and-earn modules, content rewards, a shop with attribution, finance, circles, a life dashboard.
Full spec and history: README.md, docs/DECISIONS.md, docs/build-map.html. Read the relevant section before changing anything.

## Stack
pnpm workspace. apps/web: React 19, Vite 7, Tailwind 4, PWA. apps/api: Hono on Cloudflare Workers with D1, plain SQL migrations in apps/api/migrations, cron every fifteen minutes. packages/shared: the domain model both sides import, with Vitest tests.

## Non-negotiable rules
- Money is integer cents or integer points. Use `money()` and `feeBps()` from shared. Never floats for money.
- Times are stored as UTC ISO strings. Zone conversion happens only through `zonedToUtc` and `slotsFor` in shared.
- Every owner-scoped query filters by the session user id. Staff powers come from `can(user, permission)` in apps/api/src/db.ts.
- Payment code talks to apps/api/src/payments.ts, never to a provider SDK directly. A money order becomes `paid` only in the webhook after signature verification.
- Webhooks: verify the signature on the raw body, store the raw payload in `webhook_events`, then process. Duplicates are no-ops.
- The /go redirect writes the click after the redirect is sent and never stores a raw IP, only a salted hash.
- Journal and wellbeing data never reach brands, staff, the leaderboard or Club selection.
- Everything that pays out has a wait or a reviewer: task age, daily tick cap, verified views, finance permission for payouts.
- Only spacing values 8, 12, 16, 32, 64, 120 (tokens xs, sm, md, lg, xl, 2xl). Never hardcode hex colours in screens; use the theme tokens so dark mode works.
- Wording is universal and plain. Every action in the app is a checkbox row with the `toy` hover affordance.
- Screens open with `PageHeader` (or `BackLink` on coloured headers) and are built from `Section`, `StatTile` and the charts in `components/Charts.tsx`. Numbers come before actions on any dashboard. No new shadow values; use `shadow-toy-soft` or the `toy` classes.
- Contrast rule, from the kit: on a solid colour fill (`bg-r1`…`bg-r7`, `bg-ink`, a `Hero`) every foreground element is white (`text-on-fill`, rings and lines in `var(--color-on-fill)` with an `rgba(255,255,255,0.3)` track, buttons `variant="light"`). Yellow is the one exception and takes `text-on-yellow`. Dark text and dark buttons sit only on cream, card and tint surfaces. Never put a brown ring, brown text or an ink button on a coloured card.
- Dashboards use the kit's chart vocabulary in `components/Charts.tsx`: `AreaLine` for trends, `PillBars` for days, `Gauge` and `Ring` for scores, `Donut` with `Legend` for shares, `Bubbles` for what comes up most, `CalendarGrid` for a month, `EmojiRow` for moods, `Sparkline`, `Segments`, `PillChain` and `WeekDots` on rows. Pick the chart that fits the data; a screen with numbers should never be a wall of text. Moods are `MoodFace`, not emoji. A hero or a coloured card carries one of the seven characters (`Avatar`) with a mood that follows its number. Every tracker screen shows a line over thirty days. Line charts (`AreaLine`, `MultiLine`) keep their frame on: y labels, baseline and gridlines show even with no data; only the small line inside a metric card turns `axes` off.
- Do not build the white-label app, a marketplace, instalments or native chat transport (see docs/DECISIONS.md).

## Commands
- pnpm dev (web on 5173, api on 8787)
- pnpm typecheck
- pnpm --filter @kreators/shared test
- pnpm build
- pnpm db:migrate:local
- bash <scratchpad>/blueprint.sh for the end-to-end smoke test against the local api

## Done means
Typecheck and build pass, shared tests pass, the smoke test passes, the spacing and colour scans are clean, and docs/DECISIONS.md has a line if the plan changed.
