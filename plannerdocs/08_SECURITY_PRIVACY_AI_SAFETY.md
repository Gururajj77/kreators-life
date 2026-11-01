# 08 — Security, privacy and AI safety

**Last updated:** 2026-11-01

**Product:** kreators.app
**Version:** 0.5, reconciled with the app on 1 November 2026, after that day's bug sweep and its legal, security and performance pass (0.3 was 26 October 2026)
**Source of truth:** the auth and privacy rules in `CLAUDE.md`; `apps/api/src/routes/auth.ts`, `me.ts`, `ops.ts`, `index.ts`, `access.ts`, `limits.ts`, `account.ts`, `logs.ts`, `go.ts`, `companion.ts`, `media.ts`, `agency.ts`, `agencyDocs.ts`, `calendar.ts`, `assistant/`; `packages/shared/src/index.ts`; the policy pages in `apps/web/src/site/Policy.tsx`; `headers.ts`, `safeurl.ts`, `alerts.ts`, `cachecontrol.ts`, `routes/legal.ts`; and `docs/security/` (`SECURITY_REPORT.md` is the 27 checks plus 7 bonus checks, each with its evidence and status; `SECURITY_MAP.md`, `SECURITY_RUNBOOK.md`, `SECRETS.md`, `RESTORE.md`). **§14 is the full state after the 2026-11-01 sweep and replaces the older lines where they disagree.**

## 1. Security baseline as built

**Sign-in is hand-built** on Hono and D1, with no package. That departs from the v0.1 advice to use a maintained provider. The reason, decided on 23 October 2026, is the anonymous device session that an email and password are layered onto later. The rules:

