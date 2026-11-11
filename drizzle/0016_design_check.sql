CREATE TABLE `daily_design_check_metrics` (
	`day` text NOT NULL,
	`element_type` text NOT NULL,
	`checks` integer DEFAULT 0 NOT NULL,
	`clean_checks` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `element_type`)
);
--> statement-breakpoint
CREATE TABLE `daily_design_issue_metrics` (
	`day` text NOT NULL,
	`issue_type` text NOT NULL,
	`checks` integer DEFAULT 0 NOT NULL,
	`issues` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `issue_type`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `checked_element_type` text;--> statement-breakpoint
ALTER TABLE `events` ADD `design_issue_counts` text;