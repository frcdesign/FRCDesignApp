CREATE TABLE `recent_inserts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`selection` text NOT NULL,
	`inserted_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recent_inserts_user_library_idx` ON `recent_inserts` (`user_id`,`library_id`,`inserted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `recent_inserts_user_id_insertable_id_selection_unique` ON `recent_inserts` (`user_id`,`insertable_id`,`selection`);--> statement-breakpoint
ALTER TABLE `insertables` ADD `fasten_disabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Whether a part fastens is whether `fasten_info` is set.
ALTER TABLE `insertables` DROP COLUMN `supports_fasten`;