- Session tokens are two UUIDs in `sessions`, sent as a Bearer header. An account can be signed in on at most three devices at once (`MAX_DEVICES`); a fourth sign-in signs the oldest out (`newSession` is the one place a session is made), and the pushed-out token is kept for thirty days in `session_evictions` (the cron clears it, and it goes with the account) so that device is told why (`{ error: 'unauthorized', reason: 'devices' }`) instead of a bare 401.
- Passwords are PBKDF2-SHA256 at 100,000 iterations, the Workers free-plan ceiling, with a 16-byte hex salt and a constant-time compare.
- One password rule, `passwordProblem`, runs on the forms and on both endpoints.
- Sign-in answers the same for an unknown email and a wrong password. For an unknown email it hashes against a decoy salt, so the timing matches.
- Changing a password needs the current one and signs out every other device (`POST /me/password`).
- A reset link is 32 random bytes, stored as a SHA-256 hash, good for thirty minutes, one open per account. Any email gets the same answer. Using the link signs every device out. The link is built from the `PUBLIC_URL` variable, never from the request's Host header (see §14).
- Founder addresses in `admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in, audited. Until mail verifies addresses, whoever signs up with one first gets it. Sign up with them right after a deploy.
- Sign-up also asks for a phone number and a date of birth. The server refuses anyone under 18 (`MIN_AGE`), normalises the phone to digits, and never shows either to anyone else. The date of birth cannot be changed afterwards.

The rest of the baseline:

- Roles, permissions, ownership and module flags are checked on the server on every route. See 05.
- Secrets are Worker bindings set with `pnpm cf:secret`. Locally they sit in `.dev.vars`, which git ignores. No key is in the repo or the bundle.
- Every input passes through `str`, `num` or `oneOf` with bounds. Every money amount is an integer. Picture and link blocks are https only. The Markdown renderer emits no HTML and no links. Nothing uses `dangerouslySetInnerHTML`.
- Rate limits live in one file, `apps/api/src/limits.ts`. `LIMITS` holds every name with its count and window, `ROUTE_LIMITS` says which method and path each one guards, and `index.ts` wires them: the doors without a session (paths under `/auth/` and `/public/`) per address before the session check, everything else per person after it. A change to a number is made there and nowhere else. The names, per address: `signin` 10 a minute, `signup` 10 an hour, `forgot` 10 an hour, `reset` 20 an hour, `anon` 60 an hour, `lead` 5 a minute, `clientError` 20 in ten minutes, `vitals` 60 an hour (page-speed reports), `notice` 5 an hour (a copyright notice) and `unsubscribe` 30 an hour, and `portal` 30 in ten minutes (a client approving, sending back, commenting or accepting at their link). On top, `signinEmail` 20 tries per email per quarter hour and `forgotEmail` 3 reset mails per email per hour. Per person: `checkout` 10 a minute; `post` 10, `reply` 30, `like` 120, `follow` 60, `message` 120, `intro` 20, `offer` 20, `create` 30 (listings, products, events, clubs, opportunities, proposals, rewards, and in Agency clients, invoices, agreements and templates), `ticket` 5, `apply` 10, `entry` 10, `claim` 10 (attendee codes, so a custom word cannot be guessed at), `research` 40, `generate` 20, `setup` 20, `reminder` 240, `upload` 30, `assistant` 60, `coachAsk` 20, `coachWrite` 60, `discover` 30, `prefs` 240 and `agency` 600, each an hour.
- `secureHeaders()` runs on every API answer. There is no CORS: the app and the API are one origin, and the old `Access-Control-Allow-Origin: *` was removed on 2026-11-01 (§14).
- A switched-off module is refused by the server, not only hidden: `MODULE_FOR_PREFIX` and `modulesForPath` in `access.ts` map every API prefix to its module, and the middleware in `index.ts` answers 403 when none of its modules is available to the person (the global flag, an override, the rollout and the minimum role all count). A new route file gets a line in that map or it is treated as core and always open.
- CSRF barely applies: sessions are Bearer tokens, never cookies. As defence in depth, a state-changing request that carries a foreign `Origin` is refused with 403 `wrong origin` (§14).
- Uploads are small and checked. A picture or a GIF (JPEG, PNG, WebP, AVIF or GIF) is up to 1 MB (`MAX_UPLOAD_BYTES`; the browser shrinks pictures first), is accepted only when its first bytes say what its header says, is kept as base64 in D1 (`media_files`) and is served from `/api/public/media/:id` only as the type it really is. A person keeps at most 60 files (`MAX_FILES_PER_PERSON`), and `upload` limits it to 30 an hour. A person's files go with their account. A video is only ever a link (YouTube and Vimeo in their own player, or a direct .mp4 or .webm). Uploading to R2 for video is not built. Every deliverable and portfolio item is still a link.
- Every query is a prepared statement with bound values.
- Cloudflare gives TLS in transit and D1 encrypts at rest.
- A 500 logs the error and answers "something broke on our side" (the app's own log keeps the message, never a body). Audit rows carry summaries, never passwords or journal text, and no address.
- No clickable links in what people write to each other: posts, replies, chat lines (Bond, circles, event conversations, pre-owned listings), coach notes, inbox lines and the notes inside Agency render through `components/Inert.tsx`, which keeps a web address as plain text and never an anchor, and `index.html` tells phones not to turn numbers, emails or addresses into links. `scripts/scan.sh` fails on any `dangerouslySetInnerHTML`. The only real links are the ones the owner sets on purpose: a public page's link blocks, an event host's photo-folder link (from a short list of hosts), a deliverable's https link, and partner links.
- Webhooks verify the signature on the raw body, store the raw payload in `webhook_events`, then process; a duplicate is a no-op. A money order becomes `paid` only in the webhook after the signature checks out. Payment code talks to `apps/api/src/payments.ts`, never to a provider SDK directly.

## 2. Who sees what

- A brand member sees only the campaigns and listings of their own organizations. Anyone else gets "not your organization".
- A person sees only their own applications, submissions, orders, bookings, finance, journal, wellbeing, reviews, not-to-do items, Discover answers, Agency records, templates and scheduled reviews. Someone else's row answers 404. Every owner-scoped query filters by the session user id.
- A learner sees a cohort only when enrolled, or with the mentor permission.
- A host sees the registrants of an event. Other attendees see only their own registration and the feedback average. A circle's host sees counts, never who.
- Staff see only the queues their permissions open (`can(user, permission)`). A permission on a plain user is refused. An admin holds every permission except Life coach, which is given on purpose.
- **Journal and wellbeing** never reach brands, staff, the leaderboard or Club selection. They reach the assistant's model only for their owner, the journal only when the owner asks about it, and only through a model that keeps no data. The one other door is a life coach the person said yes to: wellbeing numbers (never a tracker's note) and saved reviews (never their snapshot) reach that coach only while the person's own Reflection switch on that link is on. The journal never reaches a coach.
- **Discover** (quizzes, add-ons, Human design, numerology) is owner only like the journal: never shown to brands, staff, the leaderboard or a coach. Only a short profile (the top and quietest strength, the trait bands and the reasoning level; for the add-ons the four letters, the top love languages and, with their own switch, the three mind bands) can reach the assistant, only while the owner's assistant switch is on and only for a model that keeps no data. Birth details stay on the person's own table.
- **The leaderboard** lists people only after they opt in and finish setup; nobody blocked either way with the viewer is listed; journal and wellbeing never count; no date of birth or age band is ever used.
- **Anonymous posts, replies and event lines** show the reader a made-up name (`anonAlias`, hashed from the writer and the conversation, so it is the same in one thread and different in the next), never the id, handle, follower count or rank; staff keep the id so a report can be acted on. Circle members and Bond chats are aliases only, with no reveal, and member ids never reach the browser.
- **Life coaches:** a coach works only with students who said yes. What a coach sees is the student's choice per link, five switches on to start with (daily and streaks, pillars and pyramids, routine and contract, life map answers, reflection), read fresh on every request with the link active and the permission held at that moment. Never the journal, a tracker's note, money, the Companion, practices, the contract's signed name or a review's snapshot. Every ask, answer, end, share change, note and task change is a line in `coach_log`, shown to both sides.
- **Phone and date of birth** are never shown to anyone else; the date of birth cannot be changed.
- The smoke test proves much of this: journal, finance, not-to-do, the public page, Observability, the staff checks, an owner's Agency records and templates, the business-metrics switch, and the client link's switches. Campaigns, applications and cohorts are checked by reading the code.

## 3. Privacy as practised

- Sign-up stores an email and a password hash. Nothing else is required. City, area and interests are optional. A position is optional, rounded to three decimals, used only by the circle matcher and never returned.
- Click tracking on `/go`, `/out` and page events stores a salted hash of the address, never the address. `CLICK_SALT` is the salt (changing it changes the made-up names of anonymous posts too). The one optional cookie (`kl_click`) follows the consent rules in §14.
- KYC keeps a hash and the last four digits of PAN and bank numbers.
- The public page is opt-in part by part. A switched-off page returns only the name. The server enforces every switch, including friend requests and chats.
- Export is one JSON file of what the person wrote or made (`GET /me/export`), including their Agency records, templates, scheduled reviews, business metrics, messages, posts, tickets, finance lists, the Companion chat, their terms and privacy choices and the state of their calendar link (never its secret). Delete anonymises the person, removes the private rows and keeps money rows for the books; erase wipes progress and keeps the account. Both are logged in `data_requests` with no name. See §12, §14 and 04 §10.
- The privacy page (`/privacy`) says what is kept and for how long (a table read from `RETENTION` in shared), why, the lawful basis for each use, who handles the data (`/subprocessors`, read from `SUBPROCESSORS`), the person's rights and how to use them, the cookie and Global Privacy Control, that the minimum age is 18, a California notice and the AI statement. It has sections on Discover, life coaches, Agency and your clients, the calendar link, the content strategist and the assistant. The terms page is a plain-language draft, now with a section on invoices and agreements, for a lawyer to finish.
- No third-party analytics. Product events stay in our own table. Email goes through Resend only when a key is set, and the outbox keeps every message either way.

## 4. Safety and moderation as built

- Moderators hide posts and replies, and the author is told why. Guides (staff) can pin posts and can switch on holding a new member's first post until a guide says okay (`hold_first_posts`, off by default).
- Anyone blocks anyone (`POST /bond/block`): it ends a friendship, hides posts, replies, event lines and leaderboard rows both ways, and a blocked person cannot ask again. An introduction needs consent first, and a friend request from an event says which event it came from.
- Muting from Community is by rank (`COMMUNITY_RANKS`: member, guide, staff, admin): only someone of a lower rank can be muted, and lifting a mute needs at least the muter's rank.
- Circles and Bond chats use aliases only. There is no reveal.
- Support tickets reach staff with the support permission.
- Random video chat is parked, as v0.1 required.
- Not built: a report button on posts, circle messages, Bond chats or Store chats; a queue of reports; a code of conduct page; appeals.

## 5. The Companion's limits as built

- The module blurb says "Not a therapist." The screen says it is not a therapist and that in a crisis you should call your local emergency number. Help repeats it and names Tele-MANAS 14416 for India.
- Without the `AI` binding, the Companion answers from the person's own numbers. It reflects and asks one question, with fixed lines for tired, stressed, sad, angry, happy and "what next".
- With Workers AI (`@cf/meta/llama-3.1-8b-instruct`), the system prompt says: be warm, brief and concrete, and end with one question. Never diagnose or give medical advice. If someone mentions self-harm, tell them to contact emergency services or a crisis line.
- On self-harm words, a fixed reply names emergency services and Tele-MANAS before any model answers.
- The chat stays with the person and goes nowhere else.
- Wellbeing scores never rank anyone. They never reach a brand, staff, the leaderboard or Club selection, and never decide eligibility for anything.
- Not built: a way to report an unsafe reply, and crisis guidance for regions beyond India. The text does not imply monitoring or emergency response, which is right.

## 6. The book collection

Nothing from the 10 TB collection or the 25,000 books is in the app. Knowledge is curated resources with their sources, seeded by migration and managed by staff. `shubham.md` asks for a chatbot over the books and for the books in the Store. Before either, the v0.1 steps stand. Inventory the sources. Record author, publisher, source, licence and how each was acquired. Sort them into public domain, open licence, licensed and restricted. Decide the permitted uses. Exclude anything without a rights basis. Stop retrieval from returning long passages. Keep provenance and a takedown route. Owning a copy grants no right to train on it or distribute it.

## 7. AI data handling as built

Four places send text to a model. Each is optional and off without its key.

- **The Companion** (Workers AI, the optional `AI` binding) sends the person's first name, streak, wellbeing score and label, today's mood, last night's sleep, the weakest pillar, the open task count, the next task title, the day's small act, and the message. Course drafting sends pasted notes to Workers AI too. Cloudflare processes both inside the Worker's account.
- **The assistant** (any OpenAI-compatible endpoint from `ASSISTANT_BASE_URL`, OpenRouter by default, with `ASSISTANT_API_KEY`) runs only for a person on a plan. What they type, the chat so far and what a tool looks up to do the job go to the model; that can be their tasks and money. It acts as the person, on their own things, with the same limits as a tap: every tool is a description over an existing route, run inside the Worker with the person's own Bearer token, so the session, the module switches, the rate limits, the waits, the xp caps and the owner filters apply exactly as to a tap. The user comes from the token, never from the model; every id a model gives passes `seg` (no slash, no dot); the person's date and zone come from the device. A change is a row with Undo (`assistant_actions`: tool names, ids and plain labels, never journal text); removing and settling wait for Confirm; a Stop button marks the message and the loop checks before each model call and tool.
- **Privacy follows the model.** A model listed as `private` has a zero-retention host and is asked to keep nothing (`ASSISTANT_ZDR`); only then are the journal and tracker reads, and a Discover summary, offered, and the journal is read only when the person asks about it. A model that keeps data is sent without that ask and never offered those reads; the panel says so under the picker. A model off the list is asked for zero retention unless `ASSISTANT_ZDR` is "off".
- **The content strategist** sends one brand folder at a time to Anthropic through the official SDK when `ANTHROPIC_API_KEY` is set: the brand's name, niche, description and voice, its sources with their summaries, the research runs the owner picked, and the brief. Nothing else about the person goes with it. Research goes out through Agent Reach, which is read-only and never posts or logs in for anyone; the bridge accepts only known channels and plain parameters.
- Journal text is never sent to a model, except by the assistant, only for its owner, only when they ask about it, and only through a `private` model. The Companion never sees it. Discover's rules (the brief's next steps) use no model at all. Plan my week, plan strength, the daily brief and the reminders are rules only.
- The system prompts hold no secret and no privileged logic. A model's reply is drawn as small markdown with no links and no HTML.
- The privacy page names the strategist, Anthropic, the assistant and OpenRouter. Not done: it does not yet name Workers AI or what the Companion sends it (check `/subprocessors` for what it lists).
- **Never trained on.** The terms and the privacy page both say: we never use what you write to train AI models, and the companies that run the assistant or the writing tool get only what the job needs. That holds for the app's own code: nothing is exported for training. The assistant's panel says which models keep data, and a model that keeps data never receives the journal or a tracker.

## 8. Minors

The minimum age is 18. Sign-up asks for a date of birth and the server refuses anyone younger; the terms say the same. There is no guardian flow and no age verification beyond the date typed, so the rule keeps honest people out and relies on the terms for the rest.

## 9. Incident response

Nothing is written. The pieces that exist: `pnpm cf:logs` for live logs, Wrangler observability, the audit log, the webhook log with replay, the email outbox, `pnpm cf:secret` to rotate a key, and D1's own point-in-time recovery. Write down who receives a report, the severity levels, the rotation order (the admin key, the assistant and Anthropic keys, Razorpay, Resend, Meta, the Agent Reach key, the click salt), how to restore the database, and what to tell people.

## 10. Agency, the client link and the private calendar link

Agency is owner only: every query filters by the session user id, and the whole app is behind its module gate. What leaves the account does so through a link with a secret in it, each a switch the owner controls.

- **The client link** (`/a/<token>`, a 16-character secret, about 80 bits) shows one client's dashboard, only the parts the owner switched on (waiting for approval, coming up, published, progress and shared notes on by default; channels, hours, invoices and agreements off). `GET /public/agency/:token` builds only what is on; what is off is never sent. Never in it, whatever is switched on: the owner's private notes, per-piece fees, the retainer amount, time entries line by line, other clients, and what a brand wrote in Army. Approving, sending back and commenting can each be switched off and are refused with 403, and all writes are limited per address (`portal`). A fresh link closes the old one; switching it off closes it.
- **An invoice link** (`/i/<token>`, 12 characters, about 60 bits, works only once the invoice is not a draft) carries the invoice with the owner's switches applied on the server before anything is sent (`invoiceForClient`): the bank and UPI details, tax numbers, due date and notes can each be hidden, and the client's browser never receives what is off. Comments and the PDF download are switches too. The client's own Agency client id never leaves.
- **An agreement link** (`/k/<token>`, 16 characters) shows the agreement as sent, lets the client answer the brief (only answers to questions that exist and options that were offered are kept) and accept by typing their name. That is typed acceptance, not a certified e-signature, and the screen says so. A signed agreement is never edited. Comments on it are a switch. Closing it (taking it back to a draft, or voiding it) closes the link.
- **The private calendar link** (`/api/public/calendar/<token>.ics`, 24 characters, about 120 bits) is off until the person switches it on. It carries the title, the pillar and the priority of each open task that has a day (and its time in the person's zone), and the name and time of the reviews they scheduled; never a note, the journal, a mood or anything from a tracker. It is one way: it shows tasks in a calendar and never changes them. A fresh link closes the old one.
- **Personal details:** the business profile (sender, tax numbers, bank, signer) is saved on the person's own account and is shown only on an invoice or an agreement they choose to send, and only the parts they leave switched on.
- **Business metrics** in Reviews are refused by the server (403) until the person switches them on.
- Token secrets are random (`randomCode`), never guessable from an id, never listed anywhere, and a link that does not exist answers 404 with no detail.

## 11. Logs, errors and retention

The app's own log (`app_logs`, `apps/api/src/logs.ts`) has a line for every change anyone makes (any request that is not a plain read), every refusal (4xx, rate limits, failed sign-ins), every server error with its message, every cron run that did something, and every error a browser reports (`POST /public/client-error`, limited per address). A line holds the area, the cleaned path (ids replaced), the status, the time it took and who did it; never a body or a query string. Nothing from the journal, wellbeing, Companion, Discover or the assistant is logged but a bare server-error line with no person and no path. Only a super admin (role `admin`) reads it, since it names people. Lines are kept thirty days (`KEEP_DAYS`; the cron prunes), and a deleted account's name is wiped from them. Observability counts (including Agency's) are counts only: no names, amounts or notes.

## 12. Erase, delete and export

- **Export** (`GET /me/export`): one JSON file of everything the person wrote or made, by table, including Agency's clients, deliverables, notes, time, agreements, comments and templates, scheduled reviews, business metrics and focus settings. The calendar link's secret is left out.
- **Erase** (`POST /me/reset`, under Profile) wipes progress but keeps the device session so the person can start over: pyramids, not-to-do, reviews, xp and scores, the strategy session, Discover, the assistant's actions and the points ledger. It keeps what must not be undone or is not progress: a plan and its credits, unlocked card games, attendee claims and run entries (clearing them would let a code or a run pay again), a life coach and their links, and the person's business records (Agency, invoices).
- **Delete** (the person's own, or an admin's from People, never an admin account or one's own; both through `deleteAccount` in `apps/api/src/account.ts`, audited): the personal details go, the person's own things go (sessions, pyramids, journal, wellbeing, reviews and their schedules, the calendar link, Agency's clients, deliverables, notes, time, agreements, comments, templates and business metrics, uploaded files), and the money records stay anonymised for the books. An invoice stays with its totals and loses who it was for, its lines, the bank and its link. Account deletion needs the word DELETE.

## 13. Hardening from the 2026-11-01 sweep

Four read-only reviewers went over the shared rules, the server, the newer server features and the screens; each proved a bug before it was reported. What was fixed and is now the rule:

- **A typed key finds nothing it should not.** Every `*_BY_KEY` lookup in shared is built by `byKey` as a null-prototype object, so a key like `constructor` or `toString` finds nothing instead of an inherited function (it used to answer 500).
- **A date must be a real day.** `DATE_RE.test` in `apps/api/src/db.ts` checks the calendar, not only the shape: `2026-11-31` and `2026-00-00` are refused with a plain error, never a 500. `parseRepeat` drops an end day that is not a real day. `GET /wellbeing/:kind?days=abc` no longer fails.
- **Members-only community posts stay members-only.** Liking, reading the replies and replying all go through `canSeePost` (the owner or a buyer of the membership); anyone else gets 404.
- **Roles.** `POST /admin/users/:id/role` and the same change in Observability refuse changing your own role (400). Adding a teammate to an organization is `INSERT OR IGNORE`, so it cannot demote an owner who is already a member.
- **A coach cannot set a due day before the student's do day** (`DATES_PROBLEM`), the same rule the student's own edit has.
- **Links.** `parseLinkBlocks` refuses an https link that holds control characters and gives every block its own id. The calendar file escapes a lone carriage return and folds lines before 75 bytes without splitting a character.
- **Free and double use closed.** The test payment path cannot make a points-only product or a points-priced program free, and points and refunds move with a guard first (see 07 §16).

### Reported in the 2026-11-01 sweep, not changed (open items, awaiting a decision)

These were found and written down; none has been fixed or ruled out. Money items are also in 07.

- `POST /public/client-error` was registered before the rate-limit loop in `index.ts`, so its `clientError` limit never ran. **Fixed later 2026-11-01:** the route now comes after the loop and has its line in `ROUTE_LIMITS`.
- `POST /me/password` is not in `ROUTE_LIMITS`, and the current password is compared with `!==`, not the constant-time compare used at sign-in. Still open (a "password changed" mail now follows it, §14).
- `/orgs` has no line in `MODULE_FOR_PREFIX`, so it is treated as core and always open.
- Bond chat messages have no block check, so a blocked person can still be written to in an open chat.
- Community mute uses `INSERT OR REPLACE`, which resets the muter's rank on an existing mute and so changes who may lift it.
- Media uploads can never be deleted by the person; only the 60-file cap and account deletion remove them. Still open.
- Time: a client's approval day (`approved_day`) and the review numbers (`reviews.ts`, `fromTs` and `toTs`) use UTC day edges, not the person's zone.
- Money and points (also 07): Party host cancel says points are refunded but refunds nothing; a waitlist promotion never charges; Store checkout can make orders from one debit under concurrency; School and Party enrolment take points without a `points >= ?` guard; a coupon is spent before a checkout that fails; an invoice's status can move between any two states (draft to paid books income).
- `getStats` counts a Club badge for `accepted`, `member` and `active`, but reviewers set `approved`.
- Screens: a few (Agency and review buttons) ignore a failed save, and some keep a stale error line when a sheet is reopened. A KPI target of 0 means "no target".
- **Delete left some rows behind.** **Fixed later 2026-11-01** for Bond, circle and pre-owned messages, posts and replies, support tickets, finance dues, goals, recurring entries and budgets, the Companion chat, payout details, the person's mail in `email_outbox` (by user and by address) and the client details on invoices (blanked, the totals kept). **Still open:** introductions and applications rows.
- **Export left some things out.** **Fixed later 2026-11-01:** it now includes the Companion chat, portfolio, payout details (last digits only), posts and replies, messages, tickets, finance dues, goals, recurring entries and budgets, `xp_events`, pillar scores and the consent records. **Still out:** Community mutes and event reminders.

## 14. State after the 2026-11-01 security, privacy and performance pass

Three launch checklists (legal, security, performance) were worked through with the rule that nothing may break. Every change was proved by the full smoke suite (910 checks), the browser drivers, the layout probes and a 102-route Chrome browse for policy violations. `docs/security/SECURITY_REPORT.md` is the table of the 27 checks and 7 bonus checks, each with its status (Passed, Fixed and re-tested, or Open), evidence and notes; this section is the summary. Nothing was run against production.

**Headers and browser rules.**
- One enforcing Content-Security-Policy, written in code (`CSP` in `apps/api/src/headers.ts`) and in `apps/web/public/_headers` (the smoke test checks that the two match): own origin for scripts, styles, fonts and connections, plus Razorpay's checkout hosts for the payment window, `frame-src` only for YouTube (no-cookie), Vimeo and Razorpay, `object-src 'none'`, `frame-ancestors 'none'`. Inline styles are allowed (React style attributes). It was first shipped as report-only; `scripts/smoke/csp-browse.mjs` over 102 routes found three needs, now in the policy, and then 0 violations. Going back to watch-only is one word in two files.
- HSTS for two years (`max-age=63072000; includeSubDomains`, no preload), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on the reset page), `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- **No CORS.** `Access-Control-Allow-Origin: *` was on every API answer and is gone. A state-changing request with a foreign `Origin` header is refused with 403 `wrong origin`; no `Origin` (scripts, webhooks) passes, as do the site's own host, `PUBLIC_URL` and loopback in development. Webhooks are checked by signature, not origin.
- Every API answer carries `X-Request-Id`; an authenticated answer is `Cache-Control: no-store` (Explore and uploaded pictures set their own, see `cachecontrol.ts`). A 5xx answers `{ error, requestId }` and nothing else; a malformed JSON body is a 400 and its parser text, which can quote a password, is neither returned nor logged.
- **Blocked paths.** Hidden files, backups, dumps, config, source, logs and `.map` files answer 404 from the Worker (`blockedPath` in `headers.ts` and the `run_worker_first` list in `wrangler.jsonc`, kept in step), where the app shell used to answer 200. `sourcemap: false` in the build. `bash scripts/check-exposed.sh <domain>` asks for them and fails on any 200.

