# Security report: kreators.app, 2026-11-01

Pre-launch pass against the owner's checklist (27 checks and 7 bonus checks). Scope: the Worker (`apps/api`), the static site headers (`apps/web/public/_headers`), repository history and tooling. Nothing here was run against production.

**Updated 2026-11-07.** The tables are the 2026-11-01 pass, with the statuses and notes corrected against the code as it is now. Open items 2, 3, 4, 6, 8 and 9 are closed: see "Closed since the first pass", which says what proves each. Item 5, the second factor for staff, is still not built, and that is left out on purpose for now.

**A note on numbering.** The brief named some checks by number (04, 14, 20 headers; 13 CORS; 16 CSRF; 20 errors; 23 exposed files; 24 and 25 git secrets; 26 and 27 docs and tests; 07 XSS; 08 logs and alerts; 21 dependencies; 01, 05, 15, 17 sign-in and reset; B2 server-side request forgery) but I did not have the checklist's own titles. Where a number is not in that list, the row names the topic I audited under it and is marked "topic assumed". Please map any that differ.

## Summary

| | Count |
|---|---|
| Checks and bonus checks reviewed | 34 |
| Passed as found | 16 |
| Fixed and re-tested | 15 |
| Open, with a next step | 3 (and 3 open items below, some behind a Passed row) |
| Not applicable | 0 |

Automated evidence: `bash scripts/smoke/blueprint.sh --fresh --keep` passes **910 of 910** (was 875 before this work; 35 new checks in the section "Security: headers, origin, exposed files, errors, addresses, alerts"), run twice, once on a fresh and once on a reused database. `pnpm typecheck` clean, `pnpm --filter @kreators/shared test` 209 of 209, `bash scripts/scan.sh` clean, `pnpm audit --prod` no known vulnerabilities.

## All checks

