CREATE TABLE `generated_sets` (
	`library_id` text NOT NULL,
	`set` text NOT NULL,
	`group_id` text NOT NULL,
	`version_id` text NOT NULL,
	`features` text NOT NULL,
	`catalog` text NOT NULL,
	PRIMARY KEY(`library_id`, `set`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `insertables` ADD `generated_studio` text;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `fastenable_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `preselected_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `quick_fastener_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `fastenable` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `preselected` integer;