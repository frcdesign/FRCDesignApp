/*
 An element's own part number, name and material were stored as the first entry
 of `configurations.records` — the probe of its default configuration. That made
 every probed insertable carry a configurations row, even one with no parameters
 to configure, and forced "is it configurable?" to test the parameter count.

 That part data moves to `insertables.part_data`, where it describes the element
 rather than a configuration of it. `configurations` is left holding only real
 configuration data, so a row exists exactly when there are parameters.

 The default record is always written first (see toResult), so `$[0]` is it.
*/
ALTER TABLE `insertables` ADD `part_data` text;--> statement-breakpoint
UPDATE `insertables` SET `part_data` = (
    SELECT json_remove(json_extract(c.`records`, '$[0]'), '$.configuration')
    FROM `configurations` c
    WHERE c.`id` = `insertables`.`id`
      AND json_array_length(c.`records`) > 0
);--> statement-breakpoint
UPDATE `configurations` SET `records` = json_remove(`records`, '$[0]')
    WHERE json_array_length(`records`) > 0;--> statement-breakpoint
DELETE FROM `configurations` WHERE json_array_length(`parameters`) = 0;
