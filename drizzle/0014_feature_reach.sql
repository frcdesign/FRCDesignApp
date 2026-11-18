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
<<<<<<< HEAD:drizzle/0014_feature_reach.sql
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'search', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `source` IN ('search', 'group_search');--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'favorites', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `source` = 'favorites';--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'recents', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `source` = 'recents';--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'quick_insert', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `is_quick_insert` = 1;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'fasten', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `fasten` = 1;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'download', `user_id` FROM `events` WHERE (`type` = 'download' OR (`type` = 'insert' AND `target_element_type` IS NOT NULL)) AND `library_id` IS NOT NULL AND `element_id` IS NOT NULL AND `source` IS NOT NULL AND `type` = 'download';--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'version_manager', `user_id` FROM `events` WHERE `type` = 'version_run' AND `version_kind` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'featurescripts', `user_id` FROM `events` WHERE `type` = 'feature_add' AND `feature_type` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_feature_users`("day", "feature", "user_id") SELECT DISTINCT `day`, 'report', `user_id` FROM `events` WHERE `type` = 'report' AND `report_topic` IS NOT NULL AND `report_category` IS NOT NULL AND `report_source` IS NOT NULL AND `user_id` != 'signed-out';
=======
INSERT INTO `user_first_seen`("user_id", "first_day") SELECT `user_id`, min(`day`) FROM (SELECT `user_id`, `day` FROM `daily_user_activity` UNION ALL SELECT `user_id`, `day` FROM `daily_app_opens` UNION ALL SELECT `user_id`, `day` FROM `daily_feature_users`) GROUP BY `user_id`;
>>>>>>> c3c38433 (Store each person's first day; drop the events backfill from 0015):drizzle/0015_feature_reach.sql
