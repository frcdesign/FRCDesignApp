CREATE TABLE `design_check_dismissals` (
	`document_id` text NOT NULL,
	`element_id` text NOT NULL,
	`issue_key` text NOT NULL,
	`dismissed_by` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	PRIMARY KEY(`document_id`, `element_id`, `issue_key`)
);
