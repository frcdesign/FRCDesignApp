CREATE TABLE `daily_version_metrics` (
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`created_versions` integer DEFAULT 0 NOT NULL,
	`updated_workspaces` integer DEFAULT 0 NOT NULL,
	`updated_elements` integer DEFAULT 0 NOT NULL,
	`failed_elements` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `kind`)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`day` text NOT NULL,
	`library_id` text,
	`user_id` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`element_id` text,
	`document_id` text,
	`instance_id` text,
	`instance_type` text,
	`insertable_id` text,
	`target_element_type` text,
	`selection` text,
	`is_favorite` integer,
	`is_quick_insert` integer,
	`source` text,
	`fasten` integer,
	`version_kind` text,
	`version_scope` text,
	`created_versions` integer,
	`updated_workspaces` integer,
	`updated_elements` integer,
	`failed_elements` integer
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "type", "created_at", "day", "library_id", "user_id", "schema_version", "element_id", "document_id", "instance_id", "instance_type", "insertable_id", "target_element_type", "selection", "is_favorite", "is_quick_insert", "source", "fasten") SELECT "id", "type", "created_at", "day", "library_id", "user_id", "schema_version", "element_id", "document_id", "instance_id", "instance_type", "insertable_id", "target_element_type", "selection", "is_favorite", "is_quick_insert", "source", "fasten" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`day`);