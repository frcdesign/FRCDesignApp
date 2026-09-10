/*
 The whole schema in one migration. It replaces the 0000-0009 chain, which was
 collapsed once the database was reset: nothing had shipped that a fresh create
 could not express, and the chain's last step could not run on D1 at all, since
 recreating `users` for a foreign key needs a `PRAGMA foreign_keys` D1 rejects.
 The reasoning behind each superseded step is in git history.
*/
CREATE TABLE `configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`parameters` text DEFAULT '[]' NOT NULL,
	`records` text DEFAULT '[]' NOT NULL,
	`build_issues` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`default_selection` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_id_library_id_insertable_id_unique` ON `favorites` (`user_id`,`library_id`,`insertable_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`document_id` text NOT NULL,
	`version_id` text NOT NULL,
	`sort_alphabetically` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`small_thumbnail_url` text,
	`large_thumbnail_url` text,
	`build_issues` text DEFAULT '[]' NOT NULL,
	`last_loaded_at` integer,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_document_id_library_id_unique` ON `groups` (`document_id`,`library_id`);--> statement-breakpoint
CREATE TABLE `insertables` (
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
	`index_configurations` integer DEFAULT false NOT NULL,
	`version_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`vendors` text DEFAULT '[]' NOT NULL,
	`small_thumbnail_url` text,
	`large_thumbnail_url` text,
	`fasten_info` text,
	`part_metadata` text,
	`build_issues` text DEFAULT '[]' NOT NULL,
	`last_loaded_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`library_id` text DEFAULT 'frc-design-lib' NOT NULL,
	`group_id` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_configuration_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`element_id` text NOT NULL,
	`parameter_id` text NOT NULL,
	`value` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`, `parameter_id`, `value`, `day`)
);
--> statement-breakpoint
CREATE INDEX `daily_configuration_metrics_day_idx` ON `daily_configuration_metrics` (`library_id`,`day`);--> statement-breakpoint
CREATE TABLE `daily_insertable_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`element_id` text NOT NULL,
	`target_element_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`, `day`, `target_element_type`)
);
--> statement-breakpoint
CREATE INDEX `daily_insertable_metrics_day_idx` ON `daily_insertable_metrics` (`library_id`,`day`);--> statement-breakpoint
CREATE TABLE `daily_insertable_users` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`element_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`, `day`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`favorite_count` integer DEFAULT 0 NOT NULL,
	`fasten_count` integer DEFAULT 0 NOT NULL,
	`quick_insert_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `library_id`, `type`)
);
--> statement-breakpoint
CREATE TABLE `daily_source_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`source` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`quick_insert_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `library_id`, `source`)
);
--> statement-breakpoint
CREATE TABLE `daily_target_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`target_element_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `library_id`, `target_element_type`)
);
--> statement-breakpoint
CREATE TABLE `daily_user_activity` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`day`, `library_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `daily_user_activity_day_idx` ON `daily_user_activity` (`day`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
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
	`fasten` integer
);
--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`day`);--> statement-breakpoint
CREATE TABLE `insertable_stats` (
	`library_id` text NOT NULL,
	`element_id` text NOT NULL,
	`insert_count` integer DEFAULT 0 NOT NULL,
	`first_inserted_at` integer NOT NULL,
	`last_inserted_at` integer NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`)
);
--> statement-breakpoint
CREATE INDEX `insertable_stats_count_idx` ON `insertable_stats` (`library_id`,`insert_count`);--> statement-breakpoint
CREATE TABLE `user_stats` (
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insert_count` integer DEFAULT 0 NOT NULL,
	`open_count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `library_id`)
);
