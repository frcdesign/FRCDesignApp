import {
    and,
    countDistinct,
    eq,
    gte,
    lte,
    min,
    sql,
    type SQL
} from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type Db } from "../../db/client";
import { dailyFeatureUsers, type LoggedEvent } from "./schema";
import { users } from "../../db/schema";
import {
    asFeatureAdd,
    asReport,
    asUse,
    asVersionRun,
    SIGNED_OUT_USER_ID
} from "./logged-event";
import { AppFeature, EventType, UseSource, UseTarget } from "./usage";
import {
    NEW_USER_WEEKS,
    REACH_DAILY_DAYS,
    ReachInterval,
    type FeatureReachBucket,
    type FeatureReachOut
} from "./contract";
import { activeUserRows } from "./metric-queries";
import { addDays, countDays, toWeekStart, type DayRange } from "./day";

/** The features one event is a use of; a replay of the log gives the same. */
export function featuresOf(event: LoggedEvent): AppFeature[] {
    if (asVersionRun(event)) return [AppFeature.VERSION_MANAGER];
    if (asFeatureAdd(event)) return [AppFeature.FEATURESCRIPTS];
    if (asReport(event)) {
        // Nobody to count among a week's users.
        return event.userId === SIGNED_OUT_USER_ID ? [] : [AppFeature.REPORT];
    }
    if (event.type === EventType.DEFAULT_SELECTION) {
        return [AppFeature.DEFAULT_CONFIGURATION];
    }
    const use = asUse(event);
    if (!use) return [];
    // A run's planner fastens its parts; nobody chose to.
    if (use.source === UseSource.AUTO_ASSEMBLY) {
        return [AppFeature.AUTO_ASSEMBLY];
    }

    const features: AppFeature[] = [];
    const fromSource = sourceFeature(use.source);
    if (fromSource) features.push(fromSource);
    if (use.isQuickInsert) features.push(AppFeature.QUICK_INSERT);
    if (use.fasten) features.push(AppFeature.FASTEN);
    if (use.preselected) features.push(AppFeature.PRESELECTION);
    if (use.atInsertLocation) features.push(AppFeature.INSERT_LOCATION);
    if (use.target === UseTarget.DOWNLOAD) features.push(AppFeature.DOWNLOAD);
    return features;
}

function sourceFeature(source: UseSource): AppFeature | undefined {
    switch (source) {
        case UseSource.SEARCH:
        case UseSource.GROUP_SEARCH:
            return AppFeature.SEARCH;
        case UseSource.FAVORITES:
            return AppFeature.FAVORITES;
        case UseSource.RECENTS:
            return AppFeature.RECENTS;
        case UseSource.BROWSE:
        case UseSource.AUTO_ASSEMBLY:
        case UseSource.UNKNOWN:
            return undefined;
    }
}

/** A point a day over a short range, a week over a long one. */
export function reachInterval(range: DayRange): ReachInterval {
    return countDays(range) <= REACH_DAILY_DAYS
        ? ReachInterval.DAY
        : ReachInterval.WEEK;
}

/** The day or week a day key falls in, as SQLite computes it; a week matches `toWeekStart`. */
function bucketOf(
    day: SQLiteColumn | SQL.Aliased<string>,
    interval: ReachInterval
): SQL<string> {
    switch (interval) {
        case ReachInterval.DAY:
            return sql<string>`${day}`;
        case ReachInterval.WEEK:
            return sql<string>`date(${day}, '-' || ((strftime('%w', ${day}) + 6) % 7) || ' days')`;
    }
}

/** How far before a bucket's start its new-user window starts: {@link NEW_USER_WEEKS} weeks ending with its last day. */
function lookbackDays(interval: ReachInterval): number {
    switch (interval) {
        case ReachInterval.DAY:
            return NEW_USER_WEEKS * 7 - 1;
        case ReachInterval.WEEK:
            return (NEW_USER_WEEKS - 1) * 7;
    }
}

/**
 * Distinct users first seen in the new-user window of the bucket starting
 * `start`. Compared at UTC midnight, hours from the reporting day's.
 */
