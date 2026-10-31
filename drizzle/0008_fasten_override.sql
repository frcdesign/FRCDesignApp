ALTER TABLE `insertables` ADD `fasten_override` integer;--> statement-breakpoint
-- Every load detects a part studio's mate connector, so only an assembly's choice is the admin's.
UPDATE `insertables` SET `fasten_override` = true WHERE `supports_fasten` = true AND `element_type` = 'ASSEMBLY';
