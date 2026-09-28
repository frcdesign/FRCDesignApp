-- FTCDesignLib is now ConfigLib, and a library is keyed by its id, so every row
-- of it moves with the name. The new row goes in first and the old one last:
-- the children point at `libraries.id`, and SQLite does not cascade an update.
INSERT INTO libraries (id, cache_version, admin_team_id, admin_team, approve_versions)
SELECT 'config-lib', cache_version, admin_team_id, admin_team, approve_versions
FROM libraries WHERE id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE groups SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE insertables SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE favorites SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE load_jobs SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE users SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE events SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_target_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_source_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_insertable_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_insertable_users SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_configuration_metrics SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE daily_user_activity SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE insertable_stats SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
UPDATE user_stats SET library_id = 'config-lib' WHERE library_id = 'ftc-design-lib';
--> statement-breakpoint
DELETE FROM libraries WHERE id = 'ftc-design-lib';
