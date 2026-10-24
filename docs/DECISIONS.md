# Decisions

One line per decision that changed the plan, with the date. Newest at the bottom.

- 2026-10-23: Stack fixed by the founder: React + Vite + pnpm on the front, Cloudflare Workers with Hono and D1 on the back, one Worker serving both. No Drizzle; plain SQL migrations.
- 2026-10-23: Anonymous device sessions first; email and password layered on top later. No OTP or Google sign-in until an email provider exists.
- 2026-10-24: Points are the only spendable unit inside the app. Money checkout is recorded in test mode until a payment provider is live. No "Kreators Cash".
- 2026-10-24: Wording is universal, never creator-only. Every action is a checkbox row. Spacing scale is 8, 12, 16, 32, 64, 120 only.
- 2026-10-24: Design tokens come from the freud UI Kit v1.5 in Figma and are frozen in the repo. Dark mode reverses the same hues rather than going grey.
- 2026-10-24: Feature flags resolve on the server (switch, minimum role, rollout, overrides) and the client reads `access` from `/api/me`.
- 2026-10-24: Content rewards pay per thousand verified views. YouTube is read automatically with a key; every other platform is typed by the creator and confirmed by a reviewer. Payouts never exceed the pool and need the finance permission.
- 2026-10-24: Playbook tiers adopted: parity features built plainly, attribution and funnels as the difference, white-label app, marketplace and instalments skipped.
- 2026-10-24: Tracked links write the click after the redirect (`waitUntil`) instead of through a queue; no Queues binding yet.
- 2026-10-24: Auto-DM queues matched comments when Meta is not connected so the flow can be tested with the simulator; live sending needs the Meta secrets.
- 2026-10-24: Circles seat people within twenty kilometres when positions exist, otherwise by city; positions are rounded to three decimals and never returned by any endpoint.
- 2026-10-24: Payment provider sits behind `apps/api/src/payments.ts`; Razorpay is the first adapter, live only when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Money orders stay `pending` until the webhook confirms; the booking happens after the order, not inside it, so slot holds are not needed.
- 2026-10-24: Transactional email goes through an outbox table; Resend sends when `RESEND_API_KEY` is set, otherwise the admin can read what would have gone out.
- 2026-10-24: Product analytics and funnels live in our own `analytics_events` table rather than PostHog, so nothing leaves the Worker.
- 2026-10-24: Availability is written in the creator's IANA zone with date overrides, buffers, notice and a booking horizon; `slotsFor` in shared is pure and unit-tested.
- 2026-10-24: Memberships can carry a period in months; entitlement checks the order's expiry, and buying again renews.
- 2026-10-24: Account deletion anonymises the person and keeps money rows for the books; export is one JSON file.
- 2026-10-24: Home is the landing screen and the one dashboard. Results come before actions on it, and its guidance line always names the next box and what it will not work without. Every screen opens with `PageHeader` and is built from `Section`, `StatTile` and the shared charts; card shadows carry a hairline edge so they show on cream and in dark mode.
- 2026-10-24: Circles repeat weekly by default: the next occurrence opens on its own once the current one's tables are set, cancelling the latest ends the series. Joining asks how you will show up (single wears red, committed wears white, or rather not say); the answer is stored per signup, shown only to its owner, and never returned for other members.
- 2026-10-24: Dashboards follow the freud kit's Home and Mental Health Metrics frames (greeting with pills, score and mood card pair, tracker rows with mini visuals, score hero with per-area bars, mood history row) rather than our own layout, so the app reads like the design source.
- 2026-10-24: Contrast rule adopted from the kit: on a solid colour the foreground is white (yellow takes brown); dark elements live only on cream, card and tint surfaces. The orange and green relationship colours switched to white text for the same reason. Dashboards draw with the kit's chart vocabulary (area lines, pill bars, gauges, donuts, bubbles, month grids, emoji rows) rather than plain bars.
- 2026-10-24: Moods are drawn faces in the kit's style, never system emoji; every hero and metric card carries one of the seven characters whose expression follows the number; each metric screen and Home show a thirty-day or fourteen-day line graph, because the founder found the plain versions too flat.
- 2026-10-24: Line charts always draw their frame (y axis with labels, baseline, gridlines) even when empty, so an empty chart still reads as a chart; Home and Life carry a week chart of mood, sleep and calm on one scale.
- 2026-10-25: A local-only demo seed (`POST /api/demo/seed`, gated by `DEMO_SEED` in `.dev.vars`, own account only, replaces its own rows) fills the charts so the dashboard can be judged with data. Line charts keep a small floor above the axis so a zero line is its own line; the service worker takes over on the next load so a new build is seen without closing tabs.
