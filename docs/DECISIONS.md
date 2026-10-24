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
