# 05 — Feature flags, entitlements and access control

Last updated: 2026-11-05

**Product:** kreators.app
**Version:** 0.6, reconciled with the app on 5 November 2026
**Source of truth:** `apps/api/src/access.ts`, `apps/api/src/db.ts` (`can`, `isGuide`, `isStaff`, `orgRole`), `packages/shared/src/modules.ts` (`MODULES`, `MODULE_GROUP_ORDER`, `GROUP_OPEN_DEFAULT`, `AppPrefs`, `moduleState`), `packages/shared/src/roles.ts` (`PERMISSIONS`, `isStaffFor`), `apps/api/src/routes/admin.ts` (the flag routes), `apps/api/src/agencyTeamAccess.ts`, `apps/api/src/portalAccess.ts`, `apps/api/src/teamLinkAccess.ts`, and the Flags and People pages under Admin.

## 1. Purpose

Flags let an admin switch any module off without a deploy. A flag can also limit a module to a role, roll it out to a share of people, or override it for one person, one role or one brand. Authorization is a separate layer. Roles, permissions and ownership decide what a person may do inside a module.

**Rule from v0.1, kept:** a frontend toggle is never the only security control. **Status:** holds for roles, permissions, ownership and module flags. See §3, §4 and §10. It holds at a shared link too. The parts the owner switched off are removed on the server before anything is sent (§6). It holds for an Agency team member as well: one server gate reads their row on every request (§5b).

## 2. The flag model as built

One flag per module, keyed by the module key: `army`, `agency`, `companion`. There is no `module.` prefix. There are no `feature.` or `ops.` flags and no environments on a flag.

- `module_settings` holds `key`, `enabled`, `min_role` (user, sub_admin, admin) and `rollout` (0 to 100). A module with no row is enabled, with the minimum role from `MODULES` and a rollout of 100.
- `flag_overrides` holds `flag_key`, `subject_type` (user, role, organization), `subject_id`, `enabled`, `expires_at`, `reason` and `created_by`. Expired overrides are ignored when read. An override cannot switch off a locked module (the route answers 400, "That part of the app is always on.").
- `MODULES` carries each module's own defaults: `defaultOn`, `minRole`, and `locked` for the parts a person cannot switch off. The locked ones are Home, Daily, Pillars, Search and the Assistant.
- There are 46 modules in six groups. The groups always come in one order (`MODULE_GROUP_ORDER`): Contribution, Reflection, Connection, Creation, Essentials, then Operations, the team's own group.
- `users.modules` is the person's own on or off per app. The setup chat writes it for the apps that fit the person's answers. It switches only `setupSwitchable` apps: Contribution, Creation, Connection and Reflection, never the essentials or the team's tools. Afterwards a person changes it on the Apps page or under Profile, Features (`PATCH /me/modules`). Both draw the same group list with a switch beside each app.
- `users.app_prefs_json` (migration 0074) is the person's own arrangement of the groups. It says which groups start open and the order of apps inside a group. It never changes what is available or on (§12).
- The flags and live overrides are kept by each Worker instance for five seconds (`ACCESS_TTL_MS`). Every admin route that writes a flag or an override drops that copy at once (`forgetAccessContext`). So a change shows on the next request there, and within five seconds everywhere else.

## 3. The modules as built

"On for a new account" is the module's own default. The setup chat then switches on the apps that fit and off the rest. The table follows the one group order.

The Apps page and Profile, Features list every app that is available to the person, on or off, with its switch. Locked apps are not listed there. The laptop sidebar and the phone menu list the apps that are on, under their group. Inside a group the apps come in the person's own order first (§12), then by context: what is on, then what fits their answers, then what they open most on this device.

