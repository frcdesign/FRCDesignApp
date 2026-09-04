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
	`count` integer DEFAULT 0 NOT NULL,
	`part_studio_count` integer DEFAULT 0 NOT NULL,
	`assembly_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`, `day`)
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
	`assembly_count` integer DEFAULT 0 NOT NULL,
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
	`insertable_id` text,
	`target_element_type` text,
	`configuration` text,
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
--> statement-breakpoint
ALTER TABLE `favorites` ADD `created_at` integer;