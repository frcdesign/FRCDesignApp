ALTER TABLE `libraries` ADD `approve_versions` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `load_jobs` ADD `awaiting_approval` integer DEFAULT false NOT NULL;