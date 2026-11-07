import {
    and,
    asc,
    count,
    countDistinct,
    eq,
    gte,
    inArray,
    lte,
    sum,
    type SQL
} from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type Db } from "../../db/client";
import { favorites } from "../../db/schema";
import {
    dailyAppOpens,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    dailyVersionMetrics,
    userStats
} from "./schema";
import { workspaceLinks } from "../version-manager/schema";
import { USE_EVENT_TYPES, UseSource, type UseTarget } from "./usage";
import { LibraryId } from "../library/library-id";
import {
    emptyTargets,
    type UseTargets,
    type AnalyticsTotals,
    type DailyUsePoint,
    type DailyMetricPoint,
    type UseSourceUsage,
    type VersionManagerTotals
} from "./contract";
import { type DayRange } from "./day";
import { eachDay } from "./range";

/** Lifetime totals, or scoped to one library or a window. */
export async function getTotals(
    db: Db,
    libraryId?: LibraryId,
    range?: DayRange
): Promise<AnalyticsTotals> {
    const [metrics, targets, uniqueUsers, favoriteCount, opens] =
        await Promise.all([
            countMetrics(db, libraryId, range),
            countTargets(db, libraryId, range),
            countUsers(db, libraryId, range),
            countFavorites(db, libraryId),
            countAppOpens(db, libraryId, range)
        ]);

    const uses = metrics;

    return {
        uses: Number(uses?.total ?? 0),
        appOpens: Number(opens?.value ?? 0),
        uniqueUsers: uniqueUsers?.value ?? 0,
        favoriteUses: Number(uses?.favorites ?? 0),
        quickInserts: Number(uses?.quickInserts ?? 0),
        fastenInserts: Number(uses?.fastens ?? 0),
        targets: toTargets(targets),
        favorites: favoriteCount?.value ?? 0
    };
}

function scopeFilters(
    columns: { day: SQLiteColumn; libraryId: SQLiteColumn },
    libraryId?: LibraryId,
    range?: DayRange
): SQL[] {
    const filters: SQL[] = [];
    if (libraryId) filters.push(eq(columns.libraryId, libraryId));
    if (range) {
        filters.push(gte(columns.day, range.from));
        filters.push(lte(columns.day, range.to));
    }
    return filters;
}

/** Only the uses: an insert or a download, not another kind of event. */
function usesOnly(): SQL {
    return inArray(dailyMetrics.type, [...USE_EVENT_TYPES]);
}

