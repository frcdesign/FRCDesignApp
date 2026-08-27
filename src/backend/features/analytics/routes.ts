import {
    and,
    asc,
    count,
    countDistinct,
    eq,
    gte,
    lte,
    sql,
    sum
} from "drizzle-orm";
import z from "zod";
import { getApp, type AppContext } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb, type Db } from "../../db/client";
import {
    configurations,
    configurationValueStats,
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    events,
    favorites,
    group,
    insertables,
    insertableStats,
    userStats
} from "../../db/schema";
import { EventType, InsertSource } from "./events";
import { LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import {
    ParameterType,
    type ConfigurationParameter
} from "../configurations/models";
import { SPARKLINE_DAYS, usesPerMonth } from "./contract";
import type {
    AnalyticsOverviewOut,
    AnalyticsTotals,
    ConfigurationParameterUsage,
    ConfigurationValueUsage,
    DailyInsertPoint,
    DailyMetricPoint,
    HealthIssueCount,
    HealthItem,
    InsertableReportOut,
    InsertSourceUsage,
    LibraryHealthCounts,
    LibraryHealthOut,
    LibrarySummary,
    PartUsageOut,
    TargetSplit,
    UnusedOptionOut
} from "./contract";
import {
    BuildIssueSeverity,
    BuildIssueType,
    getIssueDescription,
    getIssueSeverity,
    getMaxSeverity,
    type BuildIssue
} from "../build-checker/issues";
import { toDayKey } from "./tracking";

export const analyticsRoutes = getApp();

/**
 * Every read handler here is deliberately public: the dashboard lives outside
 * the Onshape panel with no OAuth, and in this app an endpoint is public
 * exactly by never touching `c.var.getUserId()` / `c.var.getOnshapeApi()`.
 * Only aggregates are returned — never a user id.
 */

/** Matches the dashboard's default preset. */
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_UNUSED_THRESHOLD = 5;
/** Values shown per free-form (non-enum) parameter before truncating. */
const MAX_FREE_FORM_VALUES = 20;

interface DayRange {
    from: string;
    to: string;
}

/** Reads the `from`/`to` query params, defaulting to the last 30 days. */
function getRange(c: AppContext): DayRange {
    const dayFormat = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const now = Date.now();

    const to = dayFormat.safeParse(c.req.query("to"));
    const from = dayFormat.safeParse(c.req.query("from"));

    return {
        to: to.success ? to.data : toDayKey(now),
        from: from.success
            ? from.data
            : toDayKey(now - DEFAULT_RANGE_DAYS * 24 * 3600 * 1000)
    };
}

/** GET /api/analytics/overview */
analyticsRoutes.get("/analytics/overview", async (c) => {
    const db = getDb(c.env.DB);
    const range = getRange(c);

    const [totals, rangeTotals, perLibrary, series, metricSeries, sources] =
        await Promise.all([
            getTotals(db),
            getTotals(db, undefined, range),
            getLibrarySummaries(db, range),
            getSeries(db, range),
            getMetricSeries(db, range),
            getSources(db, range)
        ]);

    const out: AnalyticsOverviewOut = {
        totals,
        rangeTotals,
        libraries: perLibrary,
        series,
        metricSeries,
        sources,
        ...range
    };
    return c.json(out);
});

/** GET /api/analytics/summary/library/:libraryId */
analyticsRoutes.get("/analytics/summary" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const range = getRange(c);

    const [totals, rangeTotals, series, metricSeries, sources, health] =
        await Promise.all([
            getTotals(db, libraryId),
            getTotals(db, libraryId, range),
            getSeries(db, range, libraryId),
            getMetricSeries(db, range, libraryId),
            getSources(db, range, libraryId),
            getHealthCounts(db, libraryId)
        ]);

    const out: AnalyticsOverviewOut = {
        totals,
        rangeTotals,
        libraries: [{ libraryId, totals, rangeTotals, health }],
        series,
        metricSeries,
        sources,
        ...range
    };
    return c.json(out);
});

/** GET /api/analytics/health/library/:libraryId */
analyticsRoutes.get("/analytics/health" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getLibraryHealth(db, libraryId));
});

