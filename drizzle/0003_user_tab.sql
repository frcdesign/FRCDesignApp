PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`tab_id` text,
	`group_id` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "theme", "tab_id", "group_id") SELECT "id", "theme", "library_id", "group_id" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;