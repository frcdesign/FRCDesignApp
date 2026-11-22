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
    type FeatureReachOut,
    type FeatureReachWeek
} from "./contract";
import { activeUserRows } from "./metric-queries";
import { addDays, toWeekStart, type DayRange } from "./day";

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
    if (isMassAnalysisEvent(event.type)) {
        return [AppFeature.MASS_ANALYSIS];
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

function isMassAnalysisEvent(type: EventType): boolean {
    return (
        type === EventType.MASS_REPORT ||
        type === EventType.MATERIAL_SET ||
        type === EventType.MASS_OVERRIDE_SET
    );
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

/** The Monday a day key falls in, as SQLite computes it; matches `toWeekStart`. */
function weekOf(day: SQLiteColumn | SQL.Aliased<string>): SQL<string> {
    return sql<string>`date(${day}, '-' || ((strftime('%w', ${day}) + 6) % 7) || ' days')`;
}

/**
 * Distinct users first seen in the {@link NEW_USER_WEEKS} weeks up to and
 * including `week`. Compared at UTC midnight, hours from the reporting day's.
 */
function countNew(
    userId: SQLiteColumn | SQL.Aliased<string>,
    week: SQL<string>
): SQL<number> {
    const window = `-${(NEW_USER_WEEKS - 1) * 7} days`;
    return sql<number>`count(distinct case when ${users.createdAt} >= strftime('%s', ${week}, ${window}) * 1000 then ${userId} end)`.mapWith(
        Number
    );
}

/**
 * Each week's active users and each feature's users among them, all and only
 * the new. Everybody who used a feature counts as active, so a share never
 * passes 100%.
 */
export async function getFeatureReach(
    db: Db,
    range: DayRange,
    trackingSince: string | undefined
): Promise<FeatureReachOut> {
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
    const everyoneWeek = weekOf(everyone.day);
    const featureWeek = weekOf(dailyFeatureUsers.day);

    const [activeRows, featureRows, firstRows] = await Promise.all([
        // Left joined: anybody without a record counts as existing.
        db
            .select({
                week: everyoneWeek,
                users: countDistinct(everyone.userId),
                newUsers: countNew(everyone.userId, everyoneWeek)
            })
            .from(everyone)
            .leftJoin(users, eq(users.id, everyone.userId))
            .groupBy(everyoneWeek)
            .all(),
        db
            .select({
                week: featureWeek,
                feature: dailyFeatureUsers.feature,
                users: countDistinct(dailyFeatureUsers.userId),
                newUsers: countNew(dailyFeatureUsers.userId, featureWeek)
            })
            .from(dailyFeatureUsers)
            .leftJoin(users, eq(users.id, dailyFeatureUsers.userId))
            .where(inRange)
            .groupBy(featureWeek, dailyFeatureUsers.feature)
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

    const byWeek = new Map<string, FeatureReachWeek>();
    // A quiet week is listed, so a line breaks there rather than bridging it.
    for (
        let week = toWeekStart(range.from);
        week <= range.to;
        week = addDays(week, 7)
    ) {
        const splits = knowsNewUsers(week, trackingSince);
        byWeek.set(week, {
            week,
            activeUsers: 0,
            users: {},
            ...(splits ? { newActiveUsers: 0, newUsers: {} } : {})
        });
    }
    for (const row of activeRows) {
        const week = byWeek.get(row.week);
        if (!week) continue;
        week.activeUsers = row.users;
        if (week.newActiveUsers !== undefined) {
            week.newActiveUsers = row.newUsers;
        }
    }
    for (const row of featureRows) {
        const week = byWeek.get(row.week);
        if (!week) continue;
        week.users[row.feature] = row.users;
        if (week.newUsers && row.newUsers > 0) {
            week.newUsers[row.feature] = row.newUsers;
        }
    }

    const firstUsed: FeatureReachOut["firstUsed"] = {};
    for (const row of firstRows) {
        if (row.day) firstUsed[row.feature] = row.day;
    }

    return { weeks: [...byWeek.values()], firstUsed };
}

/**
 * Only once tracking began before the week's new-user window: somebody first
 * seen the day tracking began may have been using the app long before.
 */
function knowsNewUsers(week: string, trackingSince: string | undefined) {
    if (trackingSince === undefined) return false;
    return addDays(week, -(NEW_USER_WEEKS - 1) * 7) > trackingSince;
}
