CREATE TABLE `load_jobs` (
	`group_id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`instance_id` text,
	`started_at` integer NOT NULL,
	`force_reload` integer DEFAULT false NOT NULL,
	`awaiting_approval` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onshape_webhooks` (
	`subject` text NOT NULL,
	`subject_id` text NOT NULL,
	`webhook_id` text,
	`token` text NOT NULL,
	PRIMARY KEY(`subject`, `subject_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onshape_webhooks_token_unique` ON `onshape_webhooks` (`token`);--> statement-breakpoint
ALTER TABLE `groups` ADD `thumbnail_workspace_id` text;--> statement-breakpoint
ALTER TABLE `insertables` ADD `excluded_parameter_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `libraries` ADD `admin_team_id` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `admin_team` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `libraries` ADD `approve_versions` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `theme`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `tab_id`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `group_id`;