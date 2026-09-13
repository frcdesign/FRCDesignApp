ALTER TABLE `groups` ADD `version_created_at` integer;--> statement-breakpoint
ALTER TABLE `insertables` ADD `version_created_at` integer;--> statement-breakpoint
ALTER TABLE `configurations` DROP COLUMN `build_issues`;