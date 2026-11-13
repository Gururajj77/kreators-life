-- 0153: AI chat's tables (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile
-- section"). The All tables the person opened to the assistant and the Companion, a JSON list of table keys, each off until they switch it on
-- with Show to AI chat at the top of the table or under AI chat on the Profile tab. NULL is none. Read with parseAiTables in dataTables.ts;
-- on GET /me as aiTables and in the export, cleared by the account's delete, left as it is by an erase of progress.
ALTER TABLE users ADD COLUMN ai_tables_json TEXT;