function countNew(
    userId: SQLiteColumn | SQL.Aliased<string>,
    start: SQL<string>,
    interval: ReachInterval
): SQL<number> {
    const window = `-${lookbackDays(interval)} days`;
    return sql<number>`count(distinct case when ${users.createdAt} >= strftime('%s', ${start}, ${window}) * 1000 then ${userId} end)`.mapWith(
        Number
    );
}

/**
 * Each day or week's active users and each feature's users among them, all and
 * only the new. Everybody who used a feature counts as active, so a share
 * never passes 100%.
 */
export async function getFeatureReach(
    db: Db,
    range: DayRange,
    trackingSince: string | undefined
): Promise<FeatureReachOut> {
    const interval = reachInterval(range);
    const inRange = and(
        gte(dailyFeatureUsers.day, range.from),
        lte(dailyFeatureUsers.day, range.to)
    );
    const active = activeUserRows(db, range);
    const everyone = db
        .select({ day: active.day, userId: active.userId })
        .from(active)
        .union(
            db
                .select({
                    day: dailyFeatureUsers.day,
                    userId: dailyFeatureUsers.userId
                })
                .from(dailyFeatureUsers)
                .where(inRange)
        )
        .as("everyone");
    const everyoneBucket = bucketOf(everyone.day, interval);
    const featureBucket = bucketOf(dailyFeatureUsers.day, interval);

    const [activeRows, featureRows, firstRows] = await Promise.all([
        // Left joined: anybody without a record counts as existing.
        db
            .select({
                start: everyoneBucket,
                users: countDistinct(everyone.userId),
                newUsers: countNew(everyone.userId, everyoneBucket, interval)
            })
            .from(everyone)
            .leftJoin(users, eq(users.id, everyone.userId))
            .groupBy(everyoneBucket)
            .all(),
        db
            .select({
                start: featureBucket,
                feature: dailyFeatureUsers.feature,
                users: countDistinct(dailyFeatureUsers.userId),
                newUsers: countNew(
                    dailyFeatureUsers.userId,
                    featureBucket,
                    interval
                )
            })
            .from(dailyFeatureUsers)
            .leftJoin(users, eq(users.id, dailyFeatureUsers.userId))
            .where(inRange)
            .groupBy(featureBucket, dailyFeatureUsers.feature)
            .all(),
        // All time: where a line starts doesn't depend on the range.
        db
            .select({
                feature: dailyFeatureUsers.feature,
                day: min(dailyFeatureUsers.day)
            })
            .from(dailyFeatureUsers)
            .groupBy(dailyFeatureUsers.feature)
            .all()
    ]);

    const byStart = new Map<string, FeatureReachBucket>();
    // A quiet day or week is listed, so a line breaks there rather than bridging it.
    const step = interval === ReachInterval.DAY ? 1 : 7;
    const first =
        interval === ReachInterval.DAY ? range.from : toWeekStart(range.from);
    for (let start = first; start <= range.to; start = addDays(start, step)) {
        const splits = knowsNewUsers(start, interval, trackingSince);
        byStart.set(start, {
            start,
            activeUsers: 0,
            users: {},
            ...(splits ? { newActiveUsers: 0, newUsers: {} } : {})
        });
    }
    for (const row of activeRows) {
        const bucket = byStart.get(row.start);
        if (!bucket) continue;
        bucket.activeUsers = row.users;
        if (bucket.newActiveUsers !== undefined) {
            bucket.newActiveUsers = row.newUsers;
        }
    }
    for (const row of featureRows) {
        const bucket = byStart.get(row.start);
        if (!bucket) continue;
        bucket.users[row.feature] = row.users;
        if (bucket.newUsers && row.newUsers > 0) {
            bucket.newUsers[row.feature] = row.newUsers;
        }
    }

    const firstUsed: FeatureReachOut["firstUsed"] = {};
    for (const row of firstRows) {
        if (row.day) firstUsed[row.feature] = row.day;
    }

    return { interval, buckets: [...byStart.values()], firstUsed };
}

/**
 * Only once tracking began before the bucket's new-user window: somebody first
 * seen the day tracking began may have been using the app long before.
 */
function knowsNewUsers(
    start: string,
    interval: ReachInterval,
    trackingSince: string | undefined
) {
    if (trackingSince === undefined) return false;
    return addDays(start, -lookbackDays(interval)) > trackingSince;
}
