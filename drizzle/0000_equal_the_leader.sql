CREATE TABLE `configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`parameters` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`instance_id` text NOT NULL,
	`sort_alphabetically` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`thumbnail_urls` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`default_configuration` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_id_library_id_insertable_id_unique` ON `favorites` (`user_id`,`library_id`,`insertable_id`);--> statement-breakpoint
CREATE TABLE `insertables` (
	`id` text PRIMARY KEY NOT NULL,
	`element_id` text NOT NULL,
	`document_id` text NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`element_type` text NOT NULL,
	`microversion_id` text NOT NULL,
	`version_name` text NOT NULL,
	`version_created_at` text NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`is_open_composite` integer DEFAULT false NOT NULL,
	`supports_fasten` integer DEFAULT false NOT NULL,
	`instance_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`vendors` text DEFAULT '[]' NOT NULL,
	`thumbnail_urls` text,
	`fasten_info` text,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insertables_element_id_document_id_unique` ON `insertables` (`element_id`,`document_id`);--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_version` integer DEFAULT 0 NOT NULL,
	`search_db` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`library` text DEFAULT 'frc-design-lib' NOT NULL
);
