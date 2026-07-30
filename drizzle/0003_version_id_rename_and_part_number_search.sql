ALTER TABLE `groups` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` RENAME COLUMN `instance_id` TO `version_id`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_name`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `version_created_at`;--> statement-breakpoint
ALTER TABLE `insertables` ADD `search_part_numbers` integer NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `insertables` ADD `default_part_number` text;--> statement-breakpoint
ALTER TABLE `configurations` ADD `part_numbers` text NOT NULL DEFAULT '{}';