**Outbound requests and links.**
- `apps/api/src/safeurl.ts` (`publicHttpsUrl`, `safeFetch`: https only, no IP numbers, localhost, internal names, logins or odd ports; at most 3 redirects, each re-checked; a timeout and a size cap) guards every fetch of an address a person influenced (`reach.ts`). A public name that resolves to a private address is not caught (no DNS in a Worker; a Worker cannot reach private networks anyway).
- `httpUrl` in `db.ts` keeps only `http` or `https` addresses typed into meeting, replay, video and event link fields (Shop products and lessons, School sessions, Party and Admin events); `javascript:` and the like are dropped on the server. (An older open item in the report said these were unchecked; they now are. An Army `finalUrl` was not re-checked.)

**Alerts, sign-in and mail.**
- `apps/api/src/alerts.ts`, run by the fifteen-minute cron: 20 failed sign-ins, 100 answers of 429, 20 server errors, or any role or permission change in fifteen minutes tell every admin in the inbox (Team tab), once an hour per kind. The text holds counts only. A plain read that takes 1.5 seconds or more is logged as a warning (`SLOW_READ_MS`).
- The Razorpay webhook signature is compared in constant time (`verifyWebhook` in `payments.ts`).
- The reset link comes from `PUBLIC_URL`. The reset mail's body, which holds the live link, is not kept in the outbox (`private: true` in `sendEmail`: a note is stored instead). A "your password was changed" mail follows a reset and a change; a mail failure never blocks the change.
- Links in what people write to each other stay inert text (see §1); `scripts/scan.sh` also fails on an `<img>` without `alt`.

