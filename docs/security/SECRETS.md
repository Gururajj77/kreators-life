# Secrets register

Names and facts only. Never write a value in this file, in git, in a chat or in a ticket. "Last rotated" is for you to fill in.

Where a secret lives: **Cloudflare secret** (`pnpm cf:secret NAME` sets it on the Worker), **local** (`apps/api/.dev.vars`, git-ignored, never shared), or **provider dashboard**.

| Name | What it does | Who owns it | Where it is stored | Last rotated | How to rotate |
|---|---|---|---|---|---|
| `ADMIN_KEY` | opens `/api/admin/*` without a session | founder | Cloudflare secret; local `.dev.vars` (dev value only) | | make a new 32+ character random value, `pnpm cf:secret ADMIN_KEY`, update your password manager |
| `CLICK_SALT` | hashes click addresses and anonymous aliases | founder | Cloudflare secret | | changing it changes anonymous names in old threads and breaks click de-duplication; rotate only if leaked |
| `RAZORPAY_KEY_ID` | public checkout id | founder | Cloudflare variable | | Razorpay dashboard, then update |
| `RAZORPAY_KEY_SECRET` | creates orders and refunds | founder | Cloudflare secret | | Razorpay dashboard, regenerate key, update, test a payment in test mode |
| `RAZORPAY_WEBHOOK_SECRET` | verifies webhook signatures | founder | Cloudflare secret + Razorpay webhook settings | | set a new secret in Razorpay's webhook, then `pnpm cf:secret RAZORPAY_WEBHOOK_SECRET` at once |
| `RESEND_API_KEY` | sends mail | founder | Cloudflare secret | | Resend dashboard, new key with "Sending access" only, revoke the old one |
| `ANTHROPIC_API_KEY` | content strategist writer | founder | Cloudflare secret | | Anthropic console, new key, revoke old, set a spend limit |
| `ASSISTANT_API_KEY` | assistant model provider (OpenRouter) | founder | Cloudflare secret | | OpenRouter, new key with a credit limit, revoke old. **This key was pasted in an earlier chat session: rotate it now.** |
| `REACH_KEY` | bridge key | founder | Cloudflare secret + the bridge's own start line | | choose a new value in both places |
| `YOUTUBE_API_KEY` | YouTube reads | founder | Cloudflare secret | | Google Cloud console, new key restricted to the YouTube Data API |
| `META_APP_SECRET` | Meta webhook signature | founder | Cloudflare secret | | Meta app dashboard |
| `META_ACCESS_TOKEN` | Meta private replies | founder | Cloudflare secret | | Meta app dashboard |
| `META_VERIFY_TOKEN` | Meta webhook subscription check | founder | Cloudflare secret | | any new random word, set in both places |
| `ADMIN_EMAILS` | extra founder addresses | founder | Cloudflare variable (not secret) | | edit when a founder joins or leaves |
| GitHub account | repository access | founder | provider | | turn on two-factor, enable push protection |
| Cloudflare account | deploys, D1, secrets | founder | provider | | two-factor, no shared logins, API tokens scoped to this account |

## Rules

- A value pasted anywhere outside the provider's dashboard or `pnpm cf:secret` counts as leaked: rotate it.
- `.dev.vars` and `.env*` are ignored by git (`.gitignore`); the example file `apps/api/.dev.vars.example` holds names and harmless dev values only.
- `scripts/hooks/pre-commit` refuses a commit that adds something that looks like a key (install note in SECURITY_RUNBOOK.md).
- The Worker never logs a secret: the app log keeps a cleaned path, a status and a short message, never a body, header or query string.
