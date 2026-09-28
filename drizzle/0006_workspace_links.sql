CREATE TABLE `workspace_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_document_id` text NOT NULL,
	`source_workspace_id` text NOT NULL,
	`target_document_id` text NOT NULL,
	`target_workspace_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_links_source_idx` ON `workspace_links` (`source_document_id`,`source_workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_links_target_idx` ON `workspace_links` (`target_document_id`,`target_workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_links_source_document_id_source_workspace_id_target_document_id_target_workspace_id_unique` ON `workspace_links` (`source_document_id`,`source_workspace_id`,`target_document_id`,`target_workspace_id`);