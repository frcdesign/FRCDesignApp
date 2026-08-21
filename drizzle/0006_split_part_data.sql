/*
 An element's own part number, name and material were stored as the first entry
 of `configurations.records` — the probe of its default configuration. That made
 every probed insertable carry a configurations row, even one with no parameters
 to configure, and forced "is it configurable?" to test the parameter count.

 That part data moves to `insertables.part_data`, where it describes the element
 rather than a configuration of it. Nothing is carried over: the column starts
 null and repopulates on the next load, which is also when a configurations row
 that holds no parameters is dropped.
*/
ALTER TABLE `insertables` ADD `part_data` text;