| Group | Key | Name | Path | On for a new account | Minimum role | Locked |
|---|---|---|---|---|---|---|
| Contribution | `school` | School | `/school` | on | user |  |
| Contribution | `work` | Work | `/work` | on | user |  |
| Contribution | `army` | Army | `/army` | on | user |  |
| Contribution | `win` | Win | `/win` | off | user |  |
| Contribution | `agency` | Agency | `/agency` | off | user |  |
| Reflection | `discover` | Discover | `/discover` | off | user |  |
| Reflection | `life` | Life | `/life` | on | user |  |
| Reflection | `wellbeing` | Wellbeing | `/wellbeing` | off | user |  |
| Reflection | `mood` | Mood | `/mood` | off | user |  |
| Reflection | `sleep` | Sleep | `/sleep` | off | user |  |
| Reflection | `stress` | Stress | `/stress` | off | user |  |
| Reflection | `mindful` | Mindfulness | `/mindful` | off | user |  |
| Reflection | `journal` | Journal | `/journal` | on | user |  |
| Reflection | `reviews` | Reviews | `/reviews` | off | user |  |
| Reflection | `companion` | Companion | `/companion` | off | user |  |
| Reflection | `coaching` | Coaching | `/coaching` | off | user |  |
| Connection | `cards` | Games | `/cards` | off | user |  |
| Connection | `party` | Party | `/party` | off | user |  |
| Connection | `run` | Kreators Run | `/run` | off | user |  |
| Connection | `community` | Community | `/community` | off | user |  |
| Connection | `club` | Club | `/club` | off | user |  |
| Connection | `bond` | Bond | `/bond` | off | user |  |
| Connection | `circles` | Circles | `/circles` | off | user |  |
| Creation | `profile` | Public page | `/profile` | on | user |  |
| Creation | `shop` | Shop | `/shop` | on | user |  |
| Creation | `store` | Store | `/store` | off | user |  |
| Creation | `audience` | Audience | `/shop/audience` | off | user |  |
| Creation | `content` | Content | `/shop/content` | off | user |  |
| Creation | `automations` | Auto-DM | `/shop/automations` | off | user |  |
| Creation | `finance` | Finance | `/finance` | off | user |  |
| Creation | `library` | My purchases | `/library` | off | user |  |
| Creation | `knowledge` | Knowledge | `/knowledge` | off | user |  |
| Creation | `tools` | Tools | `/tools` | off | user |  |
| Creation | `tv` | TV | `/tv` | off | user |  |
| Creation | `fund` | Fund | `/fund` | off | user |  |
| Essentials | `home` | Home | `/home` | on | user | yes |
| Essentials | `today` | Daily | `/today` | on | user | yes |
| Essentials | `tower` | Pillars | `/tower` | on | user | yes |
| Essentials | `search` | Search | `/search` | on | user | yes |
| Essentials | `leaderboard` | Leaderboard | `/leaderboard` | on | user |  |
| Essentials | `notifications` | Inbox | `/inbox` | on | user |  |
| Essentials | `help` | Help | `/help` | on | user |  |
| Essentials | `assistant` | Assistant | `/plans` | on | user | yes |
| Operations | `manage` | Manage | `/manage` | on | staff |  |
| Operations | `admin` | Admin | `/admin` | on | admin |  |
| Operations | `observability` | Observability | `/internal/observability` | on | staff |  |

The count by group: Contribution 5, Reflection 11, Connection 7, Creation 12, Essentials 8, Operations 3. Games is switched on when a person unlocks a game in Rewards.

## 4. Evaluation order

`accessFor` runs this for every module, in this order:

1. Start from the global switch (on by default), the minimum role and the rollout. The setting's values win over the module's own.
2. Apply the most specific live override: the person first, then any brand they belong to, then their role. An override sets the module on or off outright (an override that turns it off gives the reason `override`).
3. With no override: if the global switch is off, the reason is `disabled`. Else, if the rollout is under 100 and the person's bucket is at or past it, the reason is `rollout`. The bucket is `rolloutBucket(userId, key)`, a fixed hash from 0 to 99.
4. Then, if the person's role ranks below the minimum role, the module is unavailable with reason `role`. An override that switches a module on does not lift the minimum role.
5. A module is `on` when it is available and either locked, switched on by the person, or on by default.

The result is one record per module: `available`, `on`, and a reason (`ok`, `disabled`, `override`, `rollout` or `role`). `GET /me` returns it and `Gate` uses it on the client. The same pure function scores every account for Observability, and Admin's "what does this person see?" preview uses it too.

The API enforces it too. `MODULE_FOR_PREFIX` in `access.ts` maps every API prefix to the module or modules that own it. A middleware in `index.ts` runs after the session check. It resolves access for the person and answers 403 ("<Name> is not available on your account.", with the module key) unless at least one of the path's modules is available. Only `available` counts, not the person's own on/off. Switching an app off for yourself is a preference the client keeps, and other screens may still read its data. A two-segment prefix (`studio/brands`) wins over its one-segment parent (`studio`). A prefix not in the map is the core and always open, so a new route file must be added to the map.

