ALTER TABLE `insertables` ADD `search_part_numbers` integer NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `insertables` ADD `default_part_number` text;--> statement-breakpoint
ALTER TABLE `configurations` ADD `part_numbers` text NOT NULL DEFAULT '{}';
