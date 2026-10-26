-- Sign-up asks for a phone number and a date of birth. The minimum age is 18 (MIN_AGE in shared).
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN birth_date TEXT NOT NULL DEFAULT '';
