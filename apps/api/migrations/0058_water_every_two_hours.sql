-- Water reminders now have their own trigger every two hours, so two hours is the shortest gap. Anyone who had picked a shorter one
-- is moved to two hours, and three hours (which a two-hour trigger could only meet every four) to four.
UPDATE reminder_prefs SET water_every_min = 120 WHERE water_every_min < 120;
UPDATE reminder_prefs SET water_every_min = 240 WHERE water_every_min > 120 AND water_every_min < 240;
