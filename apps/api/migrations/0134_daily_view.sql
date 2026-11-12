-- 0134: Daily's View menu (2026-11-12, the founder): a person can hide sections of Daily (Done today, To remember, Not scheduled yet, Your day,
-- Month calendar, Habits, Not to do and the patterns blocks). Kept on the account as a small JSON, `{"hidden": [...]}`, read only through
-- parseDailyView in shared (unknown keys are dropped, so a section removed later never breaks a page). NULL hides nothing. Set with
-- PATCH /me {dailyView} (limit `prefs` only when it carries it), on GET /me as `user.dailyView`, in the export through `toUser`, cleared with
-- the account, untouched by an erase of progress.
ALTER TABLE users ADD COLUMN daily_view_json TEXT;
