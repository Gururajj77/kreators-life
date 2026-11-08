-- How a person's dates and times read on screen (2026-11-07, the founder): a date format and a time format, kept as a small JSON, changed
-- under Profile beside the time zone. NULL is the default, "7 Nov 26, 4:17am"; read through parseDatePrefs in shared. In the export through
-- `toUser`, cleared with the account, untouched by an erase of progress.
ALTER TABLE users ADD COLUMN date_prefs_json TEXT;
