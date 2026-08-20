/*
 `force_index` read as though it overrode every limit, when it only lifts an
 insertable over the auto-index threshold — the hard configuration cap still
 applies. `index_configurations` says what it actually turns on.

 A plain RENAME COLUMN: no default or index changes, so no table recreate.
*/
ALTER TABLE `insertables` RENAME COLUMN `force_index` TO `index_configurations`;
