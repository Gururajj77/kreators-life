# 08 — Security, privacy and AI safety

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** the auth rules in `CLAUDE.md`; `apps/api/src/routes/auth.ts`, `me.ts`, `ops.ts`, `index.ts`, `go.ts`, `companion.ts`; the policy pages in `apps/web/src/site/Policy.tsx`.

## 1. Security baseline as built

**Sign-in is hand-built** on Hono and D1, with no package. That departs from the v0.1 advice to use a maintained provider. The reason, decided on 23 October 2026, is the anonymous device session that an email and password are layered onto later. The rules:

- Session tokens are two UUIDs in `sessions`, sent as a Bearer header.
- Passwords are PBKDF2-SHA256 at 100,000 iterations, the Workers free-plan ceiling, with a 16-byte hex salt and a constant-time compare.
- One password rule, `passwordProblem`, runs on the forms and on both endpoints.
- Sign-in answers the same for an unknown email and a wrong password. For an unknown email it hashes against a decoy salt, so the timing matches.
- Changing a password needs the current one and signs out every other device.
- A reset link is 32 random bytes, stored as a SHA-256 hash, good for thirty minutes, one open per account. Any email gets the same answer. Using the link signs every device out.
- Founder addresses in `admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in, audited. Until mail verifies addresses, whoever signs up with one first gets it. Sign up with them right after a deploy.
- Sign-up also asks for a phone number and a date of birth. The server refuses anyone under 18 (`MIN_AGE`), normalises the phone to digits, and never shows either to anyone else. The date of birth cannot be changed afterwards.

The rest of the baseline:

- Roles, permissions, ownership and module flags are checked on the server on every route. See 05.
- Secrets are Worker bindings set with `pnpm cf:secret`. Locally they sit in `.dev.vars`, which git ignores. No key is in the repo or the bundle.
- Every input passes through `str`, `num` or `oneOf` with bounds. Every money amount is an integer. Picture and link blocks are https only. The Markdown renderer emits no HTML and no links. Nothing uses `dangerouslySetInnerHTML`.
- Rate limits live in one file, `apps/api/src/limits.ts`, one line each with the route it guards. Per address on the doors without a session: sign-in 10 a minute, sign-up 10 an hour, forgot 10 an hour, reset 20 an hour, anonymous start 60 an hour, the lead form 5 a minute. Per person after sign-in: checkout 10 a minute, posts 10 an hour, replies 30, likes 120, follows 60, chat messages 120 (Bond, circles, pre-owned), introductions 20, offers 20, things put up 30 (listings, products, events, clubs, opportunities, proposals, rewards), tickets 5, applications 10 (Work, Win, Club, collabs), run entries 10. On top, 20 sign-in tries per email per quarter hour and 3 reset mails per email per hour.
- `secureHeaders()` runs on every API answer. CORS is open, since one Worker serves the bundle.
- CSRF does not apply: sessions are Bearer tokens, never cookies.
- There are no uploads. Every picture, deliverable and portfolio item is a link. So there is no file storage and no upload abuse surface.
- Every query is a prepared statement with bound values.
- Cloudflare gives TLS in transit and D1 encrypts at rest.
- A 500 logs the error and answers "something broke on our side". Audit rows carry summaries, never passwords or journal text, and no address.

## 2. Who sees what

- A brand member sees only the campaigns and listings of their own organizations. Anyone else gets "not your organization".
- A person sees only their own applications, submissions, orders, bookings, finance, journal, wellbeing, reviews and not-to-do items. Someone else's row answers 404.
- A learner sees a cohort only when enrolled, or with the mentor permission.
- A host sees the registrants of an event. Other attendees see only their own registration and the feedback average.
- Staff see only the queues their permissions open. A permission on a plain user is refused.
- The smoke test proves this for journal, finance, not-to-do, the public page, Observability and the staff checks. Campaigns, applications and cohorts are checked by reading the code.

## 3. Privacy as practised

- Sign-up stores an email and a password hash. Nothing else is required. City, area and interests are optional. A position is optional, rounded to three decimals, used only by the circle matcher and never returned.
- Click tracking on `/go`, `/out` and page events stores a salted hash of the address, never the address. `CLICK_SALT` is the salt.
- KYC keeps a hash and the last four digits of PAN and bank numbers.
- The public page is opt-in part by part. A switched-off page returns only the name. The server enforces every switch, including friend requests and chats.
- Export is one JSON file of everything the person wrote. Delete anonymises the person, removes the private rows and keeps money rows for the books. See 04 §10.
- The privacy page says what is kept, why, who sees it, and how to take it or delete it. The terms page is a plain-language draft dated 24 October 2026, for a lawyer to finish.
- No third-party analytics. Product events stay in our own table. Email goes through Resend only when a key is set, and the outbox keeps every message either way.

## 4. Safety and moderation as built

- Moderators hide posts and replies, and the author is told why.
- Bond has block. A blocked person cannot ask again. An introduction needs consent first.
- Circles and Bond chats use aliases only. There is no reveal.
- Support tickets reach staff with the support permission.
- Random video chat is parked, as v0.1 required.
- Not built: a report button on posts, circle messages, Bond chats or Store chats; a queue of reports; a code of conduct page; appeals.

## 5. The Companion's limits as built

- The module blurb says "Not a therapist." The screen says it is not a therapist and that in a crisis you should call your local emergency number. Help repeats it and names Tele-MANAS 14416 for India.
- Without the `AI` binding, the Companion answers from the person's own numbers. It reflects and asks one question, with fixed lines for tired, stressed, sad, angry, happy and "what next".
- With Workers AI, the system prompt says: be warm, brief and concrete, and end with one question. Never diagnose or give medical advice. If someone mentions self-harm, tell them to contact emergency services or a crisis line.
- On self-harm words, a fixed reply names emergency services and Tele-MANAS before any model answers.
- The chat stays with the person and goes nowhere else.
- Wellbeing scores never rank anyone. They never reach a brand, staff, the leaderboard or Club selection, and never decide eligibility for anything.
- Not built: a way to report an unsafe reply, and crisis guidance for regions beyond India. The text does not imply monitoring or emergency response, which is right.

## 6. The book collection

Nothing from the 10 TB collection or the 25,000 books is in the app. Knowledge is curated resources with their sources, seeded by migration and managed by staff. `shubham.md` asks for a chatbot over the books and for the books in the Store. Before either, the v0.1 steps stand. Inventory the sources. Record author, publisher, source, licence and how each was acquired. Sort them into public domain, open licence, licensed and restricted. Decide the permitted uses. Exclude anything without a rights basis. Stop retrieval from returning long passages. Keep provenance and a takedown route. Owning a copy grants no right to train on it or distribute it.

## 7. AI data handling as built

- Workers AI is optional and used in two places. The Companion sends it the person's first name, streak, wellbeing score and label, today's mood, last night's sleep, the weakest pillar, the open task count, the next task title, the day's small act, and the message. Course drafting sends pasted notes. Cloudflare processes both inside the Worker's account.
- The content strategist sends one brand folder at a time to Anthropic through the official SDK when `ANTHROPIC_API_KEY` is set: the brand's name, niche, description and voice, its sources with their summaries, the research runs the owner picked, and the brief. Nothing else about the person goes with it. Research goes out through Agent Reach, which is read-only and never posts or logs in for anyone; the bridge accepts only known channels and plain parameters. The privacy page says all of this.
- Journal text is never sent to a model.
- The system prompt holds no secret and no privileged logic.
- Not done: the privacy page does not yet name Workers AI or what the Companion sends it.

## 8. Minors

The minimum age is 18. Sign-up asks for a date of birth and the server refuses anyone younger; the terms say the same. There is no guardian flow and no age verification beyond the date typed, so the rule keeps honest people out and relies on the terms for the rest.

## 9. Incident response

Nothing is written. The pieces that exist: `pnpm cf:logs` for live logs, Wrangler observability, the audit log, the webhook log with replay, the email outbox, `pnpm cf:secret` to rotate a key, and D1's own point-in-time recovery. Write down who receives a report, the severity levels, the rotation order (the admin key, Razorpay, Resend, Meta, the click salt), how to restore the database, and what to tell people.

## Known gaps

- No report button, no report queue, no code of conduct.
- No email or phone verification, and no age verification beyond the date typed.
- No incident response document, no written backup and restore.
- The privacy page names the strategist and Anthropic but not Workers AI.
