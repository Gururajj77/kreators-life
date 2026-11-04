-- The Companion answers through the assistant's model layer with a plan (2026-11-04). Each line says who answered:
-- '' for the person's own lines and older rows, else a model id, 'workers-ai', 'local' or 'crisis'. The screen draws
-- "Answered by" from it. The words stay where they were; the export carries the column with SELECT *.
ALTER TABLE chat_messages ADD COLUMN model TEXT NOT NULL DEFAULT '';
