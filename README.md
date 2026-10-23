# Kreators Life

A mobile-first web app for creators. Seven relationships, one tower, climb a little every day.

## Stack

- `apps/web`: React 19 + Vite 7 + Tailwind 4, installable PWA.
- `apps/api`: Cloudflare Worker (Hono) with a D1 database. It also serves the built web app as static assets, so one deploy ships everything.
- `packages/shared`: the domain model both sides use (relationships, the ladder, XP rules, the question bank, starter quests, sparks, badges).

## Run it locally

```bash
pnpm install
pnpm db:migrate:local      # creates the local D1 database
pnpm dev                   # web on http://localhost:5173, api on http://localhost:8787
```

Open the web URL on your phone (same Wi-Fi, use your machine's LAN IP) and add it to the home screen.

## Deploy

```bash
pnpm --filter @kreators/api exec wrangler login
pnpm --filter @kreators/api exec wrangler d1 create kreators-life
# paste the printed database_id into apps/api/wrangler.jsonc
pnpm db:migrate
pnpm deploy
```

## Finding your way around

Four tabs, each with one job:

- **Today**: the daily routine, as three numbered steps. Check in, do the spark, tick a task. Below it, who you are becoming: your creator next to their next form, which fills in from the feet up as xp arrives.
- **Tower**: seven floors. Tap a floor to build it (one tap builds the ladder derived from your vibe check) or to add tasks. Built floors send their tasks to Today.
- **Rank**: the leaderboard.
- **You**: evolution, points and rewards, badges, your vibe check scores, profile, and help. A "how it works" card shows on Today the first time and can be brought back from here.

A floor's screen shows its character next to its next evolution, then the tasks to do, then the five rungs of the ladder collapsed under their summaries.

## How the game works

- **Vibe check**: an adaptive flow, about twenty taps. Each floor asks a gauge question, then a probe that depends on the answer (a low answer asks what is in the way, a high one asks what keeps it strong), then a foundation question whose options are pillars. Nothing is typed.
- **Derived ladders**: the pillar you picked derives the rest of the floor (principle, value goal, outcome, project, three tasks). Low-scoring floors get gentle starter tasks, high-scoring ones get stretch tasks. The three lowest floors are built by default; any other can be switched on. Derivation happens server-side from stored answers, so the client cannot invent ladders.
- **The ladder**: pillars hold up principles, which hold up value goals, outcomes, projects and tasks. A rung unlocks once the rung below it has at least one item.
- **Ripple**: completing a task gives 20 xp and sends smaller amounts up every rung above it. Finishing the last task in a project clears the project for a bonus.
- **Daily**: a check-in (streak + 10 xp) and a spark, a tiny challenge from the character whose floor needs you most (15 xp).
- **Levels and badges**: level thresholds are `60 * n * (n - 1)` xp. Badges are computed from your stats, never stored.
- **Evolution**: your identity evolves through five stages (Seed, Sprout, Rising creator, Steady hand, Luminary) as total xp grows, and each character evolves through four (Spark, Glow, Blaze, Beacon) on its floor's xp. The next form is drawn next to the current one and revealed from the feet up as xp fills it. Evolved characters gain an aura, then sparkles, then a crown; the creator gains a phone, headphones and a ring light, a cape and mic, then a crown.
- **Honors**: a second kind of badge. Admin-given (Pro, Founding creator, Community star, Collab champion) or unlocked by time on the tower (7, 30, 90, 365 days). Both kinds count on the leaderboard.
- **Points and rewards**: check-ins pay 10 points, every seventh day in a row pays 50 more. Points are separate from xp and can be reserved against real rewards (stickers, meetup ticket, tee, coaching call). A reservation refunds if cancelled. Admins fulfil them.
- **Leaderboard**: top twenty by xp, streak or badges. Anyone can hide themselves under You.
- **Wait times**: a task must exist for ten minutes (since it was written or last edited) before it can be ticked. Only six completions per rolling day earn xp; later ones still count as done but pay nothing, and undoing them takes nothing back. Check-ins and sparks only accept today's date (one day of timezone slack), never a future or earlier day. Every evolution stage also needs time: characters need 2, 10 and 30 days on their floor, identity needs 3, 14, 45 and 120 days on the tower. A fully revealed form that is still waiting shows as "being prepared" with a soft glow.

## Admin

Admin endpoints live under `/api/admin/*` and need an `X-Admin-Key` header that matches the `ADMIN_KEY` secret. Locally it is read from `apps/api/.dev.vars` (`ADMIN_KEY=dev-admin-key`). In production set it once:

```bash
pnpm --filter @kreators/api exec wrangler secret put ADMIN_KEY
```

There is a small admin page at `/admin` in the web app: paste the key, find a creator, make them pro, give honors, add points, and fulfil or cancel reservations. The same actions over curl:

```bash
K='X-Admin-Key: dev-admin-key'; B=http://localhost:8787/api/admin
curl -H "$K" "$B/users?q=jay"
curl -H "$K" -X POST "$B/users/<id>/pro" -d '{"pro":true}'
curl -H "$K" -X POST "$B/users/<id>/honors" -d '{"key":"founder","note":"first hundred"}'
curl -H "$K" -X POST "$B/users/<id>/points" -d '{"amount":500,"note":"launch gift"}'
curl -H "$K" "$B/redemptions?status=reserved"
curl -H "$K" -X POST "$B/redemptions/<id>" -d '{"status":"fulfilled"}'
```