| API prefix | Module or modules that own it |
|---|---|
| `school`, `work`, `army`, `win`, `agency`, `party`, `run`, `community`, `club`, `leaderboard`, `cards`, `discover`, `bond`, `circles`, `life`, `journal`, `reviews`, `companion`, `assistant`, `tools`, `finance`, `manage` | the module of the same name |
| `community/channels` | `community` |
| `bond/channels` | `bond` |
| `assistant/feelings` (the feelings reader in the strategy session) | `assistant` |
| `connect` (photos, the conversation and who to meet inside an event) | `party`, `run` (either) |
| `wellbeing` | `wellbeing`, `mood`, `sleep`, `stress`, `mindful`, `life` (any) |
| `coach` (the coach's side and the directory) | `coaching` |
| `studio`, `kyc` | `shop` |
| `studio/links`, `studio/content` | `content`, `automations` (either) |
| `studio/brands` | `content` |
| `studio/automations`, `studio/funnels`, `studio/sequences` | `automations` |
| `studio/leads`, `studio/broadcasts` | `audience` |
| `market` | `store` |
| `resources` | `knowledge` |
| `proposals` | `tv`, `fund` (either) |
| `internal` | `observability` |

`reviews/kpis` sits under `reviews`, so business metrics need Reviews available and the person's own switch. `agency/team`, `agency/docs` and the team link's owner routes sit under `agency`.

Always open (the core):

- `me`, with everything under it. That includes `me/coach`, where a student answers, shares and ends a coaching link. It includes `me/teams`, where a person answers an Agency team invite, leaves a team or reads a client member's view. It includes `me/calendar`, `me/activity`, and `me/legal`, where a person saves privacy choices and accepts the terms notice. So switching an app off never stops anyone from saying no, leaving, or changing a privacy choice.
- `onboarding`, `session`, `nodes`, `today`, `insights`, `rewards`, `inbox`, `search`, `support`, `home`, `media`, `reminders`, `credits`, `discounts` (it only prices a code; each checkout is gated where it lives), `store` (a product's checkout and follow) and `orgs` (see the open item below).
- `insights` (Emerging) is core but stricter than the gate. It reads only the apps that are `on` for the person, available and switched on, and sends no read for an app that is off.

**Open item:** `/orgs` (brands, their teammates, `routes/orgs.ts`) is mounted in `index.ts` but has no line in `MODULE_FOR_PREFIX`. So it is open as core even when Army is off for the person. Its own checks still apply (`orgRole`, or the `talent` permission, to add a teammate). Whether it should map to `army` is a decision for the founder; it is listed under Known gaps.

The `admin` routes sit outside the session check and have their own (§7). The public routes need no session (see 03, §6). `public` is left out of the map on purpose: a client has no account, so each client route asks `requirePortalAccess` or `requireTeamLinkAccess` instead (§6). The assistant's tools run through the same routes as the person, so the gate holds for them too. A tool is offered only while its app is on.

## 5. Access model as built

- **Roles:** `user` (shown as Creator), `sub_admin` (Staff) and `admin`, ranked. A module's minimum role keeps Manage behind staff, Admin behind admins and the Operations group behind staff. Only an admin changes a role, and every change is audited. Nobody changes their own role, on either door. `POST /admin/users/:id/role` (the Admin console) and `POST /internal/users/:id/role` (Observability) both answer 400 "you cannot change your own role". The admin-key door has no signed-in person, so the key can still set any role; that is what it is for.
- **Permissions:** nine jobs, held in `users.permissions`. `can(user, permission)` is the one check, and it calls `isStaffFor`:

| Permission | What it is for | Who may hold it |
|---|---|---|
| `talent` | Runs Army campaigns, shortlists and assigns creators | staff, given it |
| `cohorts` | Publishes programs, runs cohorts, marks completion | staff, given it |
| `events` | Creates any kind of event, checks people in, opens circles and sets their tables | staff, given it |
| `finance` | Approves bounty payouts, reviews money orders and manages discount codes | staff, given it |
| `moderation` | Hides posts and handles reports; makes someone a guide in Community and its channels | staff, given it |
| `support` | Answers help requests | staff, given it |
| `review` | Decides Club applications, bounties, TV and Fund proposals | staff, given it |
| `mentor` | Gives feedback on assignments | a creator or staff, given it |
| `coach` | Coaches students who said yes: sees what they share, leaves notes, adds tasks; never their journal | a creator or staff, given it |

  A plain user holding a staff permission still fails. An admin passes everything except `coach`. Life coach is the one permission an admin does not hold unless given it, and a creator who holds it wears the Life coach badge. People ask to become a coach in the setup chat or under Coaching. The admins are told once, and giving the permission (through the one permissions route, which tells the person) is the yes. Taking it away ends every link of theirs and tells their students.
- **Guides:** `isGuide` in `db.ts` is `can(user, 'moderation')`, the one guide rule (2026-11-03). It decides who hides, pins, holds and approves first posts under `/manage/community`, and who opens, renames or closes a Community channel. A staff member without moderation no longer does any of it; every admin does. `isStaff` (an admin or a sub admin) is a separate check: staff see an anonymous writer's id so a report can be acted on. Muting in Community goes by rank (member, guide, staff, admin): only someone of a lower rank can be muted.
- **Super admin:** a role of `admin`. It is never locked out of an unlock (points, xp, badge). It may give xp, points, badges, honors, a plan and credits by hand (all audited), reads the app's own log (Observability, Logs) and sets any event's attendee code. Only an admin's own session (not the key alone) makes, changes or retires an Agency house template. Founder addresses in `admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in (`promoteBootstrapAdmin`, audited).
- **Ownership:** every owner-scoped query filters by the session user. Someone else's row answers 404 or 403.
- **Brands:** `orgRole` and `orgIdsOf` decide who sees a campaign or a listing. Adding a teammate is `INSERT OR IGNORE`, so adding someone who is already in the brand cannot demote an owner. A brand team can be given Agency with a `flag_overrides` row whose `subject_type` is `organization`.
- **Entitlements:** a Club event needs an approved membership that has not expired; so does a Club-only Work listing (`isClubMember`). A gated product, store item, tool or card game needs the xp floor, the points floor and the badge from `unlockFor` (any mix; "Unlocks at 500 xp, 2,000 points and the First tick badge"). A membership product checks the order's expiry. A members-only Community feed (posts tied to a membership product) is seen, reacted to and answered only by the product's owner and the people who bought it. That is `canSeePost` in `community.ts`, with an order that is `paid` or `test`. Liking, reading the replies and replying to a post you cannot see all answer 404, so its existence does not leak. The plan and its credits (`PLANS`, `credit_accounts`) gate typing to the assistant, not a module. The Companion never shows a paywall: without a plan it answers with its free built-in replies.
- **Eligibility:** a cohort page needs enrolment or the mentor permission. A run entry needs club membership and the start code inside the window. A run's discussion is for its people only: the club's host, the members in the club by the time it ended, and anyone who logged it; anyone else gets 404. A claim of an event code needs to be one of that event's own guests, once, never the host. A chat from a public page needs an accepted friendship and the other person's chat switch. A Bond channel is for its members only, and a non-member gets 404. A coach works only with students who said yes, and sees only what each student's own switches share (`COACH_SHARE_PARTS`: daily, pillars, routine, life map, reflection).
- **Devices:** an account can be signed in on at most three devices (`MAX_DEVICES`); a fourth signs the oldest out.

## 5a. Rules that apply before a module or a role (the launch pass, 2026-11-01)

- **Public routes added.** No session is needed, and each door that takes input is limited per address: `POST /api/public/vitals` (limit `vitals`), `GET /api/public/business`, `POST /api/public/copyright-notice` (limit `notice`), `GET` and `POST /api/public/unsubscribe/:token` (limit `unsubscribe`). The unsubscribe token is the person's id and a hash only the server can make. It opens one action (turn off marketing mail) and nothing else. `GET /api/internal/vitals` is behind `internal`, so it is for staff and admins.
- **The Origin rule.** A write that carries an `Origin` header from another site is refused with 403 `wrong origin` before any route runs. The request's own host, the host of `PUBLIC_URL` and, in local development, a loopback address are allowed. A request with no `Origin` (a script, a webhook, a smoke check) passes, and webhooks are skipped because each checks its own signature. A Bearer header is still the thing that proves who is asking; this rule only closes a second door.
- **No CORS.** The API sends no `Access-Control-Allow-Origin`, so no other site can read an answer from a browser.
- **Blocked paths.** A path that should hold nothing answers 404 from the Worker and never the app shell. That covers any segment starting with a dot, `.env`, `.git`, backups, dumps, `.sql`, `.map`, config and project files, `/src`, `/logs` and `/tmp`. `/.well-known/` is left open. The rule is `blockedPath` in `apps/api/src/headers.ts`; `scripts/check-exposed.sh` asks for these paths and expects 404.
- **What a browser may keep.** An authenticated answer is `no-store`. Only anonymous answers that are the same for every visitor (Explore, an uploaded picture) are public. The Workers cache copy is skipped for any request that carries Authorization or a cookie.
- **Who is told.** `securityAlerts` writes to every admin's inbox (kind `team`) when failed sign-ins, answers of 429, server errors or a role or permission change cross a line in the last fifteen minutes. It tells them once an hour per kind. Reading the log itself is still only for a super admin.
- **Consent gates behaviour, not access.** A person's privacy choices (`attribution`, `embeds`, `marketing`, all off until they say yes) decide three things. They decide whether the tracked-link cookie is set, whether a YouTube or Vimeo video loads, and whether marketing mail is sent. `sendEmail({ marketing: true })` sends only with a recorded yes and refuses with none. Receipts and password resets are never marketing. They do not change what any role or module may do.
- **The terms notice.** `LEGAL_VERSION` is the day the terms or privacy policy last changed; it is now 2026-11-05. When it changes, every account sees the one-time terms notice again. Accepting it is core (`me/legal`), and it does not change access.

## 5b. Agency team members (wave 14, migrations 0076 and 0081)

An Agency owner can ask people to work on their Agency: a content creator, a videographer, a video editor or a client. The ask goes by email, @username or friend code (`POST /agency/team`, limit `teamInvite`). A block reads like an unknown person. A team holds at most `MAX_TEAM` (25) people, with at most `MAX_TEAM_INVITES` (10) waiting.

- **Access per tab.** Each member has Off, View or Edit for Overview, Pipeline, Clients and Paperwork. `parseTeamAccess` is the one reader. Overview is never Edit. A client member never sees Clients and never edits.
- **One gate.** A member sends `X-Agency-Team: <row id>` with each Agency request. `agencyTeamGate`, mounted on `/agency` after the module gate and the limits, is the only place that turns it into access:
  1. No header: the person works on their own Agency.
  2. The member's row is read on every request, never cached. A removal or a leave ends access on the next request.
  3. A client member is refused on every owner route. They read one read-only view at `GET /me/teams/:id/client-view`.
  4. The owner's Agency must be available to the owner. If not, the answer is 403 "This agency is not open right now."
  5. The method and path must be on `TEAM_ROUTE_RULES`, an allowlist. A route that is not on it answers 403. Settings, adding or deleting clients, the client link and its password, Army, time, template writes and the team itself have no rule on purpose.
  6. The member's access must open that rule's tab at that rule's level.
  7. The route then runs as the owner, so every owner filter still holds. The answer is cut down: no business profile or bank, no private notes, fees, retainer amount, client link or Army links. A write by a member leaves a line in the client's log naming them.
- **The member's own module.** The module gate runs first, so `/agency` must be available to the member too (flag, override, rollout, role). Their own on/off switch for Agency does not matter.
- **Answering and leaving** live under `/me/teams`, which is core, so a person can say no or leave even with Agency off. Both people are told in the inbox. The rows are in both people's export and go with either account and with the tied client.

## 6. What a client sees at a link

A client, a brand's reader or a guest at a link has no account, so none of the above applies to them. The link is the key, and what it shows is a set of switches the owner controls and the server enforces.

- **The client link** (`agency_clients.portal_token`, `portal_json`): a switch for each part (waiting for approval, coming up, published, the month so far, shared notes, channels, hours, invoices, agreements). There is a switch for each thing they may do (approve or send back, write notes). A part that is off is not sent. Never in it (`PORTAL_NEVER`): the owner's private notes, per-piece fees and the retainer amount, time line by line, other clients, and what the brand wrote in Army.
- **The password on a client link.** A new client cannot be added without one (`POST /agency/clients` answers 400 "set a password for their page"). Only the owner sets, changes, generates or clears it. A locked link answers `401 {error: 'locked'}` with the client's name and the business's face, and nothing more. The right password gives a portal session: twelve hours, for that one client, held in the browser's sessionStorage and sent as `X-Portal-Session`. Unlocking is limited per address (`portalLogin`) and per client (`portalLoginLink`). A wrong password and an unknown link answer in the same words. Changing or clearing the password, a fresh link or closing it ends every session. `requirePortalAccess(c, clientId)` is the one check, and `portalDocGate` puts it in front of the agreement, invoice and document links. A client with no password still opens as before, and the page warns that anyone with the link can open it.
- **Client onboarding.** A client added since migration 0071 sees only a short form until they send it. After that the client's page opens as before.
- **An invoice** (`/i/<token>`): a switch for the bank details, tax numbers, due date, total in words, notes, comments and download. `invoiceForClient` removes what is off before the invoice leaves the server. A draft has no public page.
- **An agreement** (`/k/<token>`) and **a document** (`/d/<token>`): the client answers the brief and accepts or approves by typing their name (not a certified e-signature). Only options the agreement offered are kept. Download shows once it is sent.
- **The team link** (`/t/<token>`, migration 0081): a second link per client for the client's own team. It has its own token, switches, password and sessions (`X-Team-Link-Session`). It never opens without a password: switching it on needs one, and the password cannot be removed while it is on. Approving is off until the owner allows it. It never shows `TEAM_LINK_NEVER`: invoices and money, agreements, other documents, the retainer and its fee, onboarding, billing, hours and private notes. Its routes find a client by the team token only. Every client-link, agreement and invoice route answers 404 to a request carrying a team session (`refuseTeamSession`). Unlocking is limited by `teamLinkLogin` and `teamLinkLoginLink`.
- **Asking for a new password.** Every lock screen offers "Ask for a new password" (`POST /public/agency/password-request`, limit `portalPasswordAsk`). It answers the same for any link, so it shows nothing about which links exist. The app never sends a password; the owner shares it another way.
- **The private calendar** (`/api/public/calendar/<token>.ics`): off until switched on; a title, a pillar and a priority only.
- **A closed or renewed link** answers 410 with who to ask, kept only as a hash (`retired_portal_links`). A fresh link closes the old one. Renewing one of a client's two links never touches the other. Each of these doors is limited per address.

## 7. Admin console as built

Admin, Flags is a `DataTable`. It shows every module with its switch, minimum role and rollout, editable in the row. Overrides are added with a subject, a reason and an optional expiry, and removed; the overrides list is paged. "Preview what this person sees" lives at `GET /admin/flags/preview/:userId`. An unknown module key answers 404.

Under People, "What does this person see?" lists every app as a tick row. Ticking or unticking writes a person-level override with the reason "Set from People", one per app, replaced each time. A struck-through app is not allowed for them, Reset removes the override, and a locked app cannot be blocked (the server refuses it too). People also deletes an account (never an admin's or your own), starts a plan, adds credits, and gives xp, points, badges and honors.

Every change is written to the audit log and shown under Admin, Audit. The actions include `flag.set`, `flag.override`, `flag.override.remove`, `user.role`, `user.permissions`, `user.delete`, `user.plan`, `user.credits`, `user.xp`, `user.points`, `user.badge` and `user.honor`.

Two parts of Admin check more than the admin door. Discount codes (`/admin/discounts`) also need the finance permission, which every admin holds. House templates (`/admin/agency/templates`) need a signed-in admin; the shared key alone cannot make one.

The admin routes are not behind the session check; they have their own. They open with the `X-Admin-Key` header (compared in constant time with `ADMIN_KEY`) or with a signed-in admin's session. With no key set and no signed-in person they answer 503. With neither the key nor an admin they answer 403. The key is there for the first admin; after that an admin's session is enough.

Not built from v0.1: values per environment, flag owners and dependencies, a rollback button (the audit log shows the old value and the admin sets it back), and a confirmation step for high-impact flags.

## 8. Example rows

```text
module_settings   key=store      enabled=0  min_role=user       rollout=100
module_settings   key=companion  enabled=1  min_role=user       rollout=25
module_settings   key=agency     enabled=1  min_role=user       rollout=50
flag_overrides    flag_key=reviews  subject_type=user  subject_id=<id>  enabled=0  reason="Set from People"  expires_at=NULL
flag_overrides    flag_key=agency   subject_type=organization  subject_id=<org>  enabled=1
```

## 9. What a person sees

- A module that is unavailable to the person is not listed on the Apps page or under Profile, Features. Its route shows the `Gate` screen, headed "<Name> is off", with "It is not available on your account right now."
- A module that is available but switched off is listed on the Apps page and under Profile, Features with its switch off. Its route shows the same heading with "It is switched off. Turn it on from Apps." and an Open Apps button. Module names are public; nothing is hidden about their existence.
- The Apps page is one accordion per group in its pillar's colour, saying "N of M on". Opening a group lists its apps: the name opens an app that is on, and the switch turns it on or off.
- A person's own switch never changes what is available to others.
- Deep links are re-checked on every visit, because `Gate` reads the live `/me`. A reminder's link (`/reviews?kind=…`) therefore lands on the Gate screen if the app is off.
- The service worker takes over on the next load (`autoUpdate`, `skipWaiting`), so a cached page is replaced after a deploy.
- Every app's main screen ends with a "How it works" section (`HOW_TO`, shown only on the module's own path), so a person who just turned an app on reads its rules.

## 10. Flag lifecycle

Module flags are long-lived product configuration, one per module. A module has no `module_settings` row until an admin first changes its flag (an upsert). Until then its defaults come from `MODULES`. There are no temporary release flags.

A new module needs:

- an entry in `MODULES`, in one of the six groups;
- in the same place, `SETUP_APP_LINES` if the setup chat can switch it, the relationships it serves in the site's content, and the build map;
- a `HOW_TO` entry (the shared test insists);
- a line in `MODULE_FOR_PREFIX`;
- a route file with a rate limit for each write;
- its tables, with export, erase and delete decided (see 04, §13).

A new app slots into its group by context, after any apps a person has placed in their own order (`orderInGroup`). Groups never move.

## 11. Required tests, with status

As of 2026-11-05 the shared suite has 553 tests passing and the smoke test 1,609 checks.

- A disabled module cannot be reached through the UI: holds (`Gate`).
- A disabled module cannot be reached through the API: holds ("a switched-off app refuses its API" demands a 403 and "the core stays open while an app is off"). An override is refused the same way ("an override refuses the API too", "and the door opens again when it is removed"), and so is a rollout the person falls outside.
- A person cannot read another brand's data: holds in code (`orgRole`). Not in the smoke test.
- An expired membership loses access: holds (`ends_at` is checked in Party).
- An override expires as set: holds (`expires_at` is filtered on read).
- An unknown flag fails safely: **does not hold.** A module with no row is enabled. An unknown key on the admin API is a 404.
- Flag changes are audited: holds ("every change is audited").
- A module can be switched off without harming other modules: holds. Flags change nothing in the data.
- Rollout is deterministic: holds (the shared test "buckets the same person the same way every time").
- What a shared link shows is what the owner switched on: holds. The smoke test reads a client link, an invoice and an agreement with parts switched off and finds nothing of them in what is sent. The shared tests cover `invoiceForClient` and `parsePortalShow`.
- The team link shows no paper and needs its own password: holds (the "team link: …" smoke checks, including "a team session on an invoice, agreement, document or the client link is a 404" and "switching it on needs a password, and a weak one is refused").
- An Agency team member reaches only what their access allows: holds (the "team: …" smoke checks, including "what an editor may not do is refused", "a client member is refused on every owner route" and the owner's Agency switched off and back on).
- Only guides moderate: holds ("only guides pin", "only a guide opens a Community channel").
- Business metrics are refused until the person switches them on: holds (403 on every route but the switch).
- App prefs accept only known groups and each group's own apps, once each: holds (`appPrefs.test.ts`, and the smoke checks "app prefs refuse an app placed in another group", "app prefs belong to their owner", "app prefs are in the export").
- Also proven: "access resolves on the server", "a flag can be switched off", "an override for one person can be set", "the override reaches that person".

## 12. App groups, their order and a person's app prefs (2026-11-04)

The groups are display, not access. Nothing here changes what is available or on.

- **One order.** `MODULE_GROUP_ORDER` puts the groups in one order everywhere they are listed: Contribution, Reflection, Connection, Creation, Essentials, Operations. That covers Apps, Profile, Features, the laptop sidebar, the phone menu, Home's Go to and the public Features page. `inGroupOrder` applies it. Each group wears one relationship colour (`MODULE_GROUP_ACCENT`).
- **How a group starts.** Until a person picks, Contribution and Essentials start open on Apps, in the sidebar and in the phone menu, and the rest start closed (`GROUP_OPEN_DEFAULT`, `groupStartsOpen`). The group of the app you are in also opens. Profile, Features opens every group.
- **Picking.** Under Profile, Features each group has a "Starts open on Apps and in the menu" switch. "Arrange apps" turns the rows into a drag list with Move up and Move down. Apps move only inside their group, and groups never reorder. Reset order clears a group's order.
- **Saved on the account.** `users.app_prefs_json` (migration 0074) holds `open` and `order`. `PATCH /me {appPrefs}` saves the whole set. `appPrefsProblem` is the one check: it refuses an unknown group, an app of another group and a repeat. `parseAppPrefs` is the one reader. The keys are looked up in objects with no prototype, so "constructor" finds nothing. The limit `prefs` applies only when a save carries `appPrefs`. It is on `GET /me` as `user.appPrefs`, in the export, gone with the account and untouched by an erase.
- **Per tab.** Which groups a person opened during a visit is kept for that tab only (`useKept`), and forgotten on reload, sign-out or another device.

## Known gaps

- A module with no flag row is enabled by default. That is the design (the defaults live in `MODULES`), but an unknown key is not refused.
- No confirmation step before switching a module off in production.
- Reading another brand's data is enforced in code but not covered by a smoke check.
- `/orgs` is not in `MODULE_FOR_PREFIX` and is open as core (reported 2026-11-01, not changed; see §4).
- The guide rule and the decision log disagree on one point. docs/DECISIONS.md (2026-11-03) says a creator who holds moderation now acts as a guide. In code, `isStaffFor` passes `moderation` only for staff or an admin, so a creator holding it does not. The permissions route still lets an admin store it on a creator.
- Left open on purpose by the security pass (`docs/security/SECURITY_REPORT.md`): session tokens live in `localStorage` (the content security policy, no third-party scripts and no HTML sinks are what protect them); the `X-Admin-Key` door under `/api/admin` has no rate limit and a development default; there is no second factor for staff.
- The commits "first launch" and "mini edit" (early on 5 November) hold the work up to migration 0082; the rest of 5 November is not committed yet. Before a deploy these new files must be added to git: `apps/api/migrations/0083_agency_due_index.sql`, the two Google Sans Flex font files (`apps/web/public/fonts/google-sans-flex-latin.woff2` and `-latin-ext.woff2`), `apps/web/src/components/fx/FractalGlass.tsx`, `apps/web/src/components/RowCard.tsx`, and the insights golden test files (`packages/shared/src/insights.golden.test.ts`, `insights.golden.fixtures.ts` and the three files in `packages/shared/src/__golden__/`). Those are all the untracked files under `apps/` and `packages/` on 2026-11-05.

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October). Modules went from the original set to 46, including Agency, Discover, Games, Leaderboard, Coaching, Reviews and Mindfulness. The Assistant joined Home, Daily, Pillars and Search as a locked module. Permissions went from eight to nine with Life coach, which an admin does not hold unless given it. The evaluation order was re-read against `accessFor` (the minimum role applies after an override too). `MODULE_FOR_PREFIX` is listed in full with the always-open prefixes; the admin console's own check is described; People can set a person-level override per app; and what a client sees at a shared link (§6) is written down.
- 2026-11-01 (later): after the bug sweep. Nobody can change their own role on either door; adding a brand teammate cannot demote an owner; a members-only Community post is liked, read and answered only by its product's owner and buyers; `/orgs` is written down as an open item.
- 2026-11-01 (later, the launch pass): `me/legal` joins the always-open core prefixes. Section 5a writes down the rules that apply before any module or role check.
- 2026-11-05 (version 0.6, migrations 0001 to 0083): reconciled with the app as built.
  - §2: the groups are in one order (Contribution, Reflection, Connection, Creation, Essentials, Operations); a person switches apps on the Apps page as well as under Profile, Features; `users.app_prefs_json` is named; the five-second flag cache and `forgetAccessContext` are written down.
  - §3: the table follows the group order, with counts per group; `mindful` is named Mindfulness.
  - §4: the new prefixes `community/channels`, `bond/channels` and `assistant/feelings`; `me/teams`, `me/activity`, `insights` and `discounts` join the core; why `public` is not in the map.
  - §5: the one guide rule (`isGuide`), finance now covers discount codes, the super admin's plan and credits and house templates, the run discussion and Bond channel eligibility, the Companion's free answers.
  - §5a: the terms notice and `LEGAL_VERSION` 2026-11-05.
  - New §5b: Agency team members and their one gate.
  - §6: the client link password and portal sessions, client onboarding, documents, the team link, the password ask and closed links.
  - §7: People's other powers, the newer audit actions, the extra checks on discount codes and house templates.
  - §9: the Apps page lists every available app with its switch.
  - §11: team, team link, guide and app prefs checks; 553 shared tests and 1,609 smoke checks.
  - New §12: app groups, their order and a person's app prefs.
  - Known gaps: the guide rule mismatch and the files to add to git.
