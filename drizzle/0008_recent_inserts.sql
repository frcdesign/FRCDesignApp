CREATE TABLE `recent_inserts` (
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`selection` text,
	`inserted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `insertable_id`),
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recent_inserts_user_library_idx` ON `recent_inserts` (`user_id`,`library_id`,`inserted_at`);