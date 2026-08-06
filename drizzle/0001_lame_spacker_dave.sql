CREATE TABLE `library_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`type` text NOT NULL,
	`library_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`label` text NOT NULL,
	`triggered_by` text,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
