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
	`fixed` integer DEFAULT 0 NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `issue_type`)
);
--> statement-breakpoint
CREATE TABLE `design_check_dismissals` (
	`document_id` text NOT NULL,
	`element_id` text NOT NULL,
	`issue_key` text NOT NULL,
	`dismissed_by` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	PRIMARY KEY(`document_id`, `element_id`, `issue_key`)
);
