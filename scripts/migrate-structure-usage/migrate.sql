-- Moves ConfigLib Structure's usage from the deleted document's tabs to their
-- copies in the new one. README.md beside this file says how the pairs were found.
-- Safe to apply twice: the second run finds nothing left under the old ids.

DROP TABLE IF EXISTS _structure_element_map;
CREATE TABLE _structure_element_map (
    old_element_id TEXT PRIMARY KEY,
    new_element_id TEXT NOT NULL
);

INSERT INTO _structure_element_map (old_element_id, new_element_id) VALUES
    ('553871087ae2ad3513ae9456', 'fcc5ba34b0d48f55536b42e8'), -- S - Channel (GB), until 2026-11-02
    ('c98df82a4b190a9235c83b36', 'fcc5ba34b0d48f55536b42e8'), -- S - Channel (GB), from 2026-11-02
    ('d310333daa6d3117f1a6df40', 'e9d09d30247568f414d6ff56'), -- S - Quad Block Mount (GB)
    ('e57ded97de08edf56347d744', '8a65d6bf6f814e698a51fc94'), -- S - Dual Block Mount (GB)
    ('bb9bea306e515913e8824604', '1f5c7ac6b2601d113997527d'), -- S - Block Mount (GB)
    ('0399f2253d811bcd193ba186', 'd623987e1c010f6fbc7f8171'), -- S - Grid Plates (GB)
    ('8006b21b679c75d1ab07da98', 'ecbc34f52466aad2809ae4c4'), -- S - Angle Mount (GB)
    ('28cfe77702e84ceac91a6852', '235b6b4dc3aa36bbbd84522d'), -- S - Angle Mount (OS)
    ('e39a7615d427ce397cfe7969', '2555590fd97000dad6f8568d'), -- S - Extrusion (REV)
    ('3d2cc7067eb0168465827f1a', 'd8be578c9c0e6415b8176091'), -- S - Clamping Mount (GB)
    ('14042d0ca78f64c91676b516', 'ec05097b9ce32b714454064c'), -- S - Square Threaded Plate (GB)
    ('fff207c8f46bb8cc5cbeaeb8', '089e63bf7f755a49cd2bd510'), -- S - Threaded Plate  (GB)
    ('371ea20de6d3fa23f90a47a3', '333f10bbff9da3434bee9551'), -- S - Carbon Fiber Rod
    ('c6456bcf306af850a1d38bed', '571ac4fc45cc1eb44e6ddfdc'), -- Carbon Fiber Connectors (OS)
    ('6fe8e4946c68e8394eb5ac88', 'cca0359417433dfa5d7f2fb4'), -- S - GoRail (GB)
    ('01834dbf00f05b7404959390', '91d2df9148c40283cdb82957'), -- S - Gotube (GB)
    ('b52222932799a279ba4b3ffe', '49a5e4d1bc98602c7f27bd83'), -- C - Hinge Assembly (GB)
    ('fa32f4d8f04e7951ddae0396', '0cdfd97b9a645ffb6d4620bf'), -- S - Hub-Mount Control Arms (GB)
    ('20c9961caaf816f4bb97604e', 'aeba2092c24a076a5acf1ed1'), -- S - Aluminum Baseplate (GB)
    ('267bf315d1232606842ce999', '824c0e30b308491b11b24364'); -- S - Disks (GB)
    -- Undecided, 137 uses: its one parameter is on both copies below.
    -- ('2d996271889c7348287d5782', '445dc4cebedffdf4b7a2f6fb'), -- S - Threaded L Bracket (GB)
    -- ('2d996271889c7348287d5782', 'd9f28dec86dd92d40bb0bbd2'), -- Angled brackets

-- The log first: every rollup below can be rebuilt from it.
UPDATE events
SET element_id = (SELECT new_element_id FROM _structure_element_map WHERE old_element_id = events.element_id),
    document_id = 'd27f6611d9012810fbaf7f9a'
WHERE library_id = 'config-lib'
  AND document_id = '7fb23f41cc337e07e70da816'
  AND element_id IN (SELECT old_element_id FROM _structure_element_map);

INSERT INTO insertable_stats (library_id, element_id, insert_count, first_inserted_at, last_inserted_at)
SELECT s.library_id, m.new_element_id, SUM(s.insert_count), MIN(s.first_inserted_at), MAX(s.last_inserted_at)
FROM insertable_stats s
JOIN _structure_element_map m ON m.old_element_id = s.element_id
WHERE s.library_id = 'config-lib'
GROUP BY s.library_id, m.new_element_id
ON CONFLICT (library_id, element_id) DO UPDATE SET
    insert_count = insert_count + excluded.insert_count,
    first_inserted_at = MIN(first_inserted_at, excluded.first_inserted_at),
    last_inserted_at = MAX(last_inserted_at, excluded.last_inserted_at);

DELETE FROM insertable_stats
WHERE library_id = 'config-lib'
  AND element_id IN (SELECT old_element_id FROM _structure_element_map);

INSERT INTO daily_insertable_metrics (day, library_id, element_id, target_element_type, count)
SELECT d.day, d.library_id, m.new_element_id, d.target_element_type, SUM(d.count)
FROM daily_insertable_metrics d
JOIN _structure_element_map m ON m.old_element_id = d.element_id
WHERE d.library_id = 'config-lib'
GROUP BY d.day, d.library_id, m.new_element_id, d.target_element_type
ON CONFLICT (library_id, element_id, day, target_element_type) DO UPDATE SET
    count = count + excluded.count;

DELETE FROM daily_insertable_metrics
WHERE library_id = 'config-lib'
  AND element_id IN (SELECT old_element_id FROM _structure_element_map);

INSERT OR IGNORE INTO daily_insertable_users (day, library_id, element_id, user_id)
SELECT d.day, d.library_id, m.new_element_id, d.user_id
FROM daily_insertable_users d
JOIN _structure_element_map m ON m.old_element_id = d.element_id
WHERE d.library_id = 'config-lib';

DELETE FROM daily_insertable_users
WHERE library_id = 'config-lib'
  AND element_id IN (SELECT old_element_id FROM _structure_element_map);

INSERT INTO daily_configuration_metrics (day, library_id, element_id, parameter_id, value, instance_key, count)
SELECT d.day, d.library_id, m.new_element_id, d.parameter_id, d.value, d.instance_key, SUM(d.count)
FROM daily_configuration_metrics d
JOIN _structure_element_map m ON m.old_element_id = d.element_id
WHERE d.library_id = 'config-lib'
GROUP BY d.day, d.library_id, m.new_element_id, d.parameter_id, d.value, d.instance_key
ON CONFLICT (library_id, element_id, parameter_id, value, instance_key, day) DO UPDATE SET
    count = count + excluded.count;

DELETE FROM daily_configuration_metrics
WHERE library_id = 'config-lib'
  AND element_id IN (SELECT old_element_id FROM _structure_element_map);

DROP TABLE _structure_element_map;