| # | Check (topic) | Status | Evidence | Notes |
|---|---|---|---|---|
| 01 | Sign-in is rate limited and does not reveal which emails exist (topic assumed) | Passed | smoke "Limits" and auth sections; `limits.ts` `signin` 10/min per address, `signinEmail` 20/15 min per email; decoy hash for unknown email; since 2026-11-07 the keys hold a salted hash of the address and the email (`limitKey` in `ops.ts`), never either itself, and smoke reads the table to check it | Not changed |
| 02 | Passwords hashed with a slow salted hash (topic assumed) | Passed | CLAUDE.md rule; `hashPassword` PBKDF2-SHA256 100,000 iterations, 16-byte salt, constant-time compare | 100,000 is the Workers free-plan ceiling |
| 03 | Every owner-scoped query filters by the session user (topic assumed) | Passed | smoke sections for every app test that a second account cannot read or change the first's data; sampled queries in routes | Not exhaustively re-read: 580 `DB` uses |
| 04 | Security headers on the static site and app shell | Fixed & re-tested | smoke "the site home carries...", "a page of the app carries...", "the policy served for static files is the one written in code"; `curl -I /` | `apps/web/public/_headers` and the Worker's own pages (`headers.ts`) |
| 05 | Password reset: one-time, short, hashed, link from config | Fixed & re-tested | `auth.ts`: 32 random bytes, SHA-256 stored, 30 minutes, one open per account; link now built from `PUBLIC_URL`; smoke auth sections | The link used the request's own origin when `PUBLIC_URL` is unset (local development only) |
| 06 | Sessions: random tokens, limited devices, sign out everywhere on password change (topic assumed) | Passed | `newSession`, `MAX_DEVICES` 3, smoke "devices" checks; `/me/password` and `/auth/reset` delete other sessions | |
| 07 | Cross-site scripting | Passed | grep of `apps/web/src` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `dangerouslySetInnerHTML`: no hits; `scripts/scan.sh` fails on any raw HTML; `Inert.tsx` keeps addresses in user text as plain text; enforcing CSP blocks inline scripts and `javascript:` URLs | Link fields are checked on the server too (closed item 4) |
| 08 | Logs and alerts | Fixed & re-tested | `alerts.ts` (new); smoke "below the levels no alert is made...", "after a role change the admins are told in the inbox..."; no secret in any log line (see findings) | Alerts run in the fifteen-minute cron only. They reach the inbox and, since 2026-11-07, each admin's email (closed item 9) |
| 09 | Uploads checked by content and size (topic assumed) | Passed | CLAUDE.md and `routes/media.ts`: 1 MB, first bytes checked, served `nosniff`; smoke media section | |
| 10 | Webhooks verified before processing (topic assumed) | Passed | `routes/go.ts`: HMAC on the raw body, payload stored, duplicates ignored; smoke payments section | Compared in constant time (closed item 3) |
| 11 | Money only moves on verified events (topic assumed) | Passed | an order is `paid` only in the webhook; amount mismatch refused | |
| 12 | Switched-off modules refused by the server (topic assumed) | Passed | `MODULE_FOR_PREFIX`, smoke access sections | |
| 13 | CORS: no wildcard, no reflected origin | Fixed & re-tested | `cors()` removed from `index.ts`; smoke "an unknown origin gets no Access-Control-Allow-Origin on /api/health, /api/me or a preflight" | The old setting sent `Access-Control-Allow-Origin: *` |
| 14 | HTTPS enforced: HSTS | Fixed & re-tested | smoke "carries HSTS for two years without preload" on pages and API | `max-age=63072000; includeSubDomains`, no preload. Owner: switch on "Always Use HTTPS" in Cloudflare |
| 15 | Account recovery does not leak or hand over accounts | Passed | same answer for any email on `/auth/forgot`; per-email limit 3/hour; token claimed before use | |
| 16 | CSRF | Fixed & re-tested | smoke "a write that says it comes from another site is refused with 403", "a signed-in write from another site changes nothing", "a write from the site itself goes through", "a write with no origin goes through", "a webhook is checked by its signature, not by origin" | Auth is a Bearer header, so this is defence in depth |
| 17 | Password rules and change flow | Fixed & re-tested | `passwordProblem` shared; `/me/password` needs the current password; a "your password was changed" mail now goes out after a reset and after a change (`auth.ts`, `me.ts`) | The mail goes through `sendEmail`; a mail failure never blocks the change |
| 18 | Rate limits on expensive and abusable routes (topic assumed) | Passed | `limits.ts` `ROUTE_LIMITS`; smoke "Limits" | The `/api/admin` key has its own limit since 2026-11-07 (closed item 2) |
| 19 | Input validation: SQL by prepared statements (topic assumed) | Passed | every query uses `.prepare().bind()`; the 257 template-string queries interpolate code constants; `ORDER BY` values come from fixed lists (`community.ts`, `growth.ts`, `leaderboard.ts`); All tables (2026-11-13) builds its SQL only from its own allowlist of tables and columns (`tableSql` in `packages/shared/src/dataTables.ts`), binds everything typed and looks a typed key up through `byKey` | Sampled, not proven line by line |
| 20 | Error pages and API errors leak nothing | Fixed & re-tested | `index.ts` `onError`: plain line plus `requestId`, never `err.message` or a stack; malformed JSON gives 400 and the body is not logged; smoke "a body that is not JSON answers 4xx with no stack...", "an unknown API route answers 404 with one plain line" | The 500 body itself could not be forced in the smoke run; it is verified by reading the handler |
| 21 | Dependencies | Passed | `pnpm audit --prod`: "No known vulnerabilities found" (2026-11-01); `pnpm-lock.yaml` is tracked | `.github/workflows/ci.yml` installs with `--frozen-lockfile` on every push since 2026-11-07 (closed item 8). `pnpm deploy` builds but does not install, so use `pnpm install --frozen-lockfile` wherever you install |
| 22 | Admin powers audited (topic assumed) | Passed | `audit()` rows for role, permission, delete, xp, badges; alert on role change; since 2026-11-13 a `tables.view` row (at most one per admin, member and table in half an hour) for each of a member's tables a super admin opens, and a `tables.csv` row for each download; the member and the table, never what is in it | The tables read needs an admin's own session, never the shared `ADMIN_KEY`, and never opens the journal, gratitude or a Body and mind table; smoke "All tables" |
| 23 | No exposed files (`.env`, `.git`, backups, dumps, maps) | Fixed & re-tested | smoke "hidden, backup, dump, config and map files answer 404", "the files the site ships still answer 200", "wrangler sends every blocked pattern..."; `scripts/check-exposed.sh` reports "Nothing answered 200" locally | Before: the app shell answered 200 for all of them |
| 24 | No secrets in git history | Passed | searched all 51 commits for 19 key patterns and every `.env*`, `.dev.vars*`, `*.pem`, `*.key` path: no real secret (see findings) | Hits were test values only |
| 25 | Secrets cannot be committed again | Fixed & re-tested | `.gitignore` now covers `.env.*`, `.dev.vars.*`, `*.pem`, `*.key` (keeps the example files); `scripts/hooks/pre-commit` tested on a throwaway repo | The hook is not installed for you (one line in the runbook) |
| 26 | Security documentation | Fixed & re-tested | `SECURITY_MAP.md`, `SECURITY_REPORT.md`, `SECURITY_RUNBOOK.md`, `SECRETS.md`, `RESTORE.md` | |
| 27 | Security tests repeatable | Fixed & re-tested | smoke security section; `scripts/smoke/csp-browse.mjs`; `scripts/check-exposed.sh` | See "How to run" |
| B1 | Supply chain: lockfile, audit, update alerts (topic assumed) | Open - enable Dependabot | audit clean today | Owner action below |
| B2 | Server-side request forgery | Fixed & re-tested | `safeurl.ts`; smoke "publicHttpsUrl refuses http, IP numbers, localhost, internal names, logins, odd ports and other schemes" (26 addresses) and "accepts https://example.com/a" | A public name that points at a private address is not caught (needs DNS); Workers cannot reach private networks anyway |
| B3 | Uploads and user links (topic assumed) | Fixed & re-tested | `httpUrl` in `db.ts` on every link a person types for others to open; smoke "a product's link must be http or https" and the checks beside it | See closed item 4 |
| B4 | Webhook and replay safety (topic assumed) | Passed | duplicate events are no-ops (`webhook_events`) | Timing-safe compare: closed item 3 |
| B5 | Key rotation and spending caps (topic assumed) | Open - owner action | `SECRETS.md` | OpenRouter key and `ADMIN_KEY` from an earlier chat must be rotated |
| B6 | Backups and restore (topic assumed) | Open - practise once | `RESTORE.md` (D1 Time Travel, 30 days); commands checked against `wrangler d1 time-travel --help` | Not run against production |
| B7 | Monitoring and alerting (topic assumed) | Fixed & re-tested | `alerts.ts`; `SECURITY_RUNBOOK.md` | Alerts reach the inbox and each admin's email (closed item 9); no phone page |

