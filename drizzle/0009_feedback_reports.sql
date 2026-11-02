CREATE TABLE `daily_report_metrics` (
	`day` text NOT NULL,
	`topic` text NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`element_id` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `topic`, `category`, `source`, `element_id`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `report_topic` text;--> statement-breakpoint
ALTER TABLE `events` ADD `report_category` text;--> statement-breakpoint
ALTER TABLE `events` ADD `report_source` text;