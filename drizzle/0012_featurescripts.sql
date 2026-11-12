CREATE TABLE `featurescript_favorites` (
	`user_id` text NOT NULL,
	`featurescript_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `featurescript_id`),
	FOREIGN KEY (`featurescript_id`) REFERENCES `featurescripts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `featurescripts` (
	`id` text PRIMARY KEY NOT NULL,
	`element_id` text NOT NULL,
	`microversion_id` text NOT NULL,
	`feature_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text,
	`release_version` text,
	`source_url` text,
	`is_visible` integer DEFAULT true NOT NULL,
	`example_element_id` text,
	`example_microversion_id` text,
	`icon_element_id` text,
	`icon_microversion_id` text,
	`thumbnail_urls` text,
	`problems` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `featurescripts_element_id_unique` ON `featurescripts` (`element_id`);--> statement-breakpoint
CREATE TABLE `featurescripts_document` (
	`document_id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`cache_version` integer DEFAULT 0 NOT NULL
);
