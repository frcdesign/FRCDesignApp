CREATE TABLE `daily_app_opens` (
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_stats` DROP COLUMN `open_count`;--> statement-breakpoint
-- An open's library was never more than the tab it resumed into, so the three
-- rollups it used to write are rebuilt from the log without it: its own count
-- moves to `daily_app_opens`, and the two library rollups keep inserts alone.
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
