# 05 — Feature flags, entitlements and access control

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** `apps/api/src/access.ts`, `apps/api/src/db.ts` (`can`, `orgRole`), `MODULES` and `moduleState` in shared, the Flags page under Admin.

## 1. Purpose

Flags let an admin switch any module off without a deploy. A flag can also limit a module to a role, roll it out to a share of people, or override it for one person, one role or one brand. Authorization is a separate layer. Roles, permissions and ownership decide what a person may do inside a module.

**Rule from v0.1, kept:** a frontend toggle is never the only security control. **Status:** holds for roles, permissions, ownership and module flags. See §3 and §9.

## 2. The flag model as built

One flag per module, keyed by the module key: `army`, `store`, `companion`. There is no `module.` prefix. There are no `feature.` or `ops.` flags and no environments on a flag.

- `module_settings` holds `key`, `enabled`, `min_role` (user, sub_admin, admin) and `rollout` (0 to 100). A module with no row is enabled, with the minimum role from `MODULES`.
- `flag_overrides` holds `flag_key`, `subject_type` (user, role, organization), `subject_id`, `enabled`, `expires_at`, `reason` and `created_by`. Expired overrides are ignored when read.
- `MODULES` carries each module's own defaults: `defaultOn`, `minRole`, and `locked` for the core tabs a person cannot switch off (Home, Daily, Pillars, Search).
- `users.modules` is the person's own on or off per app.

## 3. Evaluation order

`accessFor` runs this for every module, in this order:

1. Start from the global switch (on by default) and the minimum role. The setting's role wins over the module's.
2. Apply the most specific override: the person first, then any brand they belong to, then their role. An override sets the module on or off outright.
3. With no override: if the global switch is off, the reason is `disabled`. Else, if the rollout is under 100 and the person's bucket is at or past it, the reason is `rollout`. The bucket is `rolloutBucket(userId, key)`, a fixed hash from 0 to 99.
4. If the person's role ranks below the minimum role, the module is unavailable with reason `role`.
5. A module is `on` when it is available and either locked, switched on by the person, or on by default.

The result is one record per module: available, on, and the reason. `GET /me` returns it and `Gate` uses it on the client. The same pure function scores every account for Observability.

The API enforces it too. `MODULE_FOR_PREFIX` in `access.ts` maps every API prefix to the module or modules that own it (`work` to work, `studio/automations` to automations, `wellbeing` to every tracker and Life, `proposals` to TV and Fund). A middleware in `index.ts` runs after the session check: it resolves access for the person and answers 403 ("<Name> is not available on your account.") unless at least one of the path's modules is available. Only `available` counts, not the person's own on/off: switching an app off for yourself is a preference, and other screens may still read its data. A prefix not in the map is the core and always open; a new route file must be added to the map.

## 4. Access model as built

- **Roles:** `user`, `sub_admin`, `admin`, ranked. A module's minimum role keeps Manage behind staff, Admin behind admins and the Internal group behind staff.
- **Permissions:** eight jobs a staff member can hold. `can(user, permission)` is the one check. A plain user with a permission still fails. An admin passes everything.
- **Ownership:** every owner-scoped query filters by the session user. Someone else's row answers 404 or 403.
- **Brands:** `orgRole` and `orgIdsOf` decide who sees a campaign or a listing.
- **Entitlements:** a Club event needs an approved membership that has not expired. A gated product, store item or tool needs the points floor and the badge from `unlockFor`. A membership product checks the order's expiry.
- **Eligibility:** a cohort page needs enrolment or the mentor permission. A run entry needs club membership and the start code inside the window. A chat from a public page needs an accepted friendship and the other person's chat switch.

## 5. Admin console as built

Admin, Flags is a `DataTable`. It shows every module with its switch, minimum role and rollout, editable in the row. Overrides are added with a subject, a reason and an optional expiry, and removed. "Preview what this person sees" lives at `GET /admin/flags/preview/:userId`. Every change is written to the audit log and shown under Admin, Audit. The console opens with `ADMIN_KEY` before the first admin exists, and with an admin's session after.

Not built from v0.1: values per environment, flag owners and dependencies, a rollback button (the audit log shows the old value and the admin sets it back), and a confirmation step for high-impact flags.

## 6. Example rows

```text
module_settings   key=store      enabled=0  min_role=user       rollout=100
module_settings   key=companion  enabled=1  min_role=user       rollout=25
flag_overrides    flag_key=reviews  subject_type=user  subject_id=<id>  enabled=0  reason="smoke"  expires_at=NULL
flag_overrides    flag_key=army     subject_type=organization  subject_id=<org>  enabled=1
```

## 7. What a person sees

- A module that is off or unavailable is absent from the laptop sidebar and the phone menu, and grey on the Apps page. Its route shows the `Gate` screen. When it is only switched off: "It is switched off. Turn it on from Apps." Otherwise: "It is not available on your account right now." Module names are public; nothing is hidden about their existence.
- A person's own switch never changes what is available to others.
- Deep links are re-checked on every visit, because `Gate` reads the live `/me`.
- The service worker takes over on the next load, so a cached page is replaced after a deploy.

## 8. Flag lifecycle

Module flags are long-lived product configuration, one per module. A module has no `module_settings` row until an admin first changes its flag (an upsert). Until then its defaults come from `MODULES`. There are no temporary release flags. A new module needs an entry in `MODULES`, a `HOW_TO` entry (the shared test insists), a route file and its tables.

## 9. Required tests, with status

- A disabled module cannot be reached through the UI: holds (`Gate`).
- A disabled module cannot be reached through the API: holds ("a switched-off app refuses its API" demands a 403 and "the core stays open while an app is off"). An override is refused the same way ("an override refuses the API too", "and the door opens again when it is removed"), and so is a rollout the person falls outside.
- A person cannot read another brand's data: holds in code (`orgRole`). Not in the smoke test.
- An expired membership loses access: holds (`ends_at` is checked in Party).
- An override expires as set: holds (`expires_at` is filtered on read).
- An unknown flag fails safely: **does not hold.** A module with no row is enabled. An unknown key on the admin API is a 404.
- Flag changes are audited: holds ("every change is audited").
- A module can be switched off without harming other modules: holds. Flags change nothing in the data.
- Rollout is deterministic: holds (the shared test "buckets the same person the same way every time").
- Also proven: "access resolves on the server", "a flag can be switched off", "an override for one person can be set", "the override reaches that person".

## Known gaps

- A module with no flag row is enabled by default. That is the design (the defaults live in `MODULES`), but an unknown key is not refused.
- No confirmation step before switching a module off in production.
