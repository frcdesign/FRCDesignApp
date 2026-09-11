/**
 * Reads of the library-wide rollups: totals, the day series behind the charts,
 * and where inserts started from.
 */
import {
    and,
    asc,
    count,
    countDistinct,
    eq,
    gte,
    lte,
    sum,
    type SQL
} from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { type Db } from "../../db/client";
import { favorites } from "../../db/schema";
import {
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    userStats
} from "./schema";
import { EventType, InsertSource } from "./events";
import { LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import {
    emptyTargets,
    type InsertTargets,
    type AnalyticsTotals,
    type DailyInsertPoint,
    type DailyMetricPoint,
    type InsertSourceUsage,
    type LibrarySummary
} from "./contract";
import { type DayRange } from "./day";
import { eachDay } from "./range";
import { getHealthCounts } from "./health";

/** Lifetime totals, optionally scoped to one library and to a window. */
export async function getTotals(
    db: Db,
    libraryId?: LibraryId,
    range?: DayRange
): Promise<AnalyticsTotals> {
    const [metrics, targets, uniqueUsers, favoriteCount] = await Promise.all([
        countMetrics(db, libraryId, range),
        countTargets(db, libraryId, range),
        countUsers(db, libraryId, range),
        countFavorites(db, libraryId)
    ]);

    const byType = new Map(metrics.map((row) => [row.type, row]));
    const inserts = byType.get(EventType.INSERT);

    return {
        inserts: Number(inserts?.total ?? 0),
        appOpens: Number(byType.get(EventType.APP_OPEN)?.total ?? 0),
        uniqueUsers: uniqueUsers?.value ?? 0,
        favoriteInserts: Number(inserts?.favorites ?? 0),
        quickInserts: Number(inserts?.quickInserts ?? 0),
        fastenInserts: Number(inserts?.fastens ?? 0),
        targets: toTargets(targets),
        favorites: favoriteCount?.value ?? 0
    };
}

/**
 * The scope every rollup read takes: one library or all of them, one window or
 * all of time. The tables differ only in which columns carry the two.
 */
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

/** Each event type's counters, summed over whatever the caller scoped to. */
function countMetrics(db: Db, libraryId?: LibraryId, range?: DayRange) {
    const filters = scopeFilters(dailyMetrics, libraryId, range);

    return db
        .select({
            type: dailyMetrics.type,
            total: sum(dailyMetrics.count),
            favorites: sum(dailyMetrics.favoriteCount),
            fastens: sum(dailyMetrics.fastenCount),
            quickInserts: sum(dailyMetrics.quickInsertCount)
        })
        .from(dailyMetrics)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(dailyMetrics.type)
        .all();
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
    rows: { targetElementType: ElementType; total: string | number | null }[]
): InsertTargets {
    const targets = emptyTargets();
    for (const row of rows) {
        targets[row.targetElementType] = Number(row.total ?? 0);
    }
    return targets;
}

/**
 * `user_stats` holds one row per user for all time and so cannot be windowed;
 * a range counts the per-day activity rollup instead.
 */
function countUsers(db: Db, libraryId?: LibraryId, range?: DayRange) {
    if (range) {
        return db
            .select({ value: countDistinct(dailyUserActivity.userId) })
            .from(dailyUserActivity)
            .where(and(...activityFilters(range, libraryId)))
            .get();
    }
    if (libraryId) {
        return db
            .select({ value: count() })
            .from(userStats)
            .where(eq(userStats.libraryId, libraryId))
            .get();
    }
    // Distinct across libraries: someone active in two has a row in each.
    return db
        .select({ value: countDistinct(userStats.userId) })
        .from(userStats)
        .get();
}

/** Favorites standing now, which have no day to be windowed by. */
function countFavorites(db: Db, libraryId?: LibraryId) {
    return db
        .select({ value: count() })
        .from(favorites)
        .where(libraryId ? eq(favorites.libraryId, libraryId) : undefined)
        .get();
}

export async function getLibrarySummaries(db: Db): Promise<LibrarySummary[]> {
    return Promise.all(
        Object.values(LibraryId).map(async (libraryId) => ({
            libraryId,
            totals: await getTotals(db, libraryId),
            health: await getHealthCounts(db, libraryId)
        }))
    );
}

/** Daily insert mix (favorites / fasten / quick insert) across the range. */
function activityFilters(range: DayRange, libraryId?: LibraryId) {
    return scopeFilters(dailyUserActivity, libraryId, range);
}

/** Each event type's counters per day, summed across libraries when unscoped. */
function countMetricsByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    const filters = scopeFilters(dailyMetrics, libraryId, range);

    return db
        .select({
            day: dailyMetrics.day,
            type: dailyMetrics.type,
            total: sum(dailyMetrics.count),
            favoriteInserts: sum(dailyMetrics.favoriteCount),
            fastenInserts: sum(dailyMetrics.fastenCount),
            quickInserts: sum(dailyMetrics.quickInsertCount)
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .groupBy(dailyMetrics.day, dailyMetrics.type)
        .all();
}

/** Each day's inserts by target, summed across libraries when unscoped. */
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

/** One row per user per day already, so this is a COUNT, not a DISTINCT. */
function countUsersByDay(db: Db, range: DayRange, libraryId?: LibraryId) {
    return db
        .select({ day: dailyUserActivity.day, activeUsers: count() })
        .from(dailyUserActivity)
        .where(and(...activityFilters(range, libraryId)))
        .groupBy(dailyUserActivity.day)
        .all();
}

/**
 * Every metric's daily values as one series, read from rollups: the event log
 * grows with every insert rather than with the range.
 */
export async function getMetricSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyMetricPoint[]> {
    const [rows, targetRows, userRows] = await Promise.all([
        countMetricsByDay(db, range, libraryId),
        countTargetsByDay(db, range, libraryId),
        countUsersByDay(db, range, libraryId)
    ]);

    const byDay = new Map<string, DailyMetricPoint>();
    const pointFor = (day: string): DailyMetricPoint => {
        const existing = byDay.get(day);
        if (existing) return existing;
        const created: DailyMetricPoint = {
            day,
            inserts: 0,
            appOpens: 0,
            activeUsers: 0,
            favoriteInserts: 0,
            quickInserts: 0,
            fastenInserts: 0,
            targets: emptyTargets()
        };
        byDay.set(day, created);
        return created;
    };

    for (const row of rows) {
        const point = pointFor(row.day);
        if (row.type === EventType.APP_OPEN) {
            point.appOpens = Number(row.total ?? 0);
            continue;
        }
        point.inserts = Number(row.total ?? 0);
        point.favoriteInserts = Number(row.favoriteInserts ?? 0);
        point.fastenInserts = Number(row.fastenInserts ?? 0);
        point.quickInserts = Number(row.quickInserts ?? 0);
    }
    for (const row of targetRows) {
        pointFor(row.day).targets[row.targetElementType] = Number(
            row.total ?? 0
        );
    }
    for (const row of userRows) {
        pointFor(row.day).activeUsers = row.activeUsers;
    }

    // A quiet day is a zero, not a missing point: anything dividing by the
    // number of points would average over active days instead of calendar ones.
    for (const day of eachDay(range)) pointFor(day);

    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Lifetime inserts split by which part of the app they started from. */
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
): Promise<InsertSourceUsage[]> {
    const rows = await countBySource(db, range, libraryId);

    const bySource = new Map(rows.map((row) => [row.source, row]));
    // Every source is listed, so one nobody uses reads as a zero, not a gap.
    return Object.values(InsertSource).map((source) => ({
        source,
        count: Number(bySource.get(source)?.count ?? 0),
        quickInsertCount: Number(bySource.get(source)?.quickInsertCount ?? 0)
    }));
}

function countInsertsByLibraryDay(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
) {
    const filters = [
        eq(dailyMetrics.type, EventType.INSERT),
        gte(dailyMetrics.day, range.from),
        lte(dailyMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    return db
        .select({
            day: dailyMetrics.day,
            libraryId: dailyMetrics.libraryId,
            count: dailyMetrics.count
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .orderBy(asc(dailyMetrics.day))
        .all();
}

/** Daily insert counts per library, as one row per day for the chart. */
export async function getSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyInsertPoint[]> {
    const rows = await countInsertsByLibraryDay(db, range, libraryId);

    const byDay = new Map<string, DailyInsertPoint>();
    for (const row of rows) {
        const point = byDay.get(row.day) ?? { day: row.day, counts: {} };
        point.counts[row.libraryId] = row.count;
        byDay.set(row.day, point);
    }
    // Same reason as the metric series: a missing day is a zero, and a line
    // that jumps across it reads as activity that never happened.
    for (const day of eachDay(range)) {
        if (!byDay.has(day)) byDay.set(day, { day, counts: {} });
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
