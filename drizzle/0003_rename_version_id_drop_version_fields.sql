ALTER TABLE `groups` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_name`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_created_at`;
