ALTER TABLE `daily_design_issue_metrics` ADD `fixed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_design_issue_metrics` ADD `dismissed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `design_issue_type` text;