/** GET /api/analytics/parts/library/:libraryId */
analyticsRoutes.get("/analytics/parts" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);

    // Driven off the library rather than the stats table, so a part nobody has
    // used is still listed (at zero) and a part that has left the library is
    // not listed at all — its usage is history about something you can no
    // longer open, which only pads the table.
    const [rows, series] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                insertCount: insertableStats.insertCount,
                firstInsertedAt: insertableStats.firstInsertedAt,
                lastInsertedAt: insertableStats.lastInsertedAt,
                insertableId: insertables.id,
                name: insertables.name,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                isVisible: insertables.isVisible,
                groupName: group.name
            })
            .from(insertables)
            .leftJoin(
                insertableStats,
                and(
                    eq(insertableStats.libraryId, insertables.libraryId),
                    eq(insertableStats.elementId, insertables.elementId)
                )
            )
            // `groupId` is a non-null FK that cascades, so a row always matches.
            .innerJoin(group, eq(group.id, insertables.groupId))
            .where(eq(insertables.libraryId, libraryId))
            .all(),
        getPartSparklines(db, libraryId)
    ]);

    const now = Date.now();
    const out: PartUsageOut[] = rows
        .map((row) => ({
            elementId: row.elementId,
            insertableId: row.insertableId,
            name: row.name,
            groupName: row.groupName,
            documentId: row.documentId,
            versionId: row.versionId,
            isVisible: row.isVisible,
            insertCount: row.insertCount ?? 0,
            usesPerMonth: usesPerMonth(
                row.insertCount ?? 0,
                row.firstInsertedAt,
                now
            ),
            lastInsertedAt: row.lastInsertedAt,
            recent: series.get(row.elementId) ?? emptySparkline()
        }))
        // Most used first; unused parts fall to the bottom in name order.
        .sort(
            (a, b) =>
                b.usesPerMonth - a.usesPerMonth || a.name.localeCompare(b.name)
        );
    return c.json(out);
});

function emptySparkline(): number[] {
    return Array.from({ length: SPARKLINE_DAYS }, () => 0);
}

/**
 * Daily insert counts per part over the trailing window, as dense arrays the
 * table can plot directly.
 *
 * Read from the raw event log rather than a rollup: this is the one query
 * narrow enough not to need one, since it is a single library over a month.
 */
async function getPartSparklines(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, number[]>> {
    const now = Date.now();
    const days = Array.from({ length: SPARKLINE_DAYS }, (_, i) =>
        toDayKey(now - (SPARKLINE_DAYS - 1 - i) * 24 * 3600 * 1000)
    );
    const dayIndex = new Map(days.map((day, i) => [day, i]));

    const rows = await db
        .select({
            elementId: events.elementId,
            day: events.day,
            count: count()
        })
        .from(events)
        .where(
            and(
                eq(events.libraryId, libraryId),
                eq(events.type, EventType.INSERT),
                gte(events.day, days[0])
            )
        )
        .groupBy(events.elementId, events.day)
        .all();

    const byElement = new Map<string, number[]>();
    for (const row of rows) {
        if (row.elementId === null) continue;
        const index = dayIndex.get(row.day);
        if (index === undefined) continue;
        const counts = byElement.get(row.elementId) ?? emptySparkline();
        counts[index] = row.count;
        byElement.set(row.elementId, counts);
    }
    return byElement;
}

/** GET /api/analytics/unused/library/:libraryId */
analyticsRoutes.get("/analytics/unused" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);

    const parsed = z.coerce
        .number()
        .int()
        .nonnegative()
        .safeParse(c.req.query("threshold"));
    const threshold = parsed.success ? parsed.data : DEFAULT_UNUSED_THRESHOLD;

    // Drives off insertables (not the stats table) so parts with no events at
    // all — the ones that matter most here — are included.
    const rows = await db
        .select({
            elementId: insertables.elementId,
            insertableId: insertables.id,
            name: insertables.name,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            groupName: group.name,
            isVisible: insertables.isVisible,
            insertCount: insertableStats.insertCount,
            firstInsertedAt: insertableStats.firstInsertedAt,
            lastInsertedAt: insertableStats.lastInsertedAt
        })
        .from(insertables)
        .leftJoin(
            insertableStats,
            and(
                eq(insertableStats.libraryId, insertables.libraryId),
                eq(insertableStats.elementId, insertables.elementId)
            )
        )
        .innerJoin(group, eq(group.id, insertables.groupId))
        .where(
            and(
                eq(insertables.libraryId, libraryId),
                eq(insertables.isVisible, true),
                sql`coalesce(${insertableStats.insertCount}, 0) <= ${threshold}`
            )
        )
        .orderBy(
            asc(sql`coalesce(${insertableStats.insertCount}, 0)`),
            asc(insertables.name)
        )
        .all();

    const series = await getPartSparklines(db, libraryId);
    const now = Date.now();
    const out: PartUsageOut[] = rows.map((row) => ({
        elementId: row.elementId,
        insertableId: row.insertableId,
        name: row.name,
        groupName: row.groupName,
        documentId: row.documentId,
        versionId: row.versionId,
        isVisible: row.isVisible,
        insertCount: row.insertCount ?? 0,
        usesPerMonth: usesPerMonth(
            row.insertCount ?? 0,
            row.firstInsertedAt,
            now
        ),
        lastInsertedAt: row.lastInsertedAt,
        recent: series.get(row.elementId) ?? emptySparkline()
    }));
    return c.json(out);
});

