ALTER TABLE `insertables` ADD `fasten_disabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Whether a part fastens is whether `fasten_info` is set.
ALTER TABLE `insertables` DROP COLUMN `supports_fasten`;
