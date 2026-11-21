CREATE TABLE `first_teams` (
	`program` text NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`state_province` text,
	`country` text,
	`rookie_year` integer,
	`last_season` integer NOT NULL,
	PRIMARY KEY(`program`, `number`)
);
--> statement-breakpoint
CREATE TABLE `team_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`default_selection` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_favorites_team_id_library_id_insertable_id_unique` ON `team_favorites` (`team_id`,`library_id`,`insertable_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`source` text DEFAULT 'onshape' NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`role_checked_at` integer NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `team_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`company_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`subteam_id` text DEFAULT '' NOT NULL,
	`subteam_members` text DEFAULT '[]' NOT NULL,
	`synced_at` integer,
	`registered_at` integer NOT NULL,
	`registered_by` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_organizations_company_id_subteam_id_unique` ON `team_organizations` (`company_id`,`subteam_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_organizations_team_id_company_id_unique` ON `team_organizations` (`team_id`,`company_id`);--> statement-breakpoint
CREATE TABLE `team_recent_inserts` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`library_id` text NOT NULL,
	`insertable_id` text NOT NULL,
	`selection` text NOT NULL,
	`user_id` text NOT NULL,
	`inserted_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insertable_id`) REFERENCES `insertables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_recent_inserts_team_library_idx` ON `team_recent_inserts` (`team_id`,`library_id`,`inserted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_recent_inserts_team_id_insertable_id_selection_unique` ON `team_recent_inserts` (`team_id`,`insertable_id`,`selection`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`program` text NOT NULL,
	`number` integer NOT NULL,
	`members_edit_favorites` integer DEFAULT false NOT NULL,
	`vendor_ranking` text DEFAULT '[]' NOT NULL,
	`colors` text DEFAULT '[]' NOT NULL,
	`generic_vendor` text DEFAULT 'any' NOT NULL,
	`registered_at` integer NOT NULL,
	`registered_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `teams_first_idx` ON `teams` (`program`,`number`);--> statement-breakpoint
CREATE TABLE `daily_team_metrics` (
	`team_id` text NOT NULL,
	`day` text NOT NULL,
	`category` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`category`, `day`, `team_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_team_users` (
	`team_id` text NOT NULL,
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`team_id`, `day`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `team_id` text;