/** GET /api/analytics/unused-options/library/:libraryId */
analyticsRoutes.get("/analytics/unused-options" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);

    const parsed = z.coerce
        .number()
        .int()
        .nonnegative()
        .safeParse(c.req.query("threshold"));
    const threshold = parsed.success ? parsed.data : DEFAULT_UNUSED_THRESHOLD;

    const [parts, valueRows] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                name: insertables.name,
                parameters: configurations.parameters
            })
            .from(insertables)
            .innerJoin(configurations, eq(configurations.id, insertables.id))
            .where(
                and(
                    eq(insertables.libraryId, libraryId),
                    eq(insertables.isVisible, true)
                )
            )
            .all(),
        db
            .select({
                elementId: configurationValueStats.elementId,
                parameterId: configurationValueStats.parameterId,
                value: configurationValueStats.value,
                count: configurationValueStats.count
            })
            .from(configurationValueStats)
            .where(eq(configurationValueStats.libraryId, libraryId))
            .all()
    ]);

    const byElement = new Map<string, typeof valueRows>();
    for (const row of valueRows) {
        byElement.set(row.elementId, [
            ...(byElement.get(row.elementId) ?? []),
            row
        ]);
    }

    const out: UnusedOptionOut[] = [];
    for (const part of parts) {
        const usage = buildParameterUsage(
            part.parameters,
            byElement.get(part.elementId) ?? []
        );
        for (const parameter of usage) {
            // Only an enum declares the options it could have been given, so
            // only an enum can have one that was never picked.
            if (parameter.type !== ParameterType.ENUM) continue;
            for (const value of parameter.values) {
                if (value.count > threshold) continue;
                out.push({
                    elementId: part.elementId,
                    partName: part.name,
                    parameterId: parameter.parameterId,
                    parameterName: parameter.name,
                    value: value.value,
                    label: value.label,
                    count: value.count,
                    isDefault: value.isDefault,
                    parameterTotal: parameter.total
                });
            }
        }
    }

    // Never-picked first, then by how much of the parameter went elsewhere:
    // an option skipped on a heavily configured part is the stronger signal.
    out.sort(
        (a, b) =>
            a.count - b.count ||
            b.parameterTotal - a.parameterTotal ||
            a.partName.localeCompare(b.partName)
    );
    return c.json(out);
});

