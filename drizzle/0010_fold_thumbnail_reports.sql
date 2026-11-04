-- Reports no longer have a thumbnail type; past ones count as Other.
INSERT INTO `daily_report_metrics` (`day`, `topic`, `category`, `source`, `element_id`, `count`)
SELECT `day`, `topic`, 'other', `source`, `element_id`, `count`
FROM `daily_report_metrics`
WHERE `category` = 'thumbnail'
ON CONFLICT (`day`, `topic`, `category`, `source`, `element_id`)
DO UPDATE SET `count` = `daily_report_metrics`.`count` + excluded.`count`;--> statement-breakpoint
DELETE FROM `daily_report_metrics` WHERE `category` = 'thumbnail';--> statement-breakpoint
UPDATE `events` SET `report_category` = 'other' WHERE `report_category` = 'thumbnail';
