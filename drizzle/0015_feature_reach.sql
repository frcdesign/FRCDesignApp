CREATE TABLE `daily_feature_users` (
	`day` text NOT NULL,
	`feature` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`feature`, `day`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_first_seen` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_day` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `events` ADD `at_insert_location` integer;--> statement-breakpoint
INSERT INTO `user_first_seen`("user_id", "first_day") SELECT `user_id`, min(`day`) FROM (SELECT `user_id`, `day` FROM `daily_user_activity` UNION ALL SELECT `user_id`, `day` FROM `daily_app_opens` UNION ALL SELECT `user_id`, `day` FROM `daily_feature_users`) GROUP BY `user_id`;
