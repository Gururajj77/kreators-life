-- 2026-11-04 (founder): each person picks which app groups start open on Apps, in the laptop sidebar and in the phone menu, and the
-- order of the apps inside a group (never across groups). One JSON column, read and written only through parseAppPrefs and
-- appPrefsProblem in shared (PATCH /me { appPrefs }). NULL means the defaults: Contribution and Essentials open, the rest closed,
-- apps in context order. In the export with the account, cleared when the account is deleted, untouched by an erase of progress.
ALTER TABLE users ADD COLUMN app_prefs_json TEXT DEFAULT NULL;
