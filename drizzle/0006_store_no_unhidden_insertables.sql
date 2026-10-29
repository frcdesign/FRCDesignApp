-- What a group's last save would have stored, had it known the check.
UPDATE `groups`
SET `build_issues` = json_insert(`build_issues`, '$[#]', json('{"type":"no-unhidden-insertables"}'))
WHERE `last_loaded_at` IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM `insertables`
        WHERE `insertables`.`group_id` = `groups`.`id` AND `insertables`.`is_visible` = 1
    )
    AND NOT EXISTS (
        SELECT 1 FROM json_each(`groups`.`build_issues`)
        WHERE json_extract(`value`, '$.type') = 'no-unhidden-insertables'
    );
