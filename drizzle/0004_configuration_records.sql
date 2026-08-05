/*
 The part-number search flag becomes a force-index override, and configurations
 now store a rich record per probed configuration instead of a bare part-number
 map.

 Unlike 0003, none of these change a column default or touch an index, so no
 table recreate is needed: SQLite (and D1) support RENAME COLUMN, DROP COLUMN,
 and ADD COLUMN directly. The renamed `force_index` keeps each insertable's
 existing flag value. `part_numbers` held a part-number map keyed differently
 from the new `ConfigurationRecord[]`, so there's nothing to carry over — it's
 dropped and `records` starts empty, to be repopulated on the next load.
*/
ALTER TABLE `insertables` RENAME COLUMN `search_part_numbers` TO `force_index`;--> statement-breakpoint
ALTER TABLE `insertables` DROP COLUMN `default_part_number`;--> statement-breakpoint
ALTER TABLE `configurations` DROP COLUMN `part_numbers`;--> statement-breakpoint
ALTER TABLE `configurations` ADD `records` text DEFAULT '[]' NOT NULL;
