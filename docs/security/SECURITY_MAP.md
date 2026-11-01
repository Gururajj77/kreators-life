# Security map: kreators.app

Written 2026-11-01 from `apps/api/src/index.ts`, `access.ts`, `limits.ts`, `env.ts` and the route files. Names only, never values.

## How a request is handled

1. Cloudflare serves static files (the web app) straight from the built assets, with the headers in `apps/web/public/_headers`.
2. The Worker runs first for `/`, `/api/*`, `/go/*`, `/out/*`, `/sitemap.xml` and for the paths in `run_worker_first` that must hold nothing (hidden files, backups, dumps, config). Those answer 404 from `blockedPath` in `apps/api/src/headers.ts`.
3. Inside `/api`, in this order: request id, wrong-origin check on writes, security headers, no-store cache line, the app log, the per-address limits for the open doors, then the doors with no session (`/auth`, `/admin`, `/public`, `/webhooks`), then the session check (Bearer token in `sessions`), then the module gate (`MODULE_FOR_PREFIX`), then the per-person limits, then the routes.
4. Every owner-scoped query filters by the session user id. Staff powers come from `can(user, permission)` (`db.ts`).

## Who can call what

| Prefix under /api | Who may call | Module that must be on | Notes |
|---|---|---|---|
| `/health` | anyone | none | liveness only |
| `/auth/*` | anyone (limited per address and per email) | none | sign-up, sign-in, forgot, reset, sign-out, anonymous device session |
| `/public/*` (explore, media, certificates, invoices, agency, contracts, calendar, legal, page by handle, client-error) | anyone (limited per address) | none | the owner's own switches decide what a public page shows; links carry long random tokens |
| `/webhooks/razorpay`, `/webhooks/meta` | the provider only | none | signature checked on the raw body first, payload stored, duplicates ignored; exempt from the wrong-origin check |
| `/admin/*` | `X-Admin-Key` header (shared secret, `ADMIN_KEY`) or a signed-in `admin` | none | not covered by the session check; no per-address limit yet (see SECURITY_REPORT, open items) |
| `/me`, `/me/coach`, `/me/calendar`, `/me/legal` | signed in | none (core) | `/me/coach` is core so a student can always say no or end a link |
| `/onboarding`, `/session`, `/nodes`, `/today`, `/rewards`, `/inbox`, `/search`, `/credits`, `/store` | signed in | none (core) | |
| `/school` `/work` `/army` `/win` `/agency` `/party` `/run` `/community` `/club` `/leaderboard` `/cards` `/discover` `/bond` `/circles` `/life` `/journal` `/reviews` `/companion` `/assistant` `/finance` `/tools` `/market` `/kyc` | signed in | the module of the same name (`/market` is `store`, `/kyc` is `shop`) | switched off or not rolled out to the person: 403 |
| `/connect` | signed in | `party` or `run` | event photos, conversation, who to meet |
| `/wellbeing` | signed in | any of `wellbeing`, `mood`, `sleep`, `stress`, `mindful`, `life` | owner only; never shown to staff or brands |
| `/coach` | signed in, holds the `coach` permission | `coaching` | the coach sees only what the student shares |
| `/studio`, `/studio/links` `/content` `/brands` `/automations` `/funnels` `/sequences` `/leads` `/broadcasts` | signed in | `shop`, `content`, `automations`, `audience` by sub-prefix | the strategist and research reach other sites (guarded by `safeurl.ts`) |
| `/resources` | signed in | `knowledge` | |
| `/proposals` | signed in | `tv` or `fund` | |
| `/manage`, `/manage/resources`, `/manage/community` | staff (`sub_admin`, `admin`) | `manage` | permission checked per route |
| `/internal/*` (Observability, Logs, roles) | staff; logs and role changes admin only | `observability` | reads `app_logs`; role changes audited |
| `/orgs`, `/reminders`, `/media`, `/reviews/kpis` | signed in | none or the parent module | media upload: 1 MB, magic bytes checked |

Outside `/api`: `/go/:code` (tracked links, writes the click after redirecting, salted hash of the address, no raw address), `/out/:kind/:id` (partner links), `/sitemap.xml`, `/` (site home with the absolute share image).

## Worker variables and bindings

