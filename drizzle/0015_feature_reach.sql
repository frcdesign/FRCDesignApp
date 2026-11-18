CREATE TABLE `daily_feature_users` (
	`day` text NOT NULL,
	`feature` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`feature`, `day`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `at_insert_location` integer;--> statement-breakpoint
INSERT INTO `users`("id", "library_id", "created_at") SELECT `user_id`, 'frc-design-lib', strftime('%s', `first_day`, '+12 hours') * 1000 FROM (SELECT `user_id`, min(`day`) AS `first_day` FROM (SELECT `user_id`, `day` FROM `daily_user_activity` UNION ALL SELECT `user_id`, `day` FROM `daily_app_opens` UNION ALL SELECT `user_id`, `day` FROM `daily_feature_users`) GROUP BY `user_id`) WHERE EXISTS (SELECT 1 FROM `libraries` WHERE `id` = 'frc-design-lib') ON CONFLICT(`id`) DO UPDATE SET `created_at` = excluded.`created_at`;