/** The uses' counters, summed over whatever the caller scoped to. */
function countMetrics(db: Db, libraryId?: LibraryId, range?: DayRange) {
    const filters = [
        usesOnly(),
        ...scopeFilters(dailyMetrics, libraryId, range)
    ];

    return db
        .select({
            total: sum(dailyMetrics.count),
            favorites: sum(dailyMetrics.favoriteCount),
            fastens: sum(dailyMetrics.fastenCount),
            quickInserts: sum(dailyMetrics.quickInsertCount)
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .get();
}

/** Inserts by target, over whatever the caller scoped to. */
function countTargets(db: Db, libraryId?: LibraryId, range?: DayRange) {
    const filters = scopeFilters(dailyTargetMetrics, libraryId, range);

    return db
        .select({
            targetElementType: dailyTargetMetrics.targetElementType,
            total: sum(dailyTargetMetrics.count)
        })
        .from(dailyTargetMetrics)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(dailyTargetMetrics.targetElementType)
        .all();
}

/** Rows of one target apiece, as the whole-of-enum shape the contract states. */
export function toTargets(
    rows: { targetElementType: UseTarget; total: string | number | null }[]
): UseTargets {
    const targets = emptyTargets();
    for (const row of rows) {
        targets[row.targetElementType] = Number(row.total ?? 0);
    }
    return targets;
}

/** `user_stats` is all-time, so a range counts the daily rollups. */
function countUsers(db: Db, libraryId?: LibraryId, range?: DayRange) {
    if (range) {
        return countActiveUsers(db, range, libraryId).then((value) => ({
            value
        }));
    }
    return db
        .select({ value: count() })
        .from(userStats)
        .where(libraryId ? eq(userStats.libraryId, libraryId) : undefined)
        .get();
}

/** Both bounds inclusive, as every day key is. */
function openFilters(range: DayRange): SQL[] {
    return [
        gte(dailyAppOpens.day, range.from),
        lte(dailyAppOpens.day, range.to)
    ];
}

/** App-wide only; see `dailyAppOpens`. */
function countAppOpens(db: Db, libraryId?: LibraryId, range?: DayRange) {
    if (libraryId) return undefined;
    return db
        .select({ value: sum(dailyAppOpens.opens) })
        .from(dailyAppOpens)
        .where(range ? and(...openFilters(range)) : undefined)
        .get();
}

/**
 * Who was about on each day of the range: the library rollup, and app opens,
 * which have no library and so no row in it. Rows are one per library, and an
 * open's is one per person, so every read of this counts distinct.
 */
export function activeUserRows(db: Db, range: DayRange, libraryId?: LibraryId) {
    const activity = db
        .select({
            day: dailyUserActivity.day,
            userId: dailyUserActivity.userId
        })
        .from(dailyUserActivity)
        .where(and(...activityFilters(range, libraryId)));

    if (libraryId) return activity.as("active");

    return activity
        .union(
            db
                .select({
                    day: dailyAppOpens.day,
                    userId: dailyAppOpens.userId
                })
                .from(dailyAppOpens)
                .where(and(...openFilters(range)))
        )
        .as("active");
}

/**
 * Everybody active at any point in the range, as {@link activeUserRows} counts
 * them. A union of ids alone dedupes them in one pass, which a union of
 * day-and-id rows can't.
 */
export async function countActiveUsers(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<number> {
    const activity = db
        .select({ userId: dailyUserActivity.userId })
        .from(dailyUserActivity)
        .where(and(...activityFilters(range, libraryId)));
    const people = libraryId
        ? activity.groupBy(dailyUserActivity.userId).as("people")
        : activity
              .union(
                  db
                      .select({ userId: dailyAppOpens.userId })
                      .from(dailyAppOpens)
                      .where(and(...openFilters(range)))
              )
              .as("people");
    const row = await db.select({ value: count() }).from(people).get();
    return row?.value ?? 0;
}

/** Favorites standing now, which have no day to be windowed by. */
function countFavorites(db: Db, libraryId?: LibraryId) {
    return db
        .select({ value: count() })
        .from(favorites)
        .where(libraryId ? eq(favorites.libraryId, libraryId) : undefined)
        .get();
}

/** Daily insert mix (favorites / fasten / quick insert) across the range. */
function activityFilters(range: DayRange, libraryId?: LibraryId) {
    return scopeFilters(dailyUserActivity, libraryId, range);
}

/** The uses' counters per day, summed across libraries when unscoped. */
function countMetricsByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    const filters = [
        usesOnly(),
        ...scopeFilters(dailyMetrics, libraryId, range)
    ];

    return db
        .select({
            day: dailyMetrics.day,
            total: sum(dailyMetrics.count),
            favoriteUses: sum(dailyMetrics.favoriteCount),
            fastenInserts: sum(dailyMetrics.fastenCount),
            quickInserts: sum(dailyMetrics.quickInsertCount)
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .groupBy(dailyMetrics.day)
        .all();
}

/** Each day's uses by target, summed across libraries when unscoped. */
function countTargetsByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    const filters = scopeFilters(dailyTargetMetrics, libraryId, range);

    return db
        .select({
            day: dailyTargetMetrics.day,
            targetElementType: dailyTargetMetrics.targetElementType,
            total: sum(dailyTargetMetrics.count)
        })
        .from(dailyTargetMetrics)
        .where(and(...filters))
        .groupBy(dailyTargetMetrics.day, dailyTargetMetrics.targetElementType)
        .all();
}

function countUsersByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    const active = activeUserRows(db, range, libraryId);

    return db
        .select({ day: active.day, activeUsers: countDistinct(active.userId) })
        .from(active)
        .groupBy(active.day)
        .all();
}

/** App-wide, as {@link countAppOpens}: a library's series has no opens. */
function countOpensByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    if (libraryId) return [];
    return db
        .select({ day: dailyAppOpens.day, total: sum(dailyAppOpens.opens) })
        .from(dailyAppOpens)
        .where(and(...openFilters(range)))
        .groupBy(dailyAppOpens.day)
        .all();
}

/** From rollups, since the event log grows with every insert. */
export async function getMetricSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyMetricPoint[]> {
    const [rows, targetRows, userRows, openRows] = await Promise.all([
        countMetricsByDay(db, range, libraryId),
        countTargetsByDay(db, range, libraryId),
        countUsersByDay(db, range, libraryId),
        countOpensByDay(db, range, libraryId)
    ]);

    const byDay = new Map<string, DailyMetricPoint>();
    const pointFor = (day: string): DailyMetricPoint => {
        const existing = byDay.get(day);
        if (existing) return existing;
        const created: DailyMetricPoint = {
            day,
            uses: 0,
            appOpens: 0,
            activeUsers: 0,
            favoriteUses: 0,
            quickInserts: 0,
            fastenInserts: 0,
            targets: emptyTargets()
        };
        byDay.set(day, created);
        return created;
    };

    for (const row of rows) {
        const point = pointFor(row.day);
        point.uses = Number(row.total ?? 0);
        point.favoriteUses = Number(row.favoriteUses ?? 0);
        point.fastenInserts = Number(row.fastenInserts ?? 0);
        point.quickInserts = Number(row.quickInserts ?? 0);
    }
    for (const row of openRows) {
        pointFor(row.day).appOpens = Number(row.total ?? 0);
    }
    for (const row of targetRows) {
        pointFor(row.day).targets[row.targetElementType] = Number(
            row.total ?? 0
        );
    }
    for (const row of userRows) {
        pointFor(row.day).activeUsers = row.activeUsers;
    }

    // A quiet day is a zero, so averages are over calendar days.
    for (const day of eachDay(range)) pointFor(day);

    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Lifetime uses split by which part of the app they started from. */
function countBySource(db: Db, range: DayRange, libraryId?: LibraryId) {
    const filters = [
        gte(dailySourceMetrics.day, range.from),
        lte(dailySourceMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailySourceMetrics.libraryId, libraryId));

    return db
        .select({
            source: dailySourceMetrics.source,
            count: sum(dailySourceMetrics.count),
            quickInsertCount: sum(dailySourceMetrics.quickInsertCount)
        })
        .from(dailySourceMetrics)
        .where(and(...filters))
        .groupBy(dailySourceMetrics.source)
        .all();
}

export async function getSources(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<UseSourceUsage[]> {
    const rows = await countBySource(db, range, libraryId);

    const bySource = new Map(rows.map((row) => [row.source, row]));
    // Every source is listed, so one nobody uses reads as a zero, not a gap.
    return Object.values(UseSource).map((source) => ({
        source,
        count: Number(bySource.get(source)?.count ?? 0),
        quickInsertCount: Number(bySource.get(source)?.quickInsertCount ?? 0)
    }));
}

function countUsesByLibraryDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    const filters = [
        usesOnly(),
        gte(dailyMetrics.day, range.from),
        lte(dailyMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    return db
        .select({
            day: dailyMetrics.day,
            libraryId: dailyMetrics.libraryId,
            count: sum(dailyMetrics.count)
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .groupBy(dailyMetrics.day, dailyMetrics.libraryId)
        .orderBy(asc(dailyMetrics.day))
        .all();
}

/** Daily use counts per library, as one row per day for the chart. */
export async function getSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyUsePoint[]> {
    const rows = await countUsesByLibraryDay(db, range, libraryId);

    const byDay = new Map<string, DailyUsePoint>();
    for (const row of rows) {
        const point = byDay.get(row.day) ?? { day: row.day, counts: {} };
        point.counts[row.libraryId] = Number(row.count ?? 0);
        byDay.set(row.day, point);
    }
    // A missing day is a zero, or the line jumps across it.
    for (const day of eachDay(range)) {
        if (!byDay.has(day)) byDay.set(day, { day, counts: {} });
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** The version manager's totals over a range, and what is linked right now. */
export async function getVersionManagerTotals(
    db: Db,
    range: DayRange
): Promise<VersionManagerTotals> {
    const [totals, links] = await Promise.all([
        db
            .select({
                runs: sum(dailyVersionMetrics.runs),
                partialRuns: sum(dailyVersionMetrics.partialRuns),
                failedRuns: sum(dailyVersionMetrics.failedRuns),
                createdVersions: sum(dailyVersionMetrics.createdVersions),
                updatedElements: sum(dailyVersionMetrics.updatedElements)
            })
            .from(dailyVersionMetrics)
            .where(
                and(
                    gte(dailyVersionMetrics.day, range.from),
                    lte(dailyVersionMetrics.day, range.to)
                )
            )
            .get(),
        db.select({ value: count() }).from(workspaceLinks).get()
    ]);

    return {
        runs: Number(totals?.runs ?? 0),
        runsWithFailures:
            Number(totals?.partialRuns ?? 0) + Number(totals?.failedRuns ?? 0),
        createdVersions: Number(totals?.createdVersions ?? 0),
        updatedElements: Number(totals?.updatedElements ?? 0),
        links: links?.value ?? 0
    };
}