## Findings and fixes

All files below are under the repository root.

1. **CORS answered `*` on every API call** (`cors()` with defaults). The app and API are one origin, so CORS is gone. `apps/api/src/index.ts`.
2. **The static site and app shell had no security headers.** Added `apps/web/public/_headers` for every file and `apps/api/src/headers.ts` for the Worker's own pages (site home, short links, 404s), with one policy written in code and checked against the file by the smoke test. HSTS has no preload, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` (the app asks for position in Profile and the vibe check, and never for camera or microphone), `Cross-Origin-Opener-Policy: same-origin-allow-popups` for the payment window, `Referrer-Policy: no-referrer` added on the reset page.
3. **Content-Security-Policy is enforcing.** It was first shipped as report-only. A Chrome browse of 102 routes (home, daily, profile, sheets, public site, terms, a product page, pricing, agency pages and more) found three needs that are now in the policy: inline styles (React style attributes, one page that renders a style element, and Razorpay's checkout), and `cdn.razorpay.com` for a script the checkout loads. After that: 0 violations on the full browse, with sheets opened and the checkout script loaded, and 0 with the checkout window itself opened (`new Razorpay(...).open()` against Razorpay's real script; it opened its frame from `api.razorpay.com`). A real payment was not made. To go back to watch-only, change one word in `headers.ts` and `_headers`.
4. **No state-changing request from a foreign page is accepted** (403 `wrong origin`) when the browser sends an `Origin`. No `Origin` always passes; own host, `PUBLIC_URL` and loopback in development pass; webhooks are exempt.
5. **Every API answer** now has `X-Request-Id`, the full header set and `Cache-Control: no-store` (public routes that set their own cache line keep it).
6. **Errors**: 5xx bodies are `{ error, requestId }`; malformed JSON that reaches the app-level handler is a 400 and its parser text (which can quote the start of a body, such as a password) is neither returned nor logged. Unknown API routes answer `{ "error": "not found" }`.
7. **Exposed files**: paths for hidden files, backups, dumps, config, source and logs answer 404 from the Worker instead of the app shell, via `run_worker_first` patterns in `apps/api/wrangler.jsonc` and `blockedPath` in `headers.ts`. `/.well-known/*`, `/assets/*`, `/fonts/*`, `/sw.js`, the manifest, icons, `og.png`, `licences.json` and `/resources/*` are untouched. `vite.config.ts` has `sourcemap: false`, and no `.map` is in `dist`.
8. **SSRF guard**: `apps/api/src/safeurl.ts` (`publicHttpsUrl`, `safeFetch` with manual redirects (3 at most, each re-checked), a timeout and a size cap). Used in `apps/api/src/reach.ts` where the Worker reads a page a person linked (`readPage`), and before any link or transcript target is passed to the Agent Reach bridge. Other `fetch(` calls go to fixed provider hosts (Razorpay, Resend, YouTube, Meta, the configured model host); the metric readers take only a video id out of a person's link.
9. **Alerts**: `apps/api/src/alerts.ts` and one line in `cron.ts`. 20 failed sign-ins, 100 answers of 429, 20 server errors or any role or permission change in fifteen minutes tell every admin in the inbox (Team tab), once an hour per kind and admin. Texts hold counts only. Since 2026-11-07 each new note also goes out as one private email (closed item 9).
10. **Reset link** is built from `PUBLIC_URL` when it is set (it fell back to the request's own origin only when unset). **Password-changed mail** now follows a reset and a change.
11. **Secrets in logs**: no log line holds a password, token, header, query or body: `logs.ts` writes the cleaned path, status, time, area and the person's name; `console.log` calls print only cron counts; model errors print the provider's status and message. The one route found that could echo body text (a JSON parse error) is closed (finding 6).
12. **Git history**: 51 commits searched for `sk_live_`, `sk_test_`, `rk_live_`, `sk-ant-`, `sk-or-`, `AKIA`, `ghp_`, `github_pat_`, `xox*-`, `AIza`, `BEGIN (RSA) PRIVATE KEY`, `service_role`, `rzp_live_`, `rzp_test_`, long `Bearer` strings, and `*_KEY=`/`*_SECRET=` assignments. No real key was found. The only assignment hits are the smoke test's own key (`smoke-admin-key`, `scripts/smoke/blueprint.sh`, commits 0eeade4, 67f0c30, b77b386), placeholder text in the planner docs (commits ffdff2c, 25ed459, 01fbc11) and a usage comment in `scripts/reach/server.mjs` (8d00821); none of them is a live secret. File paths ever added matching `.env*`, `.dev.vars*`, `*.pem`, `*.key`: only `apps/api/.dev.vars.example` (tracked, holds the dev value `dev-admin-key` and empty names). `apps/api/.dev.vars` is ignored and untracked.
13. **`.gitignore`** gained `.env.*`, `.dev.vars.*`, `*.pem`, `*.key` (with the two example files kept). `apps/api/.dev.vars.example` gained the missing names (values empty).
14. **Tooling**: `scripts/check-exposed.sh` (a long path list, a status per path, `!!!` and exit 1 on any 200, a reminder to use it only on your own domain), `scripts/hooks/pre-commit` (staged-diff secret scan; values never printed), `scripts/smoke/csp-browse.mjs` (browse and list CSP violations).

## Accepted and mitigated risk

- **Session tokens live in `localStorage`** (documented decision: Bearer tokens, no cookies). Mitigations: enforcing CSP with same-origin scripts only (plus Razorpay's checkout on pay), no third-party script, no raw HTML sinks (`scripts/scan.sh`), a user's links never rendered as clickable in messages, at most 3 devices, and every session ends on a password change or reset. A cross-site scripting hole would still expose tokens, so the CSP and the sink scan are the line to keep.

## Open items

| # | Risk | Next step |
|---|---|---|
| 1 | The enforcing CSP was tested with a real browser, the checkout script and the checkout window, not with a real payment (bank pages, UPI apps and 3-D Secure were not exercised) | Make one test-mode payment on the deployed site with DevTools open on the Console; any "Refused to..." line is a policy gap. To roll back: change `Content-Security-Policy` to `Content-Security-Policy-Report-Only` in `apps/web/public/_headers` and `CSP_HEADER` in `apps/api/src/headers.ts`, then deploy |
| 5 | Sign-in has a per-address and per-email limit, but accounts have no second factor | Not built, and left out for now (2026-11-07). When it comes, start with an optional authenticator-app step for admin and staff accounts |
| 7 | A public name that resolves to a private address passes `publicHttpsUrl` (no DNS in a Worker) | Accepted: a Worker cannot reach private networks. Re-check if research moves to a machine you run (the Agent Reach bridge) |

## Closed since the first pass

Each one was checked against the code on 2026-11-07. The numbers keep the first pass's numbering, since other rows point at them.

| # | What the first pass said | What the code does now | What proves it |
|---|---|---|---|
| 2 | `/api/admin/*` took the shared `ADMIN_KEY` with no limit | Limit `adminKey`, ten tries in ten minutes per address (`limits.ts`, on every method of `/admin/*`, wired with the doors that take no session). `adminKeyDoor` in `ops.ts` takes a place before it compares, so however many arrive at once no more than ten are compared; it compares the SHA-256 of both sides with `safeEqual`, so neither length nor content changes the time; a right key gives its place back; once an address has spent its places even the right key answers 429, or a good guess would still show. An admin's own session is never counted, even beside an old key left on a device. `admin.ts` trusts only the door's flag, so a method with no door (OPTIONS) cannot test a guess. A strong value still matters: this is per address, so many addresses can share out the guessing. Set a 32+ character random value (SECRETS.md), and once the founders are admins consider unsetting `ADMIN_KEY` in production so only admin sessions work | Smoke, section Admin: "the right key spends no try...", "wrong keys are refused, then told to wait...", "once an address has spent its tries even the right key waits...", "an admin signed in on that address is not slowed", "a method with no door opens nothing...", "many guesses at once get no more than the limit compared" |
| 3 | The Razorpay webhook signature was compared with `===` | `verifyWebhook` in `payments.ts` XORs every character and never stops early. The Meta webhook in `routes/go.ts` still used `!==`, found while checking this; it now uses `safeEqual` (2026-11-07) | Read in the code: `payments.ts` `verifyWebhook`, `routes/go.ts` `webhooks.post('/meta')`. Timing itself is not measured by any test |
| 4 | `meetingUrl`, `replayUrl`, the product `url`, `onlineUrl` and Army's `finalUrl` were stored with no scheme check | This one was only partly fixed. `httpUrl` in `db.ts` already covered meetings, replays, lesson videos and event links. A product's `url` and Army work (the source of `finalUrl`) were still plain text, and so were two the first pass had not named, a portfolio piece and a School hand-in. All four go through it since 2026-11-07, and a link that fails is refused with a 400 rather than dropped, so nobody loses what they typed. Rows written earlier are not rewritten: React and the enforcing CSP still refuse a `javascript:` link there | Smoke: "a product's link must be http or https", "an edit cannot put a bad link in", "a portfolio piece's link must be http or https", "a hand-in's link must be http or https", "Army refuses work whose link is not http or https" |
| 6 | The reset mail's body, with its live link, was kept in `email_outbox` | `sendEmail` in `ops.ts` stores `(the link in this mail is not kept)` for a mail sent with `private: true`, and the reset in `routes/auth.ts` is sent that way | Smoke, section Security: "the reset mail's link is not kept in the outbox" reads the smoke database directly |
| 8 | No CI | `.github/workflows/ci.yml`: install (frozen), typecheck, shared tests, `scripts/scan.sh`, build and `pnpm perf:budget` on every push and pull request, with no secrets, read-only, and actions pinned to a full commit. The smoke suite stays local, since it needs a running Worker and its own database, and `pnpm audit --prod` stays a manual step, since a new advisory would fail unrelated pushes. It starts on the next push | The file. Not yet seen running on GitHub |
| 9 | Alerts reached the inbox only | `securityAlerts` also sends one private email per new note, so the same once an hour per kind and admin, holding counts only. While `RESEND_API_KEY` is unset the mail waits in the outbox as `skipped` and the note says "Mail is not set up on this server, so this inbox note is the only alert." A mail that fails never stops the cron or the next admin's mail. Nobody is paged by phone: a Cloudflare error-rate notification is the owner's step below | Smoke, section Security: "an alert mail holds counts only...", "a mail that fails never stops the run...", "a role change goes out as one email to a new admin...", "the inbox note says plainly that mail is not set up", "and a second cron run in the hour sends no second email" |

Banner note: Cloudflare adds `server: cloudflare` to answers; our code sets no `Server` or `X-Powered-By`, and it cannot be removed at the Worker.

## Manual actions only the owner can do

1. **Rotate now**: the OpenRouter key (`ASSISTANT_API_KEY`) and `ADMIN_KEY` that were pasted in an earlier chat session. Steps in SECRETS.md.
2. **Two-factor authentication** on GitHub, Cloudflare, Resend, Razorpay, OpenRouter, Anthropic, Google Cloud (YouTube key) and the email account that owns them.
3. **GitHub**: Settings, Code security: turn on Secret scanning, **Push protection**, **Dependabot alerts** and **Dependabot security updates**. Install the hook: `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`.
4. **Cloudflare**: turn on "Always Use HTTPS" and "Automatic HTTPS Rewrites" for the zone; check SSL mode is Full (strict); add a notification for Worker error rate; keep API tokens scoped to this account.
5. **Spending caps**: OpenRouter (credit limit on the key), Anthropic (monthly limit), Resend (sending limit), Razorpay (settlement and refund approvals), Cloudflare (billing alert).
6. **Mail domain records** (Resend shows the exact values for your domain under Domains; add them at your DNS host):
   - SPF: a TXT record at the sending (sub)domain with `v=spf1 include:amazonses.com ~all` (Resend sends through Amazon SES; if you already have an SPF record, add the `include:` to it, never create a second one).
   - DKIM: the TXT record Resend gives you, named `resend._domainkey` (the value is long and unique to you).
   - Return path: the MX record Resend gives you at `send.<your domain>`.
   - DMARC: a TXT record named `_dmarc` with `v=DMARC1; p=none; rua=mailto:<an address you read>`. After two clean weeks change `p=none` to `p=quarantine`, later `p=reject`.
7. **`PUBLIC_URL`** must be set as a Worker variable to your real site address, or reset and unsubscribe links will use whatever address the request came to.
8. **Restore drill**: do the practice steps in RESTORE.md once and write the date in it.
9. Set `EMAIL_FROM` to an address on the verified domain. Security alerts, like every other mail, go out only once `RESEND_API_KEY` is set.
10. **Automatic checks**: `.github/workflows/ci.yml` starts on the next push. Check that GitHub Actions is allowed under Settings, Actions, and read the first run.

## How to run the security tests

```
pnpm build
bash scripts/smoke/blueprint.sh --fresh --keep     # all 910 checks, including the security section
node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json
SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json node scripts/smoke/csp-browse.mjs   # CSP violations in Chrome
bash scripts/check-exposed.sh http://127.0.0.1:8788      # or your own domain
pnpm audit --prod
pkill -f "wrangler dev --port 8788"
```

The smoke server serves the built `_headers`, so the header checks run against real responses.
