-- Added rather than renamed in place of `library_id`, which stays: the column
-- has to lose its NOT NULL, its default and its foreign key, and SQLite can
-- only do that by rebuilding the table. A rebuild drops `users`, and D1
-- enforces foreign keys always — `PRAGMA foreign_keys=OFF` is a no-op there and
-- `defer_foreign_keys` does not survive the rename — so every favorite pointing
-- at a user fails it. That is what broke the first attempt on cert.
ALTER TABLE `users` ADD `tab_id` text;--> statement-breakpoint
-- The library a caller was last in is the tab they chose. A row written from
-- here on starts null, which is what the welcome asks about.
UPDATE `users` SET `tab_id` = `library_id`;
