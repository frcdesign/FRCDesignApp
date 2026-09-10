ALTER TABLE `events` ADD `session_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `schema_version` integer DEFAULT 1 NOT NULL;