/** GET /api/analytics/insertable/library/:libraryId/element/:elementId */
analyticsRoutes.get(
    "/analytics/insertable" + libraryRoute() + "/element/:elementId",
    async (c) => {
        const libraryId = getLibraryParam(c);
        const elementId = c.req.param("elementId")!;
        const db = getDb(c.env.DB);

        const [
            stats,
            insertable,
            valueRows,
            series,
            uniqueUsers,
            targetRows,
            favoriteCount
        ] = await Promise.all([
            db
                .select()
                .from(insertableStats)
                .where(
                    and(
                        eq(insertableStats.libraryId, libraryId),
                        eq(insertableStats.elementId, elementId)
                    )
                )
                .get(),
            db
                .select({
                    id: insertables.id,
                    name: insertables.name,
                    documentId: insertables.documentId,
                    versionId: insertables.versionId
                })
                .from(insertables)
                .where(
                    and(
                        eq(insertables.libraryId, libraryId),
                        eq(insertables.elementId, elementId)
                    )
                )
                .get(),
            db
                .select()
                .from(configurationValueStats)
                .where(
                    and(
                        eq(configurationValueStats.libraryId, libraryId),
                        eq(configurationValueStats.elementId, elementId)
                    )
                )
                .all(),
            // A single part's trend is narrow enough to read from raw
            // events via events_element_day_idx, so it needs no rollup.
            db
                .select({
                    day: events.day,
                    count: count()
                })
                .from(events)
                .where(
                    and(
                        eq(events.libraryId, libraryId),
                        eq(events.elementId, elementId),
                        eq(events.type, EventType.INSERT)
                    )
                )
                .groupBy(events.day)
                .orderBy(asc(events.day))
                .all(),
            db
                .select({ value: countDistinct(events.userId) })
                .from(events)
                .where(
                    and(
                        eq(events.libraryId, libraryId),
                        eq(events.elementId, elementId),
                        eq(events.type, EventType.INSERT)
                    )
                )
                .get(),
            db
                .select({
                    targetElementType: events.targetElementType,
                    count: count()
                })
                .from(events)
                .where(
                    and(
                        eq(events.libraryId, libraryId),
                        eq(events.elementId, elementId),
                        eq(events.type, EventType.INSERT)
                    )
                )
                .groupBy(events.targetElementType)
                .all(),
            // Favorites are keyed by insertable id, so a part that left
            // the library has none to count.
            db
                .select({ value: count() })
                .from(favorites)
                .innerJoin(
                    insertables,
                    eq(insertables.id, favorites.insertableId)
                )
                .where(
                    and(
                        eq(insertables.libraryId, libraryId),
                        eq(insertables.elementId, elementId)
                    )
                )
                .get()
        ]);

        // The 1:1 configurations table is keyed by insertable id, so the
        // current parameter definitions are only reachable via a live row.
        const parameters = insertable
            ? ((
                  await db
                      .select({ parameters: configurations.parameters })
                      .from(configurations)
                      .where(eq(configurations.id, insertable.id))
                      .get()
              )?.parameters ?? [])
            : [];

        const out: InsertableReportOut = {
            elementId,
            name: insertable?.name ?? null,
            documentId: insertable?.documentId ?? null,
            versionId: insertable?.versionId ?? null,
            insertCount: stats?.insertCount ?? 0,
            usesPerMonth: usesPerMonth(
                stats?.insertCount ?? 0,
                stats?.firstInsertedAt ?? null,
                Date.now()
            ),
            firstInsertedAt: stats?.firstInsertedAt ?? null,
            lastInsertedAt: stats?.lastInsertedAt ?? null,
            uniqueUsers: uniqueUsers?.value ?? 0,
            favorites: favoriteCount?.value ?? 0,
            targets: toTargetSplit(targetRows),
            series,
            parameters: buildParameterUsage(parameters, valueRows)
        };
        return c.json(out);
    }
);

/**
 * Splits inserts by the tab they landed in. A part studio target means the
 * part was derived; an assembly target means it was inserted as an instance.
 */
function toTargetSplit(
    rows: { targetElementType: ElementType | null; count: number }[]
): TargetSplit {
    const split: TargetSplit = { partStudio: 0, assembly: 0 };
    for (const row of rows) {
        if (row.targetElementType === ElementType.PART_STUDIO) {
            split.partStudio += row.count;
        } else if (row.targetElementType === ElementType.ASSEMBLY) {
            split.assembly += row.count;
        }
    }
    return split;
}

/**
 * Merges recorded value counts with the insertable's current parameters, so
 * declared-but-unused enum options still surface and stale parameter ids are
 * kept rather than dropped.
 */
export function buildParameterUsage(
    parameters: ConfigurationParameter[],
    valueRows: { parameterId: string; value: string; count: number }[]
): ConfigurationParameterUsage[] {
    const countsByParameter = new Map<string, Map<string, number>>();
    for (const row of valueRows) {
        const values =
            countsByParameter.get(row.parameterId) ?? new Map<string, number>();
        values.set(row.value, row.count);
        countsByParameter.set(row.parameterId, values);
    }

    const usage: ConfigurationParameterUsage[] = parameters.map((parameter) => {
        const counts =
            countsByParameter.get(parameter.id) ?? new Map<string, number>();
        countsByParameter.delete(parameter.id);

        const values =
            parameter.type === ParameterType.ENUM
                ? // Seed from the declared options so a never-picked one is visible.
                  parameter.options.map((option) => ({
                      value: option.id,
                      label: option.name,
                      count: counts.get(option.id) ?? 0,
                      isDefault: option.id === parameter.default
                  }))
                : toFreeFormValues(counts, parameter.default);

        return {
            parameterId: parameter.id,
            name: parameter.name,
            type: parameter.type,
            defaultValue: parameter.default,
            total: sumCounts(counts),
            values: values.sort((a, b) => b.count - a.count),
            isRetired: false
        };
    });

    // Whatever is left was recorded against a parameter the insertable no
    // longer declares (renamed or removed since).
    for (const [parameterId, counts] of countsByParameter) {
        usage.push({
            parameterId,
            name: parameterId,
            type: "unknown",
            defaultValue: null,
            total: sumCounts(counts),
            values: toFreeFormValues(counts, null).sort(
                (a, b) => b.count - a.count
            ),
            isRetired: true
        });
    }

    return usage;
}

