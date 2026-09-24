ALTER TABLE `libraries` ADD `admin_team` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `libraries` SET `admin_team` = (
	SELECT json_group_array(json_object(
		'userId', `user_id`,
		'isTeamAdmin', json(CASE WHEN `is_team_admin` THEN 'true' ELSE 'false' END)
	))
	FROM `admin_team_members`
	WHERE `admin_team_members`.`library_id` = `libraries`.`id`
)
WHERE EXISTS (
	SELECT 1 FROM `admin_team_members`
	WHERE `admin_team_members`.`library_id` = `libraries`.`id`
);--> statement-breakpoint
DROP TABLE `admin_team_members`;
