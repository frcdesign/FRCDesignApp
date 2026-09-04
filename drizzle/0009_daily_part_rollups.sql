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
