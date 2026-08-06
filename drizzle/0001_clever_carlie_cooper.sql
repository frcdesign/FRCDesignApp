CREATE TABLE `library_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`type` text NOT NULL,
	`library_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`label` text NOT NULL,
	`triggered_by` text,
	`error` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
ALTER TABLE `groups` ADD `last_loaded_at` integer;--> statement-breakpoint
ALTER TABLE `insertables` ADD `last_loaded_at` integer;