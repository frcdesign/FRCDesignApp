-- Drops every table this app owns, children before parents so the drops stay
-- valid under the foreign key enforcement D1 always has on. Leaves D1's own
-- _cf_METADATA alone. Clearing d1_migrations is what lets 0000_init reapply.
DROP TABLE IF EXISTS `__old_favorites`;
DROP TABLE IF EXISTS `__new_users`;
DROP TABLE IF EXISTS `configurations`;
DROP TABLE IF EXISTS `favorites`;
DROP TABLE IF EXISTS `insertables`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `libraries`;
DROP TABLE IF EXISTS `daily_configuration_metrics`;
DROP TABLE IF EXISTS `daily_insertable_metrics`;
DROP TABLE IF EXISTS `daily_insertable_users`;
DROP TABLE IF EXISTS `daily_metrics`;
DROP TABLE IF EXISTS `daily_source_metrics`;
DROP TABLE IF EXISTS `daily_target_metrics`;
DROP TABLE IF EXISTS `daily_user_activity`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `insertable_stats`;
DROP TABLE IF EXISTS `user_stats`;
DROP TABLE IF EXISTS `d1_migrations`;