**Secrets and the repository.** The whole git history (51 commits, 19 key patterns, every `.env*`, `.dev.vars*`, `*.pem`, `*.key` path) was searched: no real secret. `.gitignore` covers `.env.*`, `.dev.vars.*`, `*.pem`, `*.key`. `scripts/hooks/pre-commit` refuses a commit that adds something that looks like a key (written and tested on a throwaway repo, **not installed**: `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`, or `git config core.hooksPath scripts/hooks`). `pnpm audit --prod` found no known vulnerabilities. `docs/security/SECRETS.md` lists every secret and how to rotate it.

**Consent model (migration 0059, `routes/legal.ts`, `lib/consent.ts`).**
- Three choices, all off until the person says yes (`CONSENT_PURPOSES`): remember which tracked link brought me (the `kl_click` cookie), show videos from YouTube and Vimeo, and send me news and offers by email.
- Asked once, in a card at the bottom left (`ConsentPopup`), stored on the account and, for a visitor, on the device; changed any time under Profile, Privacy choices. The card comes back only when `CONSENT_VERSION` changes or the footer's "Privacy choices" button asks.
- The browser tells the server its answer in the `kc_attr` cookie. `/go` sets `kl_click` only outside the countries that wait for a yes (`CONSENT_FIRST_COUNTRIES`: the EU, the UK, Switzerland and others) or after a yes, and never when the browser sends Global Privacy Control (`Sec-GPC`). A video waits behind `EmbedGate` until allowed or tapped.
- Marketing email goes only with a recorded yes, carries an unsubscribe link and `List-Unsubscribe` headers, and has a public unsubscribe page; receipts and resets are not marketing (see 07 §17).
- Terms: sign-up needs `acceptTerms: true` (an unticked box on the sign-up page, the setup chat's account card and the account form); each acceptance is an append-only row of document and version (`terms_acceptances`, `LEGAL_VERSION`). An account made earlier sees a one-time notice (`POST /me/legal/accept`). Choices are a row per purpose (`user_consents`) and an append-only log (`consent_records`, with source and banner version). `data_requests` logs each export and delete with the date only, and `copyright_notices` holds notices and counter-notices from the public form (limit `notice`; an admin is told).
- Public pages: `/terms`, `/privacy`, `/refunds`, `/contact`, `/pricing`, `/subprocessors`, `/copyright`, `/licences` (44 production packages, no copyleft; `scripts/licences.mjs` writes `licences.json`). Business details come from Worker variables and say "Being set up" until set.

**Retention** (`RETENTION` and `RETENTION_DAYS` in shared; the cron's `tidyOld` applies the ones with a number): account data until the account is deleted; journal and wellbeing until the entry or account is deleted; sessions until sign-out, the device cap, or thirty days after a push-out; reset links thirty minutes, the used or expired row removed within seven days; the app's own log thirty days; the mail outbox 90 days; raw payment messages 365 days (the text is cleared, the order stays); orders, invoices and money records seven years with the name removed on delete; tracked-link clicks 396 days; terms and privacy choices until the account is deleted; data requests and copyright notices three years (1,095 days); page-speed reports 90 days. Water reminders from a past day are deleted by the cron.

**What export and delete cover now.** Export: everything in §12 plus messages, posts, replies, tickets, finance lists, the Companion chat, portfolio, payout details (last digits only), xp and pillar scores, and the terms and privacy choices. Delete: the same, plus mail in the outbox and client details on invoices; money rows stay for the books. Still not covered: introductions and applications on delete; Community mutes and event reminders in the export. Both actions are logged in `data_requests`.

**AI statement.** What people write is never used to train a model. Four places send text to a model (see §7); each is optional and off without its key; the journal and wellbeing reach only a model that keeps nothing, only for their owner, and only when asked; Discover's results send only a short profile.

**Accepted and open, with next steps** (the report's open table, as it stands after the later fixes):
- Session tokens live in `localStorage` (a decision: Bearer tokens, no cookies). Mitigated by the enforcing CSP, no third-party script, no raw HTML sinks and at most 3 devices; a cross-site scripting hole would still expose tokens, so keep the CSP and the sink scan.
- `/api/admin/*` accepts the shared `ADMIN_KEY` with no per-address limit and no session; the local default is `dev-admin-key`. Next: a 32+ character random value in production, and consider unsetting it once the founders are admins.
- No second factor for staff or anyone.
- No CI: nothing runs the tests, the audit or a frozen install on a push.
- Alerts reach the inbox only; nobody is paged.
- One real test-mode payment with the browser console open has not been made, so bank pages, UPI apps and 3-D Secure are untested against the policy. A "Refused to..." line is a gap; roll back to report-only if one blocks a payment.
- A public name that points at a private address passes `publicHttpsUrl` (accepted).
- Public pages are drawn in the browser, not on the server (accepted, see `docs/performance.md`).
- Older open items in §13 that remain: the password change compare and rate limit, `/orgs` as core, Bond chat block check, mute rank on replace, no media delete, UTC day edges, the money items, introductions and applications on delete.

**Owner's manual actions** (only the owner can do these; detail in the report and `SECRETS.md`): rotate the OpenRouter key and `ADMIN_KEY` that were pasted in an earlier chat; two-factor on GitHub, Cloudflare, Resend, Razorpay, OpenRouter, Anthropic, Google and the email account that owns them; GitHub secret scanning, push protection and Dependabot, and install the pre-commit hook; Cloudflare "Always Use HTTPS" and "Automatic HTTPS Rewrites", SSL mode Full (strict), an error-rate notification; spending caps at OpenRouter, Anthropic, Resend, Razorpay and Cloudflare; SPF, DKIM, return-path and DMARC records for the mail domain, and `EMAIL_FROM` on it; set `PUBLIC_URL` as a Worker variable (reset and unsubscribe links depend on it); do the restore drill in `RESTORE.md` once and write the date in it.

## Known gaps

- No report button, no report queue, no code of conduct.
- No email or phone verification, and no age verification beyond the date typed.
- An incident runbook and a restore guide now exist (`docs/security/SECURITY_RUNBOOK.md`, `RESTORE.md`), but the restore drill has not been done once.
- The privacy page names the strategist, Anthropic, the assistant and OpenRouter, but not Workers AI or what the Companion sends it.
- Uploaded files that nothing uses any more are not cleaned out: only the 60-file cap and account deletion remove them.
- No two-factor sign-in and no session list the person can read, beyond the three-device cap.
- A client link has no expiry date; it works until the owner closes or renews it.
- The open items in 13 and 14 (found 2026-11-01, awaiting a decision). The export and delete gaps are mostly closed; read "everything the person wrote" in 3 and 12 as nearly all of it (the exceptions are listed in 13).
- No second factor for staff, no CI, alerts only in the inbox, session tokens in `localStorage` (accepted), and the `/api/admin` key has no rate limit (§14).

## What changed since this was written (2026-11-01)

Since 26 October 2026: an account is capped at three devices and the pushed-out one is told why; the list of rate limits grew to 34 names (assistant, Discover, coaching, upload, Agency, client links and more); pictures and GIFs can be uploaded (small, checked by their first bytes), so "there are no uploads" no longer holds; the assistant can read the journal for its owner, on request and only through a model that keeps nothing; Discover, life coaches, the leaderboard and anonymous posts have written privacy rules; Agency added the client link, invoice and agreement links and the calendar link, each with switches enforced on the server; the app has its own thirty-day log; erase, delete and export now cover the new tables; the privacy page gained sections for most of this.

**2026-11-01 (bug sweep):** section 13 is new. It records what the sweep fixed (null-prototype key lookups, real-calendar date checks, members-only community posts, no changing your own role, no demoting an owner by adding them as a teammate, the coach date rule) and lists everything it reported but did not change, including the export and delete gaps, as open items awaiting a decision.

**2026-11-01 (later, legal, security and performance pass):** section 14 is new and is the full state after the pass: an enforcing CSP and the other headers, no CORS and an Origin check on writes, blocked paths, the outbound-address guard (`safeurl.ts`) and `httpUrl` on typed links, inbox alerts, the reset link from `PUBLIC_URL` and a reset mail the outbox does not keep, a constant-time webhook compare, the consent model (terms boxes, three choices that start off, Global Privacy Control, marketing mail by recorded yes), the retention list, and export and delete that now cover messages, posts, tickets, finance lists, the Companion chat and consent records. The limit list is now 37 names. Several §13 open items are marked fixed in place (the client-error limit, most of the delete and export gaps). `docs/security/SECURITY_REPORT.md` holds the 27 checks and 7 bonus checks. What stays open, and what only the owner can do, is at the end of §14.
