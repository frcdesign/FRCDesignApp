/*
 A favorite stored the selection to insert as a map of parameter values, which
 had to be canonical for its thumbnail to key the same render as everyone
 else's. It now stores the canonical form itself — the text every equivalent
 selection shares — and the insert menu reads the values back out of it.

 json_each walks the stored map in document order, which is the parameter order
 it was written in, so a converted row spells its selection the way
 canonicalizeConfiguration would.
*/
ALTER TABLE `favorites` ADD `canonical_configuration` text;
--> statement-breakpoint
UPDATE `favorites`
SET `canonical_configuration` = (
    SELECT group_concat(entry.key || '=' || entry.value, ';')
    FROM json_each(`favorites`.`default_configuration`) AS entry
)
WHERE `default_configuration` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `favorites` DROP COLUMN `default_configuration`;
