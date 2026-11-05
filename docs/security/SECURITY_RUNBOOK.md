# Security runbook

For the person on call (today that is the founder). Plain steps, in order.

## Where to look

- **The app's own log**: sign in as an admin, open Admin, then Logs (`/internal/logs`). One line per change, refusal, server error, cron run and browser error: area, cleaned path (ids replaced), status, time taken, who. Never a body, never journal or wellbeing lines. Kept thirty days. Only a super admin (role `admin`) can read it. Observability (`/internal/observability`) has the counts.
- **Live Worker output**: `pnpm cf:logs` (a live tail of `console.error` lines). A 500 answer carries a `requestId`; the same id is in the log line, in brackets, and in the tail.
- **The audit trail**: role, permission, deletion and payout changes are rows in `audit_logs` (Admin shows them).
- **Cloudflare**: dashboard, Workers, kreators-life, Metrics and Logs; D1 for the database; Security Events if the zone is behind Cloudflare's firewall.

## Find one person's activity

1. Admin, People, find the person; copy their name.
2. Logs, search the name: every change they made, with times.
3. A bare 401/403/429 has no person; look at the time window and area instead.
4. Journal, wellbeing, Companion, Discover and assistant lines never appear by design.

## What each alert means

The cron (every fifteen minutes) looks at the last fifteen minutes and tells every admin in the inbox (Team tab), at most once an hour per kind (`apps/api/src/alerts.ts`).

| Alert | Level | Likely cause | Look at |
|---|---|---|---|
| Many failed sign-ins | 20 or more in 15 minutes | password guessing, or a user who forgot | Logs, area `auth`, status 401; how many different times; the per-address and per-email limits are already slowing it |
| Many requests were slowed down | 100 or more answers of 429 | a script hammering the app, or a bug that retries | Logs, status 429, which area |
| Many server errors | 20 or more answers of 5xx | a bad deploy, D1 trouble, a provider outage | Logs, level error, the repeated message and its `requestId`; `pnpm cf:logs` |
| A role or a permission changed | any | you did it, or someone got admin | Audit trail, who did it; if it was not you, treat as an emergency |

## First three actions when one fires

1. **Look before touching.** Open Logs for the window. Is it one address, one area, one repeated message? Write the time you started.
2. **Contain.** Sign-in guessing: the limits are already on; if one account is the target, tell the owner of that email to change the password (that signs out every other device). Server errors after a deploy: roll back with `wrangler rollback` from `apps/api` (or redeploy the last good commit). A role you did not give: remove it in Admin, People (audited), change the password of that admin account, and check the audit trail for what they did.
3. **Tell and record.** Note what happened, what you did and when, in a private doc. If personal data may have left, you may owe people and a regulator a notice (India: DPDP; EU/UK: 72 hours). Ask a lawyer.

## Emergency card (suspected leak or break-in)

1. Do not delete logs. Screenshot Logs and the audit trail.
2. Rotate, in this order: `ADMIN_KEY`, the Cloudflare account password and API tokens, GitHub password and tokens, `RAZORPAY_KEY_SECRET` and webhook secret, `RESEND_API_KEY`, `ASSISTANT_API_KEY`, `ANTHROPIC_API_KEY`, `CLICK_SALT` last (see SECRETS.md; `pnpm cf:secret NAME`).
3. Sign everyone out if a session token store may be read: in D1, `DELETE FROM sessions;` through `wrangler d1 execute kreators-life --remote --command "DELETE FROM sessions"`. Every person signs in again.
4. If the site itself is serving something wrong, redeploy the last good commit (`git checkout <good>`, `pnpm deploy`) and check `curl -I https://<domain>/` for the headers.
5. If data was changed, restore with RESTORE.md (D1 Time Travel, 30 days).
6. Turn on two-factor everywhere that lacks it (list in SECURITY_REPORT.md).
7. Write down what happened; fix the cause; add a smoke check so it cannot come back quietly.

## Checks you can run any day

- `bash scripts/check-exposed.sh <your domain>` lists files that should not be public.
- `bash scripts/smoke/blueprint.sh --fresh` runs every automated check, including the security section.
- `pnpm audit --prod` lists known vulnerable packages.
- `node scripts/smoke/csp-browse.mjs` (with a smoke server up and a shot list, see its header) browses the app in Chrome and lists any Content-Security-Policy violation.

## One-time setup

- Install the secret-catching commit hook: `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
