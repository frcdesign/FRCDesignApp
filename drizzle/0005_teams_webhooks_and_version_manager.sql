CREATE TABLE `onshape_webhooks` (
	`subject` text NOT NULL,
	`subject_id` text NOT NULL,
	`webhook_id` text,
	`token` text NOT NULL,
	PRIMARY KEY(`subject`, `subject_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onshape_webhooks_token_unique` ON `onshape_webhooks` (`token`);--> statement-breakpoint
CREATE TABLE `daily_app_opens` (
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_version_metrics` (
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`update_only_runs` integer DEFAULT 0 NOT NULL,
	`partial_runs` integer DEFAULT 0 NOT NULL,
	`failed_runs` integer DEFAULT 0 NOT NULL,
	`created_versions` integer DEFAULT 0 NOT NULL,
	`updated_elements` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `workspace_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_document_id` text NOT NULL,
	`source_workspace_id` text NOT NULL,
	`target_document_id` text NOT NULL,
	`target_workspace_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_links_source_idx` ON `workspace_links` (`source_document_id`,`source_workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_links_target_idx` ON `workspace_links` (`target_document_id`,`target_workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_links_source_document_id_source_workspace_id_target_document_id_target_workspace_id_unique` ON `workspace_links` (`source_document_id`,`source_workspace_id`,`target_document_id`,`target_workspace_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`day` text NOT NULL,
	`library_id` text,
	`user_id` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`element_id` text,
	`document_id` text,
	`instance_id` text,
	`instance_type` text,
	`insertable_id` text,
	`target_element_type` text,
	`selection` text,
	`is_favorite` integer,
	`is_quick_insert` integer,
	`source` text,
	`fasten` integer,
	`version_kind` text,
	`version_scope` text,
	`version_update_only` integer,
	`version_outcome` text,
	`failed_steps` integer,
	`created_versions` integer,
	`updated_elements` integer
);
--> statement-breakpoint
-- Only the columns the table had; the version columns start empty.
INSERT INTO `__new_events`("id", "type", "created_at", "day", "library_id", "user_id", "schema_version", "element_id", "document_id", "instance_id", "instance_type", "insertable_id", "target_element_type", "selection", "is_favorite", "is_quick_insert", "source", "fasten") SELECT "id", "type", "created_at", "day", "library_id", "user_id", "schema_version", "element_id", "document_id", "instance_id", "instance_type", "insertable_id", "target_element_type", "selection", "is_favorite", "is_quick_insert", "source", "fasten" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`day`);--> statement-breakpoint
ALTER TABLE `groups` ADD `held_at` integer;--> statement-breakpoint
ALTER TABLE `insertables` ADD `excluded_parameter_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `libraries` ADD `admin_team_id` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `admin_team` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `theme`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `tab_id`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `group_id`;--> statement-breakpoint
ALTER TABLE `user_stats` DROP COLUMN `open_count`;--> statement-breakpoint
-- FTCDesignLib is now ConfigLib, and a library is keyed by its id, so every row
-- of it moves with the name. The new row goes in first and the old one last:
-- the children point at `libraries.id`, and SQLite does not cascade an update.
INSERT INTO libraries (id, cache_version, admin_team_id, admin_team)
SELECT 'config-lib', cache_version, admin_team_id, admin_team
FROM libraries WHERE id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE groups SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE insertables SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE favorites SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE users SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE events SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_target_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_source_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_insertable_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_insertable_users SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_configuration_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_user_activity SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE insertable_stats SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE user_stats SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
DELETE FROM libraries WHERE id = 'ftc-design-lib';
--> statement-breakpoint
-- Rebuilt from the log: an open is counted in `daily_app_opens` alone, and the
-- library rollups count inserts.
INSERT INTO `daily_app_opens` (`day`, `user_id`, `opens`)
SELECT `day`, `user_id`, COUNT(*) FROM `events` WHERE `type` = 'app_open' GROUP BY `day`, `user_id`;
--> statement-breakpoint
DELETE FROM `daily_metrics` WHERE `type` = 'app_open';
--> statement-breakpoint
DELETE FROM `daily_user_activity`;
--> statement-breakpoint
INSERT INTO `daily_user_activity` (`day`, `library_id`, `user_id`)
SELECT DISTINCT `day`, `library_id`, `user_id` FROM `events` WHERE `type` = 'insert' AND `library_id` IS NOT NULL;
--> statement-breakpoint
DELETE FROM `user_stats`;
--> statement-breakpoint
INSERT INTO `user_stats` (`user_id`, `library_id`, `insert_count`, `first_seen_at`, `last_seen_at`)
SELECT `user_id`, `library_id`, COUNT(*), MIN(`created_at`), MAX(`created_at`) FROM `events`
WHERE `type` = 'insert' AND `library_id` IS NOT NULL GROUP BY `user_id`, `library_id`;
