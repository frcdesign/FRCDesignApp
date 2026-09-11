-- The rename is written by hand, replacing the table rebuild `drizzle-kit
-- generate` emitted for it. Its copy read
-- `SELECT "insertable_id" ... FROM configurations`, naming a column the old
-- table does not have: SQLite resolves an unknown double-quoted identifier to a
-- string literal, so every row's key became the text 'insertable_id' — silently
-- on one row, and as a UNIQUE failure part-way through on more, leaving
-- `__new_configurations` behind. Empty tables copy nothing, so it looks correct
-- locally and only breaks where there is data.
--
-- SQLite has renamed columns in place since 3.25, which keeps the rows, the
-- foreign key and its cascade, and cannot half-apply. Both statements here are
-- verified by `npm run check:migrations` against a populated database.
ALTER TABLE `configurations` RENAME COLUMN `id` TO `insertable_id`;--> statement-breakpoint
ALTER TABLE `events` ADD `schema_version` integer DEFAULT 1 NOT NULL;
