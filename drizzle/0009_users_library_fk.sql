/*
 `users.library_id` was the one library reference without a foreign key, while
 groups, insertables and favorites all declare one.

 It was the only one that could not simply declare it. Those three get a row
 only after a library exists to add a group to; a user row is created on first
 sign-in with the column's default, and `POST /settings` writes whichever
 library the caller picked from the navbar — either can name a library that has
 no row yet, since a library gets one on the first group loaded into it.

 So the rows come first, one per library the app offers, before the table is
 recreated with the key. `ensureLibrary` now runs wherever a library id is
 written, which is what keeps this true for a library added later.

 D1 rejects `PRAGMA foreign_keys`, so the recreate cannot switch enforcement off
 the way drizzle-kit writes it, and `defer_foreign_keys` does not stand in:
 dropping `users` orphans every favorite, and re-creating the parent under the
 same name never clears the violations that leaves behind. So the favorites are
 parked in a scratch table and put back once `users` exists again, which keeps
 every statement here valid under the enforcement D1 always has on.
*/
INSERT OR IGNORE INTO `libraries` ("id") VALUES ('frc-design-lib');--> statement-breakpoint
INSERT OR IGNORE INTO `libraries` ("id") VALUES ('ftc-design-lib');--> statement-breakpoint
INSERT OR IGNORE INTO `libraries` ("id") VALUES ('mkcad');--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`library_id` text DEFAULT 'frc-design-lib' NOT NULL,
	`group_id` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "theme", "library_id", "group_id") SELECT "id", "theme", "library_id", "group_id" FROM `users`;--> statement-breakpoint
CREATE TABLE `__old_favorites` AS SELECT * FROM `favorites`;--> statement-breakpoint
DELETE FROM `favorites`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
INSERT INTO `favorites`("id", "user_id", "library_id", "insertable_id", "default_selection", "sort_order", "created_at") SELECT "id", "user_id", "library_id", "insertable_id", "default_selection", "sort_order", "created_at" FROM `__old_favorites`;--> statement-breakpoint
DROP TABLE `__old_favorites`;
