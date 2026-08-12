/*
 The generic `thumbnail_urls` JSON map becomes one explicit column per stored
 size. The two sizes also changed (70x40 + 300x300), and thumbnails now live
 under a new R2 key scheme, so there is nothing worth carrying over: the columns
 start null and repopulate on the next load, which is also when the new R2
 objects are written.
*/
ALTER TABLE `groups` DROP COLUMN `thumbnail_urls`;--> statement-breakpoint
ALTER TABLE `groups` ADD `small_thumbnail_url` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `large_thumbnail_url` text;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `thumbnail_urls`;--> statement-breakpoint
ALTER TABLE `insertables` ADD `small_thumbnail_url` text;--> statement-breakpoint
ALTER TABLE `insertables` ADD `large_thumbnail_url` text;
