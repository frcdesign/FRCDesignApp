ALTER TABLE `groups` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_name`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_created_at`;--> statement-breakpoint
ALTER TABLE `insertables` ADD `search_part_numbers` integer NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `insertables` ADD `default_part_number` text;--> statement-breakpoint
ALTER TABLE `configurations` ADD `part_numbers` text NOT NULL DEFAULT '{}';--> statement-breakpoint
/*
 A new insertable starts hidden, so `is_visible` defaults to false. SQLite has no
 ALTER COLUMN, so changing a default means recreating the table.

 `configurations` and `favorites` both reference `insertables(id)` ON DELETE
 CASCADE, and D1 gives no way to switch that off: it runs migration statements in
 a transaction, where `PRAGMA foreign_keys=OFF` is silently ignored, and
 `defer_foreign_keys` only postpones violation reporting — cascade actions still
 fire. So dropping `insertables` first would delete every configuration and every
 user's favorites.

 Instead, copy all three tables, drop the children before the parent (so nothing
 references `insertables` when it goes), and rename `__new_insertables` last, so
 SQLite rewrites the children's foreign keys back onto `insertables`. Rows are
 preserved throughout: existing insertables keep their current visibility.
*/
CREATE TABLE `__new_insertables` (
	`id` text PRIMARY KEY NOT NULL,
	`element_id` text NOT NULL,
	`group_id` text NOT NULL,
	`document_id` text NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`element_type` text NOT NULL,
	`microversion_id` text NOT NULL,
	`is_visible` integer DEFAULT false NOT NULL,
	`is_open_composite` integer DEFAULT false NOT NULL,
	`supports_fasten` integer DEFAULT false NOT NULL,
	`search_part_numbers` integer DEFAULT false NOT NULL,
	`default_part_number` text,
	`version_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`vendors` text DEFAULT '[]' NOT NULL,
	`thumbnail_urls` text,
	`fasten_info` text,
	`build_issues` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_insertables`(`id`, `element_id`, `group_id`, `document_id`, `library_id`, `name`, `element_type`, `microversion_id`, `is_visible`, `is_open_composite`, `supports_fasten`, `search_part_numbers`, `default_part_number`, `version_id`, `sort_order`, `vendors`, `thumbnail_urls`, `fasten_info`, `build_issues`) SELECT `id`, `element_id`, `group_id`, `document_id`, `library_id`, `name`, `element_type`, `microversion_id`, `is_visible`, `is_open_composite`, `supports_fasten`, `search_part_numbers`, `default_part_number`, `version_id`, `sort_order`, `vendors`, `thumbnail_urls`, `fasten_info`, `build_issues` FROM `insertables`;--> statement-breakpoint
CREATE TABLE `__new_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`parameters` text DEFAULT '[]' NOT NULL,
	`part_numbers` text DEFAULT '{}' NOT NULL,
	`build_issues` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `__new_insertables`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_configurations`(`id`, `parameters`, `part_numbers`, `build_issues`) SELECT `id`, `parameters`, `part_numbers`, `build_issues` FROM `configurations`;--> statement-breakpoint
CREATE TABLE `__new_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`default_configuration` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `__new_insertables`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_favorites`(`id`, `user_id`, `library_id`, `insertable_id`, `default_configuration`, `sort_order`) SELECT `id`, `user_id`, `library_id`, `insertable_id`, `default_configuration`, `sort_order` FROM `favorites`;--> statement-breakpoint
DROP TABLE `configurations`;--> statement-breakpoint
DROP TABLE `favorites`;--> statement-breakpoint
DROP TABLE `insertables`;--> statement-breakpoint
ALTER TABLE `__new_configurations` RENAME TO `configurations`;--> statement-breakpoint
ALTER TABLE `__new_favorites` RENAME TO `favorites`;--> statement-breakpoint
ALTER TABLE `__new_insertables` RENAME TO `insertables`;--> statement-breakpoint
CREATE UNIQUE INDEX `insertables_element_id_group_id_unique` ON `insertables` (`element_id`,`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_id_library_id_insertable_id_unique` ON `favorites` (`user_id`,`library_id`,`insertable_id`);
