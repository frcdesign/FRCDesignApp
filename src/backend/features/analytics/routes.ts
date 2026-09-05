import { and, count, countDistinct, eq, gte, lte, sum } from "drizzle-orm";
import z from "zod";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import {
    configurations,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    favorites,
    group,
    insertables,
    insertableStats
} from "../../db/schema";
import type {
    AnalyticsOverviewOut,
    InsertableReportOut,
    LibrarySummaryOut,
    PartUsageOut,
    UnusedOptionOut
} from "./contract";
import { ParameterType } from "../configurations/models";
import { usesPerMonth } from "./measures";
import { getGrowth } from "./growth";
import { toDayKey } from "./tracking";
import { getHealthCounts } from "./health";
import { buildParameterUsage } from "./parameter-usage";
import {
    getConfigurationCounts,
    getPartSparklines,
    getWindowedInsertCounts,
    inWindow,
    toWindowedPart
} from "./part-queries";
import {
    getLibrarySummaries,
    getMetricSeries,
    getSeries,
    getSources,
    getTotals
} from "./metric-queries";
import { clampRange, getRange, getTrackingSince } from "./range";

export const analyticsRoutes = getApp();

/**
 * Every read handler here is deliberately public: the dashboard lives outside
 * the Onshape panel with no OAuth, and in this app an endpoint is public
 * exactly by never touching `c.var.getUserId()` / `c.var.getOnshapeApi()`.
 * Only aggregates are returned — never a user id.
 */

const DEFAULT_UNUSED_THRESHOLD = 5;

/** GET /api/analytics/overview */
analyticsRoutes.get("/analytics/overview", async (c) => {
    const db = getDb(c.env.DB);
    const requested = getRange(c);
    const trackingSince = await getTrackingSince(db);
    // Series are densified, so they read the clamped range; the totals still
    // read what was asked for, where extra empty days cost nothing.
    const range = clampRange(requested, trackingSince);

    const [totals, perLibrary, series, metricSeries, sources, growth] =
        await Promise.all([
            getTotals(db),
            getLibrarySummaries(db),
            getSeries(db, range),
            getMetricSeries(db, range),
            getSources(db, requested),
            getGrowth(db, toDayKey(Date.now()), trackingSince)
        ]);

    const out: AnalyticsOverviewOut = {
        totals,
        libraries: perLibrary,
        series,
        metricSeries,
        sources,
        trackingSince,
        growth,
        ...requested
    };
    return c.json(out);
});

/** GET /api/analytics/summary/library/:libraryId */
analyticsRoutes.get("/analytics/summary" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const requested = getRange(c);
    const trackingSince = await getTrackingSince(db);
    const range = clampRange(requested, trackingSince);

    const [totals, metricSeries, growth] = await Promise.all([
        getTotals(db, libraryId),
        getMetricSeries(db, range, libraryId),
        getGrowth(db, toDayKey(Date.now()), trackingSince, libraryId)
    ]);

    const out: LibrarySummaryOut = {
        totals,
        metricSeries,
        growth,
        trackingSince,
        ...requested
    };
    return c.json(out);
});

/** GET /api/analytics/health/library/:libraryId */
analyticsRoutes.get("/analytics/health" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getHealthCounts(db, libraryId));
});

/** GET /api/analytics/parts/library/:libraryId */
analyticsRoutes.get("/analytics/parts" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const range = getRange(c);

    // Driven off the library rather than the stats table, so a part nobody has
    // used is still listed (at zero) and a part that has left the library is
    // not listed at all — its usage is history about something you can no
    // longer open, which only pads the table.
    const [rows, series, windowed] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                firstInsertedAt: insertableStats.firstInsertedAt,
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
        getPartSparklines(db, libraryId),
        getWindowedInsertCounts(db, libraryId, range)
    ]);

    const out: PartUsageOut[] = rows
        .map((row) => toWindowedPart(row, windowed, series, range))
        // Most used first; unused parts fall to the bottom in name order.
        .sort(
            (a, b) =>
                b.usesPerMonth - a.usesPerMonth || a.name.localeCompare(b.name)
        );
    return c.json(out);
});

/** GET /api/analytics/unused/library/:libraryId */
analyticsRoutes.get("/analytics/unused" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const range = getRange(c);

    const parsed = z.coerce
        .number()
        .int()
        .nonnegative()
        .safeParse(c.req.query("threshold"));
    const threshold = parsed.success ? parsed.data : DEFAULT_UNUSED_THRESHOLD;

    // Drives off insertables (not the stats table) so parts with no events at
    // all — the ones that matter most here — are included.
    const [rows, series, windowed] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                insertableId: insertables.id,
                name: insertables.name,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                groupName: group.name,
                isVisible: insertables.isVisible,
                firstInsertedAt: insertableStats.firstInsertedAt
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
                    eq(insertables.isVisible, true)
                )
            )
            .all(),
        getPartSparklines(db, libraryId),
        getWindowedInsertCounts(db, libraryId, range)
    ]);

    const out: PartUsageOut[] = rows
        .map((row) => toWindowedPart(row, windowed, series, range))
        // Least used first: the point of the page is the bottom of the list.
        .filter((part) => part.insertCount <= threshold)
        .sort(
            (a, b) =>
                a.insertCount - b.insertCount || a.name.localeCompare(b.name)
        );
    return c.json(out);
});

/** GET /api/analytics/unused-options/library/:libraryId */
analyticsRoutes.get("/analytics/unused-options" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    const range = getRange(c);

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
        getConfigurationCounts(db, libraryId, range)
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
        const range = getRange(c);

        const [
            stats,
            insertable,
            valueRows,
            uniqueUsers,
            totals,
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
            getConfigurationCounts(db, libraryId, range, elementId),
            db
                .select({ value: countDistinct(dailyInsertableUsers.userId) })
                .from(dailyInsertableUsers)
                .where(
                    and(
                        eq(dailyInsertableUsers.libraryId, libraryId),
                        eq(dailyInsertableUsers.elementId, elementId),
                        gte(dailyInsertableUsers.day, range.from),
                        lte(dailyInsertableUsers.day, range.to)
                    )
                )
                .get(),
            db
                .select({
                    inserts: sum(dailyInsertableMetrics.count),
                    partStudio: sum(dailyInsertableMetrics.partStudioCount),
                    assembly: sum(dailyInsertableMetrics.assemblyCount)
                })
                .from(dailyInsertableMetrics)
                .where(
                    and(
                        inWindow(libraryId, range),
                        eq(dailyInsertableMetrics.elementId, elementId)
                    )
                )
                .get(),
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

        const insertCount = Number(totals?.inserts ?? 0);
        // Rated over the days the part has existed inside the window, as the
        // parts table rates it.
        const windowStart = Date.parse(`${range.from}T00:00:00Z`);
        const windowEnd = Math.min(
            Date.now(),
            Date.parse(`${range.to}T23:59:59Z`)
        );
        const firstUsed = Math.max(
            stats?.firstInsertedAt ?? windowStart,
            windowStart
        );

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
            insertCount,
            usesPerMonth: usesPerMonth(
                insertCount,
                insertCount === 0 ? null : firstUsed,
                windowEnd
            ),
            firstInsertedAt: stats?.firstInsertedAt ?? null,
            uniqueUsers: uniqueUsers?.value ?? 0,
            favorites: favoriteCount?.value ?? 0,
            targets: {
                partStudio: Number(totals?.partStudio ?? 0),
                assembly: Number(totals?.assembly ?? 0)
            },
            parameters: buildParameterUsage(parameters, valueRows)
        };
        return c.json(out);
    }
);