/**
 * Quantity and string parameters have no declared option list and unbounded
 * distinct values, so only the most-used are returned — plus the default, which
 * must stay visible even at zero uses.
 */
function toFreeFormValues(
    counts: Map<string, number>,
    defaultValue: string | null
): ConfigurationValueUsage[] {
    const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_FREE_FORM_VALUES)
        .map(([value, count]) => ({
            value,
            label: value,
            count,
            isDefault: value === defaultValue
        }));

    if (defaultValue !== null && !top.some((entry) => entry.isDefault)) {
        top.push({
            value: defaultValue,
            label: defaultValue,
            count: counts.get(defaultValue) ?? 0,
            isDefault: true
        });
    }
    return top;
}

function sumCounts(counts: Map<string, number>): number {
    let total = 0;
    for (const value of counts.values()) total += value;
    return total;
}

/**
 * Lifetime totals, optionally scoped to one library. Unique users is a count
 * over `user_stats` — globally it must be distinct, since a person active in
 * two libraries has a row in each.
 */
async function getTotals(
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

async function getLibrarySummaries(
    db: Db,
    range: DayRange
): Promise<LibrarySummary[]> {
    return Promise.all(
        Object.values(LibraryId).map(async (libraryId) => ({
            libraryId,
            totals: await getTotals(db, libraryId),
            rangeTotals: await getTotals(db, libraryId, range),
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
async function getMetricSeries(
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

    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Lifetime inserts split by which part of the app they started from. */
async function getSources(
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
async function getSeries(
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
    return [...byDay.values()];
}

/**
 * Hidden insertables are exempt from the build checks, so the health report
 * leaves them out entirely rather than counting them as healthy.
 */
function visibleIn(libraryId: LibraryId) {
    return and(
        eq(insertables.libraryId, libraryId),
        eq(insertables.isVisible, true)
    );
}

/** Selects only what the counts need; names and paths are the item list's cost. */
async function getHealthCounts(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryHealthCounts> {
    const [groups, allInsertables] = await Promise.all([
        db
            .select({
                id: group.id,
                buildIssues: group.buildIssues,
                lastLoadedAt: group.lastLoadedAt
            })
            .from(group)
            .where(eq(group.libraryId, libraryId))
            .all(),
        db
            .select({
                id: insertables.id,
                groupId: insertables.groupId,
                buildIssues: insertables.buildIssues,
                lastLoadedAt: insertables.lastLoadedAt
            })
            .from(insertables)
            .where(visibleIn(libraryId))
            .all()
    ]);

    return summarizeHealth(
        groups,
        allInsertables,
        await getConfigurationIssues(db, libraryId)
    ).counts;
}

/** The full report: counts, per-type totals, and every affected item. */
async function getLibraryHealth(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryHealthOut> {
    const [groups, allInsertables, configurationIssues] = await Promise.all([
        db
            .select({
                id: group.id,
                name: group.name,
                documentId: group.documentId,
                versionId: group.versionId,
                buildIssues: group.buildIssues,
                lastLoadedAt: group.lastLoadedAt
            })
            .from(group)
            .where(eq(group.libraryId, libraryId))
            .all(),
        db
            .select({
                id: insertables.id,
                groupId: insertables.groupId,
                name: insertables.name,
                elementId: insertables.elementId,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                buildIssues: insertables.buildIssues,
                lastLoadedAt: insertables.lastLoadedAt
            })
            .from(insertables)
            .where(visibleIn(libraryId))
            .all(),
        getConfigurationIssues(db, libraryId)
    ]);

    return summarizeHealth(groups, allInsertables, configurationIssues);
}

/**
 * An insertable's configuration issues, joined rather than fetched by id list
 * so the query stays one round trip regardless of library size. `parameters` is
 * deliberately not selected — it is large and unused here.
 */
async function getConfigurationIssues(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, BuildIssue[]>> {
    const rows = await db
        .select({
            id: configurations.id,
            buildIssues: configurations.buildIssues
        })
        .from(configurations)
        .innerJoin(insertables, eq(insertables.id, configurations.id))
        .where(visibleIn(libraryId))
        .all();
    return new Map(rows.map((row) => [row.id, row.buildIssues]));
}

/**
 * A group as the health summary needs it. `name`/paths are optional so the
 * overview can count without paying to fetch them.
 */
export interface HealthGroupRow {
    id: string;
    name?: string;
    documentId?: string;
    versionId?: string;
    buildIssues: BuildIssue[];
    lastLoadedAt: number | null;
}

export interface HealthInsertableRow {
    id: string;
    groupId: string;
    name?: string;
    elementId?: string;
    documentId?: string;
    versionId?: string;
    buildIssues: BuildIssue[];
    lastLoadedAt: number | null;
}

/**
 * Rolls groups and insertables up into the maintainer-facing health report.
 *
 * Every check is stored, so this only reads. The one inherited behaviour is
 * that an insertable's configuration issues count as its own, matching what
 * editors see in the panel. Hidden insertables are filtered out upstream —
 * they are exempt from the checks, so counting them would inflate "healthy".
 */
export function summarizeHealth(
    groups: HealthGroupRow[],
    insertables: HealthInsertableRow[],
    configurationIssues: Map<string, BuildIssue[]>
): LibraryHealthOut {
    const groupNames = new Map(groups.map((row) => [row.id, row.name ?? ""]));

    const items: HealthItem[] = [];
    const counts: LibraryHealthCounts = {
        groupCount: groups.length,
        insertableCount: insertables.length,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        healthyItems: 0,
        neverLoaded: 0
    };
    const issueCounts = new Map<BuildIssueType, number>();

    const record = (
        issues: BuildIssue[],
        lastLoadedAt: number | null,
        toItem: (severity: BuildIssueSeverity) => HealthItem
    ) => {
        if (lastLoadedAt === null) counts.neverLoaded++;

        const severity = getMaxSeverity(issues);
        if (severity === null) {
            counts.healthyItems++;
            return;
        }
        for (const issue of issues) {
            issueCounts.set(issue.type, (issueCounts.get(issue.type) ?? 0) + 1);
            switch (getIssueSeverity(issue)) {
                case BuildIssueSeverity.ERROR:
                    counts.errorCount++;
                    break;
                case BuildIssueSeverity.WARNING:
                    counts.warningCount++;
                    break;
                case BuildIssueSeverity.INFO:
                    counts.infoCount++;
                    break;
            }
        }

        items.push(toItem(severity));
    };

    for (const row of groups) {
        const issues = row.buildIssues;

        record(issues, row.lastLoadedAt, (severity) => ({
            kind: "group",
            id: row.id,
            name: row.name ?? row.id,
            groupName: null,
            documentId: row.documentId ?? "",
            versionId: row.versionId ?? "",
            elementId: null,
            issues: issues.map((issue) => issue.type),
            severity,
            lastLoadedAt: row.lastLoadedAt
        }));
    }

    for (const row of insertables) {
        const issues = [
            ...row.buildIssues,
            ...(configurationIssues.get(row.id) ?? [])
        ];

        record(issues, row.lastLoadedAt, (severity) => ({
            kind: "insertable",
            id: row.id,
            name: row.name ?? row.id,
            groupName: groupNames.get(row.groupId) ?? null,
            documentId: row.documentId ?? "",
            versionId: row.versionId ?? "",
            elementId: row.elementId ?? null,
            issues: issues.map((issue) => issue.type),
            severity,
            lastLoadedAt: row.lastLoadedAt
        }));
    }

    const issues: HealthIssueCount[] = [...issueCounts.entries()]
        .map(([type, count]) => ({
            type,
            description: getIssueDescription({ type }),
            severity: getIssueSeverity({ type }),
            count
        }))
        .sort(
            (a, b) =>
                SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
                b.count - a.count
        );

    // Worst first, so the top of the list is where a maintainer should start.
    items.sort(
        (a, b) =>
            SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
            b.issues.length - a.issues.length ||
            a.name.localeCompare(b.name)
    );

    return { counts, issues, items };
}

const SEVERITY_RANK: Record<BuildIssueSeverity, number> = {
    [BuildIssueSeverity.ERROR]: 2,
    [BuildIssueSeverity.WARNING]: 1,
    [BuildIssueSeverity.INFO]: 0
};
