import { and, countDistinct, gte, lte, min, sql, type SQL } from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type Db } from "../../db/client";
import { dailyFeatureUsers, type LoggedEvent } from "./schema";
import {
    asFeatureAdd,
    asReport,
    asUse,
    asVersionRun,
    SIGNED_OUT_USER_ID
} from "./logged-event";
import { AppFeature, EventType, UseSource, UseTarget } from "./usage";
import type { FeatureReachOut, FeatureReachWeek } from "./contract";
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
    const use = asUse(event);
    if (!use) return [];

    const features: AppFeature[] = [];
    const fromSource = sourceFeature(use.source);
    if (fromSource) features.push(fromSource);
    if (use.isQuickInsert) features.push(AppFeature.QUICK_INSERT);
    if (use.fasten) features.push(AppFeature.FASTEN);
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
        case UseSource.UNKNOWN:
            return undefined;
    }
}

/** The Monday a day key falls in, as SQLite computes it; matches `toWeekStart`. */
function weekOf(day: SQLiteColumn | SQL.Aliased<string>): SQL<string> {
    return sql<string>`date(${day}, '-' || ((strftime('%w', ${day}) + 6) % 7) || ' days')`;
}

/**
 * Each week's active users and each feature's users among them. Everybody who
 * used a feature counts as active, so a share never passes 100%.
 */
export async function getFeatureReach(
    db: Db,
    range: DayRange
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
        db
            .select({
                week: everyoneWeek,
                users: countDistinct(everyone.userId)
            })
            .from(everyone)
            .groupBy(everyoneWeek)
            .all(),
        db
            .select({
                week: featureWeek,
                feature: dailyFeatureUsers.feature,
                users: countDistinct(dailyFeatureUsers.userId)
            })
            .from(dailyFeatureUsers)
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
        byWeek.set(week, { week, activeUsers: 0, users: {} });
    }
    for (const row of activeRows) {
        const week = byWeek.get(row.week);
        if (week) week.activeUsers = row.users;
    }
    for (const row of featureRows) {
        const week = byWeek.get(row.week);
        if (week) week.users[row.feature] = row.users;
    }

    const firstUsed: FeatureReachOut["firstUsed"] = {};
    for (const row of firstRows) {
        if (row.day) firstUsed[row.feature] = row.day;
    }

    return { weeks: [...byWeek.values()], firstUsed };
}
