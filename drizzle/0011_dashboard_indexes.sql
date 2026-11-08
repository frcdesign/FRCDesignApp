CREATE INDEX `favorites_insertable_idx` ON `favorites` (`insertable_id`);--> statement-breakpoint
CREATE INDEX `daily_app_opens_day_opens_idx` ON `daily_app_opens` (`day`,`opens`);