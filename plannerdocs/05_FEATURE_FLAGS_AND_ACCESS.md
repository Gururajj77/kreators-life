# 05 — Feature flags, entitlements and access control

Last updated: 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026
**Source of truth:** `apps/api/src/access.ts`, `apps/api/src/db.ts` (`can`, `orgRole`), `MODULES`, `isStaffFor` and `moduleState` in shared, `apps/api/src/routes/admin.ts` (the flag routes), the Flags and People pages under Admin.

## 1. Purpose

Flags let an admin switch any module off without a deploy. A flag can also limit a module to a role, roll it out to a share of people, or override it for one person, one role or one brand. Authorization is a separate layer. Roles, permissions and ownership decide what a person may do inside a module.

**Rule from v0.1, kept:** a frontend toggle is never the only security control. **Status:** holds for roles, permissions, ownership and module flags. See §3, §4 and §10. It holds for what a client may see at a shared link too: the parts the owner switched off are removed on the server before anything is sent (§6).

## 2. The flag model as built

One flag per module, keyed by the module key: `army`, `agency`, `companion`. There is no `module.` prefix. There are no `feature.` or `ops.` flags and no environments on a flag.

- `module_settings` holds `key`, `enabled`, `min_role` (user, sub_admin, admin) and `rollout` (0 to 100). A module with no row is enabled, with the minimum role from `MODULES` and a rollout of 100.
- `flag_overrides` holds `flag_key`, `subject_type` (user, role, organization), `subject_id`, `enabled`, `expires_at`, `reason` and `created_by`. Expired overrides are ignored when read. An override cannot switch off a locked module (the route answers 400).
- `MODULES` carries each module's own defaults: `defaultOn`, `minRole`, and `locked` for the parts a person cannot switch off (Home, Daily, Pillars, Search and the Assistant). There are 46 modules, in six groups: Essentials, Contribution, Creation, Connection, Reflection and Operations (the team's own group, always last).
- `users.modules` is the person's own on or off per app. The setup chat writes it for the apps that fit the person's answers (`setupSwitchable`: Contribution, Creation, Connection and Reflection, never the essentials or the team's tools), and Profile, Features is the one place a person changes it afterwards.

## 3. The modules as built

"On for a new account" is the module's own default; the setup chat then switches on the apps that fit and off the rest. A module the person has on is listed in the sidebar under its group, on the Apps page, and in lists ordered by context (what is on, then what fits their answers, then what they open most on this device).

| Group | Key | Name | Path | On for a new account | Minimum role | Locked |
|---|---|---|---|---|---|---|
| Essentials | `home` | Home | `/home` | on | user | yes |
| Essentials | `today` | Daily | `/today` | on | user | yes |
| Essentials | `tower` | Pillars | `/tower` | on | user | yes |
| Essentials | `search` | Search | `/search` | on | user | yes |
| Essentials | `leaderboard` | Leaderboard | `/leaderboard` | on | user |  |
| Essentials | `notifications` | Inbox | `/inbox` | on | user |  |
| Essentials | `help` | Help | `/help` | on | user |  |
| Essentials | `assistant` | Assistant | `/plans` | on | user | yes |
| Contribution | `school` | School | `/school` | on | user |  |
| Contribution | `work` | Work | `/work` | on | user |  |
| Contribution | `army` | Army | `/army` | on | user |  |
| Contribution | `win` | Win | `/win` | off | user |  |
| Contribution | `agency` | Agency | `/agency` | off | user |  |
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
| Connection | `cards` | Games | `/cards` | off | user |  |
| Connection | `party` | Party | `/party` | off | user |  |
| Connection | `run` | Kreators Run | `/run` | off | user |  |
| Connection | `community` | Community | `/community` | off | user |  |
| Connection | `club` | Club | `/club` | off | user |  |
| Connection | `bond` | Bond | `/bond` | off | user |  |
| Connection | `circles` | Circles | `/circles` | off | user |  |
| Reflection | `discover` | Discover | `/discover` | off | user |  |
| Reflection | `life` | Life | `/life` | on | user |  |
| Reflection | `wellbeing` | Wellbeing | `/wellbeing` | off | user |  |
| Reflection | `mood` | Mood | `/mood` | off | user |  |
| Reflection | `sleep` | Sleep | `/sleep` | off | user |  |
| Reflection | `stress` | Stress | `/stress` | off | user |  |
| Reflection | `mindful` | Mindful minutes | `/mindful` | off | user |  |
| Reflection | `journal` | Journal | `/journal` | on | user |  |
| Reflection | `reviews` | Reviews | `/reviews` | off | user |  |
| Reflection | `companion` | Companion | `/companion` | off | user |  |
| Reflection | `coaching` | Coaching | `/coaching` | off | user |  |
| Operations | `manage` | Manage | `/manage` | on | staff |  |
| Operations | `admin` | Admin | `/admin` | on | admin |  |
| Operations | `observability` | Observability | `/internal/observability` | on | staff |  |

## 4. Evaluation order

`accessFor` runs this for every module, in this order:

1. Start from the global switch (on by default), the minimum role and the rollout. The setting's values win over the module's own.
2. Apply the most specific live override: the person first, then any brand they belong to, then their role. An override sets the module on or off outright (an override that turns it off gives the reason `override`).
3. With no override: if the global switch is off, the reason is `disabled`. Else, if the rollout is under 100 and the person's bucket is at or past it, the reason is `rollout`. The bucket is `rolloutBucket(userId, key)`, a fixed hash from 0 to 99.
4. Whatever came before, if the person's role ranks below the minimum role, the module is unavailable with reason `role`. An override that switches a module on does not lift the minimum role.
5. A module is `on` when it is available and either locked, switched on by the person, or on by default.

The result is one record per module: `available`, `on`, and a reason (`ok`, `disabled`, `override`, `rollout` or `role`). `GET /me` returns it and `Gate` uses it on the client. The same pure function scores every account for Observability, and Admin's "what does this person see?" preview uses it too.

The API enforces it too. `MODULE_FOR_PREFIX` in `access.ts` maps every API prefix to the module or modules that own it. A middleware in `index.ts` runs after the session check: it resolves access for the person and answers 403 ("<Name> is not available on your account.", with the module key) unless at least one of the path's modules is available. Only `available` counts, not the person's own on/off: switching an app off for yourself is a preference the client keeps, and other screens may still read its data. A two-segment prefix (`studio/brands`) wins over its one-segment parent (`studio`). A prefix not in the map is the core and always open, so a new route file must be added to the map.

| API prefix | Module or modules that own it |
|---|---|
| `school`, `work`, `army`, `win`, `agency`, `party`, `run`, `community`, `club`, `leaderboard`, `cards`, `discover`, `bond`, `circles`, `life`, `journal`, `reviews`, `companion`, `assistant`, `tools`, `finance`, `manage` | the module of the same name |
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

Always open (the core): `me` (including `me/coach`, where a student answers, shares and ends a coaching link, and `me/calendar`, so switching Coaching off never stops anyone from saying no), `onboarding`, `session`, `nodes`, `today`, `rewards`, `inbox`, `search`, `support`, `orgs`, `home`, `media`, `reminders`, `credits`, and `store` (a product's checkout and follow). `reviews/kpis` inherits Reviews, so business metrics need Reviews available and the person's own switch. The `admin` routes sit outside the session check and have their own (§7), and the public routes need no session (see 03, §6).

## 5. Access model as built

- **Roles:** `user` (shown as Creator), `sub_admin` (Staff) and `admin`, ranked. A module's minimum role keeps Manage behind staff, Admin behind admins and the Operations group behind staff. Only an admin changes a role, never their own, and every change is audited.
- **Permissions:** nine jobs, held in `users.permissions`. `can(user, permission)` is the one check, and it calls `isStaffFor`:

| Permission | What it is for | Who may hold it |
|---|---|---|
| `talent` | Runs Army campaigns, shortlists and assigns creators | staff, given it |
| `cohorts` | Publishes programs, runs cohorts, marks completion | staff, given it |
| `events` | Creates any kind of event, checks people in, opens circles and sets their tables | staff, given it |
| `finance` | Approves bounty payouts and reviews money orders | staff, given it |
| `moderation` | Hides posts and handles reports | staff, given it |
| `support` | Answers help requests | staff, given it |
| `review` | Decides Club applications, bounties, TV and Fund proposals | staff, given it |
| `mentor` | Gives feedback on assignments | a creator can hold it |
| `coach` | Coaches students who said yes: sees what they share, leaves notes, adds tasks; never their journal | a creator can hold it |

  A plain user holding a staff permission still fails. An admin passes everything except `coach`: Life coach is the one permission an admin does not hold unless given it, and the badge then reads Life coach. People ask to become a coach in the setup chat or under Coaching; the admins are told once, and giving the permission (through the one permissions route, which tells the person) is the yes. Taking it away ends every link of theirs and tells their students.
- **Super admin:** a role of `admin`. It is never locked out of an unlock (points, xp, badge), may give xp, points, badges and honors by hand (audited), reads the app's own log (Observability, Logs) and sets any event's attendee code. Founder addresses in `admins.ts` and `ADMIN_EMAILS` become admins on sign-up or sign-in (`promoteBootstrapAdmin`, audited).
- **Ownership:** every owner-scoped query filters by the session user. Someone else's row answers 404 or 403.
- **Brands:** `orgRole` and `orgIdsOf` decide who sees a campaign or a listing.
- **Entitlements:** a Club event needs an approved membership that has not expired; so does a Club-only Work listing (`isClubMember`). A gated product, store item, tool or card game needs the xp floor, the points floor and the badge from `unlockFor` (any mix; "Unlocks at 500 xp, 2000 points and the First tick badge"). A membership product checks the order's expiry. The plan and its credits (`PLANS`, `credit_accounts`) gate typing to the assistant, not a module.
- **Eligibility:** a cohort page needs enrolment or the mentor permission. A run entry needs club membership and the start code inside the window. A claim of an event code needs to be one of that event's own guests, once, never the host. A chat from a public page needs an accepted friendship and the other person's chat switch. A coach works only with students who said yes, and sees only what each student's own switches share (`COACH_SHARE_PARTS`: daily, pillars, routine, life map, reflection).
- **Devices:** an account can be signed in on at most three devices (`MAX_DEVICES`); a fourth signs the oldest out.

## 6. What a client sees at a link

A client, a brand's reader or a guest at a link has no account, so none of the above applies to them; the link is the key, and what it shows is a set of switches the owner controls and the server enforces.

- **The client link** (`agency_clients.portal_token`, `portal_json`): a switch for each part (waiting for approval, coming up, published, the month so far, shared notes, channels, hours, invoices, agreements) and for each thing they may do (approve or send back, write notes). A part that is off is not sent. Never in it: the owner's private notes, per-piece fees and the retainer amount, time line by line, other clients, and what the brand wrote in Army.
- **An invoice** (`/i/<token>`): a switch for the bank details, tax numbers, due date, total in words, notes, comments and download; `invoiceForClient` removes what is off before the invoice leaves the server. A draft has no public page.
- **An agreement** (`/k/<token>`): switches for comments and download; the client answers the brief and accepts by typing their name (not a certified e-signature). Only options the agreement offered are kept.
- **The private calendar** (`/api/public/calendar/<token>.ics`): off until switched on; a title, a pillar and a priority only.
- A fresh link closes the old one. Each of these is limited per address.

## 7. Admin console as built

Admin, Flags is a `DataTable`. It shows every module with its switch, minimum role and rollout, editable in the row. Overrides are added with a subject, a reason and an optional expiry, and removed. "Preview what this person sees" lives at `GET /admin/flags/preview/:userId`. Under People, "What does this person see?" lists every app as a tick row: ticking or unticking writes a person-level override with the reason "Set from People" (one per app, replaced each time), a struck-through app is not allowed for them, Reset removes the override, and a locked app cannot be blocked (the server refuses it too). Every change is written to the audit log (`flag.set`, `flag.override`, `flag.override.remove`, `user.role`, `user.permissions` and the rest) and shown under Admin, Audit.

The admin routes are not behind the session check; they have their own. They open with the `X-Admin-Key` header (compared in constant time with `ADMIN_KEY`) or with a signed-in admin's session. With no key set and no signed-in person they answer 503; with neither the key nor an admin they answer 403. The key is there for the first admin; after that an admin's session is enough.

Not built from v0.1: values per environment, flag owners and dependencies, a rollback button (the audit log shows the old value and the admin sets it back), and a confirmation step for high-impact flags.

## 8. Example rows

```text
module_settings   key=store      enabled=0  min_role=user       rollout=100
module_settings   key=companion  enabled=1  min_role=user       rollout=25
module_settings   key=agency     enabled=1  min_role=user       rollout=50
flag_overrides    flag_key=reviews  subject_type=user  subject_id=<id>  enabled=0  reason="Set from People"  expires_at=NULL
flag_overrides    flag_key=army     subject_type=organization  subject_id=<org>  enabled=1
```

## 9. What a person sees

- A module that is unavailable to the person is not listed on the Apps page or under Profile, Features. Its route shows the `Gate` screen, headed "<Name> is off", with "It is not available on your account right now." A module that is available but switched off is not on the Apps page either (which lists only the apps that are on, with a card at the top, "Turn apps on or off", that leads to Profile, Features); its route shows the same heading with "It is switched off. Turn it on from Apps." and an Open Apps button. Module names are public; nothing is hidden about their existence.
- A person's own switch never changes what is available to others.
- Deep links are re-checked on every visit, because `Gate` reads the live `/me`. A reminder's link (`/reviews?kind=…`) therefore lands on the Gate screen if the app is off.
- The service worker takes over on the next load (`autoUpdate`, `skipWaiting`), so a cached page is replaced after a deploy.
- Every app's main screen ends with a "How it works" section (`HOW_TO`, shown only on the module's own path), so a person who just turned an app on reads its rules.

## 10. Flag lifecycle

Module flags are long-lived product configuration, one per module. A module has no `module_settings` row until an admin first changes its flag (an upsert). Until then its defaults come from `MODULES`. There are no temporary release flags. A new module needs an entry in `MODULES` (and, in the same place, in `SETUP_APP_LINES` if the setup chat can switch it, the relationships it serves in the site's content, and the build map), a `HOW_TO` entry (the shared test insists), a line in `MODULE_FOR_PREFIX`, a route file with a rate limit for each write, and its tables (with export, erase and delete decided: see 04, §13).

## 11. Required tests, with status

- A disabled module cannot be reached through the UI: holds (`Gate`).
- A disabled module cannot be reached through the API: holds ("a switched-off app refuses its API" demands a 403 and "the core stays open while an app is off"). An override is refused the same way ("an override refuses the API too", "and the door opens again when it is removed"), and so is a rollout the person falls outside.
- A person cannot read another brand's data: holds in code (`orgRole`). Not in the smoke test.
- An expired membership loses access: holds (`ends_at` is checked in Party).
- An override expires as set: holds (`expires_at` is filtered on read).
- An unknown flag fails safely: **does not hold.** A module with no row is enabled. An unknown key on the admin API is a 404.
- Flag changes are audited: holds ("every change is audited").
- A module can be switched off without harming other modules: holds. Flags change nothing in the data.
- Rollout is deterministic: holds (the shared test "buckets the same person the same way every time").
- What a shared link shows is what the owner switched on: holds (the smoke test reads a client link, an invoice and an agreement with parts switched off and finds nothing of them in what is sent; the shared tests cover `invoiceForClient` and `parsePortalShow`).
- Business metrics are refused until the person switches them on: holds (403 on every route but the switch).
- Also proven: "access resolves on the server", "a flag can be switched off", "an override for one person can be set", "the override reaches that person".

## Known gaps

- A module with no flag row is enabled by default. That is the design (the defaults live in `MODULES`), but an unknown key is not refused.
- No confirmation step before switching a module off in production.
- Reading another brand's data is enforced in code but not covered by a smoke check.

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October). Modules went from the original set to 46, including Agency, Discover, Games, Leaderboard, Coaching, Reviews and Mindful minutes; the Assistant joined Home, Daily, Pillars and Search as a locked module. Permissions went from eight to nine with Life coach, which an admin does not hold unless given it. The evaluation order was re-read against `accessFor` (the minimum role applies after an override too); `MODULE_FOR_PREFIX` is listed in full with the always-open prefixes; the admin console's own check is described; People can set a person-level override per app; and what a client sees at a shared link (§6) is written down, since it is access control that does not go through an account.
