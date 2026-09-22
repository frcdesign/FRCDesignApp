-- Written by hand, replacing the rebuild `drizzle-kit generate` emitted. Its
-- copy read `SELECT ... "instance_key" ... FROM daily_configuration_metrics`,
-- naming a column the old table does not have: D1 resolves an unknown
-- double-quoted identifier to a string literal, so every existing row would
-- have keyed on the text 'instance_key'. See 0001, which hit the same trap.
--
-- The literal '' below is what those rows mean: recorded before the branch an
-- insert was in was tracked. A parameter nothing conditions is reported whole
-- and counts every key, so those rows keep reading correctly; an instanced one
-- needs `POST /api/analytics/rebuild-configuration-metrics` to attribute them.
--
-- The generated pragmas are dropped rather than kept: no foreign key points at
-- this table, and D1 ignores `PRAGMA foreign_keys` inside a migration anyway.
CREATE TABLE `__new_daily_configuration_metrics` (
	`day` text NOT NULL,
	`library_id` text NOT NULL,
	`element_id` text NOT NULL,
	`parameter_id` text NOT NULL,
	`value` text NOT NULL,
	`instance_key` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`library_id`, `element_id`, `parameter_id`, `value`, `instance_key`, `day`)
);
--> statement-breakpoint
INSERT INTO `__new_daily_configuration_metrics`("day", "library_id", "element_id", "parameter_id", "value", "instance_key", "count") SELECT "day", "library_id", "element_id", "parameter_id", "value", '', "count" FROM `daily_configuration_metrics`;--> statement-breakpoint
DROP TABLE `daily_configuration_metrics`;--> statement-breakpoint
ALTER TABLE `__new_daily_configuration_metrics` RENAME TO `daily_configuration_metrics`;--> statement-breakpoint
CREATE INDEX `daily_configuration_metrics_day_idx` ON `daily_configuration_metrics` (`library_id`,`day`);
