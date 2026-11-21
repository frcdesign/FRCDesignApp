/**
 * `daily_feature_users` rebuilt from the event log, as SQL: what a replay
 * through `featuresOf` gives, without reading 2.8 million events into a
 * Worker. Run a week at a time, each well inside D1's 30-second limit
 * (`scripts/backfill-feature-users.ts`). Idempotent: a row already there stays.
 */
import { type DayRange } from "./day";
import { SIGNED_OUT_USER_ID } from "./logged-event";
import { AppFeature, EventType, UseSource } from "./usage";

/** What `asUse` takes for a use: a download, or an insert with where it went. */
const IS_USE = `((type = '${EventType.DOWNLOAD}' OR (type = '${EventType.INSERT}' AND target_element_type IS NOT NULL)) AND library_id IS NOT NULL AND element_id IS NOT NULL AND source IS NOT NULL)`;

/** A use somebody chose, not an Auto Assembly run's. */
const IS_CHOSEN_USE = `(${IS_USE} AND source <> '${UseSource.AUTO_ASSEMBLY}')`;

/** Each feature's events, as `featuresOf` reads them; a new feature fails to compile until it has one. */
const FEATURE_EVENTS: Record<AppFeature, string> = {
    [AppFeature.VERSION_MANAGER]: `type = '${EventType.VERSION_RUN}' AND version_kind IS NOT NULL`,
    [AppFeature.FEATURESCRIPTS]: `type = '${EventType.FEATURE_ADD}' AND feature_type IS NOT NULL`,
    [AppFeature.REPORT]: `type = '${EventType.REPORT}' AND report_topic IS NOT NULL AND report_category IS NOT NULL AND report_source IS NOT NULL AND user_id <> '${SIGNED_OUT_USER_ID}'`,
    [AppFeature.DEFAULT_CONFIGURATION]: `type = '${EventType.DEFAULT_SELECTION}'`,
    [AppFeature.AUTO_ASSEMBLY]: `${IS_USE} AND source = '${UseSource.AUTO_ASSEMBLY}'`,
    [AppFeature.SEARCH]: `${IS_CHOSEN_USE} AND source IN ('${UseSource.SEARCH}', '${UseSource.GROUP_SEARCH}')`,
    [AppFeature.FAVORITES]: `${IS_CHOSEN_USE} AND source = '${UseSource.FAVORITES}'`,
    [AppFeature.RECENTS]: `${IS_CHOSEN_USE} AND source = '${UseSource.RECENTS}'`,
    [AppFeature.QUICK_INSERT]: `${IS_CHOSEN_USE} AND is_quick_insert = 1`,
    [AppFeature.FASTEN]: `${IS_CHOSEN_USE} AND fasten = 1`,
    [AppFeature.PRESELECTION]: `${IS_CHOSEN_USE} AND preselected = 1`,
    [AppFeature.INSERT_LOCATION]: `${IS_CHOSEN_USE} AND at_insert_location = 1`,
    [AppFeature.DOWNLOAD]: `${IS_CHOSEN_USE} AND type = '${EventType.DOWNLOAD}'`
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The statements filling the range's days, one a feature: D1 caps how many
 * SELECTs a statement can join. The days are spelled into them, so they're
 * checked first.
 */
export function featureUsersBackfill(range: DayRange): string[] {
    if (!DAY_KEY.test(range.from) || !DAY_KEY.test(range.to)) {
        throw new Error(`Not a day range: ${range.from} to ${range.to}`);
    }
    const inRange = `day BETWEEN '${range.from}' AND '${range.to}'`;
    return Object.entries(FEATURE_EVENTS).map(
        ([feature, where]) =>
            `INSERT OR IGNORE INTO daily_feature_users (day, feature, user_id) SELECT DISTINCT day, '${feature}', user_id FROM events WHERE ${inRange} AND ${where};`
    );
}