Secret means set with `wrangler secret put` (never in `wrangler.jsonc`, never in git).

| Name | Secret | Purpose |
|---|---|---|
| `DB` | binding | D1 database `kreators-life` |
| `ASSETS` | binding | the built web app |
| `AI` | binding (optional) | Workers AI for the companion and a writer fallback |
| `ADMIN_KEY` | yes | shared admin key for `/api/admin` |
| `ADMIN_EMAILS` | no | extra founder addresses promoted to admin |
| `CLICK_SALT` | yes | salt for hashing click addresses and anonymous aliases |
| `RAZORPAY_KEY_ID` | no (public id) | checkout |
| `RAZORPAY_KEY_SECRET` | yes | creates orders and refunds |
| `RAZORPAY_WEBHOOK_SECRET` | yes | verifies webhook signatures |
| `RESEND_API_KEY` | yes | sends mail |
| `EMAIL_FROM` | no | sender address |
| `PUBLIC_URL` | no | the site's own address; used for links in mail (reset link included) |
| `ANTHROPIC_API_KEY` | yes | content strategist writer |
| `ANTHROPIC_MODEL` | no | writer model id |
| `ASSISTANT_API_KEY` | yes | the assistant's model provider (OpenRouter by default) |
| `ASSISTANT_BASE_URL`, `ASSISTANT_MODEL`, `ASSISTANT_PRICE_IN`, `ASSISTANT_PRICE_OUT`, `ASSISTANT_ZDR` | no | assistant model settings |
| `REACH_URL` | no | the Agent Reach bridge address |
| `REACH_KEY` | yes | key the bridge expects |
| `YOUTUBE_API_KEY` | yes | YouTube Data API reads |
| `META_APP_SECRET`, `META_ACCESS_TOKEN` | yes | Meta webhook signature and private replies |
| `META_VERIFY_TOKEN` | yes | Meta webhook subscription check |
| `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_REG`, `BUSINESS_VAT` | no | the legal entity shown on the contact page and mail footers |
| `DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, `DMCA_REGISTERED` | no | copyright notices |

## Third parties

| Service | What it gets | Where |
|---|---|---|
| Cloudflare (Workers, D1, static assets) | everything the app stores | the host |
| Razorpay | order amounts, buyer payment inside Razorpay's own window | `payments.ts`, checkout script on the product page |
| Resend | recipient address, subject, body of mail | `ops.ts` `sendEmail` |
| OpenRouter (or any OpenAI-compatible host) | assistant messages; journal and wellbeing only to zero-retention models and only on ask | `assistant/model.ts` |
| Anthropic | the brand folder of the content strategist | `strategist.ts` |
| YouTube Data API | video ids and search terms | `social.ts`, `reach.ts` |
| Meta Graph API | comment ids for private replies | `routes/growth.ts` |
| Agent Reach bridge (self-hosted) | research targets (public https addresses) | `reach.ts` |
| YouTube and Vimeo players | embedded only after the viewer agrees (`EmbedGate`) | web |

## Risky features and what holds them

| Feature | Risk | Control |
|---|---|---|
| Sign-in, reset | guessing, enumeration | PBKDF2 100k, decoy hash for unknown email, limits per address and per email, one-time hashed reset tokens, same answer for any email |
| Sessions | theft of a token from the browser | Bearer token in `localStorage` (accepted decision), at most 3 devices, strict CSP, no third-party scripts besides Razorpay checkout, no raw HTML sinks (`scripts/scan.sh`) |
| Admin key | one secret opens `/api/admin` | long random value, constant-time compare; rotate; remove once founders are admins |
| Uploads | wrong file types, size | 1 MB, JPEG/PNG/WebP/AVIF/GIF by first bytes, base64 in D1, served with `nosniff` |
| Research fetch | server-side request forgery | `safeurl.ts`: public https only, redirects re-checked, timeout and size cap |
| Payments | forged paid orders | `paid` only in the webhook after signature verification |
| User links | `javascript:` and tracking | stored links must start with http(s) (open items list the routes that still do not check), CSP blocks `javascript:` URLs, no clickable links in what people write to each other (`Inert.tsx`) |
| Journal, wellbeing | privacy | owner only, never to staff, brands or the leaderboard; absent from the app log |
