/**
 * Reads of the library-wide rollups: totals, the day series behind the charts,
 * and where inserts started from.
 */
import { and, asc, count, countDistinct, eq, gte, lte, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import {
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    favorites,
    userStats
} from "../../db/schema";
import { EventType, InsertSource } from "./events";
import { LibraryId } from "../library/library-id";
import type {
    AnalyticsTotals,
    DailyInsertPoint,
    DailyMetricPoint,
    InsertSourceUsage,
    LibrarySummary
} from "./contract";
import { eachDay, type DayRange } from "./range";
import { getHealthCounts } from "./health";

/**
 * Lifetime totals, optionally scoped to one library. Unique users is a count
 * over `user_stats` — globally it must be distinct, since a person active in
 * two libraries has a row in each.
 */
export async function getTotals(
    db: Db,
    libraryId?: LibraryId,
    range?: DayRange
): Promise<AnalyticsTotals> {
    const metricFilters = [];
    if (libraryId) metricFilters.push(eq(dailyMetrics.libraryId, libraryId));
    if (range) {
        metricFilters.push(gte(dailyMetrics.day, range.from));
        metricFilters.push(lte(dailyMetrics.day, range.to));
    }

    const [metrics, uniqueUsers, favoriteCount] = await Promise.all([
        db
            .select({
                type: dailyMetrics.type,
                total: sum(dailyMetrics.count),
                favorites: sum(dailyMetrics.favoriteCount),
                fastens: sum(dailyMetrics.fastenCount),
                quickInserts: sum(dailyMetrics.quickInsertCount),
                assemblies: sum(dailyMetrics.assemblyCount)
            })
            .from(dailyMetrics)
            .where(metricFilters.length ? and(...metricFilters) : undefined)
            .groupBy(dailyMetrics.type)
            .all(),
        // `user_stats` holds one row per user for all time, which cannot be
        // windowed, so a range reads the per-day activity table instead.
        range
            ? db
                  .select({ value: countDistinct(dailyUserActivity.userId) })
                  .from(dailyUserActivity)
                  .where(and(...activityFilters(range, libraryId)))
                  .get()
            : libraryId
              ? db
                    .select({ value: count() })
                    .from(userStats)
                    .where(eq(userStats.libraryId, libraryId))
                    .get()
              : db
                    .select({ value: countDistinct(userStats.userId) })
                    .from(userStats)
                    .get(),
        db
            .select({ value: count() })
            .from(favorites)
            .where(libraryId ? eq(favorites.libraryId, libraryId) : undefined)
            .get()
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
        assemblyInserts: Number(inserts?.assemblies ?? 0),
        favorites: favoriteCount?.value ?? 0
    };
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
    const filters = [
        gte(dailyUserActivity.day, range.from),
        lte(dailyUserActivity.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailyUserActivity.libraryId, libraryId));
    return filters;
}

/**
 * Every metric's daily values across the range, as one series.
 *
 * Both halves are index range scans over rollups — nothing here reads the
 * event log, which grows with every insert rather than with the range.
 */
export async function getMetricSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyMetricPoint[]> {
    const filters = [
        gte(dailyMetrics.day, range.from),
        lte(dailyMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    const [rows, userRows] = await Promise.all([
        // Summed across libraries, so an overview day is one point, not three.
        db
            .select({
                day: dailyMetrics.day,
                type: dailyMetrics.type,
                total: sum(dailyMetrics.count),
                favoriteInserts: sum(dailyMetrics.favoriteCount),
                fastenInserts: sum(dailyMetrics.fastenCount),
                quickInserts: sum(dailyMetrics.quickInsertCount),
                assemblyInserts: sum(dailyMetrics.assemblyCount)
            })
            .from(dailyMetrics)
            .where(and(...filters))
            .groupBy(dailyMetrics.day, dailyMetrics.type)
            .all(),
        // One row per user per day already, so this is a COUNT, not a DISTINCT.
        db
            .select({
                day: dailyUserActivity.day,
                activeUsers: count()
            })
            .from(dailyUserActivity)
            .where(and(...activityFilters(range, libraryId)))
            .groupBy(dailyUserActivity.day)
            .all()
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
            assemblyInserts: 0
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
        point.assemblyInserts = Number(row.assemblyInserts ?? 0);
    }
    for (const row of userRows) {
        pointFor(row.day).activeUsers = row.activeUsers;
    }

    // A quiet day is a zero, not a missing point. Without this, anything that
    // divides by the number of points averages over *active* days instead of
    // calendar days, and a chart joins straight across a gap.
    for (const day of eachDay(range)) pointFor(day);

    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Lifetime inserts split by which part of the app they started from. */
export async function getSources(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<InsertSourceUsage[]> {
    const filters = [
        gte(dailySourceMetrics.day, range.from),
        lte(dailySourceMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailySourceMetrics.libraryId, libraryId));

    const rows = await db
        .select({
            source: dailySourceMetrics.source,
            count: sum(dailySourceMetrics.count),
            quickInsertCount: sum(dailySourceMetrics.quickInsertCount)
        })
        .from(dailySourceMetrics)
        .where(and(...filters))
        .groupBy(dailySourceMetrics.source)
        .all();

    const bySource = new Map(rows.map((row) => [row.source, row]));
    // Every source is listed, so one nobody uses reads as a zero, not a gap.
    return Object.values(InsertSource).map((source) => ({
        source,
        count: Number(bySource.get(source)?.count ?? 0),
        quickInsertCount: Number(bySource.get(source)?.quickInsertCount ?? 0)
    }));
}

/** Daily insert counts per library, as one row per day for the chart. */
export async function getSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyInsertPoint[]> {
    const filters = [
        eq(dailyMetrics.type, EventType.INSERT),
        gte(dailyMetrics.day, range.from),
        lte(dailyMetrics.day, range.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    const rows = await db
        .select({
            day: dailyMetrics.day,
            libraryId: dailyMetrics.libraryId,
            count: dailyMetrics.count
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .orderBy(asc(dailyMetrics.day))
        .all();

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
