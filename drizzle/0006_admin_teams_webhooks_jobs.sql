CREATE TABLE `admin_team_members` (
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_team_admin` integer NOT NULL,
	PRIMARY KEY(`library_id`, `user_id`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `load_jobs` (
	`group_id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`instance_id` text,
	`started_at` integer NOT NULL,
	`rerun` integer DEFAULT false NOT NULL,
	`rerun_force` integer DEFAULT false NOT NULL,
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
ALTER TABLE `libraries` ADD `admin_team_id